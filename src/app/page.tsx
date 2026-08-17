import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark, ButtonLink, Card } from "@/components/ui";
import { getSession } from "@/lib/session";

const PILLARS = [
  {
    kicker: "Porch Credits",
    title: "Earn, never buy",
    body: "Goods, skills, and hours — paid in credits you earn by helping a neighbor. Not for sale. Not cash.",
  },
  {
    kicker: "Calm notices",
    title: "What happened. Then it leaves.",
    body: "Fourteen days. Facts about an incident, not a person. The feed does not keep a ledger of dread.",
  },
  {
    kicker: "Storm Mode",
    title: "Who is safe. What we have.",
    body: "Ice, wind, no power — check in, list a generator or a spare room, find who needs you.",
  },
  {
    kicker: "Local pros",
    title: "Listed free",
    body: "The neighbor who actually shows up. No pay-to-be-seen. Pro is $19/mo when they want more.",
  },
] as const;

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/feed");

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col lg:max-w-5xl lg:px-6">
      <div className="relative h-[48dvh] w-full overflow-hidden lg:mt-6 lg:h-[30rem] lg:rounded-card">
        {/* eslint-disable-next-line @next/next/no-img-element -- static hero */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 via-ink/20 to-cream lg:bg-gradient-to-r lg:from-ink/55 lg:via-ink/20 lg:to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cream to-transparent lg:hidden" />
        <div className="absolute left-6 top-[max(1.25rem,env(safe-area-inset-top))]">
          <BrandMark href="/" flicker onDark className="drop-shadow-md" />
        </div>
        <p className="absolute bottom-10 left-6 max-w-[16rem] font-display text-[1.05rem] italic leading-snug text-cream drop-shadow-md lg:bottom-8">
          A porch light on. The block, together.
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-between px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:grid lg:grid-cols-2 lg:items-start lg:gap-10 lg:px-0 lg:pb-12">
        <div className="animate-slide-up relative -mt-4 lg:mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-porch-700">
            Georgia neighborhoods
          </p>
          <h1 className="mt-2 font-display text-[2.2rem] font-semibold leading-[1.1] tracking-tight lg:text-5xl">
            Your neighborhood, without the paranoia.
          </h1>
          <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
            News you can use. Trades you can finish. Notices that leave.
            Neighbors you can actually reach.
          </p>

          <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {PILLARS.map((f) => (
              <li key={f.title}>
                <Card className="h-full p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-porch-700">
                    {f.kicker}
                  </p>
                  <p className="mt-1 font-display text-[15px] font-semibold">
                    {f.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-ink-soft">
                    {f.body}
                  </p>
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
