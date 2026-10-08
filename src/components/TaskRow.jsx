import { useState } from 'react';
import { ChevronRight, ChevronDown, Clock, CalendarDays } from 'lucide-react';
import { useDrafts } from '../store/drafts.js';
import { useSettings } from '../store/settings.js';
import { useInvalidate } from '../hooks/queries.js';
import { api } from '../hooks/useApi.js';
import { friendlyError } from '../api/errors.js';
import { fmtDuration, fmtDate, isOverdue, isValidEntry, toMinutes } from '../utils/time.js';
import { useToast } from './Toast.jsx';
import TaskExpanded from './TaskExpanded.jsx';
import { tips } from '../utils/tips.js';
import { Hand } from 'lucide-react';
import { useTakeTask } from '../hooks/useTakeTask.js';

function draftCounts(d) {
  if (!d) return { pending: 0, failed: 0, saving: 0 };
  let pending = 0, failed = 0, saving = 0;
  const bump = (r, valid = true) => {
    if (r.state === 'saved') return;
    if (r.state === 'failed') failed++;
    else if (r.state === 'saving' || r.state === 'queued') saving++;
    else if (valid) pending++;
  };
  d.newEntries.forEach((r) => bump(r, isValidEntry(r)));
  Object.values(d.editedEntries).forEach((r) => bump(r));
  d.deletedEntries.forEach((r) => bump(r));
  if (d.stageChange) bump(d.stageChange);
  return { pending, failed, saving };
}

