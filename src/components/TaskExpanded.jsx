import { useEffect, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useDrafts } from '../store/drafts.js';
import { useSettings } from '../store/settings.js';
import { useTimesheets } from '../hooks/queries.js';
import { defaultTimesheetId } from '../utils/timesheetDefault.js';
import { fmtDuration, isValidEntry, toMinutes } from '../utils/time.js';
import EntryRow from './EntryRow.jsx';
import ExistingEntry from './ExistingEntry.jsx';
import { tips } from '../utils/tips.js';

export default function TaskExpanded({ task, draft, myEntries, myTimeLoading, saving }) {
  const id = String(task.id);
  const projectId = task.project?.id;
  const store = useDrafts();
  const defaultStatus = useSettings((s) => s.defaultStatus);
  const timesheets = useTimesheets(projectId);
  const lastUsed = useDrafts((s) => s.lastUsedTimesheet);

  const meta = useMemo(() => ({
    title: task.title, projectId, projectName: task.project?.name, listId: task.list?.id, listName: task.list?.name,
  }), [task, projectId]);

  const newEntries = draft?.newEntries || [];
  const edited = draft?.editedEntries || {};
  const deleted = draft?.deletedEntries || [];

  const pickDefault = (prevRow) => defaultTimesheetId({ prevRow, lastUsed, task, myEntries, timesheets: timesheets.usable });

  // No drafts on this task (first expansion, or everything just saved): give the user one row to type into.
  const hasDrafts = newEntries.length > 0 || Object.keys(edited).length > 0 || deleted.length > 0;
  useEffect(() => {
    if (!task.orphan && !hasDrafts && !saving) {
      store.addNewEntry(id, meta, { status: defaultStatus, timesheetId: pickDefault(null) || '' });
    }
  }, [hasDrafts, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  // When timesheets arrive, fill in defaults for rows that don't have one yet.
  useEffect(() => {
    if (!timesheets.usable.length) return;
    let prev = null;
    for (const r of newEntries) {
      if (!r.timesheetId && r.state === 'idle') {
        const tsId = pickDefault(prev);
        if (tsId) store.updateNewEntry(id, r.uid, { timesheetId: tsId });
      }
      prev = r;
    }
  }, [timesheets.usable]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = newEntries.filter((r) => r.state !== 'saved' && isValidEntry(r)).reduce((s, r) => s + toMinutes(r.hours, r.mins), 0);
  const noTimesheets = timesheets.isSuccess && timesheets.usable.length === 0;

  return (
    <div className="task-body">
      {task.orphan && <p className="muted small">This task isn't in your current list. You can still save these entries, or discard them.</p>}

      <section>
        <div className="section-title" title={tips.existingHeader(useSettings.getState().daysOfHistory)}>Your entries on this task</div>
        {myTimeLoading && <div className="muted small">Loading…</div>}
        {!myTimeLoading && myEntries.length === 0 && <div className="muted small">None yet in the last {useSettings.getState().daysOfHistory} days.</div>}
        {myEntries.map((e) => (
          <ExistingEntry
            key={e.id}
            entry={e}
            taskId={id}
            meta={meta}
            edit={edited[String(e.id)]}
            markedDeleted={deleted.find((d) => String(d.id) === String(e.id))}
            timesheets={timesheets.usable}
            saving={saving}
          />
        ))}
      </section>

      <section>
        <div className="section-title" title={tips.newHeader}>New entries</div>
        {noTimesheets && <div className="error-text">This project has no timesheets you can log into. Ask a project manager to add one.</div>}
        {timesheets.error && <div className="error-text">Couldn't load timesheets: {timesheets.error.message}</div>}
        <div className="entry-head">
          <span title={tips.date}>Date</span><span title={tips.hours}>Hours</span><span title={tips.mins}>Mins</span><span title={tips.description}>Description</span><span title={tips.timesheet}>Timesheet</span><span title={tips.status}>Status</span><span />
        </div>
        {newEntries.map((r) => (
          <EntryRow
            key={r.uid}
            value={r}
            timesheets={timesheets.usable}
            timesheetsLoading={timesheets.isLoading}
            disabled={saving || r.state === 'saving' || r.state === 'queued'}
            onChange={(patch) => store.updateNewEntry(id, r.uid, { ...patch, ...(r.state === 'failed' ? { state: 'idle', error: null } : {}) })}
            onRemove={() => store.removeNewEntry(id, r.uid)}
            onEnter={() => store.addNewEntry(id, meta, { status: r.status, timesheetId: pickDefault(r) || '' })}
          />
        ))}
        <div className="entry-foot">
          <button className="btn btn-small" disabled={saving} title={tips.addEntry} onClick={() => store.addNewEntry(id, meta, { status: newEntries.at(-1)?.status || defaultStatus, timesheetId: pickDefault(newEntries.at(-1)) || '' })}>
            <Plus size={14} /> Add entry
          </button>
          {subtotal > 0 && <span className="muted small" title={tips.subtotal}>Unsaved on this task: <strong>{fmtDuration(0, subtotal)}</strong></span>}
          {(newEntries.length > 1 || Object.keys(edited).length || deleted.length) ? (
            <button className="btn-link small" disabled={saving} title={tips.discardTask} onClick={() => { if (confirm('Discard unsaved changes on this task?')) store.discardTask(id); }}>Discard this task's changes</button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
