import { Avatar, VerifiedMark } from "@/components/ui";
import { joinDateLabel } from "./format";

/**
 * The identity block at the top of both the own-profile and public-profile
 * screens. Deliberately takes only public fields — email and addressLine are
 * never passed in, so they can't leak onto a neighbor's page.
 */
export function ProfileHeader({
  name,
  avatarUrl,
  neighborhoodLabel,
  bio,
  joinedAt,
  verified = false,
  badge,
  children,
}: {
  name: string;
  avatarUrl?: string | null;
  neighborhoodLabel: string;
  bio?: string | null;
  joinedAt: Date | string;
  verified?: boolean;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="animate-fade-in">
      <div className="flex items-center gap-4">
        <Avatar name={name} src={avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-1.5 font-display text-2xl font-semibold leading-tight">
            <span className="truncate">{name}</span>
            {verified && <VerifiedMark label="Verified resident" />}
          </h1>
          <p className="mt-1 truncate text-sm text-ink-soft">
            <span aria-hidden>📍</span> {neighborhoodLabel}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            Neighbor since {joinDateLabel(joinedAt)}
          </p>
          {badge && <div className="mt-1.5">{badge}</div>}
        </div>
      </div>

      {bio && (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
          {bio}
        </p>
      )}

      {children}
    </section>
  );
}
