"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Button,
  CharCount,
  Field,
  FormError,
  ImageUploader,
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
  const [error, setError] = useState<string | null>(null);

  const isEvent = type === "EVENT";

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

      <ImageUploader
        images={images}
        onChange={setImages}
        max={MAX_IMAGES}
        hint={`Optional. Up to ${MAX_IMAGES} photos, straight from your camera roll.`}
      />

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
