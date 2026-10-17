import type { RecurringItem } from "./cycles";

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
