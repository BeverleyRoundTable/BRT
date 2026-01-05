import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import fetch from "node-fetch";

// 🔁 Optional progress callback
const PROGRESS_WEBHOOK = process.env.SHEET_WEBHOOK_URL;
const RUN_ID = process.env.RUN_ID;

let lastReportedPct = -1;

async function reportProgress(pct, status = "Rendering") {
  if (!PROGRESS_WEBHOOK || !RUN_ID) return;
  if (pct === lastReportedPct) return;
  lastReportedPct = pct;

  try {
    await fetch(PROGRESS_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: RUN_ID, progress: pct, status })
    });
  } catch {}
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

console.log("🎅 Rendering:", url);
console.log(`📐 ${width}x${height} @ ${fps}fps`);

const browser = await puppeteer.launch({
  headless: "new",
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-web-security"
  ]
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

page.on("pageerror", err => {
  console.error("❌ PAGE ERROR:", err.message);
});

page.on("console", msg => {
  console.log("📄 PAGE LOG:", msg.text());
});

await page.goto(url, { waitUntil: "domcontentloaded" });

console.log("⏳ Waiting for GPX_READY…");

await page.waitForFunction(
  () => window.__GPX_READY__ === true,
  { timeout: 20000, polling: 250 }
);

// 🔒 Let one animation frame fully draw before capture
await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));

console.log("✅ GPX ready — starting render");

// 📁 Frames folder
const framesDir = "frames";
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

// Reset page state
await page.evaluate(() => {
  window.__GPX_DONE__ = false;
  window.__RENDER_FRAME__ = 0;
});

// Safety ceiling only
const maxFrames = durationMs > 0
  ? Math.ceil((durationMs / 1000) * fps)
  : Infinity;

console.log("🎥 Capturing frames");

let frame = 0;

while (frame < maxFrames) {
  // 🔑 Frame index is authoritative
  await page.evaluate(f => {
    window.__RENDER_FRAME__ = f;
  }, frame);

  const framePath = path.join(
    framesDir,
    `frame_${String(frame).padStart(5, "0")}.png`
  );

  await page.screenshot({ path: framePath, type: "png" });
  frame++;

  // 🔁 Yield so WebGL has time to flush (prevents snap/freeze)
  await new Promise(r => setTimeout(r, 0));

  if (frame % fps === 0) {
    const pct = durationMs
      ? Math.min(100, Math.round((frame / maxFrames) * 100))
      : 0;

    console.log(`📊 Render progress: ${pct}%`);
    await reportProgress(pct, "Rendering");
  }

  const done = await page.evaluate(() => window.__GPX_DONE__ === true);
  if (done) {
    console.log("✅ Animation completed cleanly");
    break;
  }
}

if (frame >= maxFrames) {
  console.warn("⚠️ Max frame limit reached");
}

await browser.close();

// 🔔 Encoding
await reportProgress(100, "Encoding MP4");

const outputFile = "gpx_animation.mp4";

const frameCount = fs.readdirSync(framesDir).length;
if (!frameCount) {
  console.error("❌ No frames captured");
  process.exit(1);
}

console.log(`🖼️ ${frameCount} frames captured`);

execSync(
  `ffmpeg -y -r ${fps} -i frames/frame_%05d.png \
   -c:v libx264 -preset veryfast -crf 18 \
   -pix_fmt yuv420p -movflags +faststart ${outputFile}`,
  { stdio: "inherit" }
);

console.log("✅ MP4 created:", outputFile);
await reportProgress(100, "Complete");
