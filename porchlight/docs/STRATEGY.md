# Porchlight — Differentiation & Go-to-Market

Companion to `HANDOFF.md` (which covers the build roadmap). This is the "why
would anyone switch" document.

> ## ⚠️ INTERNAL ONLY — do not copy from this file into the product
>
> This document names a competitor because competitive analysis has to. **No
> user-facing copy, ad, landing page, or email may do the same.** The rule, in
> the app and in anything you publish:
>
> 1. **Never name a competitor.** Naming one is legal in the US (comparative
>    advertising and nominative fair use), but it invites a public company's
>    legal team to look at a solo founder, and a meritless cease-and-desist
>    still costs you money and weeks.
> 2. **Never quote a competitor's prices.** This is the actual exposure. A
>    specific dollar figure about someone else's pricing is a falsifiable
>    statement of fact; if it's wrong or out of date, that's a Lanham Act
>    §43(a) false-advertising claim, and it's the one thing here a plaintiff
>    could genuinely win on.
> 3. **The "$170" figure below is UNVERIFIED.** It came secondhand from
>    business owners' complaints. It has not been confirmed against published
>    pricing, and it may describe an ad-spend package rather than a listing
>    fee — some competitors' basic business pages are free. Treat it as a
>    hypothesis about market pain, never as a claim to publish.
> 4. **Describe our own prices instead.** "Free forever, $19/mo for unlimited"
>    lands the same punch, can never become false, and reads more confident.
>
> Not legal advice — have a Georgia business attorney review launch copy.

## The three real openings

The incumbent is vulnerable in three places. Everything here attacks one.

**1. Small businesses are priced out of local reach.**
Solo operators — the handyman, the house cleaner, the lawn guy — get gated
behind fees or ad minimums on the one channel where they'd actually convert.
Our free tier is the wedge, $19/mo is the conversion, and the Ad-Boost Pool is
the retention hook. Sell this by describing what *we* charge, and let the
business do its own math.

**2. Their Safety feed became a paranoia machine.**
This is NextDoor's single biggest reputational wound: unverified "suspicious
person" posts, well-documented racial-profiling problems, neighbors reporting
neighbors. Most people don't articulate it as a product complaint — they just
say the app "makes me feel bad." That's a market opening, not just an ethics
issue.

**3. Nothing there is actually *for* neighbors.**
NextDoor extracts (ads, data, lead fees) and gives back a bulletin board.
Porch Credits mean participating in the community produces something of value
to the participant.

## What we build that doesn't exist elsewhere

### Porch Credits (built)
A hyperlocal time-bank currency. Earned by completing trades and helping
neighbors, spent on goods, skills, and hours of help. **Not purchasable with
cash and not cashable out** — that keeps us clear of money-transmitter
regulation and keeps it a community currency instead of a marketplace. TIME
listings (hours of tutoring, yard help, a ride to the airport) are the piece no
mainstream neighborhood app has shipped.

### Calm Safety (design principle — build in Phase 4)
The differentiator that markets itself: *"the neighborhood app without the
paranoia."* Concretely:
- Safety posts use a structured template — what happened, where, when — not a
  free-text box that invites speculation.
- A prompt before posting: "Is this about an *incident* or about a *person*?"
  Person-descriptions get a friction screen explaining why physical
  descriptions rarely help and often harm.
- Safety posts auto-expire after 14 days so the feed doesn't accrete dread.
- No "suspicious" as a selectable category. Ever.

Ship this loudly — but pitch it as *what Porchlight does*, never as an
accusation about another app. "A safety feed that doesn't make you afraid of
your neighbors" is the story a local reporter writes about, and it carries no
legal freight. Let the reporter draw the comparison; that's their job, not
yours, and it's far more credible coming from them.

### Storm Mode (Georgia-specific, high leverage)
Georgia gets tornado outbreaks, ice storms, and hurricane remnants, and those
are precisely the moments hyperlocal apps prove themselves. One toggle turns a
neighborhood's feed into: a check-in-safe roster, a resource map (who has
power, a generator, a chainsaw, a spare room, a working freezer), and a needs
board. Pin it to the top, suppress everything else.
This is the highest word-of-mouth feature in the product. One bad ice storm in
Cobb County and the whole county installs the app.

