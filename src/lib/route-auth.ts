import "server-only";
import { isAllowedEmail } from "./env";
import { createClient } from "./supabase/server";

/** For Route Handlers: the Supabase client if the allowed user is signed in, else null. */
export async function routeUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isAllowedEmail(data.user.email)) return null;
  return supabase;
}
