export class ApiError extends Error {
  /** kind: 'auth' | 'rate' | 'server' | 'network' | 'client' | 'api' | 'notfound' | 'aborted' | 'parse' */
  constructor(kind, message, extra = {}) {
    super(message || kind);
    this.name = 'ApiError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

export function friendlyError(err) {
  if (!err) return 'Unknown error';
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'auth': return 'API key rejected. Check Settings.';
      case 'rate': return 'Rate limit hit. Retrying…';
      case 'server': return 'ProofHub server error. Try again shortly.';
      case 'network': return 'Network error. Check your connection.';
      case 'notfound': return 'This item no longer exists in ProofHub.';
      case 'aborted': return 'Cancelled';
      default: return err.message || 'Request failed';
    }
  }
  return err.message || String(err);
}
