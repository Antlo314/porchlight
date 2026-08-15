import { COLOR_HEX, type Tile as TileData } from "@/lib/quilt/types";

const SHAPE_SRC: Record<string, string> = {
  lantern: "/games/quilt/lantern.png",
  leaf: "/games/quilt/leaf.png",
  peach: "/games/quilt/peach.png",
  key: "/games/quilt/key.png",
  mug: "/games/quilt/mug.png",
  star: "/games/quilt/star.png",
};

export function TileView({
  tile,
  selected,
  shaking,
  dropping,
  popping,
  hinted,
  delay,
  onTap,
}: {
  tile: TileData | null;
  selected: boolean;
  shaking: boolean;
  dropping: boolean;
  popping: boolean;
  hinted?: boolean;
  delay: number;
  onTap: () => void;
}) {
  const hex = tile ? COLOR_HEX[tile.color] : "#3a322c";
  const boards = tile?.boards ?? 0;
  const boarded = boards > 0;
  const still = selected || shaking || popping || dropping;

  return (
    <button
      type="button"
      aria-label={
        tile
          ? boarded
            ? `${tile.color} ${tile.shape}, boarded up${boards > 1 ? `, ${boards} boards` : ""}`
            : `${tile.color} ${tile.shape}`
          : "empty"
      }
      onClick={onTap}
      className={`relative aspect-square overflow-hidden rounded-lg ${
        selected ? "quilt-selected z-10" : ""
      } ${hinted && !selected ? "quilt-hint" : ""} ${shaking ? "quilt-shake" : ""} ${
        popping ? "quilt-pop" : ""
      } ${dropping ? "quilt-drop" : ""}`}
      style={{
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${hex} 78%, white), ${hex})`,
        boxShadow: selected
          ? undefined
          : `inset 0 -3px 0 rgb(0 0 0 / 0.18), inset 0 2px 0 rgb(255 255 255 / 0.18)`,
        animationDelay: still ? undefined : `${delay}ms`,
      }}
    >
      {tile && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SHAPE_SRC[tile.shape]}
          alt=""
          className={`relative z-[1] h-full w-full object-contain p-[12%] ${
            still || boarded ? "" : "quilt-breathe"
          } ${boarded ? "opacity-45 saturate-50" : ""}`}
          style={{ animationDelay: `${delay}ms` }}
          draggable={false}
        />
      )}

      {boarded && (
        <span aria-hidden className="absolute inset-0 z-[2]">
          {/* Two crossed planks over the window, nails and all. */}
          <span className="quilt-plank absolute left-[-14%] right-[-14%] top-[26%] h-[22%] rotate-[-18deg]" />
          <span className="quilt-plank absolute left-[-14%] right-[-14%] top-[54%] h-[22%] rotate-[12deg]" />
          {boards > 1 && (
            <span className="absolute bottom-0 right-0 z-[3] rounded-tl-md bg-ink/80 px-1 text-[10px] font-bold leading-tight text-cream tabular-nums">
              {boards}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
