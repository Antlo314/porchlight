// Porch Credits — the append-only trade-credit ledger.
// Balance is always derived from the ledger; never store a balance column.
import { db } from "./db";

export const SIGNUP_BONUS = 25;

export async function creditBalance(userId: string): Promise<number> {
  const agg = await db.tradeCreditEntry.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}

export async function grantSignupBonus(userId: string) {
  await db.tradeCreditEntry.create({
    data: { userId, delta: SIGNUP_BONUS, reason: "SIGNUP_BONUS" },
  });
}

// Moves credits when a credit-based barter offer completes.
// Throws if the spender's balance is insufficient.
export async function settleCreditTrade(opts: {
  offerId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}) {
  const { offerId, fromUserId, toUserId, amount } = opts;
  if (amount <= 0) throw new Error("Amount must be positive");

  await db.$transaction(async (tx) => {
    // Lock the spender's row BEFORE reading their balance.
    //
    // Without this, the read-then-write below is a classic double-spend: two
    // simultaneous settlements both read the same balance, both pass the check,
    // and both insert. SQLite happens to hide this by serializing all writes,
    // but production is Postgres (see docs/HANDOFF.md), where READ COMMITTED
    // would let both through. Writing to the User row first takes an exclusive
    // row lock for the rest of the transaction, so concurrent spends by the
    // same member queue instead of racing. Verified by
    // scripts/stress/race-credits.ts.
    await tx.user.update({
      where: { id: fromUserId },
      data: { updatedAt: new Date() },
    });

    const agg = await tx.tradeCreditEntry.aggregate({
      where: { userId: fromUserId },
      _sum: { delta: true },
    });
    if ((agg._sum.delta ?? 0) < amount) {
      throw new Error("Insufficient Porch Credits");
    }
    await tx.tradeCreditEntry.createMany({
      data: [
        { userId: fromUserId, delta: -amount, reason: "TRADE_SPENT", offerId },
        { userId: toUserId, delta: amount, reason: "TRADE_EARNED", offerId },
      ],
    });
  });
}
