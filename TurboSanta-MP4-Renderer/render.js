import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const url = process.env.RENDER_URL;
const width = Number(process.env.WIDTH || 1080);
const height = Number(process.env.HEIGHT || 1080);
const fps = Number(process.env.FPS || 30);
const durationMs = Number(process.env.DURATION || 0);

if (!url) {
  console.error("❌ Missing RENDER_URL");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("🎅 Rendering:", url);
console.log(`📐 ${width}x${height} @ ${fps}fps for max ${durationMs}ms`);

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

/**
 * MapLibre never truly goes "idle"
 * domcontentloaded + settle time is safer
 */
await page.goto(url, { waitUntil: "domcontentloaded" });

// Let MapLibre + GPX initialise
await sleep(3000);

// 📁 Prepare frames directory
const framesDir = "frames";
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

// Ensure completion flag exists
await page.evaluate(() => {
  window.__GPX_DONE__ = false;
});

console.log("🎥 Recording frames (real-time)");

// 🔁 Capture frames with HARD SAFETY CAP
let frame = 0;
const frameDelay = 1000 / fps;
const maxFrames = durationMs > 0
  ? Math.ceil(durationMs / frameDelay)
  : Infinity;

while (frame < maxFrames) {
  const framePath = path.join(
    framesDir,
    `frame_${String(frame).padStart(5, "0")}.png`
  );

  await page.screenshot({ path: framePath, type: "png" });
  frame++;

  const done = await page.evaluate(() => window.__GPX_DONE__ === true);
  if (done) {
    console.log("✅ GPX animation completed early");
    break;
  }

  await sleep(frameDelay);
}

if (frame >= maxFrames) {
  console.warn("⚠️ Max duration reached — forcing render stop");
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

// 🎬 Encode MP4 (FAST + HIGH QUALITY)
execSync(
  `ffmpeg -y -r ${fps} -i frames/frame_%05d.png \
   -c:v libx264 -preset veryfast -crf 18 \
   -pix_fmt yuv420p -movflags +faststart ${outputFile}`,
  { stdio: "inherit" }
);

console.log("✅ MP4 created:", outputFile);
