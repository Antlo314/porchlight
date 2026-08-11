# Porchlight — Grok Asset Prompts

Paste these into Grok (Imagine / Aurora) as-is. Every prompt is locked to the
app's real palette so the output drops straight into the UI without recoloring.

**Palette — quote these hex values verbatim in prompts:**
| Token | Hex | Use |
|---|---|---|
| `porch-600` | `#c2661b` | primary amber (brand) |
| `porch-500` | `#dd7f22` | lighter amber, glows |
| `porch-100` | `#faeacf` | soft amber fill |
| `cream` | `#faf7f2` | background |
| `ink` | `#2b2420` | text, dark shapes |
| `pine-600` | `#2f5540` | Georgia pine accent |

**Motif rules.** The mark is a porch lantern casting warm light. Recurring
imagery: front porches, Georgia longleaf pines, evening golden hour, peaches
sparingly. Never render the word "Nextdoor," any real company's logo, or a
recognizable real person.

---

> **Status (Aug 9, 2026):** #1 ✅ done and installed (`public/icons/`). #2 ✅ done
> — both renders came out 9:16 portrait; the portrait one is live on the landing
> page (`public/images/hero.jpg`). If you want a true 16:9 for desktop later,
> re-run prompt #2 and pick the landscape aspect in Grok's UI. #3 — a 1200×630
> OG card was cropped from the hero as a stand-in (`public/images/og.jpg`);
> generating the real illustrated card below will look sharper in link previews.
> #4 prompts below are now fully assembled — paste each one whole.

## 1. App icon ✅ (done — installed in `public/icons/`)

> A minimalist app icon of a glowing porch lantern, flat vector illustration, centered on a solid warm amber background #c2661b. The lantern is a simple geometric shape in cream #faf7f2 with a soft golden glow radiating outward. Bold, iconic, readable at 48 pixels. Rounded square format, no text, no gradients beyond the glow, generous padding around the mark. Modern app icon design, high contrast.

