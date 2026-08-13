import { CardLink } from "@/components/ui";

/** A tappable settings-style row: icon, label, sub-label, optional trailing badge. */
export function ProfileLinkRow({
  href,
  icon,
  label,
  sub,
  trailing,
}: {
  href: string;
  icon: string;
  label: string;
  sub?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <CardLink href={href} padded={false}>
      <div className="flex min-h-16 items-center gap-3 p-3">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-porch-50 text-xl"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{label}</p>
          {sub && <p className="truncate text-sm text-ink-soft">{sub}</p>}
        </div>
        {trailing}
        <span aria-hidden className="shrink-0 text-ink-soft">
          ›
        </span>
      </div>
    </CardLink>
  );
}
