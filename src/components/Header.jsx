import { RefreshCw, Plus, Settings, Clock, Search } from 'lucide-react';
import { useSettings } from '../store/settings.js';
import { fmtMinutes } from '../utils/time.js';
import Avatar from './Avatar.jsx';
import { tips } from '../utils/tips.js';
import { hostOf } from '../utils/baseUrl.js';

export default function Header({ projects, search, onSearch, onRefresh, refreshing, onNewTask, onSettings, savingLocked, unlinkedMinutes, tab, onTab }) {
  const s = useSettings();
  const myProjects = projects
    .filter((p) => !p.archived && !p.template)
    .filter((p) => !p.assigned?.length || p.assigned.map(String).includes(String(s.userId)))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
  const list = myProjects.length ? myProjects : projects.filter((p) => !p.archived);

  return (
    <header className="header">
      <div className="header-top">
        <div className="brand" title={tips.brand}><Clock size={20} /><span>Time Logger</span></div>
        <nav className="tabs" aria-label="View">
          <button className={tab === 'tasks' ? 'active' : ''} onClick={() => onTab('tasks')} title={tips.tabTasks}>Tasks</button>
          <button className={tab === 'week' ? 'active' : ''} onClick={() => onTab('week')} title={tips.tabWeek}>Week</button>
        </nav>
        <div className="spacer" />
        <button className="btn" onClick={onRefresh} disabled={refreshing || savingLocked} title={tips.refresh}>
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
        </button>
        <button className="btn" onClick={onNewTask} title={tips.newTask}><Plus size={15} /> New task</button>
        <button className="btn icon-only" onClick={onSettings} aria-label="Settings" title={tips.settings(s.userName, `${s.userEmail} · ${hostOf(s.baseUrl)}`)}>
          <Avatar initials={s.userInitials} color={s.userColor} name={s.userName} size={26} />
        </button>
      </div>
      {tab === 'tasks' && <div className="header-filters">
        <select value={s.projectFilter} onChange={(e) => s.set({ projectFilter: e.target.value })} aria-label="Project" title={tips.projectFilter}>
          <option value="">All projects</option>
          {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <select value={s.scope} onChange={(e) => s.set({ scope: e.target.value })} aria-label="Assignment" title={tips.scopeFilter}>
          <option value="mine">Assigned to me</option>
          <option value="mine+unassigned">Mine + unassigned</option>
          <option value="unassigned">Unassigned only</option>
        </select>
        <label className="search" title={tips.search}>
          <Search size={15} />
          <input type="search" value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search title, #ticket, list" aria-label="Search tasks" />
        </label>
        {unlinkedMinutes > 0 && (
          <span className="muted small" title={tips.unlinked(unlinkedMinutes)}>
            {fmtMinutes(unlinkedMinutes)} not linked to tasks
          </span>
        )}
      </div>}
    </header>
  );
}
