import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../store/settings.js';
import { useTodolists, useInvalidate } from '../hooks/queries.js';
import { api } from '../hooks/useApi.js';
import { friendlyError } from '../api/errors.js';
import { tips } from '../utils/tips.js';

export default function NewTaskModal({ projects, peopleById, onClose, onCreated }) {
  const s = useSettings();
  const invalidate = useInvalidate();
  const [projectId, setProjectId] = useState(s.projectFilter || '');
  const [listId, setListId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estH, setEstH] = useState('');
  const [estM, setEstM] = useState('');
  const [assignMe, setAssignMe] = useState(true);
  const [others, setOthers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const lists = useTodolists(projectId);
  useEffect(() => { setListId(''); setOthers([]); }, [projectId]);

  const myProjects = projects.filter((p) => !p.archived && !p.template).sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const project = projects.find((p) => String(p.id) === String(projectId));
  const members = (project?.assigned || []).map((id) => peopleById[String(id)]).filter((p) => p && !p.suspended && String(p.id) !== String(s.userId))
    .sort((a, b) => String(a.first_name).localeCompare(String(b.first_name)));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const assigned = [...(assignMe ? [s.userId] : []), ...others.map(Number)];
    const body = { title: title.trim() };
    if (description.trim()) body.description = description.trim();
    if (startDate) body.start_date = startDate;
    if (dueDate) body.due_date = dueDate;
    if (estH !== '' || estM !== '') { body.estimated_hours = Number(estH) || 0; body.estimated_mins = Number(estM) || 0; }
    if (assigned.length) body.assigned = assigned;
    try {
      const task = await api.createTask(projectId, listId, body);
      if (!task?.id) throw new Error('ProofHub did not return the new task');
      invalidate.setTasks((old) => (Array.isArray(old) ? [task, ...old.filter((t) => String(t.id) !== String(task.id))] : old));
      invalidate.tasks();
      onCreated(task);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="nt-title">
        <div className="modal-head">
          <h2 id="nt-title">New task</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="grid2">
          <label className="field" title={tips.ntProject}><span>Project</span>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required autoFocus>
              <option value="">Choose…</option>
              {myProjects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          <label className="field" title={tips.ntList}><span>Task list</span>
            <select value={listId} onChange={(e) => setListId(e.target.value)} required disabled={!projectId || lists.isLoading}>
              <option value="">{!projectId ? 'Choose a project first' : lists.isLoading ? 'Loading…' : 'Choose…'}</option>
              {(lists.data || []).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
        </div>
        <label className="field" title={tips.ntTitle}><span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={250} placeholder="What needs doing" />
        </label>
        <label className="field" title={tips.ntDescription}><span>Description <em className="muted">optional</em></span>
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
        <fieldset className="field" title={tips.ntAssign}>
          <legend>Assign to</legend>
          <label className="check"><input type="checkbox" checked={assignMe} onChange={(e) => setAssignMe(e.target.checked)} /> Me ({s.userName})</label>
          {members.length > 0 && (
            <div className="member-list">
              {members.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={others.includes(String(p.id))} onChange={(e) => setOthers((xs) => e.target.checked ? [...xs, String(p.id)] : xs.filter((x) => x !== String(p.id)))} />
                  {p.first_name} {p.last_name}
                </label>
              ))}
            </div>
          )}
          {!assignMe && others.length === 0 && <p className="muted small">The task will be created unassigned.</p>}
        </fieldset>

        {error && <p className="error-text">{error}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" title={tips.ntCreate} disabled={busy || !projectId || !listId || !title.trim()}>{busy ? 'Creating…' : 'Create task'}</button>
        </div>
      </form>
    </div>
  );
}
