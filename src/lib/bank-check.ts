import { type ISODate, daysInclusive } from "./dates";
import type { Cents } from "./money";

/** Everything the app thinks is sitting in the bank, by where it is meant to go. */
export interface BankCheckInput {
  /** Income not given a job yet. Can be negative. */
  ready: Cents;
  /** The working cycle's pocket less what already left it (unpaid bills and unspent envelopes). */
  pocketLeft: Cents;
  /** Allocated to cycles that haven't started yet. */
  setAsideAhead: Cents;
  /** Reserve balances (savings pots). */
  reserves: Cents;
  /** The previous cycle's leftover if it was never carried over (negative if it went over). */
  previousLeftover: Cents;
}

export interface BankCheck {
  accounted: Cents;
  /** Bank minus accounted: above 0 is money the app doesn't know about, below 0 is unlogged spending. */
  gap: Cents;
  lines: { label: string; cents: Cents }[];
}

export function bankCheck(bank: Cents, input: BankCheckInput, cycleName: string): BankCheck {
  const lines = [
    { label: `Left in ${cycleName} pocket`, cents: input.pocketLeft },
    { label: "Ready to allocate", cents: input.ready },
    { label: "Set aside for later cycles", cents: input.setAsideAhead },
    { label: "Reserves", cents: input.reserves },
    { label: "Last cycle's leftover, not carried over", cents: input.previousLeftover },
  ].filter((l) => l.cents !== 0 || l.label === "Ready to allocate" || l.label.startsWith("Left in"));
  const accounted = lines.reduce((s, l) => s + l.cents, 0);
  return { accounted, gap: bank - accounted, lines };
}

/** A check is only trustworthy on the day the balance was read off the bank. */
export function checkedToday(balanceOn: ISODate | null, today: ISODate): boolean {
  return balanceOn === today;
}

/** Days since the balance was last entered, or null if never. */
export function daysSinceCheck(balanceOn: ISODate | null, today: ISODate): number | null {
  if (!balanceOn || balanceOn > today) return balanceOn ? 0 : null;
  return daysInclusive(balanceOn, today) - 1;
}

export const FREE_MONEY = "Free money";
export const UNRECORDED_SOURCE = "Unrecorded money (bank check)";
export const UNLOGGED_NOTE = "Not logged (found by bank check)";
