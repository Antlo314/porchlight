// Photo grid for a post. Sources are either our own uploads ("/uploads/…",
// relative) or an external link, so they render through a plain <img> — which
// resolves relative paths natively — rather than next/image, which would need
// every external host allowlisted first.

export function PostImages({
  images,
  expanded = false,
}: {
  /** Already parsed with parseImages() by the caller. */
  images: string[];
  /** Detail view shows every photo; the feed card caps at three. */
  expanded?: boolean;
}) {
  if (images.length === 0) return null;

  const shown = expanded ? images : images.slice(0, 3);
  const hidden = images.length - shown.length;

  if (shown.length === 1) {
    return (
      <div className="mt-3 overflow-hidden rounded-card border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shown[0]}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full bg-line/50 object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`mt-3 grid gap-1 overflow-hidden rounded-card border border-line ${
        shown.length === 2 ? "grid-cols-2" : "grid-cols-3"
      }`}
    >
      {shown.map((src, i) => {
        const isLast = i === shown.length - 1;
        return (
          <div key={`${src}-${i}`} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              className="aspect-square w-full bg-line/50 object-cover"
            />
            {isLast && hidden > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-lg font-bold text-white">
                +{hidden}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
