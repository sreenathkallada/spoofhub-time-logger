import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { fmtMinutes } from '../utils/time.js';
import { tips } from '../utils/tips.js';

export default function SaveBar({ pending, running, progress, queueState, lockedByOther, canSave, onSave, onCancel, onDiscard }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  if (!running && pending.total === 0 && pending.invalid === 0 && pending.failed === 0) return null;

  const pausedSecs = queueState.pausedUntil > now ? Math.ceil((queueState.pausedUntil - now) / 1000) : 0;
  const parts = [];
  if (pending.creates) parts.push(`${pending.creates} new`);
  if (pending.edits) parts.push(`${pending.edits} ${pending.edits === 1 ? 'edit' : 'edits'}`);
  if (pending.deletes) parts.push(`${pending.deletes} ${pending.deletes === 1 ? 'deletion' : 'deletions'}`);

  return (
    <div className="savebar">
      <div className="savebar-inner">
        {running ? (
          <div className="progress" title={tips.progress}>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div>
            <span>Saving {progress.done} of {progress.total}{pausedSecs ? ` · rate limit hit, resuming in ${pausedSecs}s` : ''}</span>
          </div>
        ) : (
          <div className="summary" title={tips.summary}>
            {pending.total > 0 ? (
              <>
                <strong>{parts.join(', ')}</strong> across {pending.tasks} {pending.tasks === 1 ? 'task' : 'tasks'}
                {pending.minutes > 0 && <> · {fmtMinutes(pending.minutes)}</>}
              </>
            ) : null}
            {pending.invalid > 0 && <span className="warn-text" title={tips.invalidRows}> · {pending.invalid} incomplete {pending.invalid === 1 ? 'row' : 'rows'} will be skipped</span>}
            {pending.failed > 0 && <span className="bad-text"> · {pending.failed} failed</span>}
            {lockedByOther && <span className="warn-text" title={tips.otherTab}> · Another tab is saving right now</span>}
          </div>
        )}
        <div className="spacer" />
        {running ? (
          <button className="btn" onClick={onCancel} title={tips.stop}><X size={15} /> Stop</button>
        ) : (
          <>
            <button className="btn" onClick={onDiscard} title={tips.discardAll} disabled={pending.total === 0 && pending.invalid === 0}>Discard all</button>
            <span title={!canSave || lockedByOther ? tips.saveAllDisabled : tips.saveAll}><button className="btn btn-primary" onClick={onSave} disabled={!canSave || lockedByOther}><Save size={15} /> Save all</button></span>
          </>
        )}
      </div>
    </div>
  );
}
