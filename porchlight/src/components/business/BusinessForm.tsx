"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  CharCount,
  Field,
  FormError,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  BUSINESS_CATEGORY_META,
  type BusinessCategoryValue,
} from "@/lib/validators";
import type { ActionResult } from "./types";

const DESCRIPTION_MAX = 2000;

export type BusinessFormValues = {
  name: string;
  category: BusinessCategoryValue;
  description: string;
  phone: string;
  website: string;
};

const CATEGORIES = Object.entries(BUSINESS_CATEGORY_META) as [
  BusinessCategoryValue,
  { label: string; icon: string },
][];

/**
 * Shared create/edit form for a business profile. The caller supplies the
 * server action, so /business/new and /business/manage stay one form.
 */
export function BusinessForm({
  initial,
  submitLabel,
  successMessage,
  successHref,
  onSuccess,
  action,
}: {
  initial?: Partial<BusinessFormValues>;
  submitLabel: string;
  successMessage: string;
  successHref?: string;
  onSuccess?: () => void;
  action: (values: BusinessFormValues) => Promise<ActionResult>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<BusinessCategoryValue>(
    initial?.category ?? "HOME_SERVICES"
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await action({
        name,
        category,
        description,
        phone,
        website,
      });
      if (result.ok) {
        toast(successMessage);
        onSuccess?.();
        if (successHref) router.push(successHref);
        else router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Business name" required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="Peach State Handyman Co."
          autoComplete="organization"
        />
      </Field>

      <Field label="Category" required>
        <Select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as BusinessCategoryValue)
          }
        >
          {CATEGORIES.map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.icon} {meta.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="What do you do?"
        hint="Neighbors read this first. Plain language beats marketing copy."
        required
      >
        <Textarea
          value={description}
          maxLength={DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Licensed & insured handyman serving intown Atlanta. Drywall, fixtures, fences, small electrical."
        />
        <div className="flex justify-end">
          <CharCount value={description} max={DESCRIPTION_MAX} />
        </div>
      </Field>

      <Field label="Phone" hint="Neighbors tap to call you.">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={30}
          inputMode="tel"
          type="tel"
          placeholder="(404) 555-0142"
          autoComplete="tel"
        />
      </Field>

      <Field label="Website" hint="Include https://">
        <Input
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          type="url"
          inputMode="url"
          placeholder="https://example.com"
          autoComplete="url"
        />
      </Field>

      <FormError>{error}</FormError>

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
