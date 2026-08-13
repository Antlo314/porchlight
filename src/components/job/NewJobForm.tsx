"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  ButtonLink,
  CharCount,
  Field,
  FormError,
  ImageUploader,
  Input,
  Select,
  Spinner,
  Textarea,
  useToast,
} from "@/components/ui";
import type { BusinessCategoryValue } from "@/lib/validators";
import { createJobRequestAction } from "@/app/(app)/jobs/actions";
import { JOB_CATEGORY_OPTIONS, jobCategoryMeta } from "./meta";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;
const BUDGET_MAX = 60;

export function NewJobForm({
  neighborhoodName,
  proCounts,
}: {
  neighborhoodName: string;
  /** How many businesses in this neighborhood are listed per category. */
  proCounts: Record<string, number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<BusinessCategoryValue>("HOME_SERVICES");
  const [budgetInfo, setBudgetInfo] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const matchingPros = proCounts[category] ?? 0;
  const categoryLabel = jobCategoryMeta(category).label;
  const canSubmit = title.trim().length >= 5 && description.trim().length >= 10;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createJobRequestAction({
        title,
        description,
        category,
        budgetInfo,
        images,
      });

      if (result.ok) {
        toast("Job posted — local pros were notified");
        router.push(`/jobs/${result.id}`);
        return;
      }

      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field
        label="What do you need done?"
        required
        error={fieldErrors.title}
        hint="Short and specific — a pro decides from this line whether to answer."
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Replace two rotted fence panels"
          autoComplete="off"
        />
        <div className="flex justify-end">
          <CharCount value={title} max={TITLE_MAX} />
        </div>
      </Field>

      <Field
        label="Details"
        required
        error={fieldErrors.description}
        hint="Size, timing, access — anything that helps a pro quote without a site visit."
      >
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={5}
          placeholder="Back fence along the alley, about 12 feet. Two panels are rotted at the base. Gate on the side for access, dog is inside."
        />
        <div className="flex justify-end">
          <CharCount value={description} max={DESCRIPTION_MAX} />
        </div>
      </Field>

      <Field label="Who should see this?" required error={fieldErrors.category}>
        <Select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as BusinessCategoryValue)
          }
        >
          {JOB_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.icon} {option.label}
            </option>
          ))}
        </Select>
        <p className="text-sm text-ink-soft">
          {matchingPros > 0 ? (
            <>
              <span className="font-semibold text-porch-700">
                {matchingPros} {categoryLabel.toLowerCase()}{" "}
                {matchingPros === 1 ? "business" : "businesses"}
              </span>{" "}
              in {neighborhoodName} get a notification the moment you post.
            </>
          ) : (
            <>
              No {categoryLabel.toLowerCase()} businesses are listed in{" "}
              {neighborhoodName} yet — post anyway. Neighbors see it, and your
              job is exactly the reason a pro signs up.
            </>
          )}
        </p>
      </Field>

      <Field
        label="Budget"
        error={fieldErrors.budgetInfo}
        hint="Optional and freeform — “under $200”, “quote me”, “whatever’s fair”."
      >
        <Input
          value={budgetInfo}
          onChange={(e) => setBudgetInfo(e.target.value)}
          maxLength={BUDGET_MAX}
          placeholder="Quote me"
          autoComplete="off"
        />
      </Field>

      <div>
        <ImageUploader
          images={images}
          onChange={setImages}
          label="Photos"
          hint="Optional, but a photo gets you a real number instead of a guess."
        />
        {fieldErrors.images && (
          <p className="mt-1.5 text-sm text-red-600">{fieldErrors.images}</p>
        )}
      </div>

      <FormError>{error}</FormError>

      <div className="space-y-2 pt-1">
        <Button type="submit" size="lg" disabled={pending || !canSubmit}>
          {pending && <Spinner />}
          {pending ? "Posting…" : "Post job"}
        </Button>
        <ButtonLink href="/jobs" variant="secondary" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
