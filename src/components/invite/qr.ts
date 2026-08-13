// A small QR Code encoder — byte mode, error-correction level M, versions 1–6
// (up to 106 bytes, which comfortably covers any invite URL we mint).
//
// Why hand-rolled: the launch-event QR has to render inside our CSP and work
// offline, so calling an external QR service is out, and a new npm dependency
// isn't worth the supply-chain surface for ~250 lines of fully specified math.
// Construction follows ISO/IEC 18004: mode + character count, Reed–Solomon
// error correction over GF(256), block interleaving, function patterns, then
// the eight mask patterns scored by the standard penalty rules.
//
// Versions 7+ are deliberately unsupported: they need the 18-bit version
// information blocks and a 16-bit character count field, and nothing we
// generate gets near 106 bytes. encode() returns null instead of guessing, and
// callers fall back to showing the URL as text.

export type QrMatrix = {
  /** Modules per side, excluding the quiet zone. */
  size: number;
  /** modules[y][x] — true means a dark module. */
  modules: boolean[][];
};

/** Error-correction level M, as the two bits that go into the format info. */
const ECC_LEVEL_BITS = 0b00;

/** Per version: total codewords, EC codewords per block, block count (level M). */
const VERSIONS: Record<
  number,
  { total: number; ecPerBlock: number; blocks: number }
> = {
  1: { total: 26, ecPerBlock: 10, blocks: 1 },
  2: { total: 44, ecPerBlock: 16, blocks: 1 },
  3: { total: 70, ecPerBlock: 26, blocks: 1 },
  4: { total: 100, ecPerBlock: 18, blocks: 2 },
  5: { total: 134, ecPerBlock: 24, blocks: 2 },
  6: { total: 172, ecPerBlock: 16, blocks: 4 },
};

const MAX_VERSION = 6;
/** 4 bits of mode + 8 bits of character count = 2 codewords of header. */
const HEADER_CODEWORDS = 2;

function dataCodewords(version: number): number {
  const spec = VERSIONS[version];
  return spec.total - spec.ecPerBlock * spec.blocks;
}

// ─────────────────────────────────────────────────────────────
// GF(256) arithmetic for Reed–Solomon (primitive polynomial 0x11d)
// ─────────────────────────────────────────────────────────────

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

/** Generator polynomial of the given degree, highest-order coefficient first. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Polynomial long division remainder — the block's error-correction bytes. */
function reedSolomon(block: number[], ecLength: number): number[] {
  const gen = generatorPoly(ecLength);
  const buf = new Array<number>(block.length + ecLength).fill(0);
  for (let i = 0; i < block.length; i++) buf[i] = block[i];

  for (let i = 0; i < block.length; i++) {
    const factor = buf[i];
    if (factor === 0) continue;
    // gen[0] is always 1, so this zeroes buf[i] as it goes.
    for (let j = 0; j < gen.length; j++) buf[i + j] ^= gfMul(gen[j], factor);
  }
  return buf.slice(block.length);
}

// ─────────────────────────────────────────────────────────────
// Bit stream → codewords
// ─────────────────────────────────────────────────────────────

function buildDataCodewords(bytes: Uint8Array, version: number): number[] {
  const capacity = dataCodewords(version);
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // character count (8-bit field for versions 1–9)
  for (const byte of bytes) push(byte, 8);

  // Terminator (up to four zeroes), then pad out to a whole byte.
  const capacityBits = capacity * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  // Alternating pad codewords fill the rest of the data capacity.
  const PADS = [0xec, 0x11];
  let pad = 0;
  while (codewords.length < capacity) codewords.push(PADS[pad++ % 2]);
  return codewords;
}

