import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { ToastProvider } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { unreadMessageCount, unreadNotificationCount } from "@/lib/notify";

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
      <div className="mx-auto min-h-dvh max-w-md">
        <AppHeader
          neighborhoodName={user.neighborhood.name}
          unreadNotifications={notifications}
        />
        {/* pb-36 clears the island nav + FAB so the last list row stays tappable. */}
        <main className="px-4 pb-36 pt-4">{children}</main>
        <BottomNav unreadMessages={messages} />
      </div>
    </ToastProvider>
  );
}
