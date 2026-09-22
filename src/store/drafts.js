import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from '../utils/ids.js';
import { todayISO } from '../utils/time.js';

export const isPristine = (r) => r.hours === '' && r.mins === '' && (r.description || '') === '' && r.state === 'idle';
export const hasMeaningfulDrafts = (d) =>
  Boolean(d && (d.newEntries.some((r) => !isPristine(r)) || Object.keys(d.editedEntries).length || d.deletedEntries.length));

const emptyTask = (meta) => ({
  meta, // { title, projectId, projectName, listId, listName }
  newEntries: [],
  editedEntries: {}, // entryId -> { ...values, original:{timesheetId,...}, state, error }
  deletedEntries: [], // { id, timesheetId, state, error }
});

export const useDrafts = create(
  persist(
    (set, get) => ({
      drafts: {},
      lastUsedTimesheet: {},
      expanded: [],
      completedIds: [], // tasks completed from this app, hidden until the server list catches up (not persisted)
      markCompleted: (taskId, on) =>
        set((s) => ({ completedIds: on ? [...new Set([...s.completedIds, String(taskId)])] : s.completedIds.filter((x) => x !== String(taskId)) })),

      // ---- expansion ----
      toggleExpanded: (taskId) =>
        set((s) => {
          const closing = s.expanded.includes(taskId);
          const drafts = { ...s.drafts };
          if (closing && drafts[taskId]) {
            // drop untouched empty rows so a collapsed task carries no phantom draft
            const d = { ...drafts[taskId], newEntries: drafts[taskId].newEntries.filter((r) => !isPristine(r)) };
            if (hasMeaningfulDrafts(d)) drafts[taskId] = d; else delete drafts[taskId];
          }
          return { drafts, expanded: closing ? s.expanded.filter((x) => x !== taskId) : [...s.expanded, taskId] };
        }),
      setExpanded: (taskId, on) =>
        set((s) => ({ expanded: on ? [...new Set([...s.expanded, taskId])] : s.expanded.filter((x) => x !== taskId) })),

      // ---- new entries ----
      addNewEntry: (taskId, meta, seed = {}) =>
        set((s) => {
          const d = s.drafts[taskId] || emptyTask(meta);
          const prev = d.newEntries[d.newEntries.length - 1];
          const row = {
            uid: uid(),
            date: seed.date ?? prev?.date ?? todayISO(),
            hours: '',
            mins: '',
            description: '',
            timesheetId: seed.timesheetId ?? prev?.timesheetId ?? '',
            status: seed.status ?? prev?.status ?? 'billable',
            state: 'idle',
            error: null,
            savedId: null,
          };
          return { drafts: { ...s.drafts, [taskId]: { ...d, meta: d.meta || meta, newEntries: [...d.newEntries, row] } } };
        }),
      updateNewEntry: (taskId, id, patch) =>
        set((s) => {
          const d = s.drafts[taskId];
          if (!d) return {};
          return {
            drafts: {
              ...s.drafts,
              [taskId]: { ...d, newEntries: d.newEntries.map((r) => (r.uid === id ? { ...r, ...patch } : r)) },
            },
          };
        }),
      removeNewEntry: (taskId, id) =>
        set((s) => {
          const d = s.drafts[taskId];
          if (!d) return {};
          return { drafts: { ...s.drafts, [taskId]: { ...d, newEntries: d.newEntries.filter((r) => r.uid !== id) } } };
        }),

      // ---- edits of existing entries ----
      setEdited: (taskId, meta, entryId, values) =>
        set((s) => {
          const d = s.drafts[taskId] || emptyTask(meta);
          return {
            drafts: {
              ...s.drafts,
              [taskId]: { ...d, meta: d.meta || meta, editedEntries: { ...d.editedEntries, [entryId]: { ...values, state: 'idle', error: null } } },
            },
          };
        }),
      clearEdited: (taskId, entryId) =>
        set((s) => {
          const d = s.drafts[taskId];
          if (!d) return {};
          const edited = { ...d.editedEntries };
          delete edited[entryId];
          return { drafts: { ...s.drafts, [taskId]: { ...d, editedEntries: edited } } };
        }),

      // ---- deletions ----
      toggleDeleted: (taskId, meta, entry) =>
        set((s) => {
          const d = s.drafts[taskId] || emptyTask(meta);
          const exists = d.deletedEntries.some((x) => String(x.id) === String(entry.id));
          const deletedEntries = exists
            ? d.deletedEntries.filter((x) => String(x.id) !== String(entry.id))
            : [...d.deletedEntries, { id: entry.id, timesheetId: entry.timesheet?.id, state: 'idle', error: null }];
          return { drafts: { ...s.drafts, [taskId]: { ...d, meta: d.meta || meta, deletedEntries } } };
        }),

      // ---- state updates used by save-all ----
      patchItem: (taskId, kind, id, patch) =>
        set((s) => {
          const d = s.drafts[taskId];
          if (!d) return {};
          let next = d;
          if (kind === 'new') next = { ...d, newEntries: d.newEntries.map((r) => (r.uid === id ? { ...r, ...patch } : r)) };
          if (kind === 'edit') next = { ...d, editedEntries: { ...d.editedEntries, [id]: { ...d.editedEntries[id], ...patch } } };
          if (kind === 'delete') next = { ...d, deletedEntries: d.deletedEntries.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r)) };
          return { drafts: { ...s.drafts, [taskId]: next } };
        }),
      pruneSaved: () =>
        set((s) => {
          const drafts = {};
          for (const [taskId, d] of Object.entries(s.drafts)) {
            const newEntries = d.newEntries.filter((r) => r.state !== 'saved');
            const editedEntries = Object.fromEntries(Object.entries(d.editedEntries).filter(([, v]) => v.state !== 'saved'));
            const deletedEntries = d.deletedEntries.filter((r) => r.state !== 'saved');
            if (newEntries.length || Object.keys(editedEntries).length || deletedEntries.length) {
              drafts[taskId] = { ...d, newEntries, editedEntries, deletedEntries };
            }
          }
          return { drafts };
        }),
      resetStates: () =>
        set((s) => {
          const drafts = {};
          for (const [taskId, d] of Object.entries(s.drafts)) {
            const reset = (r) => (r.state === 'queued' || r.state === 'saving' ? { ...r, state: 'idle' } : r);
            drafts[taskId] = {
              ...d,
              newEntries: d.newEntries.map(reset),
              editedEntries: Object.fromEntries(Object.entries(d.editedEntries).map(([k, v]) => [k, reset(v)])),
              deletedEntries: d.deletedEntries.map(reset),
            };
          }
          return { drafts };
        }),

      discardTask: (taskId) =>
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[taskId];
          return { drafts };
        }),
      discardAll: () => set({ drafts: {} }),
      rememberTimesheet: (taskId, projectId, timesheetId) =>
        set((s) => ({
          lastUsedTimesheet: { ...s.lastUsedTimesheet, [`task:${taskId}`]: timesheetId, [String(projectId)]: timesheetId },
        })),
      hasDraftsFor: (taskId) => hasMeaningfulDrafts(get().drafts[taskId]),
    }),
    { name: 'phtl.drafts', version: 1, partialize: (s) => ({ drafts: s.drafts, lastUsedTimesheet: s.lastUsedTimesheet, expanded: s.expanded }) },
  ),
);
