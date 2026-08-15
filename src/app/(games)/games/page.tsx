import { currentUser } from "@/lib/auth";
import { GamesHub } from "@/components/games/GamesHub";
import { gameCreditUsage } from "@/lib/games/economy";
import { settleLastWeek } from "@/lib/quilt/weekly";

export const metadata = {
  title: "Games",
  description:
    "Light the Block — run Atlanta stoops as the porch lantern and earn Porch Credits.",
  openGraph: {
    title: "Light the Block",
    description:
      "You're the porch lantern. Hop Atlanta stoops, light the dark ones, earn Porch Credits.",
    images: [{ url: "/images/games-og.jpg", width: 1200, height: 630 }],
  },
};

export default async function GamesPage() {
  const user = await currentUser().catch(() => null);

  // Ember's Quilt is off the hub, but any week that closed with unpaid winners
  // still needs settling — dropping this would strand those credits.
  await settleLastWeek().catch(() => undefined);

  const usage = user ? await gameCreditUsage(user.id).catch(() => null) : null;

  return (
    <div className="pb-10">
      <GamesHub demo={!user} remainingToday={usage?.remainingToday ?? 0} />
    </div>
  );
}
