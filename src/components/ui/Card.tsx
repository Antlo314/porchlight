import Link from "next/link";

const CARD_BASE = "surface";

export function Card({
  className = "",
  padded = true,
  children,
}: {
  className?: string;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${CARD_BASE} ${padded ? "p-4" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

/** Card that navigates on tap, with press feedback. */
export function CardLink({
  href,
  className = "",
  padded = true,
  children,
}: {
  href: string;
  className?: string;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`block ${CARD_BASE} ${padded ? "p-4" : ""} transition-[transform,box-shadow] duration-150 active:scale-[0.99] active:bg-porch-50/40 ${className}`.trim()}
    >
      {children}
    </Link>
  );
}

export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between first:mt-0">
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {title}
      </h2>
      {action}
    </div>
  );
}
