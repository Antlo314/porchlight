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
  delay,
  onTap,
}: {
  tile: TileData | null;
  selected: boolean;
  shaking: boolean;
  dropping: boolean;
  popping: boolean;
  delay: number;
  onTap: () => void;
}) {
  const hex = tile ? COLOR_HEX[tile.color] : "#3a322c";
  return (
    <button
      type="button"
      aria-label={tile ? `${tile.color} ${tile.shape}` : "empty"}
      onClick={onTap}
      className={`relative aspect-square overflow-hidden rounded-lg ${
        selected ? "quilt-selected z-10" : ""
      } ${shaking ? "quilt-shake" : ""} ${popping ? "quilt-pop" : ""} ${
        dropping ? "quilt-drop" : ""
      }`}
      style={{
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${hex} 78%, white), ${hex})`,
        boxShadow: selected
          ? undefined
          : `inset 0 -3px 0 rgb(0 0 0 / 0.18), inset 0 2px 0 rgb(255 255 255 / 0.18)`,
        animationDelay: selected || shaking || popping || dropping ? undefined : `${delay}ms`,
      }}
    >
      {tile && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SHAPE_SRC[tile.shape]}
          alt=""
          className={`relative z-[1] h-full w-full object-contain p-[12%] ${
            selected || shaking || popping || dropping ? "" : "quilt-breathe"
          }`}
          style={{ animationDelay: `${delay}ms` }}
          draggable={false}
        />
      )}
    </button>
  );
}
