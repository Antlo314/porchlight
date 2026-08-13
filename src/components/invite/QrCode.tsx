import { encodeQr } from "./qr";

/**
 * Renders a URL as an inline SVG QR code — no dependency, no network call, so
 * it works under our CSP and on a flyer printed from a laptop with no signal.
 *
 * Returns null when the value is too long to encode (see qr.ts); callers must
 * have a text fallback rather than showing an empty box.
 */
export function QrCode({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const qr = encodeQr(value);
  if (!qr) return null;

  // Four light modules of quiet zone are required for reliable scanning.
  const QUIET = 4;
  const extent = qr.size + QUIET * 2;

  let path = "";
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.modules[y][x]) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${extent} ${extent}`}
      role="img"
      aria-label="QR code linking to your Porchlight invite"
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={extent} height={extent} className="fill-card" />
      <path d={path} className="fill-ink" />
    </svg>
  );
}