/** Splits data into blocks, appends EC, and interleaves both as the spec wants. */
function interleave(data: number[], version: number): number[] {
  const { blocks, ecPerBlock } = VERSIONS[version];
  const shortLen = Math.floor(data.length / blocks);
  const longBlocks = data.length % blocks; // these carry one extra codeword

  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let b = 0; b < blocks; b++) {
    const length = shortLen + (b >= blocks - longBlocks ? 1 : 0);
    const block = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }

  const out: number[] = [];
  const longest = shortLen + (longBlocks > 0 ? 1 : 0);
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Matrix
// ─────────────────────────────────────────────────────────────

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function buildMatrix(version: number, codewords: number[]): QrMatrix {
  const size = version * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );
  const isFunction: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false)
  );

  // x = column, y = row, matching the spec's diagrams.
  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  // Timing patterns (drawn first; the finders overwrite their ends).
  for (let i = 0; i < size; i++) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  // Finder patterns plus their separators — a 9×9 block where the ring at
  // Chebyshev distance 2 and the separator at distance 4 are light.
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(cx + dx, cy + dy, distance !== 2 && distance !== 4);
      }
    }
  }

  // Versions 2–6 have exactly one alignment pattern, at (size-7, size-7); the
  // other three candidate positions collide with finder patterns.
  if (version >= 2) {
    const centre = size - 7;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        setFunction(
          centre + dx,
          centre + dy,
          Math.max(Math.abs(dx), Math.abs(dy)) !== 1
        );
      }
    }
  }

  const drawFormat = (mask: number) => {
    const data = (ECC_LEVEL_BITS << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = (((data << 10) | rem) ^ 0x5412) >>> 0;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;

    // Copy one: around the top-left finder.
    for (let i = 0; i <= 5; i++) setFunction(8, i, bit(i));
    setFunction(8, 7, bit(6));
    setFunction(8, 8, bit(7));
    setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFunction(14 - i, 8, bit(i));

    // Copy two: split between the other two finders.
    for (let i = 0; i < 8; i++) setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFunction(8, size - 15 + i, bit(i));
    setFunction(8, size - 8, true); // the always-dark module
  };

  // Reserve the format strips before laying data down; real bits come later.
  drawFormat(0);

  // Zig-zag the codeword bits upward/downward through column pairs, right to
  // left, skipping the vertical timing column.
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (let column = 0; column < 2; column++) {
        const x = right - column;
        if (isFunction[y][x]) continue;
        let dark = false;
        if (bitIndex < codewords.length * 8) {
          dark =
            ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
          bitIndex++;
        }
        modules[y][x] = dark;
      }
    }
    upward = !upward;
  }

  const applyMask = (mask: number) => {
    const fn = MASKS[mask];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!isFunction[y][x] && fn(y, x)) modules[y][x] = !modules[y][x];
      }
    }
  };

  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty(modules, size);
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
    applyMask(mask); // XOR is its own inverse — undo before trying the next
  }
  applyMask(bestMask);
  drawFormat(bestMask);

  return { size, modules };
}

/** The four standard penalty rules; the lowest-scoring mask wins. */
function penalty(modules: boolean[][], size: number): number {
  let score = 0;

  // Rule 1 — runs of five or more same-coloured modules in a line.
  const scoreLine = (line: boolean[]) => {
    let run = 1;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  };
  for (let y = 0; y < size; y++) scoreLine(modules[y]);
  for (let x = 0; x < size; x++) {
    scoreLine(modules.map((row) => row[x]));
  }

  // Rule 2 — 2×2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const v = modules[y][x];
      if (
        v === modules[y][x + 1] &&
        v === modules[y + 1][x] &&
        v === modules[y + 1][x + 1]
      ) {
        score += 3;
      }
    }
  }

  // Rule 3 — finder-lookalike sequences (dark:light:dark:dark:dark:light:dark
  // with four light modules on one side) in any row or column.
  const FINDER_A = [
    true, false, true, true, true, false, true, false, false, false, false,
  ];
  const FINDER_B = [
    false, false, false, false, true, false, true, true, true, false, true,
  ];
  const matches = (line: boolean[], at: number, pattern: boolean[]) => {
    for (let i = 0; i < pattern.length; i++) {
      if (line[at + i] !== pattern[i]) return false;
    }
    return true;
  };
  const scanLine = (line: boolean[]) => {
    for (let i = 0; i + 11 <= line.length; i++) {
      if (matches(line, i, FINDER_A) || matches(line, i, FINDER_B)) score += 40;
    }
  };
  for (let y = 0; y < size; y++) scanLine(modules[y]);
  for (let x = 0; x < size; x++) {
    scanLine(modules.map((row) => row[x]));
  }

  // Rule 4 — imbalance between dark and light modules.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  }
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Whether `text` fits in the versions we support, so a caller can lay out a
 * text fallback instead of leaving a QR-shaped hole.
 */
export function fitsQr(text: string): boolean {
  return (
    new TextEncoder().encode(text).length + HEADER_CODEWORDS <=
    dataCodewords(MAX_VERSION)
  );
}

/**
 * Encodes `text` as a QR matrix, or returns null when it doesn't fit in the
 * versions we support (106 bytes). Callers must handle null.
 */
export function encodeQr(text: string): QrMatrix | null {
  const bytes = new TextEncoder().encode(text);
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (bytes.length + HEADER_CODEWORDS <= dataCodewords(version)) {
      const data = buildDataCodewords(bytes, version);
      return buildMatrix(version, interleave(data, version));
    }
  }
  return null;
}
