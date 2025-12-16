import puppeteer from "puppeteer";
import fs from "fs";
import { execSync } from "child_process";

const url = process.env.RENDER_URL;
const out = process.env.OUTPUT || "output.mp4";
const duration = Number(process.env.DURATION || 12000);
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

// ⏳ Let GPX + MapLibre settle
await sleep(3000);

// 🎥 Setup CDP screencast
const client = await page.createCDPSession();
const frames = [];

import path from "path";
import { execSync } from "child_process";

const framesDir = "frames";
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

  await new Promise(r => setTimeout(r, frameDelay));
}

await browser.close();

console.log("🖼️ Frames captured:", totalFrames);

client.on("Page.screencastFrame", async e => {
  frames.push(Buffer.from(e.data, "base64"));
  await client.send("Page.screencastFrameAck", {
    sessionId: e.sessionId
  });
});

// ⏱️ Run animation
await sleep(duration);

// 🛑 Stop capture
await client.send("Page.stopScreencast");
await browser.close();

// 🧪 Write frames
fs.mkdirSync("frames", { recursive: true });
frames.forEach((buf, i) => {
  fs.writeFileSync(
    `frames/frame_${String(i).padStart(5, "0")}.jpg`,
    buf
  );
});

console.log(`🖼️ ${frames.length} frames captured`);

// 🎬 Encode MP4
execSync(
  `ffmpeg -y -r ${fps} -i frames/frame_%05d.jpg \
   -c:v libx264 -pix_fmt yuv420p -profile:v high \
   -movflags +faststart ${out}`,
  { stdio: "inherit" }
);

console.log("✅ MP4 created:", out);
