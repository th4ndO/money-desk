/**
 * Money is integer cents everywhere. Postgres stores bigint; PostgREST
 * returns it as a JSON number, which is exact up to 2^53 cents (about
 * R90 trillion), so plain `number` is safe here as long as it is an integer.
 */

export type Cents = number;

// Non-breaking space, so "R1 585" never wraps across two lines.
const THOUSANDS_SEP = " ";

function groupThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
}

/**
 * R1 585, R113.21, R0, −R150. Cents are shown only when non-zero.
 */
export function formatZAR(cents: Cents): string {
  if (!Number.isSafeInteger(cents)) throw new Error(`Not an integer cents value: ${cents}`);
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(cents);
  const rands = Math.floor(abs / 100);
  const rem = abs % 100;
  const fraction = rem === 0 ? "" : `.${String(rem).padStart(2, "0")}`;
  return `${sign}R${groupThousands(rands)}${fraction}`;
}

/**
 * Parse what someone types into an amount field: "150", "R1 585",
 * "1,585", "1585.5", "113,21". Returns null if it isn't a non-negative
 * amount with at most two decimals.
 *
 * A comma followed by exactly one or two digits at the end is a decimal
 * comma ("113,21"); any other comma is a thousands separator ("1,585").
 */
export function parseRandToCents(input: string): Cents | null {
  let s = input.trim().replace(/^R/i, "").replace(/[\s  ]/g, "");
  if (s === "") return null;

  if (s.includes(".")) {
    s = s.replace(/,/g, "");
  } else if (/,\d{1,2}$/.test(s)) {
    const last = s.lastIndexOf(",");
    s = s.slice(0, last).replace(/,/g, "") + "." + s.slice(last + 1);
  } else {
    s = s.replace(/,/g, "");
  }

  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!match) return null;
  const rands = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = rands * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

/** Plain value for an input field: 158500 → "1585", 11321 → "113.21". */
export function centsToInput(cents: Cents): string {
  const rands = Math.floor(Math.abs(cents) / 100);
  const rem = Math.abs(cents) % 100;
  return `${cents < 0 ? "-" : ""}${rands}${rem === 0 ? "" : "." + String(rem).padStart(2, "0")}`;
}

export function sumCents(values: readonly Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
