"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Button,
  CharCount,
  Field,
  FormError,
  Input,
  Spinner,
  Textarea,
} from "@/components/ui";
import { POST_TYPE_META, PostType, type PostTypeValue } from "@/lib/validators";

const MAX_TITLE = 120;
const MAX_BODY = 5000;
const MAX_LOCATION = 200;
const MAX_IMAGES = 6;

export function PostComposer({
  defaultType = "GENERAL",
  createPost,
}: {
  defaultType?: PostTypeValue;
  createPost: (input: {
    type: string;
    title?: string;
    body: string;
    images?: string[];
    startsAt?: string;
    endsAt?: string;
    location?: string;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<PostTypeValue>(defaultType);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isEvent = type === "EVENT";

  function addPhoto() {
    const url = photoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("Photo links must start with http:// or https://");
      return;
    }
    if (images.length >= MAX_IMAGES) return;
    setImages((prev) => [...prev, url]);
    setPhotoUrl("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!body.trim()) {
      setError("Say something first");
      return;
    }
    if (isEvent && (!startsAt || !location.trim())) {
      setError("Events need a date and a location");
      return;
    }

    startTransition(async () => {
      const result = await createPost({
        type,
        title: title.trim() || undefined,
        body: body.trim(),
        images,
        startsAt: isEvent ? startsAt : undefined,
        endsAt: isEvent && endsAt ? endsAt : undefined,
        location: isEvent ? location.trim() : undefined,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">New post</h1>
        <Link
          href="/feed"
          className="flex min-h-11 items-center px-2 text-sm font-semibold text-ink-soft"
        >
          Cancel
        </Link>
      </div>

      <Field label="What kind of post is this?" required>
        <div className="grid grid-cols-2 gap-2">
          {PostType.options.map((option) => {
            const meta = POST_TYPE_META[option];
            const active = option === type;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setType(option)}
                className={`min-h-16 rounded-card border p-3 text-left transition-colors duration-100 active:scale-[0.99] ${
                  active
                    ? "border-porch-600 bg-porch-50"
                    : "border-line bg-card active:bg-porch-50/60"
                }`}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {meta.icon}
                </span>
                <span className="mt-1 block text-sm font-semibold">
                  {meta.label}
                </span>
                <span className="block text-xs leading-tight text-ink-soft">
                  {meta.hint}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Title"
        hint="Optional, but it helps neighbors scan the feed."
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder={
            isEvent ? "O4W porch potluck" : "What's this about?"
          }
          maxLength={MAX_TITLE}
        />
        <div className="flex justify-end">
          <CharCount value={title} max={MAX_TITLE} />
        </div>
      </Field>

      <Field label="Post" required>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder={POST_TYPE_META[type].hint}
          maxLength={MAX_BODY}
          required
        />
        <div className="flex justify-end">
          <CharCount value={body} max={MAX_BODY} />
        </div>
      </Field>

      {isEvent && (
        <div className="animate-slide-up space-y-4 rounded-card border border-line bg-card p-4">
          <p className="text-sm font-semibold text-pine-600">
            📅 Event details
          </p>
          <Field label="Starts" required>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Ends" hint="Optional">
            <Input
              type="datetime-local"
              value={endsAt}
              min={startsAt || undefined}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </Field>
          <Field label="Location" required>
            <Input
              value={location}
              onChange={(e) =>
                setLocation(e.target.value.slice(0, MAX_LOCATION))
              }
              placeholder="Freedom Park community garden"
              maxLength={MAX_LOCATION}
              required
            />
          </Field>
        </div>
      )}

      <Field
        label="Photos"
        hint={`Paste a photo link (up to ${MAX_IMAGES}).`}
      >
        <div className="flex gap-2">
          <Input
            type="url"
            inputMode="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPhoto();
              }
            }}
            placeholder="https://…"
            disabled={images.length >= MAX_IMAGES}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addPhoto}
            disabled={!photoUrl.trim() || images.length >= MAX_IMAGES}
            className="shrink-0"
          >
            Add
          </Button>
        </div>
        {images.length > 0 && (
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {images.map((src, i) => (
              <li key={`${src}-${i}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  className="aspect-square w-full rounded-xl border border-line bg-line/50 object-cover"
                />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() =>
                    setImages((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -right-4 -top-4 flex h-11 w-11 items-center justify-center"
                >
                  {/* 44px hit area, 28px badge — the offset keeps the badge
                      visually pinned to the thumbnail corner. */}
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm text-white"
                  >
                    ✕
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <FormError>{error}</FormError>

      <Button
        type="submit"
        size="lg"
        disabled={pending || body.trim().length === 0}
      >
        {pending ? (
          <>
            <Spinner /> Posting…
          </>
        ) : (
          "Post to the neighborhood"
        )}
      </Button>
    </form>
  );
}
