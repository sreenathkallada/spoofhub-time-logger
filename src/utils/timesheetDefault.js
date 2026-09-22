/**
 * Section 8 of the plan: pick a default timesheet for a new entry row.
 * Returns a timesheet id or null.
 */
export function defaultTimesheetId({ prevRow, lastUsed = {}, task, myEntries = [], timesheets = [] }) {
  const valid = new Set(timesheets.map((t) => String(t.id)));
  const ok = (id) => (id && valid.has(String(id)) ? id : null);
  return (
    ok(prevRow?.timesheetId) ||
    ok(lastUsed[`task:${task?.id}`]) ||
    ok(myEntries.find((e) => e?.timesheet?.id)?.timesheet?.id) ||
    ok(task?.timesheet_id) ||
    ok(lastUsed[String(task?.project?.id)]) ||
    null
  );
}

/** Timesheets a user may log into: not archived, and public or assigned to them. */
export function usableTimesheets(timesheets, userId) {
  return (timesheets || [])
    .filter((t) => !t.archived)
    .filter((t) => !t.private || !t.assigned?.length || t.assigned.map(String).includes(String(userId)))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}
