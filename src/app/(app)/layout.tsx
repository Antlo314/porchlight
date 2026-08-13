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
        {/* pb-32 clears the Fab (bottom-[4.5rem] + h-14 = 8rem), which would
            otherwise sit on top of the last row of every list. */}
        <main className="px-4 pb-32 pt-4">{children}</main>
        <BottomNav unreadMessages={messages} />
      </div>
    </ToastProvider>
  );
}
