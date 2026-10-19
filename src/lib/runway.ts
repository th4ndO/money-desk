import { type RecurringItem, cycleBounds, generateCycleItems, nextCycleStart, plannedTotal } from "./cycles";
import { type ISODate, addDays, daysInclusive } from "./dates";
import type { Cents } from "./money";

export interface PlannedCycle {
  name: string;
  start_date: ISODate;
  end_date: ISODate;
  planned: Cents;
  /** "existing" = already created in the app; "projected" = from recurring items. */
  source: "existing" | "projected";
}

export interface RunwayInput {
  bankBalance: Cents;
  spendableReserves: Cents;
  /** What the current cycle still needs: unpaid bills + unspent envelopes. */
  currentCommitted: Cents;
  /** Cycles already created that start after the current one, sorted. */
  futureCycles: readonly PlannedCycle[];
  recurring: readonly RecurringItem[];
  startDay: number;
  /** First day after the current cycle (or the start of the cycle containing today). */
  nextStart: ISODate;
  horizon?: number;
}

export interface RunwayResult {
  available: Cents;
  /** Whole and part cycles covered, e.g. 2.4. */
  cyclesCovered: number;
  /** Last day the money covers, or null if it lasts past the horizon. */
  runsOutOn: ISODate | null;
  averageCycleCost: Cents;
  schedule: (PlannedCycle & { covered: "full" | "part" | "none"; balanceAfter: Cents })[];
}

/**
 * Walk forward cycle by cycle, using cycles already created where they
 * exist and projecting the rest from the recurring items (so the gym
 * ending or rent starting is counted), until the money runs out.
 */
export function computeRunway(input: RunwayInput): RunwayResult {
  const horizon = input.horizon ?? 24;
  const available = input.bankBalance + input.spendableReserves - input.currentCommitted;

  const plan: PlannedCycle[] = [];
  const existing = new Map(input.futureCycles.map((c) => [c.start_date, c]));
  let start = input.nextStart;
  for (let i = 0; i < horizon; i++) {
    const found = existing.get(start);
    if (found) {
      plan.push(found);
      start = addDays(found.end_date, 1);
      continue;
    }
    const b = cycleBounds(start, input.startDay);
    plan.push({
      name: b.name,
      start_date: b.start_date,
      end_date: b.end_date,
      planned: plannedTotal(generateCycleItems(input.recurring, b.start_date, b.end_date)),
      source: "projected",
    });
    start = nextCycleStart(start, input.startDay);
  }

  let balance = available;
  let covered = 0;
  let runsOutOn: ISODate | null = null;
  const schedule: RunwayResult["schedule"] = [];

  if (balance <= 0) runsOutOn = addDays(input.nextStart, -1);

  for (const c of plan) {
    if (runsOutOn) {
      schedule.push({ ...c, covered: "none", balanceAfter: balance });
      continue;
    }
    if (c.planned <= balance) {
      balance -= c.planned;
      covered += 1;
      schedule.push({ ...c, covered: "full", balanceAfter: balance });
    } else {
      const fraction = c.planned > 0 ? balance / c.planned : 0;
      const days = daysInclusive(c.start_date, c.end_date);
      const coveredDays = Math.floor(fraction * days);
      covered += fraction;
      runsOutOn = addDays(c.start_date, coveredDays - 1);
      balance -= c.planned;
      schedule.push({ ...c, covered: coveredDays > 0 ? "part" : "none", balanceAfter: balance });
    }
  }

  const averageCycleCost = plan.length ? Math.round(plan.reduce((s, c) => s + c.planned, 0) / plan.length) : 0;
  return { available, cyclesCovered: Math.round(covered * 10) / 10, runsOutOn, averageCycleCost, schedule };
}
