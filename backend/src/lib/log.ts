function ts() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function log(tag: string, msg: string) {
  console.log(`\x1b[90m${ts()}\x1b[0m \x1b[36m[${tag}]\x1b[0m ${msg}`);
}

export function logError(tag: string, msg: string) {
  console.error(`\x1b[90m${ts()}\x1b[0m \x1b[31m[${tag}]\x1b[0m ${msg}`);
}
