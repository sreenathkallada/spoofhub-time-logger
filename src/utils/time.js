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
