import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const url = process.env.RENDER_URL;
const out = process.env.OUTPUT || "gpx_animation.mp4";
const duration = Number(process.env.DURATION || 15000);
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
await page.setViewport({
  width,
  height,
  deviceScaleFactor: 1
});

await page.goto(url, { waitUntil: "networkidle2" });

// ⏳ Let MapLibre + GPX animation fully initialise
await sleep(3000);

// 📁 Prepare frames directory
const framesDir = "frames";
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });

const totalFrames = Math.floor((duration / 1000) * fps);
const frameDelay = 1000 / fps;

console.log(`🎥 Capturing ${totalFrames} frames`);

for (let i = 0; i < totalFrames; i++) {
  const framePath = path.join(
    framesDir,
    `frame_${String(i).padStart(5, "0")}.png`
  );

  await page.screenshot({
    path: framePath,
    type: "png"
  });

  await sleep(frameDelay);
}

await browser.close();

const frameCount = fs.readdirSync(framesDir).length;
if (frameCount === 0) {
  console.error("❌ No frames captured");
  process.exit(1);
}

console.log(`🖼️ ${frameCount} frames captured`);

// 🎬 Encode MP4
execSync(
  `ffmpeg -y -r ${fps} -i frames/frame_%05d.png \
   -c:v libx264 -pix_fmt yuv420p \
   -movflags +faststart ${out}`,
  { stdio: "inherit" }
);

console.log("✅ MP4 created:", out);
