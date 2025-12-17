import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// 🔁 Optional progress callback to Google Sheets
const PROGRESS_WEBHOOK = process.env.SHEET_WEBHOOK_URL;
const RUN_ID = process.env.RUN_ID;

let lastReportedPct = -1;

async function reportProgress(pct, status = "Rendering") {
  if (!PROGRESS_WEBHOOK || !RUN_ID) return;

  // throttle: only send when % changes
  if (pct === lastReportedPct) return;
  lastReportedPct = pct;

  try {
    await fetch(PROGRESS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: RUN_ID,
        progress: pct,
        status
      })
    });
  } catch {
    // 🔕 never fail render because of reporting
  }
}

const url = process.env.RENDER_URL;
const width = Number(process.env.WIDTH || 1080);
const height = Number(process.env.HEIGHT || 1080);
const fps = Number(process.env.FPS || 24);
const durationMs = Number(process.env.DURATION || 0);

if (!url) {
  console.error("❌ Missing RENDER_URL");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("🎅 Rendering:", url);
console.log(`📐 ${width}x${height} @ ${fps}fps for max ${durationMs || "∞"}ms`);

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

// Initialise render flags + progress (SAFE)
await page.evaluate(() => {
  window.__GPX_DONE__ = false;
  window.__GPX_PROGRESS__ = 0;
  window.__GPX_TOTAL_FRAMES__ = 0;
});

console.log("🎥 Recording frames");

// 🔁 Capture frames with HARD SAFETY CAP
let frame = 0;
const frameDelay = 1000 / fps;
const maxFrames = durationMs > 0
  ? Math.ceil(durationMs / frameDelay)
  : Infinity;

// Expose total frames to page (for %)
await page.evaluate(max => {
  window.__GPX_TOTAL_FRAMES__ = max;
}, maxFrames);

while (frame < maxFrames) {
  const framePath = path.join(
    framesDir,
    `frame_${String(frame).padStart(5, "0")}.png`
  );

  await page.screenshot({ path: framePath, type: "png" });
  frame++;

  // Update progress inside page (readable by Sheets if needed later)
  await page.evaluate(f => {
    if (window.__GPX_TOTAL_FRAMES__ > 0) {
      window.__GPX_PROGRESS__ = Math.round(
        (f / window.__GPX_TOTAL_FRAMES__) * 100
      );
    }
  }, frame);

  // Log progress roughly once per second
  if (frame % fps === 0) {
    const pct = Math.min(100, Math.round((frame / maxFrames) * 100));
    console.log(`📊 Render progress: ${pct}%`);
  }

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

// 🔎 Read metadata for filename (optional)
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
