import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestQueue } from '../src/api/queue.js';
import { ApiError } from '../src/api/errors.js';

const tick = async (ms) => { await vi.advanceTimersByTimeAsync(ms); };

describe('RequestQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('limits concurrency', async () => {
    const q = new RequestQueue({ concurrency: 2, maxPerWindow: 100 });
    let running = 0, peak = 0;
    const job = () => async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 10)); running--; };
    const ps = [1, 2, 3, 4, 5].map(() => q.enqueue(job()));
    await tick(100);
    await Promise.all(ps);
    expect(peak).toBe(2);
  });

  it('enforces the sliding window', async () => {
    const q = new RequestQueue({ concurrency: 10, maxPerWindow: 3, windowMs: 1000 });
    const starts = [];
    const ps = Array.from({ length: 6 }, () => q.enqueue(async () => { starts.push(Date.now()); }));
    await tick(0);
    expect(starts.length).toBe(3);
    await tick(999);
    expect(starts.length).toBe(3);
    await tick(10);
    expect(starts.length).toBe(6);
    await Promise.all(ps);
  });

  it('pauses on 429 and retries the job', async () => {
    const q = new RequestQueue({ concurrency: 1, maxPerWindow: 100 });
    let calls = 0;
    const p = q.enqueue(async () => {
      calls++;
      if (calls === 1) throw new ApiError('rate', 'slow down', { retryAfter: 5 });
      return 'ok';
    });
    await tick(0);
    expect(calls).toBe(1);
    expect(q.state().pausedUntil).toBeGreaterThan(Date.now());
    await tick(4000);
    expect(calls).toBe(1);
    await tick(1100);
    expect(await p).toBe('ok');
    expect(calls).toBe(2);
  });

  it('retries server errors with backoff then gives up', async () => {
    const q = new RequestQueue({ concurrency: 1, maxPerWindow: 100, maxRetries: 3 });
    let calls = 0;
    const p = q.enqueue(async () => { calls++; throw new ApiError('server', 'boom'); });
    const settled = p.catch((e) => e);
    await tick(0);
    expect(calls).toBe(1);
    await tick(2000); expect(calls).toBe(2);
    await tick(4000); expect(calls).toBe(3);
    await tick(8000); expect(calls).toBe(4);
    const err = await settled;
    expect(err.kind).toBe('server');
    await tick(20000);
    expect(calls).toBe(4);
  });

  it('does not retry client or auth errors', async () => {
    const q = new RequestQueue({ concurrency: 1, maxPerWindow: 100 });
    let calls = 0;
    const p = q.enqueue(async () => { calls++; throw new ApiError('auth', 'no'); }).catch((e) => e);
    await tick(0);
    expect((await p).kind).toBe('auth');
    await tick(10000);
    expect(calls).toBe(1);
  });

  it('runs high priority before normal', async () => {
    const q = new RequestQueue({ concurrency: 1, maxPerWindow: 100 });
    const order = [];
    const slow = q.enqueue(async () => { await new Promise((r) => setTimeout(r, 5)); order.push('first'); });
    const n = q.enqueue(async () => { order.push('normal'); }, { priority: 'normal' });
    const h = q.enqueue(async () => { order.push('high'); }, { priority: 'high' });
    await tick(50);
    await Promise.all([slow, n, h]);
    expect(order).toEqual(['first', 'high', 'normal']);
  });

  it('cancels queued jobs via signal', async () => {
    const q = new RequestQueue({ concurrency: 1, maxPerWindow: 100 });
    const ac = new AbortController();
    const blocker = q.enqueue(async () => { await new Promise((r) => setTimeout(r, 50)); });
    const p = q.enqueue(async () => 'ran', { signal: ac.signal }).catch((e) => e);
    ac.abort();
    await tick(100);
    await blocker;
    expect((await p).kind).toBe('aborted');
  });
});
