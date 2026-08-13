/**
 * Key magenta sprites into PNG and (optionally) bake ElevenLabs SFX.
 * The ElevenLabs key is read from Zion on loopback and never printed.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SESSION_IMAGES = path.resolve(
  process.env.USERPROFILE || "",
  ".grok/sessions/C%3A%5CUsers%5Caarons/019ff959-f103-72e1-a0b7-86d9c8860e1d/images"
);
const OUT_IMG = path.join(ROOT, "public/games/light-the-block/sprites");
const OUT_AUDIO = path.join(ROOT, "public/games/light-the-block/audio");
const OUT_UI = path.join(ROOT, "public/games/light-the-block/ui");

const SPRITES = [
  { src: "1.jpg", dest: "lantern.png", max: 384 },
  { src: "7.jpg", dest: "lantern-jump.png", max: 384 },
  { src: "2.jpg", dest: "coin.png", max: 256 },
  { src: "3.jpg", dest: "platform.png", max: 640 },
  { src: "6.jpg", dest: "porch-unlit.png", max: 256 },
  { src: "4.jpg", dest: "puddle.png", max: 512 },
];

function ensure(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function keyMagenta(input, output, max) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const px = info.channels;
  for (let i = 0; i < data.length; i += px) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const magenta = r > 160 && b > 130 && g < 110 && r + b - 2 * g > 180;
    const mag = Math.hypot(r - 255, g - 20, b - 255);
    if (magenta || mag < 95) data[i + 3] = 0;
    else if (mag < 150) data[i + 3] = Math.round(((mag - 95) / 55) * 255);
  }
  let pipeline = sharp(data, {
    raw: { width: info.width, height: info.height, channels: px },
  }).trim({ threshold: 8 }).png();
  if (max) pipeline = pipeline.resize({ width: max, height: max, fit: "inside" });
  await pipeline.toFile(output);
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

async function genSfx(key, text, dest, duration = 1.2) {
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
    throw new Error(`sfx ${path.basename(dest)} ${res.status} ${err.slice(0, 160)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

async function main() {
  ensure(OUT_IMG);
  ensure(OUT_AUDIO);
  ensure(OUT_UI);

  for (const item of SPRITES) {
    const src = path.join(SESSION_IMAGES, item.src);
    if (!fs.existsSync(src)) {
      console.log("skip missing", item.src);
      continue;
    }
    const dest = path.join(OUT_IMG, item.dest);
    await keyMagenta(src, dest, item.max);
    console.log("sprite", item.dest);
  }

  const hub = path.join(SESSION_IMAGES, "5.jpg");
  if (fs.existsSync(hub)) {
    const dest = path.join(ROOT, "public/images/games-hub.jpg");
    await sharp(hub).jpeg({ quality: 86 }).toFile(dest);
    const og = path.join(ROOT, "public/images/games-og.jpg");
    await sharp(hub).resize(1200, 630, { fit: "cover" }).jpeg({ quality: 86 }).toFile(og);
    console.log("hub + og");
  }

  const key = await elevenKey();
  if (!key) {
    console.log("no elevenlabs key — procedural audio only");
    return;
  }

  const jobs = [
    ["Soft cartoon jump whoosh, short and warm, no voice", "jump.mp3", 0.6],
    ["Soft landing thud on wood porch, short, no voice", "land.mp3", 0.5],
    ["Bright warm coin collect chime, short, no voice", "coin.mp3", 0.6],
    ["Lantern igniting with a cozy amber whoosh, short, no voice", "ignite.mp3", 0.9],
    ["Soft wind gust through pines, short, no voice", "gust.mp3", 1.2],
    ["Gentle lantern snuffing out, warm and sad, short, no voice", "snuff.mp3", 0.8],
    ["Warm success chime for finishing a neighborhood, no voice", "clear.mp3", 1.4],
    [
      "Soft dusk ambient loop, warm analog pad, crickets far away, no melody hook, no voice, gentle and cozy",
      "dusk-loop.mp3",
      8,
    ],
  ];

  for (const [text, name, dur] of jobs) {
    const dest = path.join(OUT_AUDIO, name);
    try {
      await genSfx(key, text, dest, dur);
      console.log("sfx", name);
    } catch (err) {
      console.log("sfx fail", name, String(err.message || err));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
