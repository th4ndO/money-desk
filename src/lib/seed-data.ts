import type { Backup } from "./backup";
import { type RecurringItem, cycleBounds, generateCycleItems } from "./cycles";
import type { ISODate } from "./dates";

/**
 * Starting data for my own account, loaded once from Settings (Phase 2).
 * Amounts in cents. Tests in seed-data.test.ts check that each seeded cycle
 * plans exactly R9 745.
 */

type SeedItem = Omit<RecurringItem, "id" | "sort_order" | "category"> & { category: string };

const START = "2026-09-23";

function monthly(
  name: string,
  kind: RecurringItem["kind"],
  rands: number,
  dueDay: number | null,
  category: string,
  extra: Partial<SeedItem> = {},
): SeedItem {
  return {
    name,
    kind,
    amount_cents: rands * 100,
    due_day: dueDay,
    frequency: "monthly",
    interval_months: null,
    starts_on: START,
    ends_on: null,
    category,
    active: true,
    ...extra,
  };
}

const LATER = { starts_on: "2027-01-01", active: false } as const;

export const SEED_SETTINGS = { cycle_start_day: 23 };

export const SEED_RECURRING: SeedItem[] = [
  monthly("Debt review", "bill", 1585, 23, "Debt"),
  monthly("Liberty life cover", "bill", 500, 25, "Insurance"),
  monthly("Netflix", "bill", 229, 27, "Subscriptions"),
  monthly("Supabase", "bill", 412, 27, "Work tools"),
  monthly("Canva", "bill", 110, 29, "Work tools"),
  monthly("Gym", "bill", 250, 30, "Health", { ends_on: "2026-12-31" }),
  monthly("Claude", "bill", 380, 30, "Work tools"),
  monthly("Rain Wi-Fi", "bill", 679, 3, "Home"),
  monthly("Apple iCloud", "bill", 200, 14, "Subscriptions"),
  monthly("Spotify Student", "bill", 38, 15, "Subscriptions"),
  monthly("Water", "bill", 1000, 1, "Home"),
  monthly("Savings", "saving", 1000, 23, "Savings"),
  monthly("Groceries", "envelope", 1362, null, "Living"),
  monthly("Transport", "envelope", 1000, null, "Living"),
  monthly("Personal", "envelope", 1000, null, "Living"),
  // Prepaid until the end of December; switch on once I know where I'm living.
  monthly("Rent", "bill", 6500, 1, "Home", LATER),
  monthly("Electricity", "bill", 500, 1, "Home", LATER),
  monthly("Siblings", "bill", 500, 1, "Family", LATER),
  monthly("Vodacom", "bill", 435, 1, "Home", LATER),
];

/**
 * paidRule decides which bills and savings start ticked:
 * "savings" ticks savings only; "due-by-today" ticks savings plus every
 * bill due on or before the day the data is loaded.
 */
export const SEED_CYCLES = [
  { start_date: "2026-09-23", pocket_cents: 974500, paidRule: "due-by-today" },
  { start_date: "2026-10-23", pocket_cents: 974500, paidRule: "savings" },
  { start_date: "2026-11-23", pocket_cents: 974500, paidRule: "savings" },
] as const;

export const SEED_RESERVES = [
  { name: "January cushion", balance_cents: 473700, spendable: false },
  { name: "Savings", balance_cents: 200000, spendable: false },
];

export const SEED_TODOS = [
  "Claim UIF on uFiling (get the UI-19 from my employer)",
  "Check the two Apple charges (R180 and R200)",
  "Ask the landlord about the deposit refund in January",
  "Cancel the gym before the January debit",
  "Decide where I'm living from January",
];

/** Seed items as RecurringItem, with stable fake ids, for tests and previews. */
export function seedAsRecurringItems(): RecurringItem[] {
  return SEED_RECURRING.map((item, i) => ({ ...item, id: `seed-${i}`, sort_order: i }));
}

/**
 * The whole starting dataset as a backup, so loading it goes through the
 * same validated, all-or-nothing import as restoring a real backup.
 */
export function buildSeedBackup(today: ISODate, newId: () => string = () => crypto.randomUUID()): Backup {
  const recurring = SEED_RECURRING.map((item, i) => ({
    ...item,
    id: newId(),
    notes: null,
    sort_order: i,
  }));

  const cycles: Backup["cycles"] = [];
  const cycleItems: Backup["cycle_items"] = [];
  for (const seed of SEED_CYCLES) {
    const b = cycleBounds(seed.start_date, SEED_SETTINGS.cycle_start_day);
    const cycleId = newId();
    cycles.push({ id: cycleId, name: b.name, start_date: b.start_date, end_date: b.end_date, pocket_cents: seed.pocket_cents, closed_at: null, notes: null });
    generateCycleItems(recurring, b.start_date, b.end_date).forEach((item, i) => {
      const paid =
        item.kind === "saving" ||
        (seed.paidRule === "due-by-today" && item.kind === "bill" && item.due_date !== null && item.due_date <= today);
      cycleItems.push({
        id: newId(),
        cycle_id: cycleId,
        recurring_item_id: item.recurring_item_id,
        name: item.name,
        kind: item.kind,
        category: item.category,
        planned_cents: item.planned_cents,
        due_date: item.due_date,
        paid,
        paid_on: paid ? (item.due_date && item.due_date <= today ? item.due_date : today) : null,
        actual_cents: paid ? item.planned_cents : null,
        sort_order: i,
      });
    });
  }

  return {
    app: "money-desk",
    version: 1,
    exported_at: new Date().toISOString(),
    settings: { cycle_start_day: SEED_SETTINGS.cycle_start_day, bank_balance_cents: null, bank_balance_on: null },
    recurring_items: recurring,
    cycles,
    cycle_items: cycleItems,
    transactions: [],
    income: [],
    reserves: SEED_RESERVES.map((r, i) => ({ ...r, id: newId(), notes: null, sort_order: i })),
    todos: SEED_TODOS.map((text, i) => ({ id: newId(), text, done: false, due_date: null, sort_order: i })),
    allocations: [],
  };
}
