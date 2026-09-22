import { Pencil, Trash2, Undo2, AlertCircle, Loader2 } from 'lucide-react';
import { useDrafts } from '../store/drafts.js';
import { fmtDate, fmtDuration } from '../utils/time.js';
import EntryRow from './EntryRow.jsx';
import { tips } from '../utils/tips.js';

export default function ExistingEntry({ entry, taskId, meta, edit, markedDeleted, timesheets, saving }) {
  const store = useDrafts();
  const busy = saving || ['saving', 'queued'].includes(edit?.state) || ['saving', 'queued'].includes(markedDeleted?.state);

  if (edit) {
    return (
      <EntryRow
        compact
        value={edit}
        timesheets={timesheets}
        disabled={busy}
        onChange={(patch) => store.setEdited(taskId, meta, entry.id, { ...edit, ...patch })}
        onRemove={() => store.clearEdited(taskId, entry.id)}
      />
    );
  }

  const tsTitle = entry.timesheet?.title || timesheets.find((t) => String(t.id) === String(entry.timesheet?.id))?.title || '';
  const cls = ['existing', markedDeleted ? 'deleted' : '', markedDeleted?.state === 'failed' ? 'failed' : ''].join(' ');
  return (
    <div className={cls}>
      <span className="ex-date" title={tips.exDate(entry.date)}>{fmtDate(entry.date)}</span>
      <span className="ex-dur" title={tips.exDur(entry.logged_hours, entry.logged_mins)}>{fmtDuration(entry.logged_hours, entry.logged_mins)}</span>
      <span className="ex-desc" title={tips.exDesc(entry.description)}>{entry.description || <span className="muted">No description</span>}</span>
      <span className="ex-ts muted" title={tips.exTimesheet(tsTitle)}>{tsTitle}</span>
      <span className="ex-status muted" title={tips.exStatus(entry.status)}>{entry.status}</span>
      <span className="entry-actions">
        {['saving', 'queued'].includes(markedDeleted?.state) && <span title={tips.stateSaving}><Loader2 size={14} className="spin" /></span>}
        {markedDeleted?.state === 'failed' && <span title={tips.stateFailed(markedDeleted.error)}><AlertCircle size={14} className="bad" /></span>}
        {markedDeleted ? (
          <button className="btn-link small" disabled={busy} title={tips.undoDelete} onClick={() => store.toggleDeleted(taskId, meta, entry)}><Undo2 size={13} /> Undo</button>
        ) : (
          <>
            <button className="icon-btn" aria-label="Edit entry" title={tips.edit} disabled={busy} onClick={() =>
              store.setEdited(taskId, meta, entry.id, {
                date: String(entry.date).slice(0, 10),
                hours: entry.logged_hours ?? '',
                mins: entry.logged_mins ?? '',
                description: entry.description || '',
                timesheetId: entry.timesheet?.id || '',
                status: entry.status || 'billable',
                original: { timesheetId: entry.timesheet?.id },
              })}><Pencil size={14} /></button>
            <button className="icon-btn" aria-label="Delete entry" title={tips.delete} disabled={busy} onClick={() => store.toggleDeleted(taskId, meta, entry)}><Trash2 size={14} /></button>
          </>
        )}
      </span>
      {markedDeleted?.state === 'failed' && <div className="entry-error">{markedDeleted.error}</div>}
    </div>
  );
}
