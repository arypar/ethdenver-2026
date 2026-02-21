'use client';

type SwapHandler = (swap: any) => void;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws';
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

class WsClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<SwapHandler>>();
  private subscribedPools = new Set<string>();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionListeners = new Set<(connected: boolean) => void>();
  private _connected = false;

  get connected() {
    return this._connected;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setConnected(true);

      if (this.subscribedPools.size > 0) {
        this.ws?.send(JSON.stringify({
          type: 'subscribe',
          pools: Array.from(this.subscribedPools),
        }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'swap') {
          const handlers = this.subscriptions.get(data.pool);
          if (handlers) {
            for (const handler of handlers) {
              handler(data);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.setConnected(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  subscribe(pool: string, handler: SwapHandler): () => void {
    if (!this.subscriptions.has(pool)) {
      this.subscriptions.set(pool, new Set());
    }
    this.subscriptions.get(pool)!.add(handler);

    const isNew = !this.subscribedPools.has(pool);
    this.subscribedPools.add(pool);

    this.connect();

    if (isNew && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', pools: [pool] }));
    }

    return () => {
      const handlers = this.subscriptions.get(pool);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(pool);
          this.subscribedPools.delete(pool);
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'unsubscribe', pools: [pool] }));
          }
        }
      }
    };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this._connected);
    return () => { this.connectionListeners.delete(listener); };
  }

  private setConnected(value: boolean) {
    this._connected = value;
    for (const listener of this.connectionListeners) {
      listener(value);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const wsClient = new WsClient();
