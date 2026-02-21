import 'dotenv/config';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import quoteRouter from './routes/quote.js';
import swapRouter from './routes/swap.js';
import checkApprovalRouter from './routes/check-approval.js';
import poolDataRouter from './routes/pool-data.js';
import chartDataRouter from './routes/chart-data.js';
import resolvePoolRouter from './routes/resolve-pool.js';
import chartsRouter from './routes/charts.js';
import testRouter from './routes/test.js';
import { tracker } from './lib/pool-tracker.js';
import { setupWebSocket } from './lib/ws-server.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true }));
app.use(express.json());

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

app.use((req, res, next) => {
  const start = Date.now();
  const { method, url } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '\x1b[31m' : '\x1b[32m';
    console.log(`\x1b[90m${ts()}\x1b[0m ${color}${method} ${url} ${status}\x1b[0m ${ms}ms`);
  });

  next();
});

app.use('/uniswap', quoteRouter);
app.use('/uniswap', swapRouter);
app.use('/uniswap', checkApprovalRouter);
app.use('/uniswap', poolDataRouter);
app.use('/uniswap', chartDataRouter);
app.use('/uniswap', resolvePoolRouter);
app.use('/api', chartsRouter);
app.use('/', testRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), trackedPools: tracker.trackedPools() });
});

const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`\x1b[36mBackend running on http://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[36mWebSocket available at ws://localhost:${PORT}/ws\x1b[0m`);
  tracker.start();
});
