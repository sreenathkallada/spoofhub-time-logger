import { ApiError } from './errors.js';
import { RequestQueue } from './queue.js';

// The SpoofHub address is entered by the user at sign-in (see store/settings.js); nothing is hard-coded here.
export const queue = new RequestQueue();

/**
 * Detect SpoofHub's "HTTP 200 but actually an error" bodies:
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

function hostOf(baseUrl) {
  try { return new URL(baseUrl).host; } catch { return ''; }
}

function buildUrl(baseUrl, path, query) {
  const url = new URL(path.replace(/^\//, ''), baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/** Low-level request. Goes through the shared queue. Browsers set User-Agent themselves. */
export function request(method, path, { baseUrl, apiKey, body, query, priority = 'normal', signal, label, retries } = {}) {
  if (!baseUrl) return Promise.reject(new ApiError('client', 'No SpoofHub address'));
  if (!apiKey) return Promise.reject(new ApiError('auth', 'No API key'));
  return queue.enqueue(async (abortSignal) => {
    let res;
    try {
      res = await fetch(buildUrl(baseUrl, path, query), {
        method,
        headers: {
          'X-API-KEY': apiKey,
          'X-Comp-Url': hostOf(baseUrl), // required by /workflows; harmless elsewhere
          Accept: 'application/json',
          // The server rejects DELETE with "INCOMPLETE HEADERS" (code 1201) unless Content-Type is present, so send it on every non-GET request.
          ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
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
  }, { priority, signal, label: label || `${method} ${path}`, retries });
}
