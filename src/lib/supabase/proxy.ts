import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, supabaseAnonKey, supabaseUrl } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth/confirm"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Redirect while keeping any refreshed or cleared session cookies. */
function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string, search = "") {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  const response = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

/**
 * Refreshes the session cookie on every request, sends visitors without a
 * session to /login, and signs out any session that isn't ALLOWED_EMAIL.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // If Supabase falls back to the bare Site URL, the sign-in link lands on
  // "/?token_hash=…". Pass it on to the handler that knows what to do.
  if (searchParams.has("token_hash") && pathname !== "/auth/confirm") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Nothing may run between creating the client and this call: it is what
  // refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims && !isAllowedEmail(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    return redirectWithCookies(request, response, "/login", "?error=not-allowed");
  }

  if (!claims && !isPublic(pathname)) {
    return redirectWithCookies(request, response, "/login");
  }

  if (claims && pathname === "/login") {
    return redirectWithCookies(request, response, "/");
  }

  return response;
}
