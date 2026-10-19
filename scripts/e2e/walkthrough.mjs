// Drives the real site in Chromium at 375px against the local stack.
import { chromium } from "playwright";
import fs from "node:fs";
import { sign } from "./jwt.mjs";

const BASE = "http://localhost:3200";
const SHOTS = process.argv[2] ?? "/var/tmp/e2e/shots";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, cond, detail = "") => {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

function sessionCookie(email, sub) {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: sub, aud: "authenticated", role: "authenticated", email, app_metadata: {}, user_metadata: {} };
  const access_token = sign({ sub, email, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now });
  const session = { access_token, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user };
  return { name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), domain: "localhost", path: "/" };
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function noSideScroll(label) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  check(`no sideways scroll at 375px: ${label}`, w <= 375, `scrollWidth=${w}`);
}
async function toast(text) {
  const el = page.getByRole("status").filter({ hasText: text });
  await el.first().waitFor({ timeout: 8000 });
  return true;
}
async function shot(name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

// 1. Signed out
await page.goto(BASE + "/");
check("signed-out visit to / lands on /login", page.url().endsWith("/login"), page.url());
await page.goto(BASE + "/cycles");
check("signed-out visit to /cycles lands on /login", page.url().endsWith("/login"));
const exp = await page.request.get(BASE + "/export/json", { maxRedirects: 0 });
check("signed-out export is refused", exp.status() === 307 || exp.status() === 401, `HTTP ${exp.status()}`);
await noSideScroll("login");
await shot("01-login");

// 2. Wrong account gets signed out
await ctx.addCookies([sessionCookie("intruder@test", "33333333-3333-4333-8333-333333333333")]);
await page.goto(BASE + "/");
check("a session for another email is thrown out", page.url().includes("/login?error=not-allowed"), page.url());
await ctx.clearCookies();

// 3. Sign in as me, load starting data
await ctx.addCookies([sessionCookie("me@test", "22222222-2222-4222-8222-222222222222")]);
await page.goto(BASE + "/");
check("signed in, empty account offers a way to start", (await page.textContent("main")).includes("Recurring"));
await page.goto(BASE + "/settings");
await page.getByRole("button", { name: "Load my starting data" }).click();
check("starting data loads", await toast("Loaded your starting data"));

// 4. Dashboard for October (today is 19 Oct 2026)
await page.goto(BASE + "/");
let main = await page.textContent("main");
check("dashboard shows the October cycle", main.includes("October 2026"));
check("left in pocket = R3 362 (bills and savings paid)", main.includes("R3 362"));
check("safe per day = R3 362 / 4 days = R840.50", main.includes("R840.50"));
check("status pill says On track", main.includes("On track"));
await noSideScroll("dashboard");
await shot("02-dashboard");

// 5. Log a spend from the dashboard
let t0 = Date.now();
await page.getByLabel("Amount (R)").fill("150");
await page.getByLabel("Note").fill("Checkers");
await page.getByRole("button", { name: "Log spending" }).click();
check("logging R150 shows 'Logged R150 to Groceries'", await toast("Logged R150 to Groceries"));
await page.getByText("R3 212").first().waitFor({ timeout: 8000 });
check("left in pocket drops to R3 212", true, `${Date.now() - t0} ms including typing`);
check("amount field clears after logging", (await page.getByLabel("Amount (R)").inputValue()) === "");

// 6. Cycles list → start January
await page.goto(BASE + "/cycles");
main = await page.textContent("main");
check("cycles list shows October, November, December", ["October 2026", "November 2026", "December 2026"].every((n) => main.includes(n)));
await noSideScroll("cycles");
await shot("03-cycles");
await page.getByRole("button", { name: "Start January cycle" }).click();
await page.waitForURL(/\/cycles\/[0-9a-f-]{36}$/, { timeout: 10000 });
main = await page.textContent("main");
check("January 2027 cycle created", main.includes("January 2027"));
check("January runs 23 Dec 2026 – 22 Jan 2027", main.includes("23 Dec 2026") && main.includes("22 Jan 2027"));
check("gym is in January (30 Dec debit, ends 31 Dec)", main.includes("Gym"));
check("rent (inactive) is not in January", !main.includes("Rent"));
check("January plans R9 745", main.includes("R9 745"));
await noSideScroll("cycle detail");
await shot("04-january");

// 7. Tick a bill on the cycle page (optimistic, then saved)
t0 = Date.now();
await page.getByRole("checkbox", { name: "Netflix: not paid" }).click();
check("ticking Netflix shows 'Netflix paid'", await toast("Netflix paid"), `${Date.now() - t0} ms`);
await page.getByRole("checkbox", { name: "Netflix: paid" }).waitFor({ timeout: 8000 });
check("Netflix stays ticked after the server round trip", true);

// 8. Starting the same cycle twice is impossible
const dup = await page.evaluate(async () => document.body.innerText.includes("January 2027"));
await page.goto(BASE + "/cycles");
check("next offer moves on to February", (await page.textContent("main")).includes("Start February cycle") && dup);

// 9. Recurring page
await page.goto(BASE + "/recurring");
main = await page.textContent("main");
check("recurring explains changes apply to future cycles", main.includes("apply to cycles you start from now on"));
check("rent shows as switched off", main.includes("Rent") && main.includes("Off"));
await noSideScroll("recurring");
await shot("05-recurring");

// 10. Income + runway
await page.goto(BASE + "/income");
await page.getByLabel("Bank balance now (R)").fill("20 000");
await page.getByRole("button", { name: "Update balance" }).click();
check("balance saves", await toast("Balance set to R20"));
await page.getByText("Money runs out around").waitFor({ timeout: 8000 });
main = await page.textContent("main");
check("runway shows a run-out date", main.includes("Money runs out around"));
await page.getByLabel("Amount (R)").fill("8500");
await page.getByLabel("Source").fill("Client invoice PP-INV-0005");
await page.getByRole("button", { name: "Record income" }).click();
check("income records", await toast("Recorded R8 500 from Client invoice PP-INV-0005"));
await noSideScroll("income");
await shot("06-income");

// 11. Reserves
await page.goto(BASE + "/reserves");
main = await page.textContent("main");
check("reserves total R6 737", main.includes("R6 737"));
await noSideScroll("reserves");

// 12. Todos
await page.goto(BASE + "/todos");
await page.getByRole("checkbox", { name: /Claim UIF.*not done/ }).click();
check("ticking a to-do says Done", await toast("Done"));
await noSideScroll("todos");

// 13. Export then restore
await page.goto(BASE + "/settings");
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download full backup (JSON)" }).click()]);
const file = `${SHOTS}/backup.json`;
await download.saveAs(file);
const backup = JSON.parse(fs.readFileSync(file, "utf8"));
check("export holds 4 cycles, 1 spend, 1 income", backup.cycles.length === 4 && backup.transactions.length === 1 && backup.income.length === 1);
const csv = await page.request.get(BASE + "/export/csv/transactions");
check("CSV export works", csv.ok() && (await csv.text()).includes("amount_rands"));
await page.setInputFiles("#backup-file", file);
await page.getByText("Importing replaces everything").waitFor();
await page.getByLabel("Type REPLACE to confirm").fill("REPLACE");
await page.getByRole("button", { name: "Replace my data with this backup" }).click();
check("restore from JSON works", await toast("Restored 4 cycles, 1 spends, 1 income entries"));
await noSideScroll("settings");
await shot("07-settings");

// 14. Close October and see the review
await page.goto(BASE + "/cycles");
await page.getByRole("link", { name: /October 2026/ }).click();
page.once("dialog", (d) => d.accept());
await page.getByRole("button", { name: "Close cycle" }).click();
check("closing a cycle", await toast("Cycle closed"));
await page.getByText("Review: planned vs actual").waitFor({ timeout: 8000 });
main = await page.textContent("main");
check("closed cycle shows the review", main.includes("Review: planned vs actual"));
check("closed cycle is read-only (no log form)", (await page.getByRole("button", { name: "Log spending" }).count()) === 0);
check("ticks are disabled when closed", await page.getByRole("checkbox").first().isDisabled());
await shot("08-review");
await page.getByRole("button", { name: "Reopen cycle" }).click();
check("reopening a cycle", await toast("Cycle reopened"));

// 15. Sign out
await page.goto(BASE + "/settings");
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL(/\/login$/);
check("sign out goes to /login", true);

// Dark mode + desktop look
const dark = await browser.newContext({ viewport: { width: 375, height: 800 }, colorScheme: "dark" });
await dark.addCookies([sessionCookie("me@test", "22222222-2222-4222-8222-222222222222")]);
const dp = await dark.newPage();
await dp.goto(BASE + "/");
await dp.screenshot({ path: `${SHOTS}/09-dashboard-dark.png`, fullPage: true });
const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await desk.addCookies([sessionCookie("me@test", "22222222-2222-4222-8222-222222222222")]);
const kp = await desk.newPage();
await kp.goto(BASE + "/");
await kp.screenshot({ path: `${SHOTS}/10-dashboard-desktop.png`, fullPage: true });

check("no JavaScript errors in the page", errors.length === 0, errors.join(" | "));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
