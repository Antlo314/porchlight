import Link from "next/link";
import { Avatar, BrandMark, ButtonLink, Card } from "@/components/ui";
import { SIGNUP_BONUS } from "@/lib/credits";
import { INVITE_BONUS_JOINER } from "@/lib/invites";

export type JoinInvite = {
  code: string;
  inviterName: string;
  neighborhoodName: string;
  city: string;
};

/**
 * The public invite landing page — the first screen an invited neighbor ever
 * sees, so it carries the hero and does the whole pitch above the fold.
 *
 * `invite` is null when the code was mistyped, expired, or never existed. That
 * case is a warm dead end that still routes to normal signup, never a 404.
 */
export function JoinScreen({
  invite,
  signedIn,
}: {
  invite: JoinInvite | null;
  signedIn: boolean;
}) {
  const startingCredits = SIGNUP_BONUS + INVITE_BONUS_JOINER;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col">
      {/* Hero — the porch at golden hour, fading into the cream page. */}
      <div className="relative h-[44dvh] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static hero,
            full-viewport-width in a fixed box; next/image adds nothing here */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/5 to-cream" />
        <div className="absolute left-6 top-[max(1.25rem,env(safe-area-inset-top))]">
          <BrandMark href="/" flicker onDark className="drop-shadow-md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="animate-slide-up relative -mt-12">
          {invite ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={invite.inviterName} size="lg" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-porch-700">
                    You&apos;re invited
                  </p>
                  <p className="truncate text-[15px] font-semibold">
                    by {invite.inviterName}
                  </p>
                </div>
              </div>

              <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight">
                {invite.inviterName} invited you to {invite.neighborhoodName}
                <span className="text-ink-soft">, {invite.city}</span>
              </h1>
              <p className="mt-3 text-[15px] text-ink-soft">
                Porchlight is where your neighborhood keeps up with each other — what
                happened on the street, who needs a hand, and which local pro
                actually showed up on time.
              </p>

              <Card className="mt-5 border-porch-200 bg-porch-50">
                <p className="text-[15px] font-semibold">
                  You&apos;ll start with 🪙 {startingCredits} Porch Credits
                </p>
                <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                  <li>
                    <span className="font-semibold text-ink">
                      {SIGNUP_BONUS}
                    </span>{" "}
                    welcome credits, same as every new neighbor
                  </li>
                  <li>
                    <span className="font-semibold text-ink">
                      +{INVITE_BONUS_JOINER}
                    </span>{" "}
                    for arriving on {invite.inviterName}&apos;s invite
                  </li>
                </ul>
                <p className="mt-2 text-sm text-ink-soft">
                  Credits are how neighbors trade help here — an hour of
                  anyone&apos;s time is worth the same. They can&apos;t be
                  bought or cashed out.
                </p>
              </Card>

              <ul className="mt-5 space-y-2.5 text-[15px] text-ink-soft">
                <li>🤝 Barter goods, skills, and time with Porch Credits</li>
                <li>🛠️ Local pros listed free — no pay-to-be-seen</li>
                <li>💬 Real chats and DMs, built for your neighborhood</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-porch-700">
                Porchlight
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight">
                That invite link didn&apos;t open a door
              </h1>
              <p className="mt-3 text-[15px] text-ink-soft">
                The code may have been mistyped, or the neighbor who shared it
                isn&apos;t using Porchlight any more. No harm done — you can
                still join and pick your neighborhood on the next screen.
              </p>

              <Card className="mt-5 border-porch-200 bg-porch-50">
                <p className="text-[15px] font-semibold">
                  You&apos;ll still start with 🪙 {SIGNUP_BONUS} Porch Credits
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Every new neighbor gets them. If you have a working invite
                  code, ask your neighbor to send the link again — it adds{" "}
                  {INVITE_BONUS_JOINER} more.
                </p>
              </Card>

              <ul className="mt-5 space-y-2.5 text-[15px] text-ink-soft">
                <li>🤝 Barter goods, skills, and time with Porch Credits</li>
                <li>🛠️ Local pros listed free — no pay-to-be-seen</li>
                <li>💬 Real chats and DMs, built for your neighborhood</li>
              </ul>
            </>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {signedIn ? (
            <>
              <ButtonLink href="/feed" size="lg">
                Open Porchlight
              </ButtonLink>
              <p className="text-center text-sm text-ink-soft">
                You&apos;re already signed in. Invite bonuses only apply to new
                accounts — pass the link on to a neighbor instead.
              </p>
            </>
          ) : (
            <>
              <ButtonLink
                href={invite ? `/signup?invite=${invite.code}` : "/signup"}
                size="lg"
              >
                {invite
                  ? `Join ${invite.neighborhoodName}`
                  : "Join your neighborhood"}
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                I already have an account
              </ButtonLink>
              <p className="pt-1 text-center text-xs text-ink-soft">
                Free for neighbors. Forever.{" "}
                {invite && (
                  <>
                    Invite code{" "}
                    <span className="font-mono font-semibold tracking-wider">
                      {invite.code}
                    </span>
                  </>
                )}
              </p>
            </>
          )}
          {!signedIn && (
            <p className="text-center text-xs text-ink-soft">
              <Link href="/" className="font-semibold text-porch-700">
                What is Porchlight?
              </Link>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
