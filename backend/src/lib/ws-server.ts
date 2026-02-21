import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { tracker, type SwapRecord } from './pool-tracker.js';
import { log } from './log.js';

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
    log('ws', `Client connected (${clients.size} total)`);

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
            await tracker.track(pool);
          }
          ws.send(JSON.stringify({ type: 'subscribed', pools: Array.from(state.pools) }));
          log('ws', `Client subscribed to [${Array.from(state.pools).join(', ')}]`);
        }

        if (msg.type === 'unsubscribe' && Array.isArray(msg.pools)) {
          for (const pool of msg.pools) {
            state.pools.delete(pool);
          }
          ws.send(JSON.stringify({ type: 'unsubscribed', pools: msg.pools }));
          log('ws', `Client unsubscribed from [${msg.pools.join(', ')}]`);
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
      log('ws', `Client disconnected (${clients.size} total)`);
    });
  });

  tracker.on('swap', (swap: SwapRecord) => {
    const msg = JSON.stringify({ type: 'swap', ...swap });
    for (const [ws, state] of clients) {
      if (state.pools.has(swap.pool) && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
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
