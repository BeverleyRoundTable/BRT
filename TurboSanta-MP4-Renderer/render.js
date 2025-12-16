import puppeteer from "puppeteer";
import fs from "fs";

const url = process.env.RENDER_URL;
const out = process.env.OUTPUT || "output.mp4";
const duration = Number(process.env.DURATION || 12000); // ms
const width = Number(process.env.WIDTH || 1080);
const height = Number(process.env.HEIGHT || 1080);
const fps = Number(process.env.FPS || 30);

if (!url) {
  console.error("❌ Missing RENDER_URL");
  process.exit(1);
}

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

// ⏳ Give MapLibre + GPX time to settle
await page.waitForTimeout(3000);

// 🎥 Start recording
await page.evaluate(() => {
  window.__CAPTURE_DONE__ = false;
});

await page._client().send("Page.startScreencast", {
  format: "jpeg",
  quality: 90,
  everyNthFrame: Math.round(60 / fps)
});

const frames = [];
page._client().on("Page.screencastFrame", async e => {
  frames.push(Buffer.from(e.data, "base64"));
  await page._client().send("Page.screencastFrameAck", {
    sessionId: e.sessionId
  });
});

// ⏱️ Run animation
await page.waitForTimeout(duration);

// 🛑 Stop
await page._client().send("Page.stopScreencast");
await browser.close();

// 🧪 Write frames to disk
fs.mkdirSync("frames", { recursive: true });

frames.forEach((buf, i) => {
  fs.writeFileSync(`frames/frame_${String(i).padStart(5, "0")}.jpg`, buf);
});

console.log(`🖼️ ${frames.length} frames captured`);

// 🎬 Encode MP4
import { execSync } from "child_process";

execSync(`
  ffmpeg -y -r ${fps} -i frames/frame_%05d.jpg \
  -c:v libx264 -pix_fmt yuv420p -profile:v high \
  -movflags +faststart ${out}
`);

console.log("✅ MP4 created:", out);
