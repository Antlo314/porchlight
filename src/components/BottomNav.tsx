"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountDot } from "@/components/ui";

const TABS = [
  { href: "/feed", label: "Home", icon: "🏠" },
  { href: "/barter", label: "Barter", icon: "🤝" },
  { href: "/services", label: "Services", icon: "🛠️" },
  { href: "/messages", label: "Messages", icon: "💬" },
  { href: "/profile", label: "Me", icon: "👤" },
] as const;

export default function BottomNav({
  unreadMessages = 0,
}: {
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                active ? "font-semibold text-porch-700" : "text-ink-soft"
              }`}
            >
              <span className="relative text-xl leading-none" aria-hidden>
                {tab.icon}
                {tab.href === "/messages" && (
                  <CountDot count={unreadMessages} />
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
