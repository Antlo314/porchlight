import { currentUser } from "@/lib/auth";
import { GamesHub } from "@/components/games/GamesHub";
import { loadQuiltHub } from "./actions";

export const metadata = {
  title: "Games",
  description:
    "Light the Block and Ember's Quilt — light Atlanta porches and earn Porch Credits.",
  openGraph: {
    title: "Porchlight Games",
    description:
      "Light the Block: run the stoops as the porch lantern. Ember's Quilt: fifteen nights of stitching. 1st–3rd win Porch Credits each week.",
    images: [{ url: "/images/games-og.jpg", width: 1200, height: 630 }],
  },
};

export default async function GamesPage() {
  const user = await currentUser().catch(() => null);
  const hub = await loadQuiltHub();

  return (
    <div className="pb-10">
      <GamesHub
        demo={!user}
        weekKey={hub.weekKey}
        board={hub.board}
        cleared={hub.cleared}
      />
    </div>
  );
}