export default function TaskRow({ task, expanded, draft, projectColor, workflow, workflowName, peopleById, myEntries, myTimeLoading, saving }) {
  const toggleExpanded = useDrafts((s) => s.toggleExpanded);
  const markCompleted = useDrafts((s) => s.markCompleted);
  const setStageChange = useDrafts((s) => s.setStageChange);
  const take = useTakeTask();
  const userId = useSettings((s) => s.userId);
  const toast = useToast();
  const invalidate = useInvalidate();
  const [completing, setCompleting] = useState(false);

  const id = String(task.id);
  const assigned = (task.assigned || []).map(String);
  const unassigned = assigned.length === 0 && !task.orphan;
  const mine = assigned.includes(String(userId));
  const counts = draftCounts(draft);
  const stages = workflow?.stages || [];
  const stageChange = draft?.stageChange || null;
  const currentStageId = String(task.stage?.id || '');
  const selectedStageId = stageChange?.toId || currentStageId;
  const canChangeStage = mine && !task.orphan && stages.length > 0;
  const stageBusy = ['queued', 'saving'].includes(stageChange?.state);

  function onStageSelect(e) {
    e.stopPropagation();
    const toId = e.target.value;
    if (toId === currentStageId) { setStageChange(id, meta, null); return; }
    const to = stages.find((st) => st.id === toId);
    setStageChange(id, meta, { toId, toName: to?.title || toId, fromId: currentStageId, fromName: task.stage?.name || '', completes: toId === workflow.doneId });
  }
  const meta = { title: task.title, projectId: task.project?.id, projectName: task.project?.name, listId: task.list?.id, listName: task.list?.name };
  const myMinutes = myEntries.reduce((s, e) => s + toMinutes(e.logged_hours, e.logged_mins), 0);
  const totalLogged = fmtDuration(task.logged_hours, task.logged_mins);
  const assigneeNames = assigned.map((a) => peopleById[a]).filter(Boolean).map((p) => `${p.first_name} ${p.last_name || ''}`.trim());

  async function complete(e) {
    e.stopPropagation();
    if (saving) return;
    setCompleting(true);
    try {
      await api.setTaskCompleted(task.project.id, task.list.id, task.id, true);
      const snapshot = task;
      markCompleted(id, true);
      invalidate.setTasks((old) => (Array.isArray(old) ? old.filter((t) => String(t.id) !== id) : old));
      toast({
        message: `"${task.title}" marked complete`,
        action: 'Undo',
        ttl: 6000,
        onAction: async () => {
          try {
            await api.setTaskCompleted(snapshot.project.id, snapshot.list.id, snapshot.id, false);
            markCompleted(id, false);
            invalidate.setTasks((old) => (Array.isArray(old) ? [snapshot, ...old.filter((t) => String(t.id) !== id)] : old));
            invalidate.tasks();
          } catch (err) { toast({ message: friendlyError(err), tone: 'danger' }); }
        },
      });
      setTimeout(() => invalidate.tasks(), 7000);
    } catch (err) {
      toast({ message: `Couldn't complete task: ${friendlyError(err)}`, tone: 'danger' });
    } finally { setCompleting(false); }
  }

  const cls = ['task', expanded ? 'open' : '', unassigned ? 'unassigned' : '', counts.failed ? 'has-failed' : counts.pending || counts.saving ? 'has-pending' : ''].join(' ');

  return (
    <div className={cls}>
      <div className="task-row" role="button" tabIndex={0} onClick={() => toggleExpanded(id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpanded(id); } }} aria-expanded={expanded}>
        <span className="chev" title={tips.chevron(expanded)}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
        <div className="task-main">
          <div className="task-title">
            {task.orphan ? null : <span className="dot" style={{ background: projectColor || '#9AA3AD' }} title={tips.projectDot(task.project?.name)} />}
            <span className="title-text" title={tips.title(task)}>{task.title}</span>
            {task.ticket && <span className="ticket" title={tips.ticket(task.ticket)}>#{task.ticket}</span>}
            {unassigned && <span className="badge badge-amber" title={tips.unassigned}>Unassigned</span>}
            {unassigned && <button className="btn-link small take" disabled={saving} title={tips.take} onClick={(e) => { e.stopPropagation(); take(task); }}><Hand size={12} /> Take</button>}
          </div>
          <div className="task-sub">
            <span title={tips.project(task.project?.name)}>{task.project?.name}</span>
            {task.list?.name && <><span className="sep">/</span><span title={tips.list(task.list.name)}>{task.list.name}</span></>}
            {canChangeStage ? (
              <select
                className={`stage-select ${stageChange ? 'pending' : ''} ${stageChange?.state === 'failed' ? 'failed' : ''}`}
                value={selectedStageId}
                disabled={saving || stageBusy}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={onStageSelect}
                aria-label={`Stage of "${task.title}"`}
                title={stageChange ? tips.stagePending(stageChange.fromName, stageChange.toName, stageChange.completes, stageChange.error) : tips.stageSelect(task.stage?.name, workflowName)}
              >
                {!stages.some((st) => st.id === currentStageId) && task.stage?.name && <option value={currentStageId}>{task.stage.name}</option>}
                {stages.map((st) => <option key={st.id} value={st.id}>{st.title}{st.id === workflow.doneId ? ' ✓' : ''}</option>)}
              </select>
            ) : (
              task.stage?.name && <span className="stage" title={tips.stage(task.stage.name, workflowName)}>{task.stage.name}</span>
            )}
            {stageChange && <span className="stage-arrow" title={tips.stagePending(stageChange.fromName, stageChange.toName, stageChange.completes, stageChange.error)}>was {stageChange.fromName}{stageChange.completes ? ' · will complete' : ''}</span>}
            {task.start_date && <span className="due" title={tips.start(task.start_date)}><CalendarDays size={12} /> {fmtDate(task.start_date)} →</span>}
            {task.due_date && <span className={isOverdue(task.due_date) ? 'due overdue' : 'due'} title={tips.due(task.due_date, isOverdue(task.due_date))}><CalendarDays size={12} /> {fmtDate(task.due_date)}</span>}
            {(task.estimated_hours || task.estimated_mins) ? <span className="est" title={tips.estimate(task.estimated_hours, task.estimated_mins)}>est. {fmtDuration(task.estimated_hours, task.estimated_mins)}</span> : null}
            {mine && assigned.length > 1 && <span className="muted" title={tips.assignees(assigneeNames)}>+{assigned.length - 1} {assigned.length === 2 ? 'other' : 'others'}</span>}
          </div>
        </div>
        <div className="task-time" title={tips.loggedTotal(task.logged_hours, task.logged_mins, myMinutes)}>
          <Clock size={13} /> {totalLogged}
          {myMinutes > 0 && <span className="muted small"> · you {fmtDuration(0, myMinutes)}</span>}
        </div>
        <div className="task-badges">
          {counts.saving > 0 && <span className="badge badge-teal" title={tips.badgeSaving}>saving…</span>}
          {counts.failed > 0 && <span className="badge badge-red" title={tips.badgeFailed(counts.failed)}>{counts.failed} failed</span>}
          {counts.pending > 0 && <span className="badge badge-amber" title={tips.badgePending(counts.pending)}>{counts.pending} unsaved</span>}
        </div>
        {!task.orphan && mine && stages.length === 0 && (
          <label className="complete" onClick={(e) => e.stopPropagation()} title={tips.complete(task.title)}>
            <input type="checkbox" checked={completing} onChange={complete} disabled={completing || saving} aria-label={`Mark "${task.title}" complete`} />
          </label>
        )}
      </div>
      {expanded && (
        <TaskExpanded task={task} draft={draft} myEntries={myEntries} myTimeLoading={myTimeLoading} saving={saving} />
      )}
    </div>
  );
}
