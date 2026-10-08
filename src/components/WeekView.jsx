import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, X, Copy, MoreHorizontal, Hand } from 'lucide-react';
import { useSettings } from '../store/settings.js';
import { useDrafts, isPristine } from '../store/drafts.js';
import { useTimeRange, useProjectTimesheets } from './../hooks/queries.js';
import { api } from '../hooks/useApi.js';
import { defaultTimesheetId } from '../utils/timesheetDefault.js';
import { addDaysISO, fmtCellHours, fmtDayHeader, fmtDuration, parseDuration, splitMinutes, toMinutes, todayISO, weekDaysISO, weekStartISO, isValidEntry } from '../utils/time.js';
import { tips } from '../utils/tips.js';
import { useToast } from './Toast.jsx';
import { useTakeTask } from '../hooks/useTakeTask.js';
import EntryRow from './EntryRow.jsx';
import ExistingEntry from './ExistingEntry.jsx';

const metaOf = (t) => ({ title: t.title, projectId: t.project?.id, projectName: t.project?.name, listId: t.list?.id, listName: t.list?.name });

export default function WeekView({ tasks, saving }) {
  const settings = useSettings();
  const toast = useToast();
  const qc = useQueryClient();
  const drafts = useDrafts((s) => s.drafts);
  const weekRows = useDrafts((s) => s.weekRows);
  const lastUsed = useDrafts((s) => s.lastUsedTimesheet);
  const store = useDrafts();
  const take = useTakeTask();

  const [weekStart, setWeekStart] = useState(() => weekStartISO(todayISO()));
  const days = useMemo(() => weekDaysISO(weekStart), [weekStart]);
  const weekEnd = days[days.length - 1];
  const today = todayISO();
  const range = useTimeRange(weekStart, weekEnd);
  const [open, setOpen] = useState(null); // { taskId, day }
  const [picker, setPicker] = useState(false);

  const tasksById = useMemo(() => Object.fromEntries((tasks || []).map((t) => [String(t.id), t])), [tasks]);

  // entries by task and day; unlinked time by day
  const { byTaskDay, entriesByTask, unlinkedByDay, stubs } = useMemo(() => {
    const byTaskDay = {}, entriesByTask = {}, unlinkedByDay = {}, stubs = {};
    for (const e of range.data || []) {
      const day = String(e.date).slice(0, 10);
      const tid = e?.task?.task_id ?? e?.task?.id;
      if (!tid) { unlinkedByDay[day] = (unlinkedByDay[day] || 0) + toMinutes(e.logged_hours, e.logged_mins); continue; }
      const id = String(tid);
      ((byTaskDay[id] ||= {})[day] ||= []).push(e);
      (entriesByTask[id] ||= []).push(e);
      if (!stubs[id]) stubs[id] = { id, title: e.task.task_name || `Task ${id}`, project: e.project, list: { id: e.task.list_id, name: e.task.list_name }, assigned: [], stub: true };
    }
    return { byTaskDay, entriesByTask, unlinkedByDay, stubs };
  }, [range.data]);

  // rows: entries this week ∪ hand-added ∪ drafts dated in this week
  const rows = useMemo(() => {
    const ids = new Set(Object.keys(byTaskDay));
    for (const r of weekRows[weekStart] || []) ids.add(String(r.id));
    for (const [id, d] of Object.entries(drafts)) {
      if (d.newEntries.some((r) => r.date >= weekStart && r.date <= weekEnd && !isPristine(r))) ids.add(String(id));
    }
    const added = Object.fromEntries((weekRows[weekStart] || []).map((r) => [String(r.id), r]));
    return [...ids].map((id) => {
      const task = tasksById[id] || stubs[id] || (added[id]?.meta && { id, title: added[id].meta.title, project: { id: added[id].meta.projectId, name: added[id].meta.projectName }, list: { id: added[id].meta.listId, name: added[id].meta.listName }, assigned: [], stub: true })
        || (drafts[id]?.meta && { id, title: drafts[id].meta.title, project: { id: drafts[id].meta.projectId, name: drafts[id].meta.projectName }, list: { id: drafts[id].meta.listId, name: drafts[id].meta.listName }, assigned: [], stub: true });
      return task ? { id, task, added: Boolean(added[id]) } : null;
    }).filter(Boolean).sort((a, b) => String(a.task.project?.name).localeCompare(String(b.task.project?.name)) || String(a.task.title).localeCompare(String(b.task.title)));
  }, [byTaskDay, weekRows, weekStart, weekEnd, drafts, tasksById, stubs]);

  const { byProject: timesheetsByProject } = useProjectTimesheets(rows.map((r) => r.task.project?.id));

  function cell(taskId, day) {
    const d = drafts[taskId];
    const existing = byTaskDay[taskId]?.[day] || [];
    const deleted = new Set((d?.deletedEntries || []).map((x) => String(x.id)));
    let total = 0, pending = false, failed = false;
    const live = [];
    for (const e of existing) {
      const ed = d?.editedEntries?.[String(e.id)];
      if (deleted.has(String(e.id))) { pending = true; const del = d.deletedEntries.find((x) => String(x.id) === String(e.id)); if (del?.state === 'failed') failed = true; continue; }
      live.push(e);
      if (ed) { pending = true; if (ed.state === 'failed') failed = true; total += toMinutes(ed.hours, ed.mins); }
      else total += toMinutes(e.logged_hours, e.logged_mins);
    }
    const news = (d?.newEntries || []).filter((r) => r.date === day && r.state !== 'saved');
    for (const r of news) { total += toMinutes(r.hours, r.mins); if (!isPristine(r)) pending = true; if (r.state === 'failed') failed = true; }
    const invalid = news.some((r) => !isPristine(r) && !isValidEntry(r));
    return { existing, live, news, total, pending, failed, invalid, count: live.length + news.filter((r) => !isPristine(r)).length };
  }

  function defaultTs(task) {
    return defaultTimesheetId({ prevRow: null, lastUsed, task, myEntries: entriesByTask[String(task.id)] || [], timesheets: timesheetsByProject[String(task.project?.id)] || [] }) || '';
  }

  /** Commit typed text for one cell. Returns false when the cell can't be edited inline. */
  function commit(row, day, text) {
    const taskId = row.id, task = row.task, meta = metaOf(task);
    const mins = parseDuration(text);
    if (mins === null) { toast({ message: `Couldn't read "${text}". Use hours like 2, 1.5, 1:30 or 1h 30m.`, tone: 'warn' }); return false; }
    const c = cell(taskId, day);
    const { hours, mins: mm } = splitMinutes(mins);
    if (c.live.length === 0 && c.news.length === 0) {
      if (mins > 0) {
        const tsId = defaultTs(task);
        store.addNewEntry(taskId, meta, { date: day, hours: String(hours), mins: String(mm), timesheetId: tsId, status: settings.defaultStatus });
        if (!tsId) setTimeout(() => setOpen({ taskId, day }), 0); // no timesheet could be inferred: let the user pick it once
      }
      return true;
    }
    if (c.live.length === 0 && c.news.length === 1) {
      const r = c.news[0];
      if (mins > 0) store.updateNewEntry(taskId, r.uid, { hours: String(hours), mins: String(mm), timesheetId: r.timesheetId || defaultTs(task) });
      else store.removeNewEntry(taskId, r.uid);
      return true;
    }
    if (c.live.length === 1 && c.news.length === 0) {
      const e = c.live[0];
      const ed = drafts[taskId]?.editedEntries?.[String(e.id)];
      if (mins === 0) { store.clearEdited(taskId, e.id); store.toggleDeleted(taskId, meta, e); return true; }
      if (mins === toMinutes(e.logged_hours, e.logged_mins) && !ed) return true;
      if (mins === toMinutes(e.logged_hours, e.logged_mins) && ed && ed.description === (e.description || '') && String(ed.timesheetId) === String(e.timesheet?.id) && ed.status === e.status) { store.clearEdited(taskId, e.id); return true; }
      store.setEdited(taskId, meta, e.id, {
        date: String(e.date).slice(0, 10), hours: String(hours), mins: String(mm),
        description: ed?.description ?? (e.description || ''), timesheetId: ed?.timesheetId ?? (e.timesheet?.id || ''), status: ed?.status ?? (e.status || 'billable'),
        original: { timesheetId: e.timesheet?.id },
      });
      return true;
    }
    setOpen({ taskId, day });
    return false;
  }

  async function copyLastWeek() {
    const from = addDaysISO(weekStart, -7), to = addDaysISO(weekEnd, -7);
    try {
      const prev = await qc.fetchQuery({ queryKey: ['mytime', 'range', settings.userId, from, to], queryFn: () => api.getMyTime({ userId: settings.userId, from, to }), staleTime: 60_000 });
      let n = 0;
      for (const e of prev || []) {
        const tid = e?.task?.task_id ?? e?.task?.id;
        if (!tid) continue;
        const id = String(tid);
        const day = addDaysISO(String(e.date).slice(0, 10), 7);
        if (cell(id, day).count > 0) continue;
        const task = tasksById[id] || { id, title: e.task.task_name, project: e.project, list: { id: e.task.list_id, name: e.task.list_name } };
        const meta = metaOf(task);
        store.addWeekRow(weekStart, id, meta);
        store.addNewEntry(id, meta, { date: day, hours: String(e.logged_hours || 0), mins: String(e.logged_mins || 0), timesheetId: e.timesheet?.id || '', status: e.status || settings.defaultStatus });
        n++;
      }
      toast({ message: n ? `${n} ${n === 1 ? 'entry' : 'entries'} copied from last week as drafts — adjust, then Save all` : 'Nothing to copy from last week', tone: n ? 'success' : 'info' });
    } catch (err) { toast({ message: `Couldn't load last week: ${err.message}`, tone: 'danger' }); }
  }

  const dayTotals = days.map((day) => rows.reduce((s, r) => s + cell(r.id, day).total, 0) + (unlinkedByDay[day] || 0));
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);
  const target = settings.dailyTargetMins || 0;
  const hasUnlinked = Object.keys(unlinkedByDay).length > 0;
  const isCurrent = weekStart === weekStartISO(today);

  return (
    <div className="week">
      <div className="week-nav">
        <button className="btn btn-small" onClick={() => setWeekStart(addDaysISO(weekStart, -7))} title={tips.weekPrev}><ChevronLeft size={15} /></button>
        <button className="btn btn-small" onClick={() => setWeekStart(weekStartISO(today))} disabled={isCurrent} title={tips.weekThis}>This week</button>
        <button className="btn btn-small" onClick={() => setWeekStart(addDaysISO(weekStart, 7))} title={tips.weekNext}><ChevronRight size={15} /></button>
        <span className="week-title" title={tips.weekTitle}>{fmtDayHeader(weekStart).day} {fmtDayHeader(weekStart).month} – {fmtDayHeader(weekEnd).day} {fmtDayHeader(weekEnd).month} {weekEnd.slice(0, 4)}</span>
        <div className="spacer" />
        <span className="muted small" title={tips.weekTotal(target)}>Week {fmtDuration(0, weekTotal)}{target ? ` of ${fmtDuration(0, target * days.length)}` : ''}</span>
        <button className="btn btn-small" onClick={copyLastWeek} disabled={saving} title={tips.copyLastWeek}><Copy size={14} /> Copy last week</button>
        <button className="btn btn-small" onClick={() => setPicker(true)} disabled={saving} title={tips.addTaskRow}><Plus size={14} /> Add task</button>
      </div>

      {range.isLoading && <div className="empty">Loading this week's entries…</div>}
      {range.error && <div className="error-text">Couldn't load entries: {range.error.message}</div>}

      {!range.isLoading && (
        <div className="week-scroll">
          <table className="week-grid">
            <thead>
              <tr>
                <th className="wk-task" title={tips.weekTaskCol}>Task</th>
                {days.map((day) => { const h = fmtDayHeader(day); return <th key={day} className={day === today ? 'today' : ''} title={tips.weekDay(day, day === today)}><span className="dow">{h.dow}</span><span className="dnum">{h.day}</span></th>; })}
                <th className="wk-total" title={tips.weekRowTotal}>Total</th>
                <th className="wk-x" title={tips.removeRowCol} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={days.length + 3} className="empty">No time logged this week yet. Add a task row and type hours into a day, or copy last week.</td></tr>
              )}
              {rows.map((row) => {
                const t = row.task;
                const unassigned = !t.stub && (t.assigned || []).length === 0;
                const rowTotal = days.reduce((s, day) => s + cell(row.id, day).total, 0);
                const removable = row.added && days.every((day) => cell(row.id, day).count === 0);
                return (
                  <tr key={row.id}>
                    <td className="wk-task">
                      <div className="wk-title" title={tips.weekRowTask(t)}>{t.title}{t.ticket ? <span className="ticket"> #{t.ticket}</span> : null}</div>
                      <div className="wk-sub">
                        <span>{t.project?.name}</span>{t.list?.name ? <><span className="sep">/</span><span>{t.list.name}</span></> : null}
                        {t.stub && <span className="badge badge-grey" title={tips.weekStub}>not in your list</span>}
                        {unassigned && <><span className="badge badge-amber" title={tips.unassigned}>Unassigned</span><button className="btn-link small" disabled={saving} onClick={() => take(t)} title={tips.take}><Hand size={12} /> Take</button></>}
                      </div>
                    </td>
                    {days.map((day) => (
                      <WeekCell key={day} data={cell(row.id, day)} disabled={saving || day > addDaysISO(today, 1)} today={day === today}
                        onCommit={(text) => commit(row, day, text)} onOpen={() => setOpen({ taskId: row.id, day })} isOpen={open?.taskId === row.id && open?.day === day} day={day} />
                    ))}
                    <td className="wk-total" title={tips.weekRowTotal}>{fmtDuration(0, rowTotal)}</td>
                    <td className="wk-x">{removable && <button className="icon-btn" aria-label="Remove row" title={tips.removeRow} onClick={() => store.removeWeekRow(weekStart, row.id)}><X size={14} /></button>}</td>
                  </tr>
                );
              })}
              {hasUnlinked && (
                <tr className="wk-unlinked">
                  <td className="wk-task"><div className="wk-title muted" title={tips.weekUnlinked}>Time without a task</div><div className="wk-sub">logged directly to timesheets</div></td>
                  {days.map((day) => <td key={day} className="wk-cell ro" title={tips.weekUnlinked}>{fmtCellHours(unlinkedByDay[day] || 0)}</td>)}
                  <td className="wk-total" title={tips.weekUnlinked}>{fmtDuration(0, days.reduce((s, d) => s + (unlinkedByDay[d] || 0), 0))}</td><td />
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td className="wk-task" title={tips.weekDayTotal(target)}>Day total</td>
                {days.map((day, i) => {
                  const m = dayTotals[i];
                  const cls = !target || !m ? '' : m >= target ? 'ok' : 'under';
                  return <td key={day} className={`wk-foot ${cls}`} title={tips.weekDayTotalCell(m, target)}>{fmtDuration(0, m)}</td>;
                })}
                <td className="wk-total" title={tips.weekTotal(target)}>{fmtDuration(0, weekTotal)}</td><td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {open && (() => {
        const row = rows.find((r) => r.id === open.taskId);
        if (!row) return null;
        const c = cell(open.taskId, open.day);
        const task = row.task, meta = metaOf(task);
        const ts = timesheetsByProject[String(task.project?.id)] || [];
        const d = drafts[open.taskId];
        return (
          <CellPopover onClose={() => setOpen(null)} title={`${task.title} · ${fmtDayHeader(open.day).dow} ${fmtDayHeader(open.day).day} ${fmtDayHeader(open.day).month}`}>
            {c.existing.map((e) => (
              <ExistingEntry key={e.id} entry={e} taskId={open.taskId} meta={meta} edit={d?.editedEntries?.[String(e.id)]} markedDeleted={d?.deletedEntries?.find((x) => String(x.id) === String(e.id))} timesheets={ts} saving={saving} />
            ))}
            {c.news.map((r) => (
              <EntryRow key={r.uid} value={r} timesheets={ts} disabled={saving} compact
                onChange={(patch) => store.updateNewEntry(open.taskId, r.uid, { ...patch, ...(r.state === 'failed' ? { state: 'idle', error: null } : {}) })}
                onRemove={() => store.removeNewEntry(open.taskId, r.uid)} />
            ))}
            <div className="entry-foot">
              <button className="btn btn-small" disabled={saving} title={tips.addEntry} onClick={() => store.addNewEntry(open.taskId, meta, { date: open.day, timesheetId: c.news.at(-1)?.timesheetId || defaultTs(task), status: c.news.at(-1)?.status || settings.defaultStatus })}><Plus size={14} /> Add entry</button>
              <span className="muted small">Total {fmtDuration(0, c.total)}</span>
            </div>
          </CellPopover>
        );
      })()}

      {picker && <TaskPicker tasks={tasks || []} exclude={new Set(rows.map((r) => r.id))} onClose={() => setPicker(false)} onPick={(t) => { store.addWeekRow(weekStart, t.id, metaOf(t)); setPicker(false); }} />}
    </div>
  );
}

function WeekCell({ data, disabled, today, onCommit, onOpen, isOpen, day }) {
  const [text, setText] = useState(fmtCellHours(data.total));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(fmtCellHours(data.total)); }, [data.total, editing]);
  const cls = ['wk-cell', today ? 'today' : '', data.failed ? 'failed' : data.invalid ? 'invalid' : data.pending ? 'pending' : '', isOpen ? 'open' : ''].join(' ');
  const multi = data.count > 1;
  return (
    <td className={cls}>
      <div className="wk-cell-inner">
        <input
          type="text" inputMode="decimal" value={text} disabled={disabled} readOnly={multi}
          placeholder={disabled ? '' : '–'} aria-label={`Hours on ${day}`}
          title={tips.weekCell(data, day, multi)}
          onFocus={(e) => { setEditing(true); if (multi) { e.target.blur(); onOpen(); } }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { setEditing(false); if (!multi && text !== fmtCellHours(data.total)) { if (!onCommit(text)) setText(fmtCellHours(data.total)); } }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setText(fmtCellHours(data.total)); e.currentTarget.blur(); } }}
        />
        <button className="wk-more" aria-label="Entry details" title={tips.weekCellMore} onMouseDown={(e) => e.preventDefault()} onClick={onOpen}><MoreHorizontal size={13} /></button>
        {multi && <span className="wk-count" title={tips.weekCellMulti(data.count)}>{data.count}</span>}
      </div>
    </td>
  );
}

