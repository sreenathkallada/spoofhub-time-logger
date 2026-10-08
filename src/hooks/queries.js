import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
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

export function useLabels(enabled = true) {
  const q = useQuery({ queryKey: ['labels'], queryFn: () => api.getLabels(), staleTime: 60 * MIN, enabled, retry: false });
  const byId = useMemo(() => Object.fromEntries((q.data || []).map((l) => [String(l.id), l])), [q.data]);
  return { ...q, byId, list: q.data || [] };
}

export function useWorkflows(enabled = true) {
  return useQuery({ queryKey: ['workflows'], queryFn: () => api.getWorkflows(), staleTime: 60 * MIN, enabled, retry: false });
}

/**
 * Map workflow id -> { stages: [{id, title}], doneId }.
 * The API returns stages in board order; the last one is the completion stage in every workflow.
 */
export function useWorkflowStages() {
  const q = useWorkflows();
  const byWorkflow = useMemo(() => {
    const m = {};
    for (const wf of q.data || []) {
      const stages = (wf.workflow_stages || []).map((s) => ({ id: String(s.id), title: s.title, color: s.color || null }));
      if (stages.length) m[String(wf.id)] = { stages, doneId: stages[stages.length - 1].id };
    }
    return m;
  }, [q.data]);
  return { byWorkflow, loading: q.isLoading, error: q.error };
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

/** Your entries between two ISO dates (inclusive), for the week grid. */
export function useTimeRange(from, to, enabled = true) {
  const userId = useSettings((s) => s.userId);
  return useQuery({
    queryKey: ['mytime', 'range', userId, from, to],
    queryFn: () => api.getMyTime({ userId, from, to }),
    staleTime: 2 * MIN,
    enabled: enabled && Boolean(userId && from && to),
  });
}

/** Usable timesheets for several projects at once: { [projectId]: Timesheet[] } plus a loading flag. */
export function useProjectTimesheets(projectIds) {
  const userId = useSettings((s) => s.userId);
  const ids = useMemo(() => [...new Set((projectIds || []).filter(Boolean).map(String))].sort(), [projectIds]);
  const results = useQueries({
    queries: ids.map((pid) => ({ queryKey: ['timesheets', Number(pid) || pid], queryFn: () => api.getTimesheets(pid), staleTime: 30 * MIN })),
  });
  return useMemo(() => {
    const m = {};
    ids.forEach((pid, i) => { m[pid] = usableTimesheets(results[i].data, userId); });
    return { byProject: m, loading: results.some((r) => r.isLoading) };
  }, [ids, results, userId]);
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
