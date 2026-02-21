import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { tracker, type SwapRecord } from './pool-tracker.js';
import { monadTracker, type MonadSwapRecord } from './monad-tracker.js';
import { log, logDebug } from './log.js';

interface ClientState {
  pools: Set<string>;
  alive: boolean;
}

const clients = new Map<WebSocket, ClientState>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const state: ClientState = { pools: new Set(), alive: true };
    clients.set(ws, state);
    logDebug('ws', `Client connected (${clients.size} total)`);

    ws.send(JSON.stringify({
      type: 'connected',
      trackedPools: tracker.trackedPools(),
    }));

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'subscribe' && Array.isArray(msg.pools)) {
          for (const pool of msg.pools) {
            state.pools.add(pool);
            if (pool.startsWith('0x') && pool.length === 42) {
              await monadTracker.track(pool);
            } else {
              await tracker.track(pool);
            }
          }
          ws.send(JSON.stringify({ type: 'subscribed', pools: Array.from(state.pools) }));
          logDebug('ws', `Client subscribed to [${Array.from(state.pools).join(', ')}]`);
        }

        if (msg.type === 'unsubscribe' && Array.isArray(msg.pools)) {
          for (const pool of msg.pools) {
            state.pools.delete(pool);
          }
          ws.send(JSON.stringify({ type: 'unsubscribed', pools: msg.pools }));
          logDebug('ws', `Client unsubscribed from [${msg.pools.join(', ')}]`);
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('pong', () => {
      state.alive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
      logDebug('ws', `Client disconnected (${clients.size} total)`);
    });
  });

  tracker.on('swap', (swap: SwapRecord) => {
    const msg = JSON.stringify({ type: 'swap', ...swap });
    let sent = 0;
    for (const [ws, state] of clients) {
      if (state.pools.has(swap.pool) && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
        sent++;
      }
    }
    if (sent > 0) {
      logDebug('ws', `Broadcast swap ${swap.pool} $${swap.price.toLocaleString()} → ${sent} client(s)`);
    }
  });

  monadTracker.on('swap', (swap: MonadSwapRecord) => {
    const normalized = {
      type: 'swap',
      pool: swap.token,
      price: swap.price,
      volumeUSD: swap.volumeMON,
      feeUSD: 0,
      txHash: swap.txHash,
      blockNumber: swap.blockNumber,
      timestamp: swap.timestamp,
    };
    const msg = JSON.stringify(normalized);
    let sent = 0;
    for (const [ws, state] of clients) {
      if (state.pools.has(swap.token) && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
        sent++;
      }
    }
    if (sent > 0) {
      logDebug('ws', `Broadcast monad swap ${swap.token.slice(0, 10)}... → ${sent} client(s)`);
    }
  });

  const heartbeat = setInterval(() => {
    for (const [ws, state] of clients) {
      if (!state.alive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      state.alive = false;
      ws.ping();
    }
  }, 30_000);

  wss.on('close', () => clearInterval(heartbeat));

  log('ws', 'WebSocket server ready on /ws');
}

export function broadcastStreamTx(chain: string, tx: Record<string, unknown>) {
  const msg = JSON.stringify({ type: 'stream_tx', chain, ...tx });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function broadcastLiquidityEvent(chain: string, event: Record<string, unknown>) {
  const msg = JSON.stringify({ type: 'liquidity_event', chain, ...event });
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

/** @deprecated Use broadcastStreamTx('monad', tx) instead */
export function broadcastMonadTx(tx: Record<string, unknown>) {
  broadcastStreamTx('monad', tx);
}
