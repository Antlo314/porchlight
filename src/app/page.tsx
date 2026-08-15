import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, ButtonLink, Card } from "@/components/ui";
import { getSession } from "@/lib/session";

const FEATURES = [
  {
    title: "Barter with neighbors",
    body: "Goods, skills, and time — paid in Porch Credits you earn, never buy.",
  },
  {
    title: "Reply and DM",
    body: "Answer a post. Message a neighbor. That's the lifeblood.",
  },
  {
    title: "Light the Block",
    body: "Run the stoops as the porch lantern. Light them up, earn credits.",
  },
  {
    title: "Local pros, listed free",
    body: "Find the neighbor who actually shows up. No pay-to-be-seen.",
  },
] as const;

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/feed");

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col lg:max-w-5xl lg:px-6">
      <div className="relative h-[46dvh] w-full overflow-hidden lg:mt-6 lg:h-[28rem] lg:rounded-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- static hero,
            full-viewport-width in a fixed box; next/image adds nothing here */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/25 via-ink/5 to-cream lg:bg-gradient-to-r lg:from-ink/40 lg:via-ink/10 lg:to-transparent" />
        <div className="absolute left-6 top-[max(1.25rem,env(safe-area-inset-top))]">
          <BrandMark href="/" flicker onDark className="drop-shadow-md" />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:px-0 lg:pb-12">
        <div className="animate-slide-up relative -mt-8 lg:mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-porch-700">
            Georgia neighborhoods
          </p>
          <h1 className="mt-2 font-display text-[2.15rem] font-semibold leading-[1.12] tracking-tight lg:text-5xl">
            Your neighborhood, together.
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            News, trades, local pros, and neighbors you can actually reach.
          </p>

          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <Card className="h-full p-3.5">
                  <p className="font-display text-[15px] font-semibold">
                    {f.title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">{f.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-7 space-y-3 lg:mt-16 lg:rounded-card lg:border lg:border-line lg:bg-card lg:p-6 lg:shadow-lift">
          <ButtonLink href="/signup" size="lg">
            Join your neighborhood
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" size="lg">
            Log in
          </ButtonLink>
          <ButtonLink
            href="/games"
            variant="ghost"
            size="lg"
            className="border border-porch-200 bg-porch-50 text-porch-800"
          >
            Play Light the Block — no account needed
          </ButtonLink>
          <p className="pt-1 text-center text-xs text-ink-soft">
            Free for neighbors. Forever.{" "}
            <Link href="/join" className="font-semibold text-porch-700">
              Have an invite?
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
