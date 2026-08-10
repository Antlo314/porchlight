"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Avatar,
  Button,
  ButtonLink,
  CharCount,
  Field,
  FormError,
  Input,
  Textarea,
  useToast,
} from "@/components/ui";
import type { ProfileActionResult, ProfileFormValues } from "./types";

const NAME_MAX = 60;
const BIO_MAX = 500;

/** Only render a live preview image once the URL is plausibly loadable. */
function previewSrc(raw: string): string | null {
  const trimmed = raw.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

export function EditProfileForm({
  initial,
  neighborhoodLabel,
  action,
}: {
  initial: ProfileFormValues;
  neighborhoodLabel: string;
  action: (values: ProfileFormValues) => Promise<ProfileActionResult>;
}) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const displayName = name.trim() || initial.name || "You";
  const src = previewSrc(avatarUrl);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await action({ name, bio, avatarUrl });
      if (result.ok) {
        toast("Profile updated");
        router.push("/profile");
        router.refresh();
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Live preview — exactly what neighbors will see on your card. */}
      <div className="flex items-center gap-4 rounded-card border border-line bg-card p-4">
        <Avatar name={displayName} src={src} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight">
            {displayName}
          </p>
          <p className="mt-0.5 truncate text-sm text-ink-soft">
            <span aria-hidden>📍</span> {neighborhoodLabel}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">
            {bio.trim() || "Add a line about yourself so neighbors know you."}
          </p>
        </div>
      </div>

      <Field label="Name" required error={fieldErrors.name}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder="Maya Whitfield"
          autoComplete="name"
        />
      </Field>

      <Field
        label="About you"
        hint="A sentence or two. What you're into, what you can help with."
        error={fieldErrors.bio}
      >
        <Textarea
          value={bio}
          maxLength={BIO_MAX}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Grew up off Moreland, keeper of the block's ladder collection. Happy to water plants."
        />
        <div className="flex justify-end">
          <CharCount value={bio} max={BIO_MAX} />
        </div>
      </Field>

      <Field
        label="Photo link"
        hint="Paste a link to a photo of yourself. Leave it blank for your initials."
        error={fieldErrors.avatarUrl}
      >
        <Input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          type="url"
          inputMode="url"
          placeholder="https://example.com/me.jpg"
          autoComplete="photo"
        />
      </Field>

      {avatarUrl.trim() && !src && (
        <p className="text-sm text-ink-soft">
          That doesn&apos;t look like a link yet — it needs to start with
          https://
        </p>
      )}

      <FormError>{error}</FormError>

      <div className="space-y-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
        <ButtonLink href="/profile" variant="secondary" size="lg">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
