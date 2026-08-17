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
    safetyLocation?: string;
    safetyWhen?: string;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<PostTypeValue>(defaultType);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [safetyLocation, setSafetyLocation] = useState("");
  const [safetyWhen, setSafetyWhen] = useState("");
  const [safetyGate, setSafetyGate] = useState<"ask" | "person" | "incident">(
    defaultType === "SAFETY" ? "ask" : "incident",
  );
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isEvent = type === "EVENT";
  const isSafety = type === "SAFETY";

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
    if (isSafety && !safetyLocation.trim()) {
      setError("Notices need a place — a block or street, not a person");
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
        safetyLocation: isSafety ? safetyLocation.trim() : undefined,
        safetyWhen: isSafety && safetyWhen ? safetyWhen : undefined,
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
                onClick={() => {
                  setType(option);
                  if (option === "SAFETY") setSafetyGate("ask");
                }}
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

      {isSafety && safetyGate !== "incident" && (
        <div className="animate-slide-up space-y-3 rounded-card border border-pine-200 bg-pine-50 p-4">
          {safetyGate === "ask" ? (
            <>
              <p className="font-display text-[1.15rem] font-semibold leading-snug">
                Is this about an incident, or about a person?
              </p>
              <p className="text-sm leading-relaxed text-ink-soft">
                Notices last fourteen days, then they leave. We keep them
                about what happened — not who someone thinks they saw.
              </p>
              <div className="grid gap-2">
                <Button
                  type="button"
                  onClick={() => setSafetyGate("incident")}
                >
                  An incident
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSafetyGate("person")}
                >
                  A person
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-[1.15rem] font-semibold leading-snug">
                Describe the incident instead.
              </p>
              <p className="text-sm leading-relaxed text-ink-soft">
                Physical descriptions of people rarely help a neighbor and
                often harm one. If something happened, write what, where,
                and when. That is enough.
              </p>
              <Button
                type="button"
                onClick={() => setSafetyGate("incident")}
              >
                Write the incident
              </Button>
            </>
          )}
        </div>
      )}

      {!(isSafety && safetyGate !== "incident") && (
      <>
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

      <Field
        label={isSafety ? "What happened" : "Post"}
        hint={
          isSafety
            ? "Facts only. No speculation, no descriptions of people."
            : undefined
        }
        required
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
          placeholder={
            isSafety
              ? "A transformer blew on the 400 block. Lights are out."
              : POST_TYPE_META[type].hint
          }
          maxLength={MAX_BODY}
          required
        />
        <div className="flex justify-end">
          <CharCount value={body} max={MAX_BODY} />
        </div>
      </Field>

      {isSafety && (
        <div className="animate-slide-up space-y-4 rounded-card border border-pine-200 bg-pine-50/60 p-4">
          <p className="text-sm font-semibold text-pine-700">
            Where and when
          </p>
          <Field label="Where" hint="A block or street. Not a person." required>
            <Input
              value={safetyLocation}
              onChange={(e) =>
                setSafetyLocation(e.target.value.slice(0, MAX_LOCATION))
              }
              placeholder="400 block of Flat Shoals"
              maxLength={MAX_LOCATION}
              required
            />
          </Field>
          <Field label="When" hint="Optional. Approximate is fine.">
            <Input
              type="datetime-local"
              value={safetyWhen}
              onChange={(e) => setSafetyWhen(e.target.value)}
            />
          </Field>
          <p className="text-xs text-ink-soft">
            This notice leaves the feed in 14 days so the block does not
            keep a ledger of dread.
          </p>
        </div>
      )}

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
        ) : isSafety ? (
          "Post the notice"
        ) : (
          "Post to the neighborhood"
        )}
      </Button>
      </>
      )}
    </form>
  );
}
