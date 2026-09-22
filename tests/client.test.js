import { describe, it, expect } from 'vitest';
import { detectErrorBody, normaliseResponse } from '../src/api/client.js';

const H = (map = {}) => ({ get: (k) => map[k] ?? null });

describe('error normalisation', () => {
  it('maps 429 with Retry-After', () => {
    const e = normaliseResponse(429, H({ 'Retry-After': '7' }), null, false);
    expect(e.kind).toBe('rate'); expect(e.retryAfter).toBe(7);
  });
  it('maps 5xx to server', () => { expect(normaliseResponse(503, H(), null, false).kind).toBe('server'); });
  it('maps 403 to auth', () => { expect(normaliseResponse(403, H(), null, false).kind).toBe('auth'); });
  it('maps 415 to client', () => { expect(normaliseResponse(415, H(), null, false).kind).toBe('client'); });
  it('detects wrong access token body (1001) as auth', () => {
    const e = detectErrorBody({ success: false, status: false, code: 1001, message: 'WRONG ACCESS TOKEN' });
    expect(e.kind).toBe('auth');
  });
  it('detects 1301 invalid request as client', () => {
    const e = detectErrorBody({ code: 1301, message: 'Invalid request', response_code: 200 });
    expect(e.kind).toBe('client'); expect(e.code).toBe(1301);
  });
  it('detects 2033 custom field mismatch', () => {
    expect(detectErrorBody({ code: 2033, message: 'Value of the custom field does not match its type.' }).kind).toBe('client');
  });
  it('passes real data through', () => {
    expect(detectErrorBody([{ id: 1 }])).toBeNull();
    expect(detectErrorBody({ id: 9811882231, first_name: 'S' })).toBeNull();
    expect(detectErrorBody({ id: 5, status: 'billable', code: 7 })).toBeNull();
    expect(normaliseResponse(200, H(), [{ id: 1 }], false)).toBeNull();
  });
  it('flags unparseable 200', () => { expect(normaliseResponse(200, H(), null, true).kind).toBe('parse'); });
});
