/**
 * Produces prisma/add-neighborhoods.sql — an INSERT-only file you can paste
 * into Neon's SQL Editor to add or top up neighborhoods on a live database.
 *
 *   node scripts/build-neighborhoods-sql.mjs
 *
 * Unlike setup-production.sql this creates no tables, so it is completely safe
 * to run on a database that already has data, and safe to run repeatedly —
 * existing slugs are skipped.
 *
 * The list is read from prisma/seed.ts so the two can never drift.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const seed = readFileSync(path.join(root, "prisma", "seed.ts"), "utf8");

// Pull the NEIGHBORHOODS array literal out of the seed file.
const start = seed.indexOf("const NEIGHBORHOODS");
const open = seed.indexOf("[", start);
const close = seed.indexOf("\n];", open);
if (start === -1 || open === -1 || close === -1) {
  throw new Error("Could not locate the NEIGHBORHOODS array in prisma/seed.ts");
}
const block = seed.slice(open, close);

const rows = [];
const entry =
  /\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*city:\s*"([^"]+)",\s*county:\s*"([^"]+)",\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)\s*\}/g;
let m;
while ((m = entry.exec(block)) !== null) {
  rows.push({ slug: m[1], name: m[2], city: m[3], county: m[4], lat: m[5], lng: m[6] });
}
if (rows.length === 0) throw new Error("Parsed zero neighborhoods — check the regex against seed.ts");

const esc = (s) => s.replace(/'/g, "''");
const values = rows
  .map(
    (r) =>
      `  ('nh_${r.slug}', '${r.slug}', '${esc(r.name)}', '${esc(r.city)}', '${esc(r.county)}', 'GA', ${r.lat}, ${r.lng})`
  )
  .join(",\n");

const sql = `-- Porchlight — add / top up neighborhoods
--
-- Paste into Neon's SQL Editor and press Run.
-- Creates NO tables, so this is safe on a live database with real members,
-- and safe to run as many times as you like: slugs that already exist are
-- skipped rather than duplicated or overwritten.

INSERT INTO "Neighborhood" ("id", "slug", "name", "city", "county", "state", "lat", "lng")
VALUES
${values}
ON CONFLICT ("slug") DO NOTHING;

-- Should report ${rows.length}.
SELECT COUNT(*) AS total_neighborhoods FROM "Neighborhood";

-- The east-metro ones, so you can eyeball that they landed:
SELECT "name", "city", "county"
FROM "Neighborhood"
WHERE "county" IN ('Rockdale', 'Newton', 'Henry', 'Walton')
   OR "city" IN ('Lithonia', 'Stonecrest', 'Stone Mountain', 'Ellenwood', 'Snellville', 'Lilburn')
ORDER BY "city", "name";
`;

const out = path.join(root, "prisma", "add-neighborhoods.sql");
writeFileSync(out, sql);
console.log(`Wrote ${out}`);
console.log(`  ${rows.length} neighborhoods total`);
