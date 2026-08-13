-- One settlement per offer.
--
-- NULL offerId rows (signup bonuses, invite bonuses, adjustments) are exempt:
-- Postgres treats NULLs as distinct in a unique index, so any number of them
-- coexist. Only rows that actually reference an offer are constrained.
CREATE UNIQUE INDEX "TradeCreditEntry_offerId_reason_key"
    ON "TradeCreditEntry"("offerId", "reason");
