// Offline save gives a clear message; back online it saves; returning to the
// app shows changes made elsewhere.
import { chromium } from "playwright";
import { sign } from "./jwt.mjs";
const now = Math.floor(Date.now()/1000), sub="22222222-2222-4222-8222-222222222222", email="me@test";
const session={access_token:sign({sub,email,role:"authenticated",aud:"authenticated",exp:now+3600,iat:now}),refresh_token:"r",token_type:"bearer",expires_in:3600,expires_at:now+3600,user:{id:sub,aud:"authenticated",role:"authenticated",email}};
const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome"});
const ctx=await b.newContext({viewport:{width:375,height:800}});
await ctx.addCookies([{name:"sb-127-auth-token",value:"base64-"+Buffer.from(JSON.stringify(session)).toString("base64url"),domain:"localhost",path:"/"}]);
const p=await ctx.newPage();
const settle=()=>p.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'));
const check=(n,c,d="")=>console.log(`${c?"PASS":"FAIL"}  ${n}${d?"  — "+d:""}`);
await p.goto("http://localhost:3200/"); await settle();

// 1. Offline save
await ctx.setOffline(true);
await p.getByLabel("Amount (R)").first().fill("33");
await p.getByRole("button", { name: "Log spending" }).click();
const msg = await p.getByRole("status").filter({ hasText: "Couldn't reach Money Desk" }).first().textContent({ timeout: 10000 }).catch(() => "");
check("offline save says nothing was saved", msg.includes("nothing was saved"), msg.trim());
check("typed amount kept after offline failure", (await p.getByLabel("Amount (R)").first().inputValue()) === "33");

// 2. Back online, same form saves
await ctx.setOffline(false);
await p.getByRole("button", { name: "Log spending" }).click();
await p.getByRole("status").filter({ hasText: "Logged R33" }).first().waitFor({ timeout: 10000 });
check("back online the same entry saves", true);

// 3. A change made elsewhere shows up when returning to the app
const { execSync } = await import("node:child_process");
execSync(`psql -h /var/tmp/mdpg -p 54329 -U postgres -q -d e2e -c "insert into public.transactions (user_id, cycle_id, cycle_item_id, amount_cents, date, note) select c.user_id, c.id, i.id, 7700, '2026-10-19', 'Elsewhere' from public.cycles c join public.cycle_items i on i.cycle_id=c.id and i.name='Transport' where c.name='October 2026'"`);
await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
await p.waitForTimeout(5200);
await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
await p.waitForFunction(() => document.body.innerText.includes("R77 spent"), null, { timeout: 10000 }).then(() => check("returning to the app shows fresh figures", true)).catch(() => check("returning to the app shows fresh figures", false));
await b.close();
