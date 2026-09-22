export function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'u' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
