import { useCallback } from 'react';
import { api } from './useApi.js';
import { useSettings } from '../store/settings.js';
import { useInvalidate } from './queries.js';
import { friendlyError } from '../api/errors.js';
import { useToast } from '../components/Toast.jsx';

/** Assign an unassigned task to the current user, with undo. Immediate, not part of Save all. */
export function useTakeTask() {
  const userId = useSettings((s) => s.userId);
  const invalidate = useInvalidate();
  const toast = useToast();
  return useCallback(async (task) => {
    const id = String(task.id);
    const patchCache = (assigned) => invalidate.setTasks((old) => (Array.isArray(old) ? old.map((t) => (String(t.id) === id ? { ...t, assigned } : t)) : old));
    try {
      await api.assignTask(task.project.id, task.list.id, task.id, [userId]);
      patchCache([userId]);
      toast({
        message: `"${task.title}" is now assigned to you`, action: 'Undo', ttl: 6000,
        onAction: async () => {
          try { await api.assignTask(task.project.id, task.list.id, task.id, []); patchCache([]); }
          catch (err) { toast({ message: `Couldn't undo: ${friendlyError(err)}`, tone: 'danger' }); }
        },
      });
      setTimeout(() => invalidate.tasks(), 7000);
    } catch (err) {
      toast({ message: `Couldn't take the task: ${friendlyError(err)}`, tone: 'danger' });
    }
  }, [userId, invalidate, toast]);
}