Export at **512×512** and **192×512**, plus a **180×180** Apple touch icon.
Drop into `public/icons/` replacing `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, `apple-touch-icon.png`.

## 2. Landing hero (16:9 and 9:16)

> A warm Southern front porch at golden hour, viewed from the street. A lit porch lantern glows amber against soft evening blue. Tall Georgia pine trees blur in the background. Cozy, inviting, lived-in — a rocking chair, a potted fern, worn wooden steps. Cinematic photography, shallow depth of field, warm color grade favoring amber #c2661b and cream #faf7f2. No people, no text, no signage. Aspect ratio 16:9.

## 3. Social / OG share card (1200×630)

> A flat vector illustration of a row of five neighboring houses at dusk, each with a small glowing amber porch light, connected by delicate golden lines of light arcing between the porches. Background cream #faf7f2, houses in ink #2b2420 silhouette, lights and connecting lines in amber #c2661b, pine trees in deep green #2f5540. Clean, geometric, lots of negative space in the upper third for a headline. No text.

## 4. Empty-state illustrations (square — four separate generations)

Generate each prompt below as its own image. They share one style recipe so
they read as a set. Grok outputs JPG (no transparency) — that's fine; the solid
cream background matches the app's page background exactly.

**4a — Quiet feed:**
> An empty wooden porch rocking chair with a single lit lantern on the floor beside it, casting a soft glow. Flat vector spot illustration, single color amber #c2661b with cream #faf7f2 highlights, on a solid cream #faf7f2 background, simple confident line work, centered composition with generous whitespace, square format, no text.

**4b — No barter listings:**
> Two open hands reaching toward each other, one holding a small potted plant and the other holding a hand tool, mid-exchange. Flat vector spot illustration, single color amber #c2661b with cream #faf7f2 highlights, on a solid cream #faf7f2 background, simple confident line work, centered composition with generous whitespace, square format, no text.

**4c — No messages:**
> Two paper cups connected by a taut string, tin-can telephone style, angled toward each other across the frame. Flat vector spot illustration, single color amber #c2661b with cream #faf7f2 highlights, on a solid cream #faf7f2 background, simple confident line work, centered composition with generous whitespace, square format, no text.

**4d — No events:**
> A small folding table with three chairs and a string of glowing cafe lights hanging above it. Flat vector spot illustration, single color amber #c2661b with cream #faf7f2 highlights, on a solid cream #faf7f2 background, simple confident line work, centered composition with generous whitespace, square format, no text.

Save them into the Downloads\Porchlight folder as `empty-feed.jpg`,
`empty-barter.jpg`, `empty-messages.jpg`, `empty-events.jpg` and Claude will
wire them into the EmptyState components.

## 5. Business-facing ad creative (1:1 and 9:16)

This is your highest-value creative. It's for the outreach to the 50.

> A bold minimalist graphic split diagonally. Left side deep ink #2b2420, right side warm amber #c2661b. Clean geometric composition with strong negative space in the center for large text to be added later. Flat design, no gradients, no text, no logos. High contrast, poster-like, modern.

Add the copy yourself in Canva rather than letting the model render text —
generated text is usually malformed.

**Overlay copy — use one of these:**

- **"What are you paying to reach your neighbors?"** / *"Listing on Porchlight is free."*
  ← strongest for the outreach. A question can't be false advertising, and it
  gets the recipient to volunteer their own number, which is worth more than
  you asserting it.
- **"Free to be found. $19 to grow."**
- **"$0 to list. Forever."**

**Do not** put a competitor's name or price on any creative — see the rules at
the top of `STRATEGY.md`. Every option above describes only our own pricing,
so none of them can become false if someone else changes theirs.

## 6. Explainer video — 30 seconds (16:9)

Generate as four 7–8 second clips and cut them together.

1. > Slow push-in on a dark suburban street at dusk, houses with unlit porches, cool blue tones, quiet and disconnected. Cinematic, moody, no people, no text.
2. > A single porch lantern flickers on, casting warm amber light across wooden steps. Slow motion, shallow focus, warm glow spreading into the frame. Cinematic close-up.
3. > One by one, porch lights turn on down an entire street, warm amber spreading through the neighborhood at dusk. Aerial slow pull-back. Warm color grade, hopeful, cinematic.
4. > Close-up of two hands exchanging a garden tool over a fence at golden hour, warm amber light, shallow depth of field. Cinematic, intimate, no faces visible.

Closing card (make in Canva, not Grok): lantern mark on cream, tagline
**"Your neighborhood, together."**

## 7. Vertical short — barter hook (9:16, ~15s, for Reels/TikTok)

> Vertical video. Overhead shot on a warm wooden table: a pressure washer, a stack of homemade bread, a bicycle wrench, and a handwritten note arranged in a circle. Hands enter frame and swap items in a rotating motion. Warm amber lighting, cream background, top-down, satisfying and rhythmic. No faces, no text, no brand logos.

## 8. Storm Mode concept art (for the pitch deck — 16:9)

> A neighborhood map illustration at night during a storm, rendered as a glowing amber network. Small house icons connected by warm light lines, a few marked with generator and chainsaw symbols. Dark ink #2b2420 background, amber #c2661b glow, deep pine green #2f5540 accents. Flat vector, technical but warm, no text.

---

## Two honest cautions

**Don't use AI-generated "neighbors" in launch marketing.** Porchlight sells
trust and verified identity. Synthetic smiling faces on a community app is the
one place a fake asset actively undercuts the pitch — and it's the kind of thing
a local reporter would notice. Every prompt above deliberately avoids faces. For
the human shots, take real photos at your launch event; that footage will
convert better anyway.

**Regenerate the app icons before launch.** The current PNGs in
`public/icons/` are programmatically generated placeholders. Prompt #1 replaces
them, and it's the single asset users see most.
