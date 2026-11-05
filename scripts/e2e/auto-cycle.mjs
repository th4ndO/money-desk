// Run with the server's MONEY_DESK_FAKE_TODAY=2026-12-24 (after December ends).
// Auto-start of the January cycle, December's leftover, and the wish list.
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

await p.goto(BASE + "/settings"); await settle();
await p.getByRole("button", { name: "Load my starting data" }).click();
check("starting data loads", await toast("Loaded your starting data"));
check("only Oct–Dec exist before visiting Today", sql("select count(*) from cycles") === "3");

// Two visits at once must still make exactly one January cycle.
const p2 = await ctx.newPage();
await Promise.all([p.goto(BASE + "/"), p2.goto(BASE + "/")]);
await settle(); await p2.close();
let main = await p.textContent("main");
check("Today shows the January cycle, started automatically", main.includes("January 2027") && main.includes("23 Dec"));
check("exactly one January cycle was created", sql("select count(*) from cycles where name = 'January 2027'") === "1");
check("January plans R9 745 (gym's 30 Dec debit included)", main.includes("R9 745"));

// December's leftover: pocket R9 745 − savings R1 000 paid = R8 745.
check("leftover card shows December's R8 745", main.includes("Left over from December") && main.includes("R8 745"));
await p.getByRole("button", { name: "Add to Ready to allocate" }).click();
check("carrying it over confirms", await toast("R8 745 from December 2026 is now ready to allocate"));
await p.getByText("Already added to Ready to allocate").waitFor({ timeout: 8000 });
check("card then says it was already added", true);
check("carried over exactly once", sql("select count(*) from income where source = 'Left over from December 2026'") === "1");

// Wish list
await p.goto(BASE + "/wishlist"); await settle();
for (const [name, price, prio] of [["Shoes", "900", "1"], ["Tablet", "6000", "2"], ["Camera", "12000", "3"]]) {
  await p.getByLabel("What").last().fill(name);
  await p.getByLabel("Price (R)").last().fill(price);
  await p.getByLabel("How much you want it").last().selectOption(prio);
  await p.getByRole("button", { name: "Add to wish list" }).click();
  await toast(`Added ${name}`);
}
await settle();
main = await p.textContent("main");
check("wish list totals R18 900", main.includes("R18 900"));
check("R8 745 covers Shoes and Tablet, not Camera", main.includes("could cover Shoes, Tablet") && !main.includes("Shoes, Tablet, Camera"));
await p.getByRole("checkbox", { name: "Shoes: not bought yet" }).click();
check("ticking Shoes as bought confirms", await toast("Got it: Shoes"));
await p.goto(BASE + "/wishlist"); await settle();
main = await p.textContent("main");
check("bought item moves off the list (total R18 000)", main.includes("R18 000") && main.includes("Bought (1)"));
const w = await p.evaluate(() => document.documentElement.scrollWidth);
check("no sideways scroll on the wish list", w <= 375, `scrollWidth=${w}`);
await p.screenshot({ path: "/var/tmp/e2e/shots/15-wishlist.png", fullPage: true });
await p.goto(BASE + "/"); await settle();
await p.screenshot({ path: "/var/tmp/e2e/shots/16-january-auto.png", fullPage: true });

await b.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
process.exit(results.every(Boolean) ? 0 : 1);
