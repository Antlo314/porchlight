import { ButtonLink } from "./Button";

export function EmptyState({
  icon,
  imageSrc,
  title,
  body,
  actionLabel,
  actionHref,
}: {
  /** Emoji fallback, shown when no illustration is supplied. */
  icon: string;
  /** Brand illustration (square). Wins over `icon` when present. */
  imageSrc?: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {imageSrc ? (
        // The illustrations' cream is a touch warmer than the page cream, so
        // feather the edges with a radial mask instead of showing a square.
        <img
          src={imageSrc}
          alt=""
          width={176}
          height={176}
          className="h-44 w-44 [mask-image:radial-gradient(closest-side,black_62%,transparent_98%)]"
        />
      ) : (
        <span className="text-4xl" aria-hidden>
          {icon}
        </span>
      )}
      <h2 className="mt-3 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-soft">{body}</p>
      {actionLabel && actionHref && (
        <ButtonLink href={actionHref} size="md" className="mt-5">
          {actionLabel}
        </ButtonLink>
      )}
    </div>
  );
}
