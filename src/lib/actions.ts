import { z } from "zod";
import { isISODate } from "./dates";
import { parseRandToCents } from "./money";

/** What every Server Action returns, so the form can show "Saved" or say what went wrong. */
export type ActionResult = { ok: boolean; message: string; at?: number };

export const ok = (message: string): ActionResult => ({ ok: true, message, at: Date.now() });
export const fail = (message: string): ActionResult => ({ ok: false, message, at: Date.now() });

export const NETWORK_FAIL = "Couldn't save. Check your connection and try again.";

/** Amount typed as rands ("1 585", "113,21") → integer cents. */
export const zMoney = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const c = parseRandToCents(s);
    if (c === null) {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 150 or 113.21." });
      return z.NEVER;
    }
    return c;
  });

export const zPositiveMoney = zMoney.refine((c) => c > 0, "Enter an amount above R0.");

export const zDate = z.string().trim().refine(isISODate, "Pick a valid date.");
/** A field that may be blank or left out of the form entirely. */
const optionalString = z
  .string()
  .optional()
  .transform((s) => (s ?? "").trim());

export const zOptionalDate = optionalString
  .transform((s) => (s === "" ? null : s))
  .refine((s) => s === null || isISODate(s), "Pick a valid date.");
export const zOptionalText = (max: number) =>
  optionalString
    .pipe(z.string().max(max, `Keep it under ${max} characters.`))
    .transform((s) => (s === "" ? null : s));
export const zId = z.uuid("Something went wrong: refresh the page and try again.");
export const zCheckbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

/** FormData → plain object of strings (files and repeated keys ignored). */
export function formObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((value, key) => {
    if (typeof value === "string" && !(key in out)) out[key] = value;
  });
  return out;
}

/** Validate a form with a Zod schema, or return the first problem as a message. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  fd: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; result: ActionResult } {
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Zod's own wording ("expected string, received undefined") means the
    // form itself is out of date, not that the user typed something wrong.
    const message =
      issue.code === "invalid_type" || issue.code === "invalid_value" || issue.code === "invalid_format"
        ? issue.message.startsWith("Invalid") ? "Something's missing from the form. Refresh the page and try again." : issue.message
        : issue.message;
    return { ok: false, result: fail(message) };
  }
  return { ok: true, data: parsed.data };
}
