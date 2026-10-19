/**
 * Environment variables, read lazily so `next build` doesn't need them and a
 * missing one fails with a message saying which. NEXT_PUBLIC_* values must
 * be referenced literally for Next.js to inline them into the browser bundle.
 */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Server only. The single email address allowed to sign in. */
export function allowedEmail(): string {
  return required("ALLOWED_EMAIL", process.env.ALLOWED_EMAIL).trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === allowedEmail();
}

/** Server only. Secret mixed into the PIN; see lib/pin.ts. */
export function pinPepper(): string {
  return required("PIN_PEPPER", process.env.PIN_PEPPER);
}
