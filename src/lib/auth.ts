import "server-only";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, checked again next to the data (the proxy is the
 * first gate, this is the second, RLS is the third). Redirects otherwise.
 */
export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isAllowedEmail(data.user.email)) redirect("/login");
  return { supabase, user: data.user };
}
