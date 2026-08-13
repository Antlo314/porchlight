import { avatarHue, initials } from "@/lib/format";

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const cls = `${SIZES[size]} shrink-0 rounded-full object-cover ring-2 ring-card ${className}`.trim();

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from
    // arbitrary user-supplied hosts; next/image would need each one allowlisted.
    return <img src={src} alt="" className={cls} />;
  }

  const hue = avatarHue(name);
  return (
    <span
      aria-hidden
      className={`${cls} flex items-center justify-center font-bold`}
      style={{
        backgroundColor: `hsl(${hue} 65% 90%)`,
        color: `hsl(${hue} 55% 30%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/** Overlapping avatar row, e.g. event attendees. */
export function AvatarStack({
  people,
  max = 4,
}: {
  people: { id: string; name: string; avatarUrl?: string | null }[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((p) => (
          <Avatar
            key={p.id}
            name={p.name}
            src={p.avatarUrl}
            size="sm"
            className="ring-2 ring-card"
          />
        ))}
      </div>
      {extra > 0 && (
        <span className="ml-2 text-xs text-ink-soft">+{extra}</span>
      )}
    </div>
  );
}
