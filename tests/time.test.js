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

import { normaliseBaseUrl, hostOf } from '../src/utils/baseUrl.js';
describe('base url normalisation', () => {
  it('accepts a bare host', () => { expect(normaliseBaseUrl('projects.example.com').url).toBe('https://projects.example.com/api/v3/'); });
  it('accepts full forms', () => {
    expect(normaliseBaseUrl('https://projects.example.com/').url).toBe('https://projects.example.com/api/v3/');
    expect(normaliseBaseUrl('https://projects.example.com/api/v3').url).toBe('https://projects.example.com/api/v3/');
    expect(normaliseBaseUrl('https://projects.example.com/api/v3/').url).toBe('https://projects.example.com/api/v3/');
    expect(normaliseBaseUrl('http://localhost:8787').url).toBe('http://localhost:8787/api/v3/');
    expect(normaliseBaseUrl('  HTTPS://Example.com/sub/ ').url).toBe('https://example.com/sub/api/v3/');
  });
  it('rejects bad input', () => {
    expect(normaliseBaseUrl('').error).toBeTruthy();
    expect(normaliseBaseUrl('ftp://x.com').error).toBeTruthy();
    expect(normaliseBaseUrl('not a url').error).toBeTruthy();
  });
  it('extracts the host', () => { expect(hostOf('https://projects.example.com/api/v3/')).toBe('projects.example.com'); });
});
describe('base url rejects hosts with spaces', () => {
  it('rejects', () => { expect(normaliseBaseUrl('not a url').error).toBeTruthy(); expect(normaliseBaseUrl('https://bad host.com').error).toBeTruthy(); expect(normaliseBaseUrl('[::1]:8787').url).toBe('https://[::1]:8787/api/v3/'); });
});

import { parseDuration, weekStartISO, weekDaysISO, fmtCellHours } from '../src/utils/time.js';
describe('grid duration parsing and week helpers', () => {
  it('parses durations', () => {
    expect(parseDuration('2')).toBe(120); expect(parseDuration('1.5')).toBe(90); expect(parseDuration('1,5')).toBe(90);
    expect(parseDuration('1:30')).toBe(90); expect(parseDuration('1h 30m')).toBe(90); expect(parseDuration('45m')).toBe(45);
    expect(parseDuration('2h')).toBe(120); expect(parseDuration('')).toBe(0); expect(parseDuration('abc')).toBeNull();
  });
  it('finds Monday and lists weekdays', () => {
    expect(weekStartISO('2026-10-07')).toBe('2026-10-05'); expect(weekStartISO('2026-10-05')).toBe('2026-10-05'); expect(weekStartISO('2026-10-11')).toBe('2026-10-05');
    expect(weekDaysISO('2026-10-05')).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']);
  });
  it('formats cell hours', () => { expect(fmtCellHours(90)).toBe('1.5'); expect(fmtCellHours(0)).toBe(''); expect(fmtCellHours(45)).toBe('0.75'); });
});

import { decodeEntities, descriptionToHtml, descriptionText, looksLikeHtml, sameHtml } from '../src/utils/html.js';
describe('description html', () => {
  const raw = '&lt;div&gt;\n&lt;ul&gt;\n&lt;li&gt;&lt;input disabled="disabled" type="checkbox" aria-label="Design (SP: 3)" /&gt;&amp;nbsp;&lt;strong&gt;Design: model&lt;/strong&gt;&amp;nbsp;&amp;mdash; chose join-table&amp;nbsp;&lt;em&gt;(SP: 3)&lt;/em&gt;&lt;/li&gt;\n&lt;/ul&gt;\n&lt;/div&gt;';
  it('decodes the escaped form once', () => {
    const html = descriptionToHtml(raw);
    expect(html.startsWith('<div>')).toBe(true);
    expect(html).toContain('<strong>Design: model</strong>');
    expect(html).toContain('&mdash;'); // inner entities stay as entities in the HTML (one decode only)
  });
  it('leaves real html untouched and plain text alone', () => {
    expect(descriptionToHtml('<p>hi &amp; bye</p>')).toBe('<p>hi &amp; bye</p>');
    expect(descriptionToHtml('plain a < b')).toBe('plain a < b');
    expect(looksLikeHtml('plain')).toBe(false); expect(looksLikeHtml(raw)).toBe(true);
  });
  it('produces readable text', () => {
    expect(descriptionText(raw)).toBe('• Design: model \u2014 chose join-table (SP: 3)');
    expect(decodeEntities('a&amp;b&#8212;c&#x2014;d')).toBe('a&b\u2014c\u2014d');
  });
  it('compares ignoring whitespace', () => { expect(sameHtml('<p>a</p>\n', ' <p>a</p>')).toBe(true); });
});
