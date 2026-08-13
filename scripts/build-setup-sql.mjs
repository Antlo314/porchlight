/**
 * Produces prisma/setup-production.sql — the whole database in one file you can
 * paste into Neon's SQL Editor.
 *
 *   node scripts/build-setup-sql.mjs
 *
 * This is the no-local-tooling path: it needs no connection string, no env
 * vars, and no terminal beyond running this once. It creates the schema and
 * loads the Georgia neighborhoods.
 *
 * It deliberately does NOT create the demo accounts the dev seed makes — those
 * share a password that is committed to this repo, so they must never exist on
 * a production database.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

// Every migration in timestamp order, not just the first — otherwise tables
// added after the initial schema silently go missing from a fresh install.
const migrationsDir = path.join(root, "prisma", "migrations");
const folders = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

const migration = folders
  .map(
    (name) =>
      `-- ===== ${name} =====\n\n` +
      readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8")
  )
  .join("\n\n");

console.log(`Including ${folders.length} migration(s): ${folders.join(", ")}`);

// Same 22 neighborhoods as prisma/seed.ts. Ids are fixed strings rather than
// generated cuids so re-running this file can't create duplicates.
const NEIGHBORHOODS = [
  ["midtown-atl", "Midtown", "Atlanta", "Fulton", 33.7838, -84.3831],
  ["old-fourth-ward", "Old Fourth Ward", "Atlanta", "Fulton", 33.7644, -84.3722],
  ["grant-park", "Grant Park", "Atlanta", "Fulton", 33.7365, -84.3703],
  ["east-atlanta-village", "East Atlanta Village", "Atlanta", "DeKalb", 33.7407, -84.3438],
  ["kirkwood", "Kirkwood", "Atlanta", "DeKalb", 33.7534, -84.3269],
  ["buckhead", "Buckhead", "Atlanta", "Fulton", 33.8388, -84.3793],
  ["west-end-atl", "West End", "Atlanta", "Fulton", 33.7365, -84.4133],
  ["downtown-decatur", "Downtown Decatur", "Decatur", "DeKalb", 33.7748, -84.2963],
  ["smyrna-market-village", "Market Village", "Smyrna", "Cobb", 33.884, -84.5144],
  ["marietta-square", "Marietta Square", "Marietta", "Cobb", 33.9526, -84.5499],
  ["roswell-historic", "Historic Roswell", "Roswell", "Fulton", 34.0232, -84.3616],
  ["alpharetta-downtown", "Downtown Alpharetta", "Alpharetta", "Fulton", 34.0754, -84.2941],
  ["sandy-springs-city", "City Springs", "Sandy Springs", "Fulton", 33.9245, -84.3785],
  ["duluth-downtown", "Downtown Duluth", "Duluth", "Gwinnett", 34.0029, -84.1446],
  ["lawrenceville-square", "Lawrenceville Square", "Lawrenceville", "Gwinnett", 33.9562, -83.988],
  ["savannah-historic", "Historic District", "Savannah", "Chatham", 32.0764, -81.0912],
  ["savannah-starland", "Starland District", "Savannah", "Chatham", 32.0553, -81.0954],
  ["athens-five-points", "Five Points", "Athens", "Clarke", 33.9382, -83.391],
  ["athens-normaltown", "Normaltown", "Athens", "Clarke", 33.9645, -83.4023],
  ["augusta-summerville", "Summerville", "Augusta", "Richmond", 33.4863, -82.0244],
  ["columbus-uptown", "Uptown", "Columbus", "Muscogee", 32.4633, -84.9911],
  ["macon-intown", "InTown", "Macon", "Bibb", 32.8353, -83.6329],
];

const esc = (s) => s.replace(/'/g, "''");

const values = NEIGHBORHOODS.map(
  ([slug, name, city, county, lat, lng]) =>
    `  ('nh_${slug}', '${slug}', '${esc(name)}', '${esc(city)}', '${esc(county)}', 'GA', ${lat}, ${lng})`
).join(",\n");

const sql = `-- Porchlight production setup
--
-- Paste this whole file into Neon's SQL Editor and press Run.
-- Creates every table, then loads the ${NEIGHBORHOODS.length} Georgia neighborhoods.
--
-- Safe to run twice: the neighborhood insert skips rows that already exist.
-- No demo accounts are created here on purpose - the dev seed's demo logins
-- share a password that lives in this repo, so they must not exist in production.

${migration}

-- ---------------------------------------------------------------
-- Georgia neighborhoods
-- ---------------------------------------------------------------

INSERT INTO "Neighborhood" ("id", "slug", "name", "city", "county", "state", "lat", "lng")
VALUES
${values}
ON CONFLICT ("slug") DO NOTHING;

-- Confirm it worked: this should report 22.
SELECT COUNT(*) AS neighborhoods_loaded FROM "Neighborhood";
`;

const out = path.join(root, "prisma", "setup-production.sql");
writeFileSync(out, sql);
console.log(`Wrote ${out}`);
console.log(`  ${sql.split("\n").length} lines`);
console.log(`  ${NEIGHBORHOODS.length} neighborhoods`);
