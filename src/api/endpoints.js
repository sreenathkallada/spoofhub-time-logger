import { request } from './client.js';
import { ApiError } from './errors.js';

export const PAGE = 100;

/** getKey and getBase are read on every call so a change in Settings applies immediately. */
export function makeApi(getKey, getBase) {
  const auth = () => ({ apiKey: getKey(), baseUrl: getBase() });
  const get = (path, query, opts = {}) => request('GET', path, { ...auth(), query, ...opts });
  const post = (path, body, opts = {}) => request('POST', path, { ...auth(), body, ...opts });
  const put = (path, body, opts = {}) => request('PUT', path, { ...auth(), body, ...opts });
  const del = (path, opts = {}) => request('DELETE', path, { ...auth(), ...opts });

  const asArray = (x) => (Array.isArray(x) ? x : x?.todos || x?.time_entries || x?.data || []);

  async function paged(path, query, opts) {
    const all = [];
    let start = 0;
    for (let i = 0; i < 50; i++) { // hard stop at 5,000 records
      const page = asArray(await get(path, { ...query, limit: PAGE, start }, opts));
      all.push(...page);
      if (page.length < PAGE) break;
      start += PAGE;
    }
    return all;
  }

  return {
    getPeople: (opts) => get('people', null, { priority: 'high', ...opts }),
    getProjects: (opts) => get('projects', null, { priority: 'high', ...opts }),
    getWorkflows: (opts) => get('workflows', null, { priority: 'low', ...opts }),

    getOpenTasks: ({ projectId } = {}, opts) =>
      paged('alltodo', projectId ? { projects: projectId } : {}, { priority: 'high', ...opts }),
    getTodolists: (projectId, opts) => get(`projects/${projectId}/todolists`, null, { priority: 'high', ...opts }),
    createTask: (projectId, listId, body, opts) =>
      post(`projects/${projectId}/todolists/${listId}/tasks`, body, { priority: 'high', ...opts }),
    setTaskCompleted: (projectId, listId, taskId, completed, opts) =>
      put(`projects/${projectId}/todolists/${listId}/tasks/${taskId}`, { completed }, { priority: 'high', ...opts }),

    getTimesheets: (projectId, opts) => get(`projects/${projectId}/timesheets`, null, { priority: 'high', ...opts }),
    getMyTime: ({ userId, from, to }, opts) =>
      paged('alltime', { user_id: userId, from_date: from, to_date: to, order_by: 'desc' }, { priority: 'high', ...opts }),
    createTime: (projectId, timesheetId, body, opts) =>
      post(`projects/${projectId}/timesheets/${timesheetId}/time`, { project: projectId, timesheet_id: timesheetId, ...body }, opts),
    updateTime: (projectId, timesheetId, entryId, body, opts) =>
      put(`projects/${projectId}/timesheets/${timesheetId}/time/${entryId}`, body, opts),
    deleteTime: (projectId, timesheetId, entryId, opts) =>
      del(`projects/${projectId}/timesheets/${timesheetId}/time/${entryId}`, opts),
  };
}

/** After a GET by id, SpoofHub returns the whole collection for a bad id. */
export function assertId(result, id) {
  if (!result || Array.isArray(result) || String(result.id) !== String(id)) {
    throw new ApiError('notfound', 'Not found');
  }
  return result;
}
