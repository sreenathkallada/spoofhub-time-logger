import { Trash2, Check, AlertCircle, Loader2 } from 'lucide-react';
import { validateEntry } from '../utils/time.js';
import { tips } from '../utils/tips.js';

const STATUSES = [
  ['billable', 'Billable'],
  ['non-billable', 'Non-billable'],
  ['none', 'None'],
];

export default function EntryRow({ value, timesheets, timesheetsLoading, disabled, onChange, onRemove, onEnter, compact }) {
  const errors = validateEntry(value);
  const dirty = value.hours !== '' || value.mins !== '' || value.description !== '' || value.state === 'failed';
  const showErr = (k) => dirty && errors[k];
  const dur = dirty && errors.duration;

  const state = value.state;
  const stateIcon =
    state === 'saved' ? <span title={tips.stateSaved}><Check size={14} className="ok" /></span> :
    state === 'saving' || state === 'queued' ? <span title={tips.stateSaving}><Loader2 size={14} className="spin" /></span> :
    state === 'failed' ? <span title={tips.stateFailed(value.error)}><AlertCircle size={14} className="bad" /></span> : null;

  return (
    <div className={`entry-row ${state === 'failed' ? 'failed' : ''} ${compact ? 'compact' : ''}`}>
      <input type="date" value={value.date} disabled={disabled} className={showErr('date') ? 'invalid' : ''} title={showErr('date') || tips.date}
        onChange={(e) => onChange({ date: e.target.value })} />
      <input type="number" min="0" max="24" inputMode="numeric" placeholder="0" value={value.hours} disabled={disabled}
        className={showErr('hours') || dur ? 'invalid' : ''} title={showErr('hours') || dur || tips.hours}
        onChange={(e) => onChange({ hours: e.target.value })} aria-label="Hours" />
      <input type="number" min="0" max="59" step="5" inputMode="numeric" placeholder="0" value={value.mins} disabled={disabled}
        className={showErr('mins') || dur ? 'invalid' : ''} title={showErr('mins') || dur || tips.mins}
        onChange={(e) => onChange({ mins: e.target.value })} aria-label="Minutes" />
      <input type="text" maxLength={500} placeholder="What did you do?" value={value.description} disabled={disabled}
        onChange={(e) => onChange({ description: e.target.value })} title={tips.description}
        onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }} aria-label="Description" />
      <select value={value.timesheetId || ''} disabled={disabled || timesheetsLoading} className={showErr('timesheetId') ? 'invalid' : ''} title={showErr('timesheetId') || tips.timesheet}
        onChange={(e) => onChange({ timesheetId: e.target.value })} aria-label="Timesheet">
        <option value="">{timesheetsLoading ? 'Loading…' : 'Choose timesheet…'}</option>
        {timesheets.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
      <select value={value.status} disabled={disabled} onChange={(e) => onChange({ status: e.target.value })} aria-label="Status" title={tips.status}>
        {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <div className="entry-actions">
        {stateIcon}
        <button className="icon-btn" aria-label={compact ? 'Cancel edit' : 'Remove entry'} title={compact ? tips.cancelEdit : tips.remove} disabled={disabled} onClick={onRemove}><Trash2 size={15} /></button>
      </div>
      {state === 'failed' && value.error && <div className="entry-error" title={tips.stateFailed(value.error)}>{value.error}</div>}
    </div>
  );
}
