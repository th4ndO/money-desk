import { z } from "zod";
import { isISODate } from "./dates";

/**
 * The export/import format. Version 1. Ids are kept so that cycle items,
 * transactions and recurring items still point at each other after a
 * restore. user_id is never exported: the importer always becomes the owner.
 */

const uuid = z.uuid();
const date = z.string().refine(isISODate, "Expected a date like 2026-10-23");
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const positiveCents = cents.min(1);
const text = (max: number) => z.string().min(1).max(max);
const optionalText = (max: number) => z.string().max(max).nullable().default(null);
const kind = z.enum(["bill", "envelope", "saving"]);

export const backupSchema = z
  .object({
    app: z.literal("money-desk"),
    version: z.literal(1),
    exported_at: z.string(),
    settings: z.object({
      cycle_start_day: z.number().int().min(1).max(28),
      bank_balance_cents: z.number().int().nullable().default(null),
      bank_balance_on: date.nullable().default(null),
    }),
    recurring_items: z.array(
      z.object({
        id: uuid,
        name: text(100),
        kind,
        amount_cents: cents,
        due_day: z.number().int().min(1).max(31).nullable(),
        frequency: z.enum(["monthly", "once", "every_n_months"]),
        interval_months: z.number().int().min(2).max(24).nullable(),
        starts_on: date,
        ends_on: date.nullable(),
        category: optionalText(50),
        notes: optionalText(1000),
        active: z.boolean(),
        sort_order: z.number().int(),
      }),
    ),
    cycles: z.array(
      z.object({
        id: uuid,
        name: text(50),
        start_date: date,
        end_date: date,
        pocket_cents: cents,
        closed_at: z.string().nullable(),
        notes: optionalText(2000),
      }),
    ),
    cycle_items: z.array(
      z.object({
        id: uuid,
        cycle_id: uuid,
        recurring_item_id: uuid.nullable(),
        name: text(100),
        kind,
        category: optionalText(50),
        planned_cents: cents,
        due_date: date.nullable(),
        paid: z.boolean(),
        paid_on: date.nullable(),
        actual_cents: cents.nullable(),
        sort_order: z.number().int(),
      }),
    ),
    transactions: z.array(
      z.object({
        id: uuid,
        cycle_id: uuid,
        cycle_item_id: uuid.nullable(),
        amount_cents: positiveCents,
        date,
        note: optionalText(200),
      }),
    ),
    income: z.array(
      z.object({ id: uuid, amount_cents: positiveCents, date, source: text(200), notes: optionalText(1000) }),
    ),
    reserves: z.array(
      z.object({
        id: uuid,
        name: text(100),
        balance_cents: cents,
        spendable: z.boolean(),
        notes: optionalText(1000),
        sort_order: z.number().int(),
      }),
    ),
    todos: z.array(
      z.object({ id: uuid, text: text(300), done: z.boolean(), due_date: date.nullable(), sort_order: z.number().int() }),
    ),
    // Added after the first release; older backups simply have none.
    allocations: z
      .array(
        z.object({
          id: uuid,
          cycle_item_id: uuid.nullable(),
          reserve_id: uuid.nullable(),
          amount_cents: positiveCents,
          date,
          note: optionalText(200),
        }),
      )
      .default([]),
  })
  .superRefine((b, ctx) => {
    const cycleIds = new Set(b.cycles.map((c) => c.id));
    const recurringIds = new Set(b.recurring_items.map((r) => r.id));
    const itemCycle = new Map(b.cycle_items.map((i) => [i.id, i.cycle_id]));
    b.cycle_items.forEach((i, n) => {
      if (!cycleIds.has(i.cycle_id)) ctx.addIssue({ code: "custom", path: ["cycle_items", n], message: "points at a missing cycle" });
      if (i.recurring_item_id && !recurringIds.has(i.recurring_item_id))
        ctx.addIssue({ code: "custom", path: ["cycle_items", n], message: "points at a missing recurring item" });
    });
    const reserveIds = new Set(b.reserves.map((r) => r.id));
    b.allocations.forEach((a, n) => {
      const ok = a.cycle_item_id ? itemCycle.has(a.cycle_item_id) && !a.reserve_id : !!a.reserve_id && reserveIds.has(a.reserve_id);
      if (!ok) ctx.addIssue({ code: "custom", path: ["allocations", n], message: "points at a missing item or pot" });
    });
    b.transactions.forEach((t, n) => {
      if (!cycleIds.has(t.cycle_id)) ctx.addIssue({ code: "custom", path: ["transactions", n], message: "points at a missing cycle" });
      if (t.cycle_item_id && itemCycle.get(t.cycle_item_id) !== t.cycle_id)
        ctx.addIssue({ code: "custom", path: ["transactions", n], message: "points at an envelope in a different cycle" });
    });
  });

export type Backup = z.infer<typeof backupSchema>;

export const BACKUP_TABLES = [
  "recurring_items",
  "cycles",
  "cycle_items",
  "transactions",
  "income",
  "reserves",
  "todos",
  "allocations",
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export function backupCounts(b: Backup): Record<BackupTable, number> {
  return Object.fromEntries(BACKUP_TABLES.map((t) => [t, b[t].length])) as Record<BackupTable, number>;
}

/** Parse a JSON string into a validated backup, or a readable error. */
export function parseBackup(json: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `That file isn't a Money Desk backup: ${issue.path.join(".") || "file"} ${issue.message}.` };
  }
  return { ok: true, backup: result.data };
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV for one table. Amount columns stay in cents (exact) and get a
 * matching rands column for spreadsheets.
 */
export function toCSV(rows: readonly Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns: string[] = [];
  for (const key of Object.keys(rows[0])) {
    columns.push(key);
    if (key.endsWith("_cents")) columns.push(key.replace(/_cents$/, "_rands"));
  }
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((col) => {
          if (col.endsWith("_rands")) {
            const c = row[col.replace(/_rands$/, "_cents")];
            return typeof c === "number" ? (c / 100).toFixed(2) : "";
          }
          return csvCell(row[col]);
        })
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
