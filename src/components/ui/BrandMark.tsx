import Link from "next/link";

/** Drawn porch lantern — the wordmark icon. Stays sharp at 16–40px. */
export function LanternMark({
  className = "h-7 w-7",
  flicker = false,
}: {
  className?: string;
  flicker?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={`${className} ${flicker ? "lantern-flicker" : ""}`.trim()}
    >
      <path
        d="M12 4.5h8l1.2 2.2H10.8L12 4.5Z"
        fill="currentColor"
        className="text-porch-800"
      />
      <path
        d="M10 8h12v1.6c0 .5-.2 1-.6 1.3L20 12.4v10.2c0 .8-.7 1.4-1.5 1.4h-5c-.8 0-1.5-.6-1.5-1.4V12.4l-1.4-1.5c-.4-.3-.6-.8-.6-1.3V8Z"
        className="fill-porch-600"
      />
      <path
        d="M12.4 12.8h7.2v9.2h-7.2V12.8Z"
        className="fill-porch-200"
      />
      <path
        d="M16 12.8v9.2M12.4 17.2h7.2"
        stroke="currentColor"
        strokeWidth="0.7"
        className="text-porch-500"
        opacity="0.7"
      />
      <circle cx="16" cy="17.4" r="1.7" className="fill-porch-400" />
      <path
        d="M11 25.2h10c.4 1.2.4 2.3 0 2.8H11c-.4-.5-.4-1.6 0-2.8Z"
        className="fill-porch-800"
      />
    </svg>
  );
}

export function BrandMark({
  href = "/",
  size = "md",
  wordmark = true,
  flicker = false,
  onDark = false,
  className = "",
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  wordmark?: boolean;
  flicker?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  const icon = size === "lg" ? "h-9 w-9" : size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const type =
    size === "lg"
      ? "text-[1.65rem] leading-none"
      : size === "sm"
        ? "text-base leading-none"
        : "text-xl leading-none";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 ${onDark ? "text-cream" : "text-porch-800"} ${className}`.trim()}
      aria-label="Porchlight"
    >
      <LanternMark className={icon} flicker={flicker} />
      {wordmark && (
        <span className={`font-display font-semibold tracking-tight ${type}`}>
          Porchlight
        </span>
      )}
    </Link>
  );
}
