import Link from "next/link";
import { CountDot } from "@/components/ui";

export default function AppHeader({
  neighborhoodName,
  unreadNotifications,
}: {
  neighborhoodName: string;
  unreadNotifications: number;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/feed" className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden>🏮</span>
          <span className="text-porch-700">{neighborhoodName}</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/neighborhood"
            aria-label="Explore neighborhoods"
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl active:bg-line/60"
          >
            🗺️
          </Link>
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-xl active:bg-line/60"
          >
            🔔
            <CountDot count={unreadNotifications} />
          </Link>
        </div>
      </div>
    </header>
  );
}
