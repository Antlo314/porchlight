"use client";

import { useState, useTransition } from "react";
import {
  Button,
  ButtonLink,
  CharCount,
  Field,
  FormError,
  Input,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  BARTER_CATEGORY_LABELS,
  BARTER_KIND_META,
  BarterCategory,
  BarterKind,
  type BarterCategoryValue,
  type BarterKindValue,
} from "@/lib/validators";
import {
  createWantAction,
  type WantMatch,
} from "@/app/(app)/barter/wants/actions";
import { MatchedListingCard } from "./MatchedListingCard";

/** Sensible starting category per kind, until the member picks one themselves. */
const DEFAULT_CATEGORY: Record<BarterKindValue, BarterCategoryValue> = {
  GOODS: "TOOLS",
  SERVICE: "SKILLS",
  TIME: "SKILLS",
};

const DESCRIPTION_MAX = 1000;

/**
 * Post a want, and get the payoff immediately.
 *
 * The success state is the feature. A want that returns "3 neighbors already
 * have this" converts far better than one that promises a notification later —
 * so the action does the matching before it returns, and this component shows
 * the result in place instead of redirecting to a list.
 */
export function WantComposer({
  neighborhoodName,
}: {
  neighborhoodName: string;
}) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<BarterKindValue>("GOODS");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BarterCategoryValue>("TOOLS");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [creditOffer, setCreditOffer] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** Set once the want is saved — holds whatever already matches it. */
  const [posted, setPosted] = useState<{
    title: string;
    matches: WantMatch[];
  } | null>(null);

  function pickKind(next: BarterKindValue) {
    setKind(next);
    if (!categoryTouched) setCategory(DEFAULT_CATEGORY[next]);
  }

  function reset() {
    setPosted(null);
    setTitle("");
    setDescription("");
    setCreditOffer("");
    setError(null);
    setFieldErrors({});
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createWantAction({
        kind,
        title,
        description,
        category,
        creditOffer,
      });

      if (result.ok) {
        toast(
          result.matches.length > 0
            ? `Posted — ${result.matches.length} already match`
            : "Want posted"
        );
        setPosted({ title: title.trim(), matches: result.matches });
        // The submit button sits well below the fold on a phone; without this
        // the payoff renders above the current scroll position and the member
        // never sees it.
        window.scrollTo({ top: 0 });
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  if (posted) {
    const { matches } = posted;

    return (
      <div className="animate-slide-up space-y-5">
        <div>
          <span className="text-4xl" aria-hidden>
            {matches.length > 0 ? "🎯" : "📌"}
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-tight">
            {matches.length === 0
              ? "Your want is up"
              : matches.length === 1
                ? "A neighbor already has this"
                : `${matches.length} neighbors already have this`}
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {matches.length === 0
              ? `Nobody in ${neighborhoodName} has one listed right now — but you have done the useful half. The next neighbor who lists something like “${posted.title}” is told you are waiting, and it lands in your notifications.`
              : "Open listings that answer what you asked for. Tap one to see it and make an offer."}
          </p>
        </div>

        {matches.length > 0 && (
          <ul className="space-y-3">
            {matches.map(({ listing, match }) => (
              <li key={listing.id}>
                <MatchedListingCard listing={listing} match={match} />
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 pt-1">
          {matches.length === 0 && (
            <ButtonLink href="/barter" size="lg">
              See what neighbors are offering
            </ButtonLink>
          )}
          <ButtonLink
            href="/barter/wants"
            variant={matches.length === 0 ? "secondary" : "primary"}
            size="lg"
          >
            Go to the wants board
          </ButtonLink>
          <Button variant="ghost" size="lg" onClick={reset}>
            Post another want
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">What do you need?</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Neighbors in {neighborhoodName} see this. Say it once and the app
          watches for it — you do not have to keep checking back.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold">
            What are you looking for?
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BarterKind.options.map((option) => {
              const meta = BARTER_KIND_META[option];
              const active = option === kind;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickKind(option)}
                  className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border p-2 text-center transition-colors active:scale-[0.98] ${
                    active
                      ? "border-porch-600 bg-porch-50 text-ink"
                      : "border-line bg-card text-ink-soft"
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {meta.icon}
                  </span>
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <span className="text-[11px] leading-tight text-ink-soft">
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
          {fieldErrors.kind && (
            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.kind}</p>
          )}
        </div>

        <Field
          label="What is it?"
          required
          error={fieldErrors.title}
          hint="Plain words work best — matching reads this, so “extension ladder” finds more than “thing for the gutters”."
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder={
              kind === "GOODS"
                ? "Extension ladder"
                : kind === "SERVICE"
                  ? "Someone to fix a leaky faucet"
                  : "A few hours of moving help"
            }
            autoComplete="off"
          />
        </Field>

        <Field
          label="Any details?"
          error={fieldErrors.description}
          hint="Optional — when you need it, how long you would borrow it."
        >
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder="Just for a Saturday afternoon — I can pick it up."
          />
          <div className="flex justify-end">
            <CharCount value={description} max={DESCRIPTION_MAX} />
          </div>
        </Field>

        <Field label="Category" required error={fieldErrors.category}>
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as BarterCategoryValue);
              setCategoryTouched(true);
            }}
          >
            {BarterCategory.options.map((option) => (
              <option key={option} value={option}>
                {BARTER_CATEGORY_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Offer Porch Credits?"
          error={fieldErrors.creditOffer}
          hint="Optional — naming a number saves a round of haggling, and a want with credits attached gets answered first."
        >
          <Input
            value={creditOffer}
            onChange={(e) => setCreditOffer(e.target.value)}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="20"
          />
        </Field>

        <FormError>{error}</FormError>

        <div className="space-y-2 pt-1">
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending && <Spinner />}
            {isPending ? "Looking for matches…" : "Post want"}
          </Button>
          <ButtonLink href="/barter/wants" variant="secondary" size="lg">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
