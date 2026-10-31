/**
 * fetch for the Supabase client that rides out a known clock hiccup.
 *
 * Right after a login token is refreshed, Supabase's database API can
 * briefly see the token as "issued in the future" (error PGRST303) because
 * its clock is a moment behind the auth server's. The request is fine a
 * second later, so retry it rather than tell the user their save failed.
 */
const RETRY_DELAYS_MS = [1200, 2500];

export async function skewTolerantFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let response = await fetch(input, init);
  for (const delay of RETRY_DELAYS_MS) {
    if (response.status !== 401) return response;
    const body = await response.clone().text();
    if (!body.includes("PGRST303")) return response;
    await new Promise((resolve) => setTimeout(resolve, delay));
    response = await fetch(input, init);
  }
  return response;
}
