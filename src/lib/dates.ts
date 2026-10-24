/**
 * Calendar-date helpers. Dates are plain ISO strings ("2026-11-23") with no
 * time or zone, so they compare correctly as strings and never shift when a
 * server runs in UTC. Only `todayJHB` looks at the clock.
 */

export type ISODate = string;

export const TIMEZONE = "Africa/Johannesburg";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(iso: ISODate): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`Not an ISO date: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new Error(`Not a real date: ${iso}`);
  }
  return { y, m, d };
}

export function isISODate(value: string): boolean {
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** m is 1–12. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The given day of the month, or the month's last day if it is shorter. */
export function clampedDate(y: number, m: number, day: number): ISODate {
  return toISODate(y, m, Math.min(day, daysInMonth(y, m)));
}

/** Shift a year/month pair by n months (n may be negative). */
export function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + n;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

/** Whole months from (y1, m1) to (y2, m2). */
export function monthsBetween(y1: number, m1: number, y2: number, m2: number): number {
  return (y2 - y1) * 12 + (m2 - m1);
}

function toUTCms(iso: ISODate): number {
  const { y, m, d } = parseISODate(iso);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso: ISODate, n: number): ISODate {
  const date = new Date(toUTCms(iso) + n * 86_400_000);
  return toISODate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Number of days from a to b counting both ends: (x, x) is 1. */
export function daysInclusive(a: ISODate, b: ISODate): number {
  return Math.round((toUTCms(b) - toUTCms(a)) / 86_400_000) + 1;
}

/** Today's date in Johannesburg, whatever zone the server runs in. */
export function todayJHB(now?: Date): ISODate {
  // Browser walkthroughs pin "today" so their expected figures stay true.
  // Both variables are needed; neither is ever set on Vercel.
  if (!now && process.env.MONEY_DESK_E2E === "1" && process.env.MONEY_DESK_FAKE_TODAY) {
    return process.env.MONEY_DESK_FAKE_TODAY;
  }
  return jhbDate(now ?? new Date());
}

function jhbDate(now: Date): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(m: number): string {
  return MONTHS[m - 1];
}

/** "23 Oct 2026" */
export function formatDate(iso: ISODate): string {
  const { y, m, d } = parseISODate(iso);
  return `${d} ${monthName(m).slice(0, 3)} ${y}`;
}

/** "23 Oct" */
export function formatShortDate(iso: ISODate): string {
  const { m, d } = parseISODate(iso);
  return `${d} ${monthName(m).slice(0, 3)}`;
}
