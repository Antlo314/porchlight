import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.resolve(
  process.env.USERPROFILE || "",
  ".grok/sessions/C%3A%5CUsers%5Caarons/019ff959-f103-72e1-a0b7-86d9c8860e1d/images"
);
const OUT = path.join(ROOT, "public/games/quilt");

async function key(srcName, destName) {
  const input = path.join(SRC, srcName);
  if (!fs.existsSync(input)) {
    console.log("skip", srcName);
    return;
  }
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magenta = r > 160 && b > 130 && g < 110 && r + b - 2 * g > 180;
    const mag = Math.hypot(r - 255, g - 20, b - 255);
    if (magenta || mag < 95) data[i + 3] = 0;
    else if (mag < 150) data[i + 3] = Math.round(((mag - 95) / 55) * 255);
  }
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .trim({ threshold: 8 })
    .resize({ width: 320, height: 320, fit: "inside" })
    .png()
    .toFile(path.join(OUT, destName));
  console.log("ok", destName);
}

await key("20.jpg", "ember-idle-2.png");
await key("21.jpg", "ember-idle-3.png");
await key("22.jpg", "ember-cheer.png");
