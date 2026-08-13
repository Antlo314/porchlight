-- Porchlight — add / top up neighborhoods
--
-- Paste into Neon's SQL Editor and press Run.
-- Creates NO tables, so this is safe on a live database with real members,
-- and safe to run as many times as you like: slugs that already exist are
-- skipped rather than duplicated or overwritten.

INSERT INTO "Neighborhood" ("id", "slug", "name", "city", "county", "state", "lat", "lng")
VALUES
  ('nh_midtown-atl', 'midtown-atl', 'Midtown', 'Atlanta', 'Fulton', 'GA', 33.7838, -84.3831),
  ('nh_old-fourth-ward', 'old-fourth-ward', 'Old Fourth Ward', 'Atlanta', 'Fulton', 'GA', 33.7644, -84.3722),
  ('nh_grant-park', 'grant-park', 'Grant Park', 'Atlanta', 'Fulton', 'GA', 33.7365, -84.3703),
  ('nh_east-atlanta-village', 'east-atlanta-village', 'East Atlanta Village', 'Atlanta', 'DeKalb', 'GA', 33.7407, -84.3438),
  ('nh_kirkwood', 'kirkwood', 'Kirkwood', 'Atlanta', 'DeKalb', 'GA', 33.7534, -84.3269),
  ('nh_buckhead', 'buckhead', 'Buckhead', 'Atlanta', 'Fulton', 'GA', 33.8388, -84.3793),
  ('nh_west-end-atl', 'west-end-atl', 'West End', 'Atlanta', 'Fulton', 'GA', 33.7365, -84.4133),
  ('nh_downtown-decatur', 'downtown-decatur', 'Downtown Decatur', 'Decatur', 'DeKalb', 'GA', 33.7748, -84.2963),
  ('nh_smyrna-market-village', 'smyrna-market-village', 'Market Village', 'Smyrna', 'Cobb', 'GA', 33.8840, -84.5144),
  ('nh_marietta-square', 'marietta-square', 'Marietta Square', 'Marietta', 'Cobb', 'GA', 33.9526, -84.5499),
  ('nh_roswell-historic', 'roswell-historic', 'Historic Roswell', 'Roswell', 'Fulton', 'GA', 34.0232, -84.3616),
  ('nh_alpharetta-downtown', 'alpharetta-downtown', 'Downtown Alpharetta', 'Alpharetta', 'Fulton', 'GA', 34.0754, -84.2941),
  ('nh_sandy-springs-city', 'sandy-springs-city', 'City Springs', 'Sandy Springs', 'Fulton', 'GA', 33.9245, -84.3785),
  ('nh_duluth-downtown', 'duluth-downtown', 'Downtown Duluth', 'Duluth', 'Gwinnett', 'GA', 34.0029, -84.1446),
  ('nh_lawrenceville-square', 'lawrenceville-square', 'Lawrenceville Square', 'Lawrenceville', 'Gwinnett', 'GA', 33.9562, -83.9880),
  ('nh_savannah-historic', 'savannah-historic', 'Historic District', 'Savannah', 'Chatham', 'GA', 32.0764, -81.0912),
  ('nh_savannah-starland', 'savannah-starland', 'Starland District', 'Savannah', 'Chatham', 'GA', 32.0553, -81.0954),
  ('nh_athens-five-points', 'athens-five-points', 'Five Points', 'Athens', 'Clarke', 'GA', 33.9382, -83.3910),
  ('nh_athens-normaltown', 'athens-normaltown', 'Normaltown', 'Athens', 'Clarke', 'GA', 33.9645, -83.4023),
  ('nh_augusta-summerville', 'augusta-summerville', 'Summerville', 'Augusta', 'Richmond', 'GA', 33.4863, -82.0244),
  ('nh_columbus-uptown', 'columbus-uptown', 'Uptown', 'Columbus', 'Muscogee', 'GA', 32.4633, -84.9911),
  ('nh_macon-intown', 'macon-intown', 'InTown', 'Macon', 'Bibb', 'GA', 32.8353, -83.6329),
  ('nh_lithonia-downtown', 'lithonia-downtown', 'Downtown Lithonia', 'Lithonia', 'DeKalb', 'GA', 33.7126, -84.1052),
  ('nh_lithonia-klondike', 'lithonia-klondike', 'Klondike', 'Lithonia', 'DeKalb', 'GA', 33.6729, -84.0930),
  ('nh_redan', 'redan', 'Redan', 'Lithonia', 'DeKalb', 'GA', 33.7398, -84.1497),
  ('nh_stonecrest', 'stonecrest', 'Stonecrest', 'Stonecrest', 'DeKalb', 'GA', 33.6873, -84.1327),
  ('nh_conyers-olde-town', 'conyers-olde-town', 'Olde Town', 'Conyers', 'Rockdale', 'GA', 33.6676, -84.0177),
  ('nh_conyers-salem', 'conyers-salem', 'Salem', 'Conyers', 'Rockdale', 'GA', 33.6237, -84.0361),
  ('nh_covington-downtown', 'covington-downtown', 'Downtown Covington', 'Covington', 'Newton', 'GA', 33.5968, -83.8602),
  ('nh_stone-mountain-village', 'stone-mountain-village', 'Stone Mountain Village', 'Stone Mountain', 'DeKalb', 'GA', 33.8081, -84.1702),
  ('nh_ellenwood', 'ellenwood', 'Ellenwood', 'Ellenwood', 'DeKalb', 'GA', 33.6379, -84.2657),
  ('nh_snellville-downtown', 'snellville-downtown', 'Downtown Snellville', 'Snellville', 'Gwinnett', 'GA', 33.8573, -84.0199),
  ('nh_lilburn-oldtown', 'lilburn-oldtown', 'Old Town Lilburn', 'Lilburn', 'Gwinnett', 'GA', 33.8901, -84.1430),
  ('nh_loganville', 'loganville', 'Loganville', 'Loganville', 'Walton', 'GA', 33.8387, -83.9008),
  ('nh_stockbridge-downtown', 'stockbridge-downtown', 'Downtown Stockbridge', 'Stockbridge', 'Henry', 'GA', 33.5443, -84.2338),
  ('nh_mcdonough-square', 'mcdonough-square', 'McDonough Square', 'McDonough', 'Henry', 'GA', 33.4473, -84.1469)
ON CONFLICT ("slug") DO NOTHING;

-- Should report 36.
SELECT COUNT(*) AS total_neighborhoods FROM "Neighborhood";

-- The east-metro ones, so you can eyeball that they landed:
SELECT "name", "city", "county"
FROM "Neighborhood"
WHERE "county" IN ('Rockdale', 'Newton', 'Henry', 'Walton')
   OR "city" IN ('Lithonia', 'Stonecrest', 'Stone Mountain', 'Ellenwood', 'Snellville', 'Lilburn')
ORDER BY "city", "name";
