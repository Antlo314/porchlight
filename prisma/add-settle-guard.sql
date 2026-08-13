-- Porchlight — stop a barter offer being settled twice
--
-- Paste into Neon's SQL Editor and press Run. Safe on a live database and safe
-- to run twice.
--
-- Why: settleCreditTrade holds a row lock so two SIMULTANEOUS settlements
-- can't overdraw an account. But nothing stopped the SAME offer being settled
-- twice in sequence — a double-tapped "mark complete", or a retry after a
-- timeout — which would move the credits a second time and mint an extra pair
-- of ledger rows. This makes that impossible at the database level, so it
-- survives any future change to the application code.
--
-- Rows with no offerId (signup bonuses, invite bonuses, adjustments) are
-- unaffected: Postgres treats NULLs as distinct in a unique index.

-- If this errors with "could not create unique index", an offer has already
-- been settled twice. The SELECT below finds them; sort that out before
-- retrying rather than dropping the guard.
CREATE UNIQUE INDEX IF NOT EXISTS "TradeCreditEntry_offerId_reason_key"
    ON "TradeCreditEntry"("offerId", "reason");

-- Any offer already double-settled. An empty result is what you want.
SELECT "offerId", "reason", COUNT(*) AS times_settled
FROM "TradeCreditEntry"
WHERE "offerId" IS NOT NULL
GROUP BY "offerId", "reason"
HAVING COUNT(*) > 1;
