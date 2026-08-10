import { ButtonLink } from "./Button";

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionHref,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
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
