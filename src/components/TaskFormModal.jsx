import { useEffect, useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useSettings } from '../store/settings.js';
import { useTodolists, useInvalidate, useLabels } from '../hooks/queries.js';
import { api } from '../hooks/useApi.js';
import { friendlyError } from '../api/errors.js';
import { tips } from '../utils/tips.js';

const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();

/** Create a task (no `task` prop) or edit an existing one (`task` given). */
export default function TaskFormModal({ task, projects, peopleById, onClose, onCreated, onUpdated }) {
  const s = useSettings();
  const invalidate = useInvalidate();
  const labels = useLabels();
  const editing = Boolean(task);
  const [projectId, setProjectId] = useState(task ? String(task.project?.id) : (s.projectFilter || ''));
  const [listId, setListId] = useState(task ? String(task.list?.id) : '');
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task ? stripHtml(task.description) : '');
  const [startDate, setStartDate] = useState(task?.start_date ? String(task.start_date).slice(0, 10) : '');
  const [dueDate, setDueDate] = useState(task?.due_date ? String(task.due_date).slice(0, 10) : '');
  const [estH, setEstH] = useState(task?.estimated_hours ?? '');
  const [estM, setEstM] = useState(task?.estimated_mins ?? '');
  const initialAssigned = (task?.assigned || []).map(String);
  const [assignMe, setAssignMe] = useState(task ? initialAssigned.includes(String(s.userId)) : true);
  const [others, setOthers] = useState(task ? initialAssigned.filter((id) => id !== String(s.userId)) : []);
  const [selLabels, setSelLabels] = useState((task?.labels || []).map(String));
  const [progress, setProgress] = useState(Number(task?.percent_progress) || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lists = useTodolists(projectId, !editing);
  useEffect(() => { if (!editing) { setListId(''); setOthers([]); } }, [projectId, editing]);

  const myProjects = projects.filter((p) => !p.archived && !p.template).sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const project = projects.find((p) => String(p.id) === String(projectId));
  const members = useMemo(() => (project?.assigned || []).map((id) => peopleById[String(id)]).filter((p) => p && !p.suspended && String(p.id) !== String(s.userId))
    .sort((a, b) => String(a.first_name).localeCompare(String(b.first_name))), [project, peopleById, s.userId]);
  // assignees on the task who aren't project members any more still need to be shown so they aren't silently dropped
  const extraAssignees = others.filter((id) => !members.some((m) => String(m.id) === id)).map((id) => peopleById[id]).filter(Boolean);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const assigned = [...(assignMe ? [s.userId] : []), ...others.map(Number)];
    try {
      if (!editing) {
        const body = { title: title.trim() };
        if (description.trim()) body.description = description.trim();
        if (startDate) body.start_date = startDate;
        if (dueDate) body.due_date = dueDate;
        if (estH !== '' || estM !== '') { body.estimated_hours = Number(estH) || 0; body.estimated_mins = Number(estM) || 0; }
        if (assigned.length) body.assigned = assigned;
        if (selLabels.length) body.labels = selLabels.map(Number);
        let created = await api.createTask(projectId, listId, body);
        if (!created?.id) throw new Error('SpoofHub did not return the new task');
        if (progress > 0) {
          try { created = (await api.updateTask(projectId, listId, created.id, { percent_progress: progress })) || created; }
          catch (err) { setError(`Task created, but progress could not be set: ${friendlyError(err)}`); }
        }
        invalidate.setTasks((old) => (Array.isArray(old) ? [created, ...old.filter((t) => String(t.id) !== String(created.id))] : old));
        invalidate.tasks();
        onCreated(created);
      } else {
        // send only what changed
        const body = {};
        if (title.trim() !== task.title) body.title = title.trim();
        if (description.trim() !== stripHtml(task.description)) body.description = description.trim();
        if ((startDate || '') !== (task.start_date ? String(task.start_date).slice(0, 10) : '')) body.start_date = startDate || null;
        if ((dueDate || '') !== (task.due_date ? String(task.due_date).slice(0, 10) : '')) body.due_date = dueDate || null;
        const eh = Number(estH) || 0, em = Number(estM) || 0;
        if (eh !== (Number(task.estimated_hours) || 0) || em !== (Number(task.estimated_mins) || 0)) { body.estimated_hours = eh; body.estimated_mins = em; }
        const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
        if (!sameSet(assigned.map(String), initialAssigned)) body.assigned = assigned;
        if (!sameSet(selLabels, (task.labels || []).map(String))) body.labels = selLabels.map(Number);
        if (progress !== (Number(task.percent_progress) || 0)) body.percent_progress = progress;
        if (!Object.keys(body).length) { onClose(); return; }
        const updated = await api.updateTask(task.project.id, task.list.id, task.id, body);
        const merged = updated?.id ? updated : { ...task, ...body };
        invalidate.setTasks((old) => (Array.isArray(old) ? old.map((t) => (String(t.id) === String(task.id) ? { ...t, ...merged } : t)) : old));
        onUpdated(merged);
      }
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  const toggleLabel = (id) => setSelLabels((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="nt-title">
        <div className="modal-head">
          <h2 id="nt-title">{editing ? 'Edit task' : 'New task'}{editing && task.ticket ? <span className="ticket"> #{task.ticket}</span> : null}</h2>
          <button type="button" className="icon-btn" aria-label="Close" title={tips.close} onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid2">
          <label className="field" title={tips.ntProject}><span>Project</span>
            {editing ? <input value={task.project?.name || ''} disabled /> : (
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required autoFocus>
                <option value="">Choose…</option>
                {myProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
          </label>
          <label className="field" title={tips.ntList}><span>Task list</span>
            {editing ? <input value={task.list?.name || ''} disabled /> : (
              <select value={listId} onChange={(e) => setListId(e.target.value)} required disabled={!projectId || lists.isLoading}>
                <option value="">{!projectId ? 'Choose a project first' : lists.isLoading ? 'Loading…' : 'Choose…'}</option>
                {(lists.data || []).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            )}
          </label>
        </div>
        <label className="field" title={tips.ntTitle}><span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={250} placeholder="What needs doing" autoFocus={editing} />
        </label>
        <label className="field" title={tips.ntDescription}><span>Description <em className="muted">optional{editing && /<[a-z][\s\S]*>/i.test(task.description || '') ? ' · formatting from SpoofHub is shown as plain text' : ''}</em></span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <div className="grid3">
          <label className="field" title={tips.ntStart}><span>Start date</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="field" title={tips.ntDue}><span>Due date</span><input type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} /></label>
          <div className="field" title={tips.ntEstimate}><span>Estimate</span>
            <div className="input-row">
              <input type="number" min="0" placeholder="h" value={estH} onChange={(e) => setEstH(e.target.value)} aria-label="Estimated hours" />
              <input type="number" min="0" max="59" placeholder="m" value={estM} onChange={(e) => setEstM(e.target.value)} aria-label="Estimated minutes" />
            </div>
          </div>
        </div>

        <div className="grid2">
          <fieldset className="field" title={tips.ntLabels}>
            <legend>Labels</legend>
            {labels.isLoading && <span className="muted small">Loading…</span>}
            {labels.error && <span className="error-text">Couldn't load labels</span>}
            <div className="label-picker">
              {labels.list.map((l) => {
                const on = selLabels.includes(String(l.id));
                return (
                  <button type="button" key={l.id} className={`label-chip ${on ? 'on' : ''}`} style={{ '--chip': l.color || '#8a94a0' }} aria-pressed={on} title={tips.label(l.name)} onClick={() => toggleLabel(String(l.id))}>
                    {on && <Check size={11} />}{l.name}
                  </button>
                );
              })}
              {!labels.isLoading && labels.list.length === 0 && <span className="muted small">No labels in your account.</span>}
            </div>
          </fieldset>
          <label className="field" title={tips.ntProgress}><span>Progress <strong>{progress}%</strong></span>
            <div className="input-row">
              <input type="range" min="0" max="100" step="5" value={progress} onChange={(e) => setProgress(Number(e.target.value))} aria-label="Progress percent" />
              <input type="number" min="0" max="100" value={progress} onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} aria-label="Progress percent" style={{ width: 70 }} />
            </div>
          </label>
        </div>

        <fieldset className="field" title={tips.ntAssign}>
          <legend>Assign to</legend>
          <label className="check"><input type="checkbox" checked={assignMe} onChange={(e) => setAssignMe(e.target.checked)} /> Me ({s.userName})</label>
          {(members.length > 0 || extraAssignees.length > 0) && (
            <div className="member-list">
              {[...extraAssignees, ...members].map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={others.includes(String(p.id))} onChange={(e) => setOthers((xs) => e.target.checked ? [...xs, String(p.id)] : xs.filter((x) => x !== String(p.id)))} />
                  {p.first_name} {p.last_name}
                </label>
              ))}
            </div>
          )}
          {!assignMe && others.length === 0 && <p className="muted small">The task will be {editing ? 'left' : 'created'} unassigned.</p>}
        </fieldset>

        {error && <p className="error-text">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose} title={tips.close}>Cancel</button>
          <button className="btn btn-primary" title={editing ? tips.ntSave : tips.ntCreate} disabled={busy || !projectId || !listId || !title.trim()}>{busy ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create task')}</button>
        </div>
      </form>
    </div>
  );
}
