import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../store/settings.js';
import { useDrafts } from '../store/drafts.js';
import { useMyTime, usePeople, useProjects, useTasks, useInvalidate } from '../hooks/queries.js';
import { useSaveAll, usePendingSummary } from '../hooks/useSaveAll.js';
import { useToast } from './Toast.jsx';
import Header from './Header.jsx';
import TaskList from './TaskList.jsx';
import SaveBar from './SaveBar.jsx';
import NewTaskModal from './NewTaskModal.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import SetupScreen from './SetupScreen.jsx';

export default function MainScreen() {
  const settings = useSettings();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [search, setSearch] = useState('');
  const [online, setOnline] = useState(navigator.onLine);

  const projects = useProjects();
  const people = usePeople();
  const tasks = useTasks(settings.projectFilter);
  const myTime = useMyTime();

  const pending = usePendingSummary();
  const save = useSaveAll(({ ok, failed }) => {
    if (failed) toast({ message: `${ok} saved · ${failed} failed — fix the highlighted rows and save again`, tone: 'warn', ttl: 8000 });
    else toast({ message: `${ok} ${ok === 1 ? 'change' : 'changes'} saved to ProofHub`, tone: 'success' });
  });

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Identity cross-check: things marked by_me must have been created by the chosen user.
  const identityMismatch = useMemo(() => {
    const creators = new Set();
    for (const t of tasks.data || []) if (t.by_me && t.creator?.id) creators.add(String(t.creator.id));
    for (const e of myTime.data || []) if (e.by_me && e.creator?.id) creators.add(String(e.creator.id));
    if (!creators.size) return false;
    return !creators.has(String(settings.userId));
  }, [tasks.data, myTime.data, settings.userId]);

  useEffect(() => {
    if (!tasks.data || !myTime.data) return;
    if (!identityMismatch && !settings.identityVerified) settings.set({ identityVerified: true });
  }, [tasks.data, myTime.data, identityMismatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const authError = [projects, people, tasks, myTime].find((q) => q.error?.kind === 'auth')?.error;
  const otherError = [projects, tasks, myTime].find((q) => q.error && q.error.kind !== 'auth')?.error;

  const peopleById = useMemo(() => {
    const m = {};
    for (const p of people.data || []) m[String(p.id)] = p;
    return m;
  }, [people.data]);

  const canSave = online && !authError && !identityMismatch && !save.running && pending.total > 0;

  return (
    <div className="app">
      <Header
        projects={projects.data || []}
        search={search}
        onSearch={setSearch}
        onRefresh={() => invalidate.all()}
        refreshing={tasks.isFetching || myTime.isFetching}
        onNewTask={() => setShowNewTask(true)}
        onSettings={() => setShowSettings(true)}
        savingLocked={save.running}
        unlinkedMinutes={myTime.unlinkedMinutes}
      />

      {!online && <div className="banner banner-warn">You're offline. Drafts are kept; saving resumes when you're back.</div>}
      {authError && (
        <div className="banner banner-danger">
          Your API key was rejected by ProofHub. <button className="btn-link" onClick={() => setReauth(true)}>Update key</button>
        </div>
      )}
      {identityMismatch && (
        <div className="banner banner-danger">
          The API key belongs to a different user than the email you entered. Saving is blocked until you sign in again.{' '}
          <button className="btn-link" onClick={() => setReauth(true)}>Sign in again</button>
        </div>
      )}
      {otherError && !authError && (
        <div className="banner banner-warn">Couldn't load from ProofHub: {otherError.message}. <button className="btn-link" onClick={() => invalidate.all()}>Retry</button></div>
      )}

      <main className="content">
        <TaskList
          tasks={tasks.data}
          loading={tasks.isLoading}
          search={search}
          projects={projects.data || []}
          peopleById={peopleById}
          myTimeByTask={myTime.byTask}
          myTimeLoading={myTime.isLoading}
          saving={save.running}
        />
      </main>

      <SaveBar
        pending={pending}
        running={save.running}
        progress={save.progress}
        queueState={save.queueState}
        lockedByOther={save.lockedByOther}
        canSave={canSave}
        onSave={save.saveAll}
        onCancel={save.cancel}
        onDiscard={() => {
          if (confirm('Discard all unsaved entries, edits and deletions?')) useDrafts.getState().discardAll();
        }}
      />

      {showNewTask && (
        <NewTaskModal
          projects={projects.data || []}
          peopleById={peopleById}
          onClose={() => setShowNewTask(false)}
          onCreated={(task) => {
            setShowNewTask(false);
            toast({ message: `Task created: ${task.title}`, tone: 'success' });
            useDrafts.getState().setExpanded(String(task.id), true);
          }}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} onChangeAccount={() => { setShowSettings(false); setReauth(true); }} />}
      {reauth && (
        <div className="modal-backdrop">
          <SetupScreen initialStep={1} onClose={() => { setReauth(false); invalidate.all(); }} />
        </div>
      )}
    </div>
  );
}
