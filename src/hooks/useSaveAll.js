import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './useApi.js';
import { useDrafts } from '../store/drafts.js';
import { queue } from '../api/client.js';
import { friendlyError } from '../api/errors.js';
import { isValidEntry, toMinutes } from '../utils/time.js';

const LOCK_KEY = 'phtl.saving';
const LOCK_TTL = 90_000;

function otherTabSaving() {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return false;
    const { tab, at } = JSON.parse(raw);
    return tab !== TAB_ID && Date.now() - at < LOCK_TTL;
  } catch { return false; }
}
const TAB_ID = Math.random().toString(36).slice(2);
const setLock = (on) => { try { on ? localStorage.setItem(LOCK_KEY, JSON.stringify({ tab: TAB_ID, at: Date.now() })) : localStorage.removeItem(LOCK_KEY); } catch {} };

/** Summarise pending drafts for the SaveBar. */
export function usePendingSummary() {
  const drafts = useDrafts((s) => s.drafts);
  let creates = 0, edits = 0, deletes = 0, minutes = 0, failed = 0, invalid = 0;
  const taskIds = new Set();
  for (const [taskId, d] of Object.entries(drafts)) {
    let touched = false;
    for (const r of d.newEntries) {
      if (r.state === 'saved') continue;
      if (r.state === 'failed') failed++;
      if (isValidEntry(r)) { creates++; minutes += toMinutes(r.hours, r.mins); touched = true; }
      else if (r.hours !== '' || r.mins !== '' || r.description) { invalid++; touched = true; }
    }
    for (const v of Object.values(d.editedEntries)) { if (v.state === 'failed') failed++; edits++; touched = true; }
    for (const v of d.deletedEntries) { if (v.state === 'failed') failed++; deletes++; touched = true; }
    if (touched) taskIds.add(taskId);
  }
  return { creates, edits, deletes, minutes, failed, invalid, tasks: taskIds.size, total: creates + edits + deletes };
}

export function useSaveAll(onDone) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [qstate, setQstate] = useState(queue.state());
  const [lockedByOther, setLockedByOther] = useState(otherTabSaving());
  const abortRef = useRef(null);

  useEffect(() => queue.subscribe(setQstate), []);
  useEffect(() => {
    const onStorage = () => setLockedByOther(otherTabSaving());
    window.addEventListener('storage', onStorage);
    const t = setInterval(onStorage, 5000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(t); };
  }, []);

  const saveAll = useCallback(async () => {
    if (running) return;
    if (otherTabSaving()) { setLockedByOther(true); return; }
    const store = useDrafts.getState();
    const jobs = [];
    const ac = new AbortController();
    abortRef.current = ac;

    for (const [taskId, d] of Object.entries(store.drafts)) {
      const { projectId } = d.meta || {};
      const listId = Number(d.meta?.listId) || d.meta?.listId;
      const taskIdNum = Number(taskId) || taskId;
      if (!projectId) continue;
      const opts = () => ({ signal: ac.signal, priority: 'normal' });
      // deletions first
      for (const del of d.deletedEntries) {
        if (del.state === 'saved') continue;
        jobs.push({ taskId, kind: 'delete', id: del.id, run: () => api.deleteTime(projectId, del.timesheetId, del.id, opts()) });
      }
      // edits
      for (const [entryId, ed] of Object.entries(d.editedEntries)) {
        if (ed.state === 'saved') continue;
        const body = { date: ed.date, logged_hours: Number(ed.hours) || 0, logged_mins: Number(ed.mins) || 0, status: ed.status, description: ed.description || '' };
        const moved = ed.original?.timesheetId && String(ed.original.timesheetId) !== String(ed.timesheetId);
        if (!moved) {
          jobs.push({ taskId, kind: 'edit', id: entryId, run: () => api.updateTime(projectId, ed.timesheetId, entryId, body, opts()) });
        } else {
          jobs.push({
            taskId, kind: 'edit', id: entryId,
            run: async () => {
              if (!ed.deletedOld) {
                await api.deleteTime(projectId, ed.original.timesheetId, entryId, opts());
                store.patchItem(taskId, 'edit', entryId, { deletedOld: true });
              }
              return api.createTime(projectId, ed.timesheetId, { ...body, list_id: listId, task_id: taskIdNum }, opts());
            },
          });
        }
      }
      // creates
      for (const row of d.newEntries) {
        if (row.state === 'saved' || row.savedId || !isValidEntry(row)) continue;
        jobs.push({
          taskId, kind: 'new', id: row.uid, timesheetId: row.timesheetId,
          run: () => api.createTime(projectId, row.timesheetId, {
            date: row.date,
            logged_hours: Number(row.hours) || 0,
            logged_mins: Number(row.mins) || 0,
            status: row.status,
            description: row.description || '',
            list_id: listId,
            task_id: taskIdNum,
          }, opts()),
        });
      }
    }

    if (!jobs.length) return;
    setRunning(true); setLock(true);
    setProgress({ done: 0, total: jobs.length });
    for (const j of jobs) store.patchItem(j.taskId, j.kind, j.id, { state: 'queued', error: null });
    let done = 0, ok = 0, failed = 0;

    await Promise.all(jobs.map(async (j) => {
      try {
        store.patchItem(j.taskId, j.kind, j.id, { state: 'saving' });
        const res = await j.run();
        const patch = { state: 'saved', error: null };
        if (j.kind === 'new') {
          patch.savedId = res?.id || 'unknown';
          const d = useDrafts.getState().drafts[j.taskId];
          if (d) store.rememberTimesheet(j.taskId, d.meta.projectId, j.timesheetId);
        }
        store.patchItem(j.taskId, j.kind, j.id, patch);
        ok++;
      } catch (e) {
        failed++;
        store.patchItem(j.taskId, j.kind, j.id, { state: e?.kind === 'aborted' ? 'idle' : 'failed', error: e?.kind === 'aborted' ? null : friendlyError(e) });
      } finally {
        done++; setProgress({ done, total: jobs.length });
      }
    }));

    setLock(false);
    store.pruneSaved();
    await Promise.all([qc.invalidateQueries({ queryKey: ['mytime'] }), qc.invalidateQueries({ queryKey: ['tasks'] })]);
    setRunning(false);
    abortRef.current = null;
    onDone?.({ ok, failed, total: jobs.length });
  }, [running, qc, onDone]);

  const cancel = useCallback(() => { abortRef.current?.abort(); queue.cancelQueued((j) => j.label && !j.label.startsWith('GET')); }, []);

  return { saveAll, cancel, running, progress, queueState: qstate, lockedByOther };
}
