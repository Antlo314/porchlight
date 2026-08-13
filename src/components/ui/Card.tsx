import Link from "next/link";

const CARD_BASE = "rounded-card border border-line bg-card";

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
      className={`block ${CARD_BASE} ${padded ? "p-4" : ""} transition-transform duration-100 active:scale-[0.99] active:bg-porch-50/50 ${className}`.trim()}
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">
        {title}
      </h2>
      {action}
    </div>
  );
}
