import { createHmac } from "node:crypto";

/** A PIN is 4–8 digits. */
export const PIN_RE = /^\d{4,8}$/;

/**
 * The Supabase password for a PIN: HMAC-SHA256 of the PIN with a server-only
 * secret. A raw 4-digit password could be guessed by calling Supabase
 * directly with the public key, skipping the lockout; without the secret,
 * the derived password can't be guessed at all.
 */
export function pinToPassword(pin: string, pepper: string): string {
  if (!PIN_RE.test(pin)) throw new Error("PIN must be 4–8 digits");
  if (pepper.length < 32) throw new Error("PIN_PEPPER must be at least 32 characters");
  return createHmac("sha256", pepper).update(`money-desk-pin:${pin}`).digest("hex");
}
