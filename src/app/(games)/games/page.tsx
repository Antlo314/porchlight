import { currentUser } from "@/lib/auth";
import { GamesHub } from "@/components/games/GamesHub";
import { loadQuiltHub } from "./actions";

export const metadata = {
  title: "Games",
  description: "Ember's Quilt — match color or shape, light the block, win the week.",
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
    <main className="mx-auto max-w-md px-4 pb-10 pt-4">
      <GamesHub demo={!user} weekKey={hub.weekKey} board={hub.board} />
    </main>
  );
}
