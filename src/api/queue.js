// Request queue: concurrency limit, sliding-window rate limit, retry with backoff.
// One instance is shared by the whole app (see client.js).
import { ApiError } from './errors.js';

const PRIORITY = { high: 0, normal: 1, low: 2 };

export class RequestQueue {
  constructor({ concurrency = 3, maxPerWindow = 20, windowMs = 10_000, maxRetries = 3 } = {}) {
    this.concurrency = concurrency;
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
    this.maxRetries = maxRetries;
    this.jobs = [];
    this.inFlight = 0;
    this.startTimes = [];
    this.pausedUntil = 0;
    this.seq = 0;
    this.timer = null;
    this.listeners = new Set();
  }

  state() {
    return { queued: this.jobs.length, inFlight: this.inFlight, pausedUntil: this.pausedUntil };
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    const s = this.state();
    this.listeners.forEach((fn) => fn(s));
  }

  /** fn receives an AbortSignal and returns a promise. */
  enqueue(fn, { priority = 'normal', signal, label = '' } = {}) {
    return new Promise((resolve, reject) => {
      const job = {
        fn, resolve, reject, label,
        priority: PRIORITY[priority] ?? 1,
        seq: this.seq++,
        attempts: 0,
        signal,
        controller: new AbortController(),
      };
      if (signal) {
        if (signal.aborted) return reject(new ApiError('aborted', 'Cancelled'));
        signal.addEventListener('abort', () => {
          const idx = this.jobs.indexOf(job);
          if (idx >= 0) {
            this.jobs.splice(idx, 1);
            job.reject(new ApiError('aborted', 'Cancelled'));
            this._emit();
          }
        }, { once: true });
      }
      this._insert(job);
      this._pump();
    });
  }

  _insert(job) {
    let i = this.jobs.length;
    while (i > 0) {
      const j = this.jobs[i - 1];
      if (j.priority < job.priority || (j.priority === job.priority && j.seq <= job.seq)) break;
      i--;
    }
    this.jobs.splice(i, 0, job);
    this._emit();
  }

  pause(ms) {
    const until = Date.now() + ms;
    if (until > this.pausedUntil) this.pausedUntil = until;
    this._emit();
    this._schedule(ms);
  }

  cancelQueued(predicate = () => true) {
    const keep = [];
    for (const job of this.jobs) {
      if (predicate(job)) job.reject(new ApiError('aborted', 'Cancelled'));
      else keep.push(job);
    }
    this.jobs = keep;
    this._emit();
  }

  _schedule(ms) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this._pump(); }, Math.max(0, ms));
  }

  _windowWait() {
    const now = Date.now();
    this.startTimes = this.startTimes.filter((t) => t > now - this.windowMs);
    if (this.startTimes.length < this.maxPerWindow) return 0;
    return this.startTimes[0] + this.windowMs - now + 1;
  }

  _pump() {
    while (this.inFlight < this.concurrency && this.jobs.length) {
      const now = Date.now();
      if (this.pausedUntil > now) { this._schedule(this.pausedUntil - now); return; }
      const wait = this._windowWait();
      if (wait > 0) { this._schedule(wait); return; }
      const job = this.jobs.shift();
      this._run(job);
    }
    this._emit();
  }

  async _run(job) {
    this.inFlight++;
    this.startTimes.push(Date.now());
    job.attempts++;
    this._emit();
    try {
      const result = await job.fn(job.controller.signal);
      job.resolve(result);
    } catch (err) {
      this._handleError(job, err);
    } finally {
      this.inFlight--;
      this._pump();
    }
  }

  _handleError(job, err) {
    const kind = err?.kind;
    if (kind === 'rate') {
      const secs = Math.min(60, Math.max(3, Number(err.retryAfter) || 3));
      this.pause(secs * 1000);
      job.priority = 0;
      this._insert(job);
      return;
    }
    if ((kind === 'server' || kind === 'network') && job.attempts <= this.maxRetries) {
      const delay = 2000 * 2 ** (job.attempts - 1);
      setTimeout(() => { this._insert(job); this._pump(); }, delay);
      return;
    }
    job.reject(err);
  }
}
