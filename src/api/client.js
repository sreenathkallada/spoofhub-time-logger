import { ApiError } from './errors.js';
import { RequestQueue } from './queue.js';

// Override with VITE_API_BASE in a .env file if the company URL ever changes.
export const BASE_URL = (import.meta.env && import.meta.env.VITE_API_BASE) || 'https://projects.sblcorp.com/api/v3/';
export const queue = new RequestQueue();

/**
 * Detect ProofHub's "HTTP 200 but actually an error" bodies:
 *   {"success":false,"status":false,"code":1001,"message":"WRONG ACCESS TOKEN"}
 *   {"code":1301,"message":"Invalid request","response_code":200}
 *   {"code":2033,"message":"Value of the custom field does not match its type."}
 */
export function detectErrorBody(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const isErrorish =
    json.success === false ||
    json.status === false ||
    (typeof json.code === 'number' && typeof json.message === 'string' && !('id' in json));
  if (!isErrorish) return null;
  const code = json.code;
  const message = json.message || 'Request failed';
  let kind = 'api';
  if (code === 1001 || /access token|api key|session expired/i.test(message)) kind = 'auth';
  else if (code === 1301 || code === 2033) kind = 'client';
  return new ApiError(kind, message, { code, body: json });
}

export function normaliseResponse(status, headers, json, parseFailed) {
  if (status === 429) {
    return new ApiError('rate', 'Too many requests', { status, retryAfter: Number(headers?.get?.('Retry-After')) || 3 });
  }
  if (status >= 500) return new ApiError('server', `Server error ${status}`, { status });
  if (status === 401 || status === 403) return new ApiError('auth', 'Access denied', { status, body: json });
  if (status === 404) return new ApiError('notfound', 'Not found', { status });
  if (status >= 400) return new ApiError('client', json?.message || `Request failed (${status})`, { status, code: json?.code, body: json });
  if (parseFailed) return new ApiError('parse', 'Unreadable response', { status });
  return detectErrorBody(json);
}

function buildUrl(path, query) {
  const url = new URL(path.replace(/^\//, ''), BASE_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Low-level request. Goes through the shared queue. Browsers set User-Agent themselves. */
export function request(method, path, { apiKey, body, query, priority = 'normal', signal, label } = {}) {
  if (!apiKey) return Promise.reject(new ApiError('auth', 'No API key'));
  return queue.enqueue(async (abortSignal) => {
    let res;
    try {
      res = await fetch(buildUrl(path, query), {
        method,
        headers: {
          'X-API-KEY': apiKey,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortSignal,
        cache: 'no-store',
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw new ApiError('aborted', 'Cancelled');
      throw new ApiError('network', e.message);
    }
    let json = null;
    let parseFailed = false;
    if (res.status !== 204) {
      const text = await res.text();
      if (text.trim()) {
        try { json = JSON.parse(text); } catch { parseFailed = true; }
      }
    }
    const err = normaliseResponse(res.status, res.headers, json, parseFailed);
    if (err) throw err;
    return json;
  }, { priority, signal, label: label || `${method} ${path}` });
}
