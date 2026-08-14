/** Porch Credit mark — a gold coin with a lantern, never the "1" emoji. */
export function CoinIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={`shrink-0 ${className}`.trim()}
    >
      <circle cx="16" cy="16" r="15" className="fill-porch-700" />
      <circle cx="16" cy="16" r="13.2" className="fill-porch-400" />
      <circle cx="16" cy="16" r="11.4" className="fill-porch-500" />
      <circle
        cx="16"
        cy="16"
        r="10.2"
        fill="none"
        className="stroke-porch-200"
        strokeWidth="0.7"
        opacity="0.85"
      />
      <path
        d="M13.1 8.6h5.8l.9 1.6h-7.6l.9-1.6Z"
        className="fill-porch-100"
      />
      <path
        d="M11.8 11h8.4v1c0 .35-.14.68-.4.9l-.9.8v6.4c0 .5-.42.9-.95.9h-3.9c-.53 0-.95-.4-.95-.9v-6.4l-.9-.8c-.26-.22-.4-.55-.4-.9V11Z"
        className="fill-cream"
      />
      <path d="M13.4 14.2h5.2v5.6h-5.2v-5.6Z" className="fill-porch-200" />
      <circle cx="16" cy="17" r="1.15" className="fill-porch-400" />
    </svg>
  );
}
