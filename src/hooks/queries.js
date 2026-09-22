import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from './useApi.js';
import { useSettings } from '../store/settings.js';
import { addDaysISO, todayISO } from '../utils/time.js';
import { usableTimesheets } from '../utils/timesheetDefault.js';

const MIN = 60_000;

export function usePeople(enabled = true) {
  return useQuery({ queryKey: ['people'], queryFn: () => api.getPeople(), staleTime: 60 * MIN, enabled });
}

export function useProjects(enabled = true) {
  return useQuery({ queryKey: ['projects'], queryFn: () => api.getProjects(), staleTime: 15 * MIN, enabled });
}

export function useWorkflows(enabled = true) {
  return useQuery({ queryKey: ['workflows'], queryFn: () => api.getWorkflows(), staleTime: 60 * MIN, enabled, retry: false });
}

/** Map stage id -> colour, from workflows (best effort). */
export function useStageColors() {
  const { data } = useWorkflows();
  return useMemo(() => {
    const m = {};
    for (const wf of data || []) for (const st of wf.workflow_stages || []) m[String(st.id)] = st.color;
    return m;
  }, [data]);
}

export function useTasks(projectId, enabled = true) {
  return useQuery({
    queryKey: ['tasks', projectId || 'all'],
    queryFn: () => api.getOpenTasks({ projectId: projectId || undefined }),
    staleTime: 2 * MIN,
    enabled,
  });
}

export function useMyTime(enabled = true) {
  const userId = useSettings((s) => s.userId);
  const days = useSettings((s) => s.daysOfHistory);
  const to = addDaysISO(todayISO(), 1);
  const from = addDaysISO(todayISO(), -days);
  const q = useQuery({
    queryKey: ['mytime', userId, days],
    queryFn: () => api.getMyTime({ userId, from, to }),
    staleTime: 2 * MIN,
    enabled: enabled && Boolean(userId),
  });
  const byTask = useMemo(() => {
    const m = {};
    let unlinked = 0;
    for (const e of q.data || []) {
      const tid = e?.task?.task_id ?? e?.task?.id;
      if (tid) (m[String(tid)] ||= []).push(e);
      else unlinked += (Number(e.logged_hours) || 0) * 60 + (Number(e.logged_mins) || 0);
    }
    for (const arr of Object.values(m)) arr.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return { byTask: m, unlinkedMinutes: unlinked };
  }, [q.data]);
  return { ...q, ...byTask };
}

export function useTimesheets(projectId, enabled = true) {
  const userId = useSettings((s) => s.userId);
  const q = useQuery({
    queryKey: ['timesheets', projectId],
    queryFn: () => api.getTimesheets(projectId),
    staleTime: 30 * MIN,
    enabled: enabled && Boolean(projectId),
  });
  const usable = useMemo(() => usableTimesheets(q.data, userId), [q.data, userId]);
  return { ...q, usable };
}

export function useTodolists(projectId, enabled = true) {
  return useQuery({
    queryKey: ['todolists', projectId],
    queryFn: () => api.getTodolists(projectId),
    staleTime: 30 * MIN,
    enabled: enabled && Boolean(projectId),
    select: (lists) => (lists || []).filter((l) => !l.archived),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return {
    tasks: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    time: () => qc.invalidateQueries({ queryKey: ['mytime'] }),
    all: () => qc.invalidateQueries(),
    setTasks: (updater) => qc.setQueriesData({ queryKey: ['tasks'] }, updater),
  };
}
