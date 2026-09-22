// All tooltip text in one place. Functions take the values they describe.
import { fmtDate, fmtDuration } from './time.js';

export const tips = {
  // header
  brand: 'Time Logger — log time against your ProofHub tasks',
  refresh: 'Reload tasks and your time entries from ProofHub. Unsaved rows are kept.',
  newTask: 'Create a new task in ProofHub',
  settings: (name, email) => `Settings and account (${name}${email ? `, ${email}` : ''})`,
  projectFilter: 'Show tasks from one project only, or from all projects you are on',
  scopeFilter: 'Which tasks to show: only those assigned to you, yours plus unassigned ones, or every open task',
  search: 'Filter the list by task title, #ticket number, task list or project name',
  unlinked: (mins) => `${fmtDuration(0, mins)} that you logged straight to timesheets without a task link in the history window. It isn't shown under any task.`,
  taskCount: 'Number of open tasks shown after the current filters',

  // task row
  chevron: (open) => (open ? 'Collapse this task' : 'Expand this task to see and log time'),
  title: (t) => `${t.title}${t.ticket ? ` (#${t.ticket})` : ''}\nClick to expand and log time. Created ${fmtDate(t.created_at)}${t.updated_at ? `, last updated ${fmtDate(t.updated_at)}` : ''}.${t.description ? `\n\n${stripHtml(t.description)}` : ''}`,
  ticket: (n) => `Ticket number #${n} — ProofHub's short reference for this task`,
  projectDot: (name) => `Project colour for ${name}`,
  project: (name) => `Project: ${name}`,
  list: (name) => `Task list inside the project: ${name}`,
  stage: (stage, workflow) => `Workflow stage: ${stage}${workflow ? ` (${workflow} workflow)` : ''}. Change it in ProofHub.`,
  due: (iso, overdue) => `Due date: ${fmtDate(iso)}${overdue ? ' — overdue' : ''}`,
  start: (iso) => `Start date: ${fmtDate(iso)}`,
  estimate: (h, m) => `Estimated effort: ${fmtDuration(h, m)}`,
  loggedTotal: (h, m, myMins) =>
    `Total time logged on this task by everyone: ${fmtDuration(h, m)}${myMins ? `\nYour share in the history window: ${fmtDuration(0, myMins)}` : ''}`,
  assignees: (names) => (names.length ? `Assigned to: ${names.join(', ')}` : 'Nobody is assigned to this task'),
  unassigned: 'No one is assigned to this task in ProofHub. You can still log time on it.',
  notMine: (names) => `Assigned to ${names.join(', ') || 'someone else'}, not to you`,
  badgeSaving: 'Entries on this task are being sent to ProofHub',
  badgeFailed: (n) => `${n} ${n === 1 ? 'change' : 'changes'} on this task failed to save. Expand to see why.`,
  badgePending: (n) => `${n} unsaved ${n === 1 ? 'entry' : 'entries'} on this task. Press Save all to send them.`,
  complete: (title) => `Mark "${title}" complete in ProofHub. It leaves this list; you can undo for a few seconds.`,

  // expanded task
  existingHeader: (days) => `Time entries you logged on this task in the last ${days} days`,
  newHeader: 'Rows you are about to save. Fill in a duration and press Save all.',
  addEntry: 'Add another row (same date and timesheet as the row above). Enter in a description does the same.',
  subtotal: 'Total duration of the valid unsaved rows on this task',
  discardTask: "Remove this task's unsaved rows, edits and deletions",

  // entry row fields
  date: 'Date the work was done (defaults to today, cannot be more than one day ahead)',
  hours: 'Whole hours worked (0–24)',
  mins: 'Additional minutes (0–59)',
  description: 'What you did. Optional, up to 500 characters. Press Enter to add another row.',
  timesheet: 'Which of this project\'s timesheets the entry goes into. Set up by project managers in ProofHub.',
  status: 'Billable: chargeable to the client. Non-billable: internal time. None: no billing category.',
  remove: 'Remove this row (it was never sent to ProofHub)',
  stateSaved: 'Saved to ProofHub',
  stateSaving: 'Sending to ProofHub…',
  stateFailed: (err) => `Failed to save: ${err || 'unknown error'}. Fix the row and press Save all again.`,

  // existing entry
  exDate: (iso) => `Logged on ${fmtDate(iso)}`,
  exDur: (h, m) => `Duration: ${fmtDuration(h, m)}`,
  exDesc: (d) => (d ? `Description: ${d}` : 'No description was given'),
  exTimesheet: (t) => `Timesheet: ${t || 'unknown'}`,
  exStatus: (s) => `Billing status: ${s}`,
  edit: 'Edit this entry (saved when you press Save all)',
  delete: 'Delete this entry from ProofHub (happens when you press Save all)',
  undoDelete: 'Keep this entry after all',
  cancelEdit: 'Cancel editing and keep the original values',

  // save bar
  summary: 'What will be sent to ProofHub when you press Save all',
  invalidRows: 'Rows without a duration or timesheet are skipped, not saved',
  discardAll: 'Throw away every unsaved row, edit and deletion on every task',
  saveAll: 'Send all pending rows, edits and deletions to ProofHub now',
  saveAllDisabled: 'Nothing to save yet, or saving is blocked (see the banner above)',
  stop: 'Stop sending. Rows already sent stay saved; the rest go back to unsaved.',
  progress: 'Progress of the current save. The app pauses automatically if ProofHub asks it to slow down.',
  otherTab: 'Another browser tab is saving right now. Wait for it to finish.',

  // new task modal
  ntProject: 'Project the task belongs to',
  ntList: 'Task list (todolist) inside the project',
  ntTitle: 'Short name of the task as it will appear in ProofHub',
  ntDescription: 'Longer details, optional',
  ntStart: 'When work should start, optional',
  ntDue: 'When it should be finished, optional',
  ntEstimate: 'Expected effort in hours and minutes, optional',
  ntAssign: 'Who the task is assigned to. Untick everyone to create it unassigned.',
  ntCreate: 'Create the task in ProofHub and open it here for logging',

  // settings
  stStatus: 'Pre-selected billing status for every new row',
  stHistory: 'How far back to load your existing entries. Longer windows mean more requests at startup.',
  stChange: 'Enter a different API key or email',
  stSignOut: 'Remove your key and user from this browser. Unsaved rows are discarded.',
  stVerified: 'The key\'s owner matches the email you entered',

  // setup
  suKey: 'Found in ProofHub: profile menu → click your profile picture five times',
  suShowKey: 'Show or hide the key while typing',
  suEmail: 'The email on your ProofHub profile — used only to find your account',
  suNotMe: 'That is not my account — let me try another email',
  suThatsMe: 'Use this account for logging time',
};

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}
