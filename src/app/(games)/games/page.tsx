import { currentUser } from "@/lib/auth";
import { GamesHub } from "@/components/games/GamesHub";
import { LanternHero } from "@/components/games/LanternHero";
import { gameCreditUsage } from "@/lib/games/economy";

export const metadata = {
  title: "Games",
  description: "Light the Block — hop Atlanta porches and earn Porch Credits.",
  openGraph: {
    title: "Light the Block",
    description: "Hop Atlanta porches. Light the block. Earn Porch Credits.",
    images: [{ url: "/images/games-og.jpg", width: 1200, height: 630 }],
  },
};

export default async function GamesPage() {
  const user = await currentUser().catch(() => null);
  const usage = user
    ? await gameCreditUsage(user.id).catch(() => ({ remainingToday: 0 }))
    : { remainingToday: 0 };

  return (
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <LanternHero />
      <GamesHub
        remainingToday={usage.remainingToday}
        demo={!user}
        neighborhoodName={user?.neighborhood.name}
      />
    </main>
  );
}
