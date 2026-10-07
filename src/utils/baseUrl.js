/**
 * Turn whatever the user typed into a ProofHub API base URL:
 *   "projects.sblcorp.com"                  -> https://projects.sblcorp.com/api/v3/
 *   "https://projects.sblcorp.com/"         -> https://projects.sblcorp.com/api/v3/
 *   "https://projects.sblcorp.com/api/v3"   -> https://projects.sblcorp.com/api/v3/
 *   "http://localhost:8787"                 -> http://localhost:8787/api/v3/
 * Returns { url } or { error }.
 */
export function normaliseBaseUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) return { error: 'Enter your ProofHub address' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try { u = new URL(raw); } catch { return { error: 'That doesn\'t look like a valid address' }; }
  if (!/^https?:$/.test(u.protocol)) return { error: 'The address must start with http:// or https://' };
  if (!u.hostname) return { error: 'The address needs a host name' };
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(u.hostname) && !/^\[[0-9a-f:.]+\]$/i.test(u.hostname)) {
    return { error: 'That doesn\'t look like a valid address' };
  }
  let path = u.pathname.replace(/\/+$/, '');
  path = path.replace(/\/api\/v3$/i, '').replace(/\/api$/i, '');
  const url = `${u.protocol}//${u.host}${path}/api/v3/`;
  return { url, host: u.host };
}

export function hostOf(baseUrl) {
  try { return new URL(baseUrl).host; } catch { return baseUrl || ''; }
}
