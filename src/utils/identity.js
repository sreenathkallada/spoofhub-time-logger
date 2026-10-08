import { addDaysISO, todayISO } from './time.js';

/**
 * Work out whether the API key in use belongs to `candidateId`, from data the API marks with `by_me`
 * (time entries and tasks created by the key's owner).
 * Returns { status: 'match' | 'mismatch' | 'unknown', ownerId?, evidence }.
 */
export async function verifyKeyOwner(api, candidateId, { days = 365 } = {}) {
  const cid = String(candidateId);
  const to = addDaysISO(todayISO(), 1), from = addDaysISO(todayISO(), -days);

  // 1. The candidate's own time entries: by_me must be true on all of them.
  try {
    const mine = await api.getMyTime({ userId: candidateId, from, to }, { retries: 1 });
    const own = (mine || []).filter((e) => String(e?.creator?.id || '') === cid);
    if (own.some((e) => e.by_me === false)) return { status: 'mismatch', evidence: 'time entries of this user are not marked as yours' };
    if (own.some((e) => e.by_me === true)) return { status: 'match', ownerId: cid, evidence: 'time entries' };
  } catch { /* fall through */ }

  // 2. Tasks: creator vs by_me gives the owner directly.
  try {
    const tasks = await api.getOpenTasks({}, { retries: 1 });
    const owners = new Set((tasks || []).filter((t) => t.by_me && t.creator?.id).map((t) => String(t.creator.id)));
    if (owners.size && !owners.has(cid)) return { status: 'mismatch', ownerId: [...owners][0], evidence: 'tasks' };
    if (owners.has(cid)) return { status: 'match', ownerId: cid, evidence: 'tasks' };
    if ((tasks || []).some((t) => String(t.creator?.id || '') === cid && t.by_me === false)) return { status: 'mismatch', evidence: 'tasks created by this user are not marked as yours' };
  } catch { /* fall through */ }

  return { status: 'unknown' };
}
