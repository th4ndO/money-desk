// Renders icon.svg to the PNG sizes phones and browsers ask for.
// Run with Playwright available: node scripts/icons/make-icons.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../..");
const svg = fs.readFileSync(path.join(here, "icon.svg"), "utf8");
const out = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/maskable-512.png", 512],
  ["src/app/apple-icon.png", 180],
  ["src/app/icon.png", 64],
];

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage();
for (const [file, size] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  await page.screenshot({ path: path.join(root, file), omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", file, size);
}
await browser.close();
