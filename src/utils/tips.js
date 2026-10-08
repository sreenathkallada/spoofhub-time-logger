// All tooltip text in one place. Functions take the values they describe.
import { fmtDate, fmtDuration } from './time.js';
import { descriptionText } from './html.js';

export const tips = {
  // header
  brand: 'Time Logger — log time against your SpoofHub tasks',
  refresh: 'Reload tasks and your time entries from SpoofHub. Unsaved rows are kept.',
  newTask: 'Create a new task in SpoofHub',
  settings: (name, email) => `Settings and account (${name}${email ? `, ${email}` : ''})`,
  projectFilter: 'Show tasks from one project only, or from all projects you are on',
  scopeFilter: 'Which tasks to show: only those assigned to you, yours plus unassigned ones, or only unassigned ones',
  search: 'Filter the list by task title, #ticket number, task list or project name',
  unlinked: (mins) => `${fmtDuration(0, mins)} that you logged straight to timesheets without a task link in the history window. It isn't shown under any task.`,
  taskCount: 'Number of open tasks shown after the current filters',

  // task row
  chevron: (open) => (open ? 'Collapse this task' : 'Expand this task to see and log time'),
  title: (t) => `${t.title}${t.ticket ? ` (#${t.ticket})` : ''}\nClick to expand and log time. Created ${fmtDate(t.created_at)}${t.updated_at ? `, last updated ${fmtDate(t.updated_at)}` : ''}.${t.description ? `\n\n${descriptionText(t.description)}` : ''}`,
  ticket: (n) => `Ticket number #${n} — SpoofHub's short reference for this task`,
  projectDot: (name) => `Project colour for ${name}`,
  project: (name) => `Project: ${name}`,
  list: (name) => `Task list inside the project: ${name}`,
  stage: (stage, workflow) => `Workflow stage: ${stage}${workflow ? ` (${workflow} workflow)` : ''}. Only people assigned to the task can change it here.`,
  stageSelect: (stage, workflow) => `Workflow stage: ${stage}${workflow ? ` (${workflow} workflow)` : ''}. Pick a new stage; it is sent when you press Save all. The last stage (✓) also completes the task.`,
  stagePending: (from, to, completes, err) => err ? `Stage change failed: ${err}` : `Stage will change from ${from} to ${to}${completes ? ' and the task will be marked complete' : ''} when you press Save all. Select the original stage to cancel.`,
  due: (iso, overdue) => `Due date: ${fmtDate(iso)}${overdue ? ' — overdue' : ''}`,
  start: (iso) => `Start date: ${fmtDate(iso)}`,
  estimate: (h, m) => `Estimated effort: ${fmtDuration(h, m)}`,
  loggedTotal: (h, m, myMins) =>
    `Total time logged on this task by everyone: ${fmtDuration(h, m)}${myMins ? `\nYour share in the history window: ${fmtDuration(0, myMins)}` : ''}`,
  assignees: (names) => (names.length ? `Assigned to: ${names.join(', ')}` : 'Nobody is assigned to this task'),
  unassigned: 'No one is assigned to this task in SpoofHub. You can still log time on it.',
  badgeSaving: 'Entries on this task are being sent to SpoofHub',
  badgeFailed: (n) => `${n} ${n === 1 ? 'change' : 'changes'} on this task failed to save. Expand to see why.`,
  badgePending: (n) => `${n} unsaved ${n === 1 ? 'entry' : 'entries'} on this task. Press Save all to send them.`,
  complete: (title) => `Mark "${title}" complete in SpoofHub. It leaves this list; you can undo for a few seconds.`,

  // week view
  tabTasks: 'Task list: expand a task to log time, change stages, add comments',
  tabWeek: 'Week grid: type hours per task per day for the whole week at once',
  weekPrev: 'Previous week', weekNext: 'Next week', weekThis: 'Jump to the current week',
  weekTitle: 'The Monday–Friday week shown in the grid',
  weekTotal: (target) => `Hours in this week across all tasks${target ? `, against ${Math.round(target / 60 * 100) / 100}h per day × 5 (set the daily target in Settings)` : ''}`,
  copyLastWeek: 'Create draft rows for this week from last week\'s entries (same tasks, durations and timesheets, no descriptions). Nothing is saved until you press Save all.',
  addTaskRow: 'Add an open task as a row so you can type hours against it',
  weekTaskCol: 'One row per task. Rows appear when a task has time this week, or when you add it.',
  weekDay: (iso, isToday) => `${fmtDate(iso)}${isToday ? ' — today' : ''}. Type hours into the cells below.`,
  weekRowTotal: 'Hours on this task in the shown week',
  weekRowTask: (t) => `${t.title}${t.ticket ? ` (#${t.ticket})` : ''}\n${t.project?.name || ''}${t.list?.name ? ` / ${t.list.name}` : ''}`,
  weekStub: 'This task is no longer in your open list (completed, reassigned or filtered), but you logged time on it this week',
  take: 'Assign this task to yourself in SpoofHub so you can change its stage. You can undo for a few seconds.',
  removeRow: 'Remove this row from the grid (it has no entries)',
  removeRowCol: 'Rows you added by hand can be removed here while they have no entries',
  close: 'Close',
  done: 'Close settings; changes apply immediately',
  weekUnlinked: 'Time logged straight to a timesheet without a task. Shown for completeness; it cannot be edited here.',
  weekDayTotal: (target) => `Hours per day across all rows${target ? ` — green when at or above your ${Math.round(target / 60 * 100) / 100}h target, amber below` : ''}`,
  weekDayTotalCell: (mins, target) => `${fmtDuration(0, mins)} logged${target ? ` of ${fmtDuration(0, target)} target` : ''}`,
  weekCell: (data, day, multi) => multi
    ? `${data.count} entries totalling ${fmtDuration(0, data.total)} on ${fmtDate(day)}. Click to see and edit them.`
    : `Hours on ${fmtDate(day)}. Type 2, 1.5, 1:30 or 1h 30m; clear to remove. ${data.pending ? 'Unsaved — press Save all.' : ''}${data.invalid ? ' Incomplete: open the details to choose a timesheet.' : ''}${data.failed ? ' Last save failed; open the details.' : ''}`,
  weekCellMore: 'Open the entries for this cell: descriptions, timesheet, status, several entries per day',
  weekCellMulti: (n) => `${n} entries in this cell`,
  pickerSearch: 'Type to filter your open tasks',
  pickerItem: (t, mine) => `Add "${t.title}" to the week${mine ? '' : ' (not assigned to you — you can still log time on it)'}`,
  // task form / labels / progress
  ntLabels: 'Labels from your account, as coloured tags on the task. Click to toggle.',
  ntProgress: 'How far along the task is, 0–100%. Independent of the stage.',
  editTask: (title) => `Edit "${title}": title, description, dates, estimate, assignees, labels and progress. Saved to SpoofHub immediately.`,
  ntSave: 'Save the changes to SpoofHub now',
  label: (name) => `Label: ${name}`,
  taskProgress: (p, est, logH, logM) => `Progress ${p}%${est ? ` · estimate ${est}` : ''}${logH || logM ? ` · logged ${fmtDuration(logH, logM)}` : ''}. Edit via the pencil.`,
  // comments
  commentBox: 'Write a comment on this task. It is posted to SpoofHub immediately when you press Post.',
  commentPost: 'Post this comment to the task now',
  // settings
  stTarget: 'Expected hours per working day. The week grid colours day totals against it.',
  stDefaultTab: 'Which view opens first: the task list or the week grid',

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
  timesheet: 'Which of this project\'s timesheets the entry goes into. Set up by project managers in SpoofHub.',
  status: 'Billable: chargeable to the client. Non-billable: internal time. None: no billing category.',
  remove: 'Remove this row (it was never sent to SpoofHub)',
  stateSaved: 'Saved to SpoofHub',
  stateSaving: 'Sending to SpoofHub…',
  stateFailed: (err) => `Failed to save: ${err || 'unknown error'}. Fix the row and press Save all again.`,

  // existing entry
  exDate: (iso) => `Logged on ${fmtDate(iso)}`,
  exDur: (h, m) => `Duration: ${fmtDuration(h, m)}`,
  exDesc: (d) => (d ? `Description: ${d}` : 'No description was given'),
  exTimesheet: (t) => `Timesheet: ${t || 'unknown'}`,
  exStatus: (s) => `Billing status: ${s}`,
  edit: 'Edit this entry (saved when you press Save all)',
  delete: 'Delete this entry from SpoofHub (happens when you press Save all)',
  undoDelete: 'Keep this entry after all',
  cancelEdit: 'Cancel editing and keep the original values',

  // save bar
  summary: 'What will be sent to SpoofHub when you press Save all',
  invalidRows: 'Rows without a duration or timesheet are skipped, not saved',
  discardAll: 'Throw away every unsaved row, edit and deletion on every task',
  saveAll: 'Send all pending rows, edits and deletions to SpoofHub now',
  saveAllDisabled: 'Nothing to save yet, or saving is blocked (see the banner above)',
  stop: 'Stop sending. Rows already sent stay saved; the rest go back to unsaved.',
  progress: 'Progress of the current save. The app pauses automatically if SpoofHub asks it to slow down.',
  otherTab: 'Another browser tab is saving right now. Wait for it to finish.',

  // new task modal
  ntProject: 'Project the task belongs to',
  ntList: 'Task list (todolist) inside the project',
  ntTitle: 'Short name of the task as it will appear in SpoofHub',
  ntDescription: 'Longer details, optional. Formatting, lists and checklists are kept in sync with SpoofHub.',
  rtBold: 'Bold (Ctrl+B)', rtItalic: 'Italic (Ctrl+I)', rtBullets: 'Bulleted list', rtNumbers: 'Numbered list',
  rtCheck: 'Checklist item — tick it off directly in the text; Enter adds another',
  rtLink: 'Insert a link on the selected text', rtClear: 'Remove bold, italic and links from the selection',
  rtArea: 'Task description. Tick checklist items here; everything is saved with the task.',
  ntStart: 'When work should start, optional',
  ntDue: 'When it should be finished, optional',
  ntEstimate: 'Expected effort in hours and minutes, optional',
  ntAssign: 'Who the task is assigned to. Untick everyone to create it unassigned.',
  ntCreate: 'Create the task in SpoofHub and open it here for logging',

  // settings
  stStatus: 'Pre-selected billing status for every new row',
  stHistory: 'How far back to load your existing entries. Longer windows mean more requests at startup.',
  stChange: 'Connect to a different SpoofHub address, or enter a different API key or email',
  stAddress: 'The SpoofHub server this browser is connected to. Change it via "Change address, key or email".',
  stSignOut: 'Remove your key and user from this browser. Unsaved rows are discarded.',
  stVerified: 'The key\'s owner matches the email you entered',

  // setup
  suAddress: 'The web address you open SpoofHub at, e.g. projects.yourcompany.com. The app adds /api/v3 itself.',
  suKey: 'Found in your SpoofHub account: profile menu → click your profile picture five times',
  suShowKey: 'Show or hide the key while typing',
  suEmail: 'The email on your SpoofHub profile — used only to find your account',
  suNotMe: 'That is not my account — let me try another email',
  suThatsMe: 'Use this account. The app first checks that the API key really belongs to it.',
};

