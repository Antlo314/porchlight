import { currentUser } from "@/lib/auth";
import { GamesHub } from "@/components/games/GamesHub";
import { loadQuiltHub } from "./actions";

export const metadata = {
  title: "Games",
  description: "Ember's Quilt — match color or shape, light the porches, win the week.",
  openGraph: {
    title: "Ember's Quilt",
    description: "Match three. Stitch the quilt. 1st–3rd win Porch Credits each week.",
    images: [{ url: "/images/quilt-hub.jpg", width: 1200, height: 630 }],
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
