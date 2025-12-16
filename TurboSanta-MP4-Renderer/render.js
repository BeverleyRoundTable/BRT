import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const url = process.env.RENDER_URL;
const width = Number(process.env.WIDTH || 1080);
const height = Number(process.env.HEIGHT || 1080);
const fps = Number(process.env.FPS || 30);

if (!url) {
  console.error("❌ Missing RENDER_URL");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("🎅 Rendering:", url);

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-web-security",
    "--autoplay-policy=no-user-gesture-required"
  ]
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

await page.goto(url, { waitUntil: "networkidle2" });

// Let MapLibre + GPX initialise
await sleep(2000);

// 📁 Prepare frames directory
const framesDir = "frames";
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

// Ensure completion flag exists
await page.evaluate(() => {
  window.__GPX_DONE__ = false;
});

console.log("🎥 Recording frames (real-time)");

// 🔁 Capture frames until animation signals completion
let frame = 0;
const frameDelay = 1000 / fps;

while (true) {
  const framePath = path.join(
    framesDir,
    `frame_${String(frame).padStart(5, "0")}.png`
  );

  await page.screenshot({ path: framePath, type: "png" });
  frame++;

  const done = await page.evaluate(() => window.__GPX_DONE__ === true);
  if (done) break;

  await sleep(frameDelay);
}

// Small buffer for final settle
await sleep(300);

// 🔎 Read metadata for filename
const meta = await page.evaluate(() => window.__GPX_META__ || {});

await browser.close();

// 🧼 Build safe filename
const safe = s =>
  String(s || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");

const datePart = meta.date
  ? new Date(meta.date).toISOString().slice(0, 10)
  : "";

const baseName = [safe(meta.name), datePart]
  .filter(Boolean)
  .join("_");

const outputFile = `${baseName || "gpx_animation"}.mp4`;

const frameCount = fs.readdirSync(framesDir).length;
if (!frameCount) {
  console.error("❌ No frames captured");
  process.exit(1);
}

console.log(`🖼️ ${frameCount} frames captured`);
console.log("📛 Output file:", outputFile);

// 🎬 Encode MP4
execSync(
  `ffmpeg -y -r ${fps} -i frames/frame_%05d.png \
   -c:v libx264 -pix_fmt yuv420p \
   -movflags +faststart ${outputFile}`,
  { stdio: "inherit" }
);

console.log("✅ MP4 created:", outputFile);
