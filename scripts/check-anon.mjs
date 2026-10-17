// Proves that a request with only the public anon key (no session) gets
// nothing back from any table. Run: npm run check:anon
// Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from the
// environment or .env.local.
import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
  process.exit(1);
}

const tables = ["settings", "recurring_items", "cycles", "cycle_items", "transactions", "income", "reserves", "todos"];
let leaked = false;

for (const table of tables) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  const empty = res.ok && body.trim() === "[]";
  const refused = res.status === 401 || res.status === 403;
  console.log(`${empty || refused ? "ok  " : "LEAK"} ${table.padEnd(16)} HTTP ${res.status} ${empty ? "[]" : refused ? "refused" : body.slice(0, 80)}`);
  if (!empty && !refused) leaked = true;
}

if (leaked) {
  console.error("\nAnonymous access returned data. Do not deploy.");
  process.exit(1);
}
console.log("\nAnonymous requests see nothing.");