function CellPopover({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    window.addEventListener('keydown', onKey); document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  return (
    <div className="cell-pop" ref={ref} role="dialog" aria-label={title}>
      <div className="modal-head"><h3>{title}</h3><button className="icon-btn" aria-label="Close" title="Close" onClick={onClose}><X size={16} /></button></div>
      {children}
    </div>
  );
}

function TaskPicker({ tasks, exclude, onClose, onPick }) {
  const [q, setQ] = useState('');
  const userId = useSettings((s) => s.userId);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks
      .filter((t) => !exclude.has(String(t.id)))
      .filter((t) => !s || `${t.title} #${t.ticket} ${t.project?.name} ${t.list?.name}`.toLowerCase().includes(s))
      .sort((a, b) => Number((b.assigned || []).map(String).includes(String(userId))) - Number((a.assigned || []).map(String).includes(String(userId))) || String(a.title).localeCompare(String(b.title)))
      .slice(0, 40);
  }, [tasks, exclude, q, userId]);
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal picker" role="dialog" aria-modal="true" aria-label="Add a task to the week">
        <div className="modal-head"><h2>Add a task to this week</h2><button className="icon-btn" aria-label="Close" title="Close" onClick={onClose}><X size={18} /></button></div>
        <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, #ticket, project, list" title={tips.pickerSearch} />
        <div className="picker-list">
          {list.length === 0 && <div className="muted small">No matching open tasks.</div>}
          {list.map((t) => {
            const mine = (t.assigned || []).map(String).includes(String(userId));
            return (
              <button key={t.id} className="picker-item" onClick={() => onPick(t)} title={tips.pickerItem(t, mine)}>
                <span className="wk-title">{t.title} <span className="ticket">#{t.ticket}</span></span>
                <span className="wk-sub">{t.project?.name} / {t.list?.name}{!mine && ((t.assigned || []).length ? ' · not assigned to you' : ' · unassigned')}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
