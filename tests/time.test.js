import { describe, it, expect } from 'vitest';
import { fmtDuration, toMinutes, splitMinutes, fmtDate, validateEntry, addDaysISO, todayISO } from '../src/utils/time.js';
import { defaultTimesheetId, usableTimesheets } from '../src/utils/timesheetDefault.js';

describe('time utils', () => {
  it('formats durations', () => {
    expect(fmtDuration(2, 30)).toBe('2h 30m');
    expect(fmtDuration(2, 0)).toBe('2h');
    expect(fmtDuration(0, 45)).toBe('45m');
    expect(fmtDuration(null, null)).toBe('—');
    expect(fmtDuration('1', '75')).toBe('2h 15m');
  });
  it('converts minutes', () => {
    expect(toMinutes('1', '40')).toBe(100);
    expect(splitMinutes(100)).toEqual({ hours: 1, mins: 40 });
  });
  it('formats dates', () => { expect(fmtDate('2026-09-21')).toBe('21 Sep 2026'); });
  it('adds days across month end', () => { expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01'); });
  it('validates entries', () => {
    const base = { date: todayISO(), hours: '1', mins: '0', description: '', timesheetId: '1', status: 'billable' };
    expect(validateEntry(base)).toEqual({});
    expect(validateEntry({ ...base, hours: '', mins: '' }).duration).toBeTruthy();
    expect(validateEntry({ ...base, timesheetId: '' }).timesheetId).toBeTruthy();
    expect(validateEntry({ ...base, date: addDaysISO(todayISO(), 5) }).date).toBeTruthy();
    expect(validateEntry({ ...base, hours: '25' }).hours).toBeTruthy();
  });
});

describe('timesheet default rule', () => {
  const timesheets = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const task = { id: 't1', timesheet_id: 3, project: { id: 'p1' } };
  it('prefers previous row', () => {
    expect(defaultTimesheetId({ prevRow: { timesheetId: 2 }, task, timesheets })).toBe(2);
  });
  it('then last used for task, then my entries, then task link, then project', () => {
    expect(defaultTimesheetId({ lastUsed: { 'task:t1': 1 }, task, timesheets })).toBe(1);
    expect(defaultTimesheetId({ myEntries: [{ timesheet: { id: 2 } }], task, timesheets })).toBe(2);
    expect(defaultTimesheetId({ task, timesheets })).toBe(3);
    expect(defaultTimesheetId({ lastUsed: { p1: 1 }, task: { ...task, timesheet_id: null }, timesheets })).toBe(1);
    expect(defaultTimesheetId({ task: { ...task, timesheet_id: null }, timesheets })).toBeNull();
  });
  it('ignores ids not in the project list', () => {
    expect(defaultTimesheetId({ prevRow: { timesheetId: 99 }, task, timesheets })).toBe(3);
  });
  it('filters usable timesheets', () => {
    const ts = [
      { id: 1, title: 'B', archived: true },
      { id: 2, title: 'A', private: true, assigned: [5] },
      { id: 3, title: 'C', private: true, assigned: [7] },
      { id: 4, title: 'D', private: false, assigned: [] },
    ];
    expect(usableTimesheets(ts, 7).map((t) => t.id)).toEqual([3, 4]);
  });
});
