import Link from "next/link";

/** Back affordance for the wants screens — the app shell has no back button. */
export function BackLink({
  href = "/barter",
  label = "Barter",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-ink-soft active:text-ink"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
