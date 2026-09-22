import { useMemo } from 'react';
import { useSettings } from '../store/settings.js';
import { useDrafts, hasMeaningfulDrafts } from '../store/drafts.js';
import { useStageColors } from '../hooks/queries.js';
import TaskRow from './TaskRow.jsx';
import { tips } from '../utils/tips.js';

export default function TaskList({ tasks, loading, search, projects, peopleById, myTimeByTask, myTimeLoading, saving }) {
  const scope = useSettings((s) => s.scope);
  const userId = useSettings((s) => s.userId);
  const drafts = useDrafts((s) => s.drafts);
  const expanded = useDrafts((s) => s.expanded);
  const completedIds = useDrafts((s) => s.completedIds);
  const stageColors = useStageColors();

  const projectColor = useMemo(() => {
    const m = {};
    for (const p of projects) m[String(p.id)] = p.color;
    return m;
  }, [projects]);

  const visible = useMemo(() => {
    if (!tasks) return [];
    const me = String(userId);
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => !t.completed && !t.template && !completedIds.includes(String(t.id)))
      .filter((t) => {
        const assigned = (t.assigned || []).map(String);
        const mine = assigned.includes(me);
        if (scope === 'mine') return mine;
        if (scope === 'mine+unassigned') return mine || assigned.length === 0;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.title} #${t.ticket} ${t.list?.name || ''} ${t.project?.name || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) =>
        String(a.project?.name).localeCompare(String(b.project?.name)) ||
        String(a.list?.name).localeCompare(String(b.list?.name)) ||
        String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  }, [tasks, scope, userId, search, completedIds]);

  const knownIds = useMemo(() => new Set((tasks || []).map((t) => String(t.id))), [tasks]);
  const orphanDrafts = Object.entries(drafts).filter(([id, d]) => !knownIds.has(String(id)) && hasMeaningfulDrafts(d));

  if (loading) return <div className="empty">Loading your tasks from ProofHub…</div>;
  if (!tasks) return null;

  return (
    <div className="tasklist">
      <div className="tasklist-meta" title={tips.taskCount}>{visible.length} {visible.length === 1 ? 'task' : 'tasks'}{search ? ' match' : ''}</div>
      {visible.length === 0 && (
        <div className="empty">
          {search ? 'Nothing matches that search.' : scope === 'mine' ? 'No open tasks are assigned to you. Try "Mine + unassigned", or create a task.' : 'No open tasks here.'}
        </div>
      )}
      {visible.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          expanded={expanded.includes(String(t.id))}
          draft={drafts[String(t.id)]}
          projectColor={projectColor[String(t.project?.id)]}
          stageColor={stageColors[String(t.stage?.id)]}
          workflowName={t.workflow?.name}
          peopleById={peopleById}
          myEntries={myTimeByTask[String(t.id)] || []}
          myTimeLoading={myTimeLoading}
          saving={saving}
        />
      ))}
      {orphanDrafts.length > 0 && (
        <section className="orphans">
          <h3>Unsaved work on tasks no longer in your list</h3>
          <p className="muted small">These tasks were completed, reassigned, or deleted in ProofHub since you started. Your entries are kept here.</p>
          {orphanDrafts.map(([id, d]) => (
            <TaskRow
              key={id}
              task={{ id, title: d.meta?.title || `Task ${id}`, project: { id: d.meta?.projectId, name: d.meta?.projectName }, list: { id: d.meta?.listId, name: d.meta?.listName }, assigned: [], orphan: true }}
              expanded={expanded.includes(String(id))}
              draft={d}
              peopleById={peopleById}
              myEntries={myTimeByTask[String(id)] || []}
              saving={saving}
            />
          ))}
        </section>
      )}
    </div>
  );
}
