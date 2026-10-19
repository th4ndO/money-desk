import type { Frequency, ItemKind } from "./cycles";
import type { ISODate } from "./dates";
import type { Cents } from "./money";

/** Row shapes as they come back from Supabase. */

export interface SettingsRow {
  id: string;
  cycle_start_day: number;
  currency: "ZAR";
  timezone: "Africa/Johannesburg";
  bank_balance_cents: Cents | null;
  bank_balance_on: ISODate | null;
}

export interface RecurringItemRow {
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
  notes: string | null;
  active: boolean;
  sort_order: number;
}

export interface CycleRow {
  id: string;
  name: string;
  start_date: ISODate;
  end_date: ISODate;
  pocket_cents: Cents;
  closed_at: string | null;
  notes: string | null;
}

export interface CycleItemRow {
  id: string;
  cycle_id: string;
  recurring_item_id: string | null;
  name: string;
  kind: ItemKind;
  category: string | null;
  planned_cents: Cents;
  due_date: ISODate | null;
  paid: boolean;
  paid_on: ISODate | null;
  actual_cents: Cents | null;
  sort_order: number;
}

export interface TransactionRow {
  id: string;
  cycle_id: string;
  cycle_item_id: string | null;
  amount_cents: Cents;
  date: ISODate;
  note: string | null;
  created_at?: string;
}

export interface IncomeRow {
  id: string;
  amount_cents: Cents;
  date: ISODate;
  source: string;
  notes: string | null;
}

export interface ReserveRow {
  id: string;
  name: string;
  balance_cents: Cents;
  spendable: boolean;
  notes: string | null;
  sort_order: number;
}

export interface TodoRow {
  id: string;
  text: string;
  done: boolean;
  due_date: ISODate | null;
  sort_order: number;
}
