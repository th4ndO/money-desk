import {
  type ISODate,
  addDays,
  addMonths,
  clampedDate,
  monthName,
  monthsBetween,
  parseISODate,
} from "./dates";
import type { Cents } from "./money";

export type ItemKind = "bill" | "envelope" | "saving";
export type Frequency = "monthly" | "once" | "every_n_months";

export interface RecurringItem {
  id: string;
  name: string;
  kind: ItemKind;
  amount_cents: Cents;
  due_day: number | null;
  frequency: Frequency;
  interval_months: number | null;
  starts_on: ISODate;
  ends_on: ISODate | null;
  category: string | null;
  active: boolean;
  sort_order: number;
}

export interface GeneratedCycleItem {
  recurring_item_id: string;
  name: string;
  kind: ItemKind;
  category: string | null;
  planned_cents: Cents;
  due_date: ISODate | null;
  sort_order: number;
}

export interface CycleBounds {
  start_date: ISODate;
  end_date: ISODate;
  name: string;
}

/**
 * The first cycle start strictly after `after`, for a given start day.
 * Checking the same month first means a changed start day still moves
 * forward to the nearest boundary instead of skipping a month.
 */
export function nextCycleStart(after: ISODate, startDay: number): ISODate {
  const { y, m } = parseISODate(after);
  const sameMonth = clampedDate(y, m, startDay);
  if (sameMonth > after) return sameMonth;
  const next = addMonths(y, m, 1);
  return clampedDate(next.y, next.m, startDay);
}

/** The start of the cycle that contains `date`. */
export function cycleStartFor(date: ISODate, startDay: number): ISODate {
  const { y, m } = parseISODate(date);
  const thisMonth = clampedDate(y, m, startDay);
  if (thisMonth <= date) return thisMonth;
  const prev = addMonths(y, m, -1);
  return clampedDate(prev.y, prev.m, startDay);
}

/** A cycle is named after the month it ends in: 23 Oct–22 Nov is "November 2026". */
export function cycleName(endDate: ISODate): string {
  const { y, m } = parseISODate(endDate);
  return `${monthName(m)} ${y}`;
}

/** Start and end (both inclusive) of a cycle beginning on `start`. */
export function cycleBounds(start: ISODate, startDay: number): CycleBounds {
  const end = addDays(nextCycleStart(start, startDay), -1);
  return { start_date: start, end_date: end, name: cycleName(end) };
}

function inWindow(date: ISODate, item: RecurringItem): boolean {
  return date >= item.starts_on && (item.ends_on === null || date <= item.ends_on);
}

function windowOverlaps(item: RecurringItem, start: ISODate, end: ISODate): boolean {
  return item.starts_on <= end && (item.ends_on === null || item.ends_on >= start);
}

/** Does an every-n-months item, anchored on its start month, fall in (y, m)? */
function monthMatches(item: RecurringItem, y: number, m: number): boolean {
  if (item.frequency === "monthly") return true;
  if (item.frequency !== "every_n_months") return false;
  const anchor = parseISODate(item.starts_on);
  const diff = monthsBetween(anchor.y, anchor.m, y, m);
  const n = item.interval_months ?? 1;
  return diff >= 0 && diff % n === 0;
}

/** Each calendar month touched by [start, end]. */
function monthsIn(start: ISODate, end: ISODate): { y: number; m: number }[] {
  const s = parseISODate(start);
  const e = parseISODate(end);
  const months = [];
  for (let i = 0; i <= monthsBetween(s.y, s.m, e.y, e.m); i++) {
    months.push(addMonths(s.y, s.m, i));
  }
  return months;
}

/**
 * Dates on which a dated item (bill or saving) falls due inside the cycle.
 * With a start day of 1–28 a monthly item lands exactly once per cycle.
 */
export function occurrencesInCycle(item: RecurringItem, start: ISODate, end: ISODate): ISODate[] {
  if (item.frequency === "once") {
    return item.starts_on >= start && item.starts_on <= end ? [item.starts_on] : [];
  }
  const day = item.due_day ?? parseISODate(item.starts_on).d;
  return monthsIn(start, end)
    .filter(({ y, m }) => monthMatches(item, y, m))
    .map(({ y, m }) => clampedDate(y, m, day))
    .filter((date) => date >= start && date <= end && inWindow(date, item));
}

/** Envelopes have no due date: one per cycle while the item is live. */
function envelopeInCycle(item: RecurringItem, start: ISODate, end: ISODate): boolean {
  if (item.frequency === "once") return item.starts_on >= start && item.starts_on <= end;
  if (!windowOverlaps(item, start, end)) return false;
  // Every-n-months envelopes follow the month the cycle is named after.
  const { y, m } = parseISODate(end);
  return monthMatches(item, y, m);
}

/**
 * The snapshot of recurring items for a new cycle. Inactive items, items
 * outside their start/end window and items whose frequency skips this
 * cycle are left out.
 */
export function generateCycleItems(
  items: readonly RecurringItem[],
  start: ISODate,
  end: ISODate,
): GeneratedCycleItem[] {
  const out: GeneratedCycleItem[] = [];
  for (const item of items) {
    if (!item.active) continue;
    const base = {
      recurring_item_id: item.id,
      name: item.name,
      kind: item.kind,
      category: item.category,
      planned_cents: item.amount_cents,
      sort_order: item.sort_order,
    };
    if (item.kind === "envelope") {
      if (envelopeInCycle(item, start, end)) out.push({ ...base, due_date: null });
    } else {
      for (const due of occurrencesInCycle(item, start, end)) out.push({ ...base, due_date: due });
    }
  }
  return out.sort(
    (a, b) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.sort_order - b.sort_order,
  );
}

export function plannedTotal(items: readonly { planned_cents: Cents }[]): Cents {
  return items.reduce((sum, i) => sum + i.planned_cents, 0);
}
