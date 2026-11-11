// Run after walkthrough.mjs-style setup with MONEY_DESK_FAKE_TODAY=2026-10-19.
// The Today page's "Check against bank": unknown money, Free money envelope,
// Ready to allocate, unlogged spending, quick envelope buttons and #log focus.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { sign } from "./jwt.mjs";

const BASE = "http://localhost:3200";
const sql = (q) => execSync(`psql -h /var/tmp/mdpg -p 54329 -U postgres -q -d e2e -Atc "${q}"`).toString().trim();
const now = Math.floor(Date.now() / 1000), sub = "22222222-2222-4222-8222-222222222222", email = "me@test";
const session = { access_token: sign({ sub, email, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }), refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: sub, aud: "authenticated", role: "authenticated", email } };
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 375, height: 800 } });
await ctx.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), domain: "localhost", path: "/" }]);
const p = await ctx.newPage();
const settle = () => p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 });
const results = [];
const check = (n, c, d = "") => { results.push(c); console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const toast = (t) => p.getByRole("status").filter({ hasText: t }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
const norm = (s) => s.replace(/[\s\u00a0\u2009\u202f]+/g, " ");
const has = async (loc, text) => loc.filter({ hasText: text }).first().waitFor({ timeout: 8000 }).then(() => true, async () => { console.log("   saw:", norm(await loc.first().textContent()).slice(0, 300)); return false; });
const rands = (s) => Number(s.replace(/[R\s ]/g, ""));
const card = () => p.locator("section[aria-labelledby=bank-title]");
const enter = async (r) => {
  await p.locator("#bank-balance").fill(String(r));
  await card().getByRole("button", { name: "Check" }).click();
  await toast("Bank balance saved");
  await settle();
};

await p.goto(BASE + "/settings"); await settle();
await p.getByRole("button", { name: "Load my starting data" }).click();
check("starting data loads", await toast("Loaded your starting data"));

await p.goto(BASE + "/"); await settle();
check("card asks for a balance when never checked", (await card().textContent()).includes("Never checked"));

// R0 in the bank shows how much Money Desk expects.
await enter(0);
const missing = card().locator("p", { hasText: "less than Money Desk expects" }).locator(".money").first();
const expected = rands(await missing.textContent());
check("R0 shows everything as missing", expected > 0, `expects R${expected}`);

// R2 000 more than expected.
await enter(expected + 2000);
check("finds R2 000 the app doesn't know about", await has(card(), /R2\s000\s*in your bank/));
await card().getByRole("button", { name: "Put in Free money" }).click();
check("Free money confirms", await toast("R2 000 is in your Free money envelope"));
await settle();
check("bank now matches", await has(card(), "Matches your bank"));
check("one Free money envelope with R2 000", sql("select count(*) || ':' || max(planned_cents) from cycle_items where name = 'Free money'") === "1:200000");
check("recorded as income once", sql("select count(*) from income where source = 'Unrecorded money (bank check)'") === "1");
check("Ready to allocate unchanged at zero", !(await p.textContent("main")).includes("Ready to allocate\nR"));

// Spend R150 of it with the quick button.
const quick = p.getByRole("group", { name: "Quick envelope" });
check("quick envelope buttons show", (await quick.getByRole("button").count()) >= 2);
await p.locator("#log-envelope").selectOption({ label: "Free money" });
await p.locator("#log-amount").fill("150");
await p.getByRole("button", { name: "Log spending" }).click();
check("spend from Free money logs", await toast("Logged R150 to Free money"));
await settle();
check("Free money bar shows R1 850 left", await has(p.locator("main"), /R1\s850/));

// Bank shows R400 less than expected: unlogged spending.
await enter(expected + 2000 - 150 - 400);
check("spots R400 not logged", await has(card(), /R400\s*less than/));
await card().getByRole("button", { name: "Log as unplanned spending" }).click();
check("unlogged spending recorded", await toast("Logged R400 as unplanned spending"));
await settle();
check("bank matches again", (await card().textContent()).includes("Matches your bank"));

// R300 extra, sent to Ready to allocate instead.
await enter(expected + 2000 - 150 - 400 + 300);
await card().getByRole("button", { name: "Ready to allocate" }).click();
check("extra goes to Ready to allocate", await toast("R300 is now ready to allocate"));
await settle();
const main = await p.textContent("main");
check("Ready to allocate card shows R300 and bank matches", main.includes("R300") && (await card().textContent()).includes("Matches your bank"));

// A stale balance doesn't offer buttons.
sql("update settings set bank_balance_on = '2026-10-10'");
await p.reload(); await settle();
check("old balance asks for today's", (await card().textContent()).includes("Last checked 9 days ago") && (await card().getByRole("button").count()) === 1);

// Home-screen shortcut opens with the amount focused.
await p.goto(BASE + "/history"); await settle();
await p.goto(BASE + "/#log"); await settle();
await p.waitForTimeout(300);
check("#log focuses the amount", await p.evaluate(() => document.activeElement?.id === "log-amount"));
const manifest = await (await p.request.get(BASE + "/manifest.webmanifest")).json();
check("manifest has the Log spending shortcut", manifest.shortcuts?.[0]?.url === "/#log");

await p.goto(BASE + "/");
await p.screenshot({ path: "/var/tmp/e2e/bank-today.png", fullPage: false });
await b.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
