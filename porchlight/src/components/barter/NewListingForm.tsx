"use client";

import { useRouter } from "next/navigation";
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
import { createListingAction } from "@/app/(app)/barter/new/actions";
import { CREDITS_PER_HOUR } from "./meta";

/** Sensible starting category per kind, until the user picks one themselves. */
const DEFAULT_CATEGORY: Record<BarterKindValue, BarterCategoryValue> = {
  GOODS: "TOOLS",
  SERVICE: "SKILLS",
  TIME: "SKILLS",
};

export function NewListingForm() {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<BarterKindValue>("GOODS");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BarterCategoryValue>("TOOLS");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [wants, setWants] = useState("");
  const [credits, setCredits] = useState("");
  const [hours, setHours] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isTime = kind === "TIME";
  const parsedHours = Number.parseFloat(hours);
  const hoursCredits =
    isTime && Number.isFinite(parsedHours) && parsedHours > 0
      ? Math.round(parsedHours * CREDITS_PER_HOUR)
      : null;
  const creditValue = isTime
    ? hoursCredits === null
      ? ""
      : String(hoursCredits)
    : credits;

  function pickKind(next: BarterKindValue) {
    setKind(next);
    if (!categoryTouched) setCategory(DEFAULT_CATEGORY[next]);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) return;
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createListingAction({
        kind,
        title,
        description,
        category,
        wants,
        creditValue,
        imageUrl,
      });

      if (result.ok) {
        toast("Listing posted");
        router.push(`/barter/${result.id}`);
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold">What are you offering?</p>
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
        label="Title"
        required
        error={fieldErrors.title}
        hint={
          isTime
            ? "Say what you'll help with — “2 hours of yard work”"
            : "Short and specific — “Pressure washer, 2000 PSI”"
        }
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder={isTime ? "2 hours of math tutoring" : "Cordless drill"}
          autoComplete="off"
        />
      </Field>

      <Field label="Details" required error={fieldErrors.description}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={3000}
          rows={5}
          placeholder="Condition, availability, anything a neighbor should know."
        />
        <div className="flex justify-end">
          <CharCount value={description} max={3000} />
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
        label="What do you want in return?"
        error={fieldErrors.wants}
        hint="Optional — “yard help or garden veggies”"
      >
        <Input
          value={wants}
          onChange={(e) => setWants(e.target.value)}
          maxLength={500}
          placeholder="Trade ideas welcome"
          autoComplete="off"
        />
      </Field>

      {isTime ? (
        <Field
          label="How many hours?"
          error={fieldErrors.creditValue}
          hint={`Neighbors price time at ${CREDITS_PER_HOUR} Porch Credits an hour — everyone's hour is worth the same.`}
        >
          <Input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            type="number"
            inputMode="decimal"
            min={0.5}
            step={0.5}
            placeholder="2"
          />
          {hoursCredits !== null && (
            <p className="text-sm font-semibold text-porch-700">
              <span aria-hidden>🪙</span> {hoursCredits} credits for{" "}
              {parsedHours} {parsedHours === 1 ? "hour" : "hours"}
            </p>
          )}
        </Field>
      ) : (
        <Field
          label="Asking price in Porch Credits"
          error={fieldErrors.creditValue}
          hint="Optional — leave blank if you'd rather just swap."
        >
          <Input
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            placeholder="40"
          />
        </Field>
      )}

      <Field
        label="Photo link"
        error={fieldErrors.images}
        hint="Optional — paste an image URL."
      >
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          type="url"
          inputMode="url"
          placeholder="https://…"
          autoComplete="off"
        />
      </Field>

      <FormError>{error}</FormError>

      <div className="space-y-2 pt-1">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending && <Spinner />}
          {isPending ? "Posting…" : "Post listing"}
        </Button>
        <ButtonLink href="/barter" variant="secondary" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
