"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CountDot, Icon, type IconName } from "@/components/ui";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/feed", label: "Home", icon: "home" },
  { href: "/barter", label: "Barter", icon: "barter" },
  { href: "/services", label: "Services", icon: "services" },
  { href: "/messages", label: "Messages", icon: "messages" },
  { href: "/games", label: "Games", icon: "games" },
  { href: "/profile", label: "Me", icon: "me" },
];

export function DesktopNav({
  unreadMessages = 0,
}: {
  unreadMessages?: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-20 hidden self-start lg:block">
      <ul className="space-y-1">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-full px-3 text-[15px] transition-colors ${
                  active
                    ? "bg-porch-600 font-semibold text-white shadow-glow"
                    : "text-ink-soft hover:bg-porch-50 hover:text-ink"
                }`}
              >
                <span className="relative">
                  <Icon name={item.icon} className="h-5 w-5" />
                  {item.href === "/messages" && (
                    <CountDot count={unreadMessages} />
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
