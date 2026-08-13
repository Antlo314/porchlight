import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.resolve(
  process.env.USERPROFILE || "",
  ".grok/sessions/C%3A%5CUsers%5Caarons/019ff959-f103-72e1-a0b7-86d9c8860e1d/images"
);
const OUT_IMG = path.join(ROOT, "public/games/quilt");
const OUT_AUD = path.join(ROOT, "public/games/quilt/audio");

async function keyMagenta(srcName, destName, max) {
  const input = path.join(SRC, srcName);
  if (!fs.existsSync(input)) {
    console.log("skip img", srcName);
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
    .resize({ width: max, height: max, fit: "inside" })
    .png()
    .toFile(path.join(OUT_IMG, destName));
  console.log("img", destName);
}

async function elevenKey() {
  try {
    const res = await fetch("http://127.0.0.1:4100/api/vault/ELEVENLABS_API_KEY");
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json.value === "string" && json.value.length > 8 ? json.value : null;
  } catch {
    return null;
  }
}

async function genSfx(key, text, dest, duration) {
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      duration_seconds: duration,
      prompt_influence: 0.35,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${path.basename(dest)} ${res.status} ${err.slice(0, 160)}`);
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

fs.mkdirSync(OUT_AUD, { recursive: true });
await keyMagenta("18.jpg", "ember-talk.png", 320);
await keyMagenta("19.jpg", "medal-silver.png", 192);
await keyMagenta("17.jpg", "medal-copper.png", 192);

const key = await elevenKey();
if (!key) {
  console.log("no elevenlabs key");
  process.exit(0);
}

const jobs = [
  ["Tiny soft tap click, wooden, very short, no voice", "tap.mp3", 0.5],
  ["Two quilt tiles swapping, soft cloth rustle, short, no voice", "swap.mp3", 0.5],
  ["Warm amber chime when three tiles match, short, no voice", "match.mp3", 0.55],
  ["Brighter golden double chime for a special match, short, no voice", "true.mp3", 0.7],
  ["Cascading sparkle of small chimes, short, no voice", "cascade.mp3", 0.8],
  ["Soft dull thud for an invalid move, short, no voice", "invalid.mp3", 0.5],
  ["Warm porch success chime, lantern lighting, no voice", "win.mp3", 1.3],
  ["Gentle low lantern snuff, not scary, short, no voice", "lose.mp3", 0.8],
  ["Soft dusk ambient pad loop, crickets far away, cozy, no melody, no voice", "loop.mp3", 8],
];

for (const [text, name, dur] of jobs) {
  try {
    await genSfx(key, text, path.join(OUT_AUD, name), dur);
    console.log("sfx", name);
  } catch (err) {
    console.log("sfx fail", name, String(err.message || err));
  }
}
