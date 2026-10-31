import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, robots.txt (public so crawlers can
    // read "Disallow: /") and the web-app manifest and icons (phones fetch
    // them without a session when adding Money Desk to the home screen).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
