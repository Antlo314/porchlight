import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { DesktopNav } from "@/components/shell/DesktopNav";
import { DesktopRail } from "@/components/shell/DesktopRail";
import { ToastProvider } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { unreadMessageCount, unreadNotificationCount } from "@/lib/notify";
import { isOwner, isStaff } from "@/lib/staff";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [notifications, messages] = await Promise.all([
    unreadNotificationCount(user.id),
    unreadMessageCount(user.id),
  ]);

  return (
    <ToastProvider>
      <div className="mx-auto min-h-dvh max-w-md lg:max-w-6xl">
        <AppHeader
          neighborhoodName={user.neighborhood.name}
          unreadNotifications={notifications}
          staff={isStaff(user)}
        />
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)_17rem] lg:gap-6 lg:px-4">
          <DesktopNav
            unreadMessages={messages}
            staff={isStaff(user)}
            owner={isOwner(user)}
          />
          {/* pb-36 clears the island nav + FAB on phones. Desktop has a side nav. */}
          <main className="px-4 pb-36 pt-4 lg:px-0 lg:pb-12">{children}</main>
          <DesktopRail
            userId={user.id}
            neighborhoodName={user.neighborhood.name}
          />
        </div>
        <div className="lg:hidden">
          <BottomNav unreadMessages={messages} />
        </div>
      </div>
    </ToastProvider>
  );
}
