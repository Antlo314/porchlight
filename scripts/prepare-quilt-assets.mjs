import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.resolve(
  process.env.USERPROFILE || "",
  ".grok/sessions/C%3A%5CUsers%5Caarons/019ff959-f103-72e1-a0b7-86d9c8860e1d/images"
);
const OUT = path.join(ROOT, "public/games/quilt");

const MAP = [
  ["8.jpg", "ember.png", 320],
  ["10.jpg", "lantern.png", 192],
  ["9.jpg", "leaf.png", 192],
  ["11.jpg", "peach.png", 192],
  ["12.jpg", "key.png", 192],
  ["13.jpg", "mug.png", 192],
  ["14.jpg", "star.png", 192],
  ["15.jpg", "medal.png", 192],
];

function keyMagenta(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magenta = r > 160 && b > 130 && g < 110 && r + b - 2 * g > 180;
    const mag = Math.hypot(r - 255, g - 20, b - 255);
    if (magenta || mag < 95) data[i + 3] = 0;
    else if (mag < 150) data[i + 3] = Math.round(((mag - 95) / 55) * 255);
  }
}

async function convert(srcName, destName, max) {
  const input = path.join(SRC, srcName);
  if (!fs.existsSync(input)) {
    console.log("skip", srcName);
    return;
  }
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  keyMagenta(data, info.channels);
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .trim({ threshold: 8 })
    .resize({ width: max, height: max, fit: "inside" })
    .png()
    .toFile(path.join(OUT, destName));
  console.log("ok", destName);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [src, dest, max] of MAP) await convert(src, dest, max);

const hub = path.join(SRC, "16.jpg");
if (fs.existsSync(hub)) {
  await sharp(hub).jpeg({ quality: 86 }).toFile(path.join(ROOT, "public/images/quilt-hub.jpg"));
  console.log("ok quilt-hub.jpg");
}
