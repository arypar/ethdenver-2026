type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
const minRank = LEVEL_RANK[currentLevel] ?? 1;

function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function logDebug(tag: string, msg: string) {
  if (minRank > LEVEL_RANK.debug) return;
  console.log(`\x1b[90m${ts()} [${tag}] ${msg}\x1b[0m`);
}

export function log(tag: string, msg: string) {
  if (minRank > LEVEL_RANK.info) return;
  console.log(`\x1b[90m${ts()}\x1b[0m \x1b[36m[${tag}]\x1b[0m ${msg}`);
}

export function logWarn(tag: string, msg: string) {
  if (minRank > LEVEL_RANK.warn) return;
  console.log(`\x1b[90m${ts()}\x1b[0m \x1b[33m[${tag}]\x1b[0m ${msg}`);
}

export function logError(tag: string, msg: string) {
  console.error(`\x1b[90m${ts()}\x1b[0m \x1b[31m[${tag}]\x1b[0m ${msg}`);
}