### Reverse service marketplace
NextDoor makes *businesses* pay to appear. We invert it: a neighbor posts the
job ("need a fence panel replaced"), and local pros respond free. Pros pay for
*standing presence* (subscription), never for the right to answer a neighbor
who asked. This is the fairness story that converts the businesses NextDoor
priced out.

### Transparent moderation
Neighborhood moderators are visible and accountable, and the moderation log is
public to that neighborhood. NextDoor's opaque, arbitrary moderation is a
frequent complaint. Ours is a feature.

### Teen job board
Parent-approved listings for neighborhood teens — mowing, babysitting, pet
sitting, tech help for older neighbors. Enormously sticky with families, and
it feeds the credit economy. No competitor does this safely.

## Monetization stack

| Line | Price | Notes |
|---|---|---|
| Business Free | $0 | Profile, reviews, 1 listing — the wedge |
| Local Pro | $19/mo | Unlimited listings, reply to requests |
| Featured | $39/mo | Pro + featured placement + Ad-Boost Pool |
| Neighborhood sponsor | ~$99/mo | One sponsor per neighborhood per week, clearly labeled |
| Featured event | ~$15 | Local venues promoting a one-off |

**Never:** selling member data, dark-pattern ads, or charging a resident
anything. Residents are free forever — say it on the landing page.

**The Ad-Boost Pool** is the retention mechanic. 20% of subscription revenue is
ring-fenced and spent buying featured placement for verified businesses rated
4.5+. A business that does good work gets advertising it never paid for. That's
the "we pay for your ads after proof of service" promise, and
`scripts/ad-boost-pool.ts` runs it monthly.

## Launch sequence for Georgia

Do **not** launch statewide. Hyperlocal networks die at low density; win one
neighborhood completely, then the next.

1. **Pick one intown Atlanta neighborhood** with existing community identity —
   Old Fourth Ward, Kirkwood, East Atlanta Village, or Grant Park. Target 150
   households before touching a second.
2. **Seed the supply side first.** Recruit 20–30 local businesses onto the free
   tier by hand. Lead with *our* number — "listing is free, Pro is $19/mo, and
   we buy ads for well-reviewed businesses out of that revenue" — and let them
   compare it to whatever they're paying now. **Ask, don't assert:** "What are
   you paying to reach neighbors today?" gets you the real figure from the one
   person who can actually verify it, and turns a sales pitch into a
   conversation. Never quote a competitor's price back at them as fact.
3. **Seed the barter side with an event.** A physical neighborhood tool-and-
   skill swap, with signup at the door. Barter is the reason to come back, but
   it needs critical mass to feel alive on day one.
4. **Anchor institutions.** In Georgia, churches, civic associations, and
   school PTAs *are* the neighborhood network. One partnership beats a thousand
   dollars of ads.
5. **Expand by adjacency**, one neighborhood at a time, always to a bordering
   one. Then Decatur, Smyrna, Marietta; then Savannah, Athens, Augusta,
   Columbus, Macon.

## Metric that matters

Not signups. **Completed trades per 100 members per month.** It's the only
number that proves the community is real rather than a directory nobody opens.
Watch it per neighborhood, and don't expand out of one until it's healthy.

## Risks worth naming

- **Cold start.** A neighborhood app with 20 people is a ghost town. Hence the
  one-neighborhood-at-a-time rule.
- **Trust and verification.** Residency verification is manual at first
  (postcard or utility bill). Don't automate it before it's a bottleneck; it
  *is* the product's integrity.
- **Moderation cost.** Grows superlinearly. Elected neighborhood moderators plus
  a transparent log is the only model that scales without a big trust-and-safety
  payroll.
- **Liability.** Barter between strangers will eventually produce a dispute. Set
  expectations in the terms, keep Porch Credits non-cashable, and never position
  Porchlight as escrow or as a party to the trade.
- **Name.** "Porchlight" is a working title — trademark-search before any spend
  on branding.
