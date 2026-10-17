"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string };

const emailSchema = z.object({ email: z.email("Enter a valid email address.").max(254) });
const codeSchema = z.object({
  email: z.email().max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Enter the code from the email: digits only."),
});

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0].message };
  const email = parsed.data.email.toLowerCase();

  // Same answer whether or not the address is allowed, so the form doesn't
  // reveal which email has access. Nothing is sent to other addresses.
  if (!isAllowedEmail(email)) return { step: "code", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${await siteOrigin()}/auth/confirm`,
    },
  });
  if (error) {
    const message =
      error.status === 429
        ? "Too many sign-in emails. Wait a minute, then try again."
        : "Couldn't send the email. Check your connection and try again.";
    return { step: "email", error: message };
  }
  return { step: "code", email };
}

export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = codeSchema.safeParse({ email: formData.get("email"), code: formData.get("code") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { step: "code", email, error: parsed.error.issues[0].message };

  const wrong = { step: "code" as const, email, error: "That code didn't work. Check it, or send a new email." };
  if (!isAllowedEmail(parsed.data.email)) return wrong;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email.toLowerCase(),
    token: parsed.data.code,
    type: "email",
  });
  if (error) return wrong;
  redirect("/");
}
