"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountDot, Icon, type IconName } from "@/components/ui";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Home", icon: "home" },
  { href: "/barter", label: "Barter", icon: "barter" },
  { href: "/services", label: "Services", icon: "services" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/profile", label: "Me", icon: "me" },
];

export default function BottomNav({
  unreadMessages = 0,
}: {
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto mx-auto grid max-w-md grid-cols-5 rounded-full border border-line/80 bg-card/90 p-1 shadow-island backdrop-blur-xl">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] transition-colors ${
                active
                  ? "bg-porch-600 font-semibold text-white shadow-glow"
                  : "text-ink-soft active:bg-porch-50"
              }`}
            >
              <span className="relative leading-none" aria-hidden>
                <Icon name={tab.icon} className="h-[1.15rem] w-[1.15rem]" />
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
