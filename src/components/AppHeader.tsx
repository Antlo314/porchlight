import Link from "next/link";
import { CountDot, Icon, LanternMark } from "@/components/ui";

export default function AppHeader({
  neighborhoodName,
  unreadNotifications,
}: {
  neighborhoodName: string;
  unreadNotifications: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-cream/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-2.5">
        <Link href="/feed" className="flex min-w-0 items-center gap-2">
          <LanternMark className="h-6 w-6 shrink-0" />
          <span className="truncate font-display text-[1.05rem] font-semibold italic tracking-tight text-porch-800">
            {neighborhoodName}
          </span>
        </Link>
        <div className="flex items-center gap-0.5">
          <Link
            href="/games"
            aria-label="Play Ember's Quilt"
            className="flex h-11 w-11 items-center justify-center rounded-full text-porch-800 active:bg-porch-100"
          >
            <Icon name="games" className="h-5 w-5" />
          </Link>
          <Link
            href="/neighborhood"
            aria-label="Explore neighborhoods"
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-porch-100"
          >
            <Icon name="map" className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink-soft active:bg-porch-100"
          >
            <Icon name="bell" className="h-5 w-5" />
            <CountDot count={unreadNotifications} />
          </Link>
        </div>
      </div>
    </header>
  );
}
