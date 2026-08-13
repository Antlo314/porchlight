"use client";

import { useRef, useState } from "react";
import { Spinner } from "./Skeleton";

/**
 * Photo picker used by every composer. Uploads immediately on selection and
 * hands back public URLs, so the parent form only ever stores strings and a
 * half-finished form never leaves an orphaned upload mid-submit.
 */
export function ImageUploader({
  images,
  onChange,
  max = 6,
  label = "Photos",
  hint = "Up to 6. JPG, PNG, WebP, or GIF, 6 MB each.",
}: {
  images: string[];
  onChange: (images: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = max - images.length;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const picked = Array.from(fileList).slice(0, remaining);
    if (picked.length === 0) {
      setError(`That's the limit — ${max} photos.`);
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      for (const file of picked) body.append("files", file);

      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "That upload didn't go through.");
        return;
      }
      onChange([...images, ...(data.urls as string[])]);
    } catch {
      setError("That upload didn't go through. Check your connection.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-soft">
          {images.length}/{max}
        </span>
      </div>

      {images.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {images.map((url, i) => (
            <li key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- user
                  uploads from arbitrary hosts; next/image needs an allowlist */}
              <img
                src={url}
                alt=""
                className="aspect-square w-full rounded-xl border border-line object-cover"
              />
              <button
                type="button"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(images.filter((u) => u !== url))}
                className="absolute -right-3 -top-3 flex h-11 w-11 items-center justify-center"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm text-white shadow">
                  ✕
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {remaining > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-card border border-dashed border-porch-300 bg-porch-50/50 px-4 font-semibold text-porch-800 transition-transform duration-100 active:scale-[0.99] disabled:opacity-70"
        >
          {busy ? (
            <>
              <Spinner /> Uploading…
            </>
          ) : (
            <>📷 Add {images.length > 0 ? "another photo" : "photos"}</>
          )}
        </button>
      )}

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <p className="text-xs text-ink-soft">{hint}</p>
      )}
    </div>
  );
}

/** Single-image variant for avatars and business logos. */
export function SingleImageUploader({
  value,
  onChange,
  label,
  hint,
  shape = "square",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  hint?: string;
  shape?: "square" | "circle";
}) {
  return (
    <div className="space-y-2">
      <ImageUploader
        images={value ? [value] : []}
        onChange={(next) => onChange(next[next.length - 1] ?? null)}
        max={1}
        label={label}
        hint={hint ?? "One image, up to 6 MB."}
      />
      {value && shape === "circle" && (
        <p className="text-xs text-ink-soft">Shown as a circle on your profile.</p>
      )}
    </div>
  );
}
