import { Card, CardLink } from "@/components/ui";

/**
 * One square in the profile stat row. Becomes a tappable card when `href` is
 * given, so the whole 44px+ tile is the target rather than a small link.
 */
export function StatTile({
  icon,
  value,
  label,
  href,
}: {
  icon: string;
  value: number | string;
  label: string;
  href?: string;
}) {
  const inner = (
    <div className="text-center">
      <p className="text-lg leading-none" aria-hidden>
        {icon}
      </p>
      <p className="mt-1.5 text-xl font-bold leading-none tabular-nums">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        {label}
      </p>
    </div>
  );

  if (href) {
    return (
      <CardLink href={href} className="py-3.5">
        {inner}
      </CardLink>
    );
  }

  return <Card className="py-3.5">{inner}</Card>;
}
