import Link from "next/link";
import { headers } from "next/headers";
import { Card, EmptyState, SectionHeading } from "@/components/ui";
import { InviteShare } from "@/components/invite/InviteShare";
import { QrCode } from "@/components/invite/QrCode";
import { fitsQr } from "@/components/invite/qr";
import { requireUser } from "@/lib/auth";
import { SIGNUP_BONUS } from "@/lib/credits";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";
import {
  INVITE_BONUS_INVITER,
  INVITE_BONUS_JOINER,
  getOrCreateInviteCode,
  inviteUrl,
} from "@/lib/invites";

export const metadata = { title: "Invite a neighbor" };

/**
 * Absolute origin for the shared link. The configured app URL wins so printed
 * codes stay canonical; otherwise we mirror whatever host the member is on,
 * which keeps the link correct in dev and on preview deploys.
 */
async function currentOrigin(): Promise<string | undefined> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const headerList = await headers();
  const host = headerList.get("host");
  if (!host) return undefined;
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${forwarded || (local ? "http" : "https")}://${host}`;
}

export default async function InvitePage() {
  const user = await requireUser();

  let code: string | null = null;
  try {
    code = await getOrCreateInviteCode(user.id);
  } catch {
    // Astronomically unlikely (five collision retries inside the library), but
    // a share screen should apologise rather than throw a 500.
    code = null;
  }

  if (!code) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon="💌"
          title="Couldn't build your invite link"
          body="Something went wrong minting your code. Try again in a moment — nothing was lost."
          actionLabel="Try again"
          actionHref="/invite"
        />
      </div>
    );
  }

  const url = inviteUrl(code, await currentOrigin());

  // One ledger row per neighbor who signed up with this member's code. The
  // joiner's bonus is a different amount, so filtering on the inviter amount
  // counts invites accepted rather than bonuses received — a member who was
  // themselves invited isn't counted as having invited someone. (If the two
  // bonus constants ever change, older rows keep their original delta, so this
  // count would need a `delta: { in: [...] }` of the historic inviter amounts.)
  const joined = await db.tradeCreditEntry.count({
    where: {
      userId: user.id,
      reason: "INVITE_BONUS",
      delta: INVITE_BONUS_INVITER,
    },
  });

  const shareText = `Come join ${user.neighborhood.name} on Porchlight — neighborhood news, trades, and local pros. You'll start with ${SIGNUP_BONUS + INVITE_BONUS_JOINER} Porch Credits.`;

  return (
    <div className="space-y-4">
      <BackLink />

      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Invite a neighbor
        </h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          Porchlight is only as good as who&apos;s on it. Bring someone from{" "}
          {user.neighborhood.name} and you both earn credits.
        </p>
      </header>

      <Card className="border-porch-200 bg-porch-50">
        <div className="flex items-stretch gap-3 text-center">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              You earn
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-porch-800">
              🪙 {INVITE_BONUS_INVITER}
            </p>
          </div>
          <div className="w-px bg-porch-200" aria-hidden />
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              They earn
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-porch-800">
              🪙 {INVITE_BONUS_JOINER}
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-ink-soft">
          Their {INVITE_BONUS_JOINER} lands on top of the {SIGNUP_BONUS}{" "}
          Porch Credits every new neighbor starts with, so they arrive with{" "}
          {SIGNUP_BONUS + INVITE_BONUS_JOINER}. Both bonuses post the moment
          their account is created — nothing to claim.
        </p>
      </Card>

      <Card>
        <div className="flex flex-col items-center">
          {fitsQr(url) ? (
            <>
              <div className="rounded-card border border-line bg-card p-3">
                <QrCode value={url} className="h-auto w-52 max-w-full" />
              </div>
              <p className="mt-3 text-center text-sm text-ink-soft">
                Point a phone camera at it, or print it for the launch table.
              </p>
            </>
          ) : (
            // Only reachable with an unusually long host name; better an
            // honest "type this in" block than a QR-shaped hole.
            <div className="w-full rounded-card border border-line bg-porch-50 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Type this in
              </p>
              <p className="mt-1 break-all font-mono text-base font-semibold">
                {url}
              </p>
            </div>
          )}

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Invite code
          </p>
          <p className="font-mono text-2xl font-bold tracking-[0.35em] text-ink">
            {code}
          </p>
          <p className="mt-1 text-center text-sm text-ink-soft">
            No camera? Type the link below — the code has no 0, O, 1 or I in it,
            so it&apos;s safe to read aloud.
          </p>
        </div>

        <div className="mt-4">
          <InviteShare url={url} code={code} shareText={shareText} />
        </div>
      </Card>

      <SectionHeading title="Neighbors you've brought in" />

      {joined === 0 ? (
        <EmptyState
          icon="🏡"
          title="No one yet"
          body="Send your link to one neighbor today. The first few are what make a neighborhood feel alive."
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">
                {pluralize(joined, "neighbor")} joined with your code
              </p>
              <p className="text-sm text-ink-soft">
                That&apos;s {joined * INVITE_BONUS_INVITER} Porch Credits earned
                from invites.
              </p>
            </div>
            <Link
              href="/barter/credits"
              className="shrink-0 text-sm font-semibold text-porch-700"
            >
              Ledger →
            </Link>
          </div>
        </Card>
      )}

      <SectionHeading title="Where it works best" />
      <Card>
        <ul className="space-y-2 text-sm text-ink-soft">
          <li>
            <span aria-hidden>💬</span> Drop the link in your street&apos;s
            group chat — that&apos;s where most neighbors already are.
          </li>
          <li>
            <span aria-hidden>🖨️</span> Print the QR for a launch table, a
            mailbox flyer, or the community board.
          </li>
          <li>
            <span aria-hidden>🚪</span> Read the code out to the neighbor you
            already wave at. Eight characters, no lookalike letters.
          </li>
        </ul>
        <p className="mt-3 text-xs text-ink-soft">
          Porchlight never messages your contacts for you. Every invite is one
          you sent yourself.
        </p>
      </Card>
    </div>
  );
}

/** The app shell has no back button, so sub-screens carry their own. */
function BackLink() {
  return (
    <Link
      href="/profile"
      className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-ink-soft active:text-ink"
    >
      <span aria-hidden>←</span> Profile
    </Link>
  );
}
