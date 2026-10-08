export const toMinutes = (h, m) => (Number(h) || 0) * 60 + (Number(m) || 0);

export function splitMinutes(total) {
  const t = Math.max(0, Math.round(Number(total) || 0));
  return { hours: Math.floor(t / 60), mins: t % 60 };
}

export function fmtDuration(h, m) {
  const t = toMinutes(h, m);
  if (!t) return '—';
  const { hours, mins } = splitMinutes(t);
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export const fmtMinutes = (t) => fmtDuration(0, t);

function pad(n) { return String(n).padStart(2, '0'); }

export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const todayISO = () => toISODate(new Date());

export function addDaysISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return toISODate(dt);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function isOverdue(iso) {
  if (!iso) return false;
  return String(iso).slice(0, 10) < todayISO();
}

export function validateEntry(e) {
  const errors = {};
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) errors.date = 'Enter a date';
  else if (e.date > addDaysISO(todayISO(), 1)) errors.date = 'Date is in the future';
  const h = Number(e.hours), m = Number(e.mins);
  if (e.hours !== '' && (Number.isNaN(h) || h < 0 || h > 24)) errors.hours = '0–24';
  if (e.mins !== '' && (Number.isNaN(m) || m < 0 || m > 59)) errors.mins = '0–59';
  if (!errors.hours && !errors.mins && toMinutes(e.hours, e.mins) <= 0) errors.duration = 'Enter a duration';
  if (toMinutes(e.hours, e.mins) > 24 * 60) errors.duration = 'More than 24 hours';
  if (!e.timesheetId) errors.timesheetId = 'Choose a timesheet';
  if (!e.status) errors.status = 'Choose a status';
  if ((e.description || '').length > 500) errors.description = 'Max 500 characters';
  return errors;
}

export const isValidEntry = (e) => Object.keys(validateEntry(e)).length === 0;

/**
 * Parse a duration typed into a grid cell. Accepts "2", "1.5", "1:30", "1h 30m", "90m", "2h".
 * Returns whole minutes, 0 for empty, or null when unreadable.
 */
export function parseDuration(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/,/g, '.');
  if (!s) return 0;
  let m;
  if ((m = s.match(/^(\d{1,2}):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/)) && (m[1] || m[2])) {
    return Math.round((Number(m[1] || 0)) * 60) + Number(m[2] || 0);
  }
  if ((m = s.match(/^(\d+(?:\.\d+)?)$/))) return Math.round(Number(m[1]) * 60);
  return null;
}

/** Monday of the week containing the given ISO date. */
export function weekStartISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = (dt.getDay() + 6) % 7; // Monday = 0
  return addDaysISO(iso, -dow);
}

/** Mon..Fri ISO dates for the week starting at startISO. */
export const weekDaysISO = (startISO, count = 5) => Array.from({ length: count }, (_, i) => addDaysISO(startISO, i));

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export function fmtDayHeader(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return { dow: DOW[(dt.getDay() + 6) % 7], day: d, month: MONTHS[m - 1] };
}

/** Cell text for a minute total: "2", "1.5", "0.75" — hours with up to two decimals. */
export function fmtCellHours(mins) {
  if (!mins) return '';
  const h = mins / 60;
  return (Math.round(h * 100) / 100).toString();
}
