import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the sign-in email's link lands. Uses the one-time token hash rather
 * than a PKCE code, so the link works even when a phone opens it in a
 * different browser (e.g. the mail app's) from the one that asked for it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const code = searchParams.get("code");

  const supabase = await createClient();
  const result = tokenHash
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : null;

  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (!result || result.error || !result.data.user) return go("/login?error=link-expired");
  if (!isAllowedEmail(result.data.user.email)) {
    await supabase.auth.signOut();
    return go("/login?error=not-allowed");
  }
  return go("/");
}
