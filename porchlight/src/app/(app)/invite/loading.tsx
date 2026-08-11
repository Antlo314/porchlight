import { Skeleton } from "@/components/ui";

export default function InviteLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-24 rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
      {/* The QR + code + share block, which is the tall part of the screen. */}
      <Skeleton className="h-96 w-full rounded-card" />
      <Skeleton className="h-24 w-full rounded-card" />
    </div>
  );
}
