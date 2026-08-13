const ICONS = {
  home: "M4.5 13.2 16 4.2l11.5 9V26a1.8 1.8 0 0 1-1.8 1.8H6.3A1.8 1.8 0 0 1 4.5 26V13.2Z M12 27.5V18h8v9.5",
  barter:
    "M8 14h7.5l-2.4-2.4M24 18h-7.5l2.4 2.4M9.5 8.5h6.2A3.3 3.3 0 0 1 19 11.8v.6M22.5 23.5h-6.2A3.3 3.3 0 0 1 13 20.2v-.6",
  services:
    "M19.5 6.8 25.2 12.5 13.8 23.9 8 25.9l2-5.8L19.5 6.8Z M17.2 9.2l5.6 5.6",
  messages:
    "M6.5 8.2h19v13.2c0 .9-.7 1.6-1.6 1.6H13.2L6.5 28V8.2Z M11 13.4h10M11 17.4h7",
  me: "M16 16.2a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z M7.4 26.2c1.6-4 4.7-6 8.6-6s7 2 8.6 6",
  bell: "M8.4 13.2a7.6 7.6 0 0 1 15.2 0c0 6.2 1.6 7.8 1.6 7.8H6.8s1.6-1.6 1.6-7.8Z M13.2 23.6a2.8 2.8 0 0 0 5.6 0",
  map: "M6.5 8.2 13 6l6 2.6 6.5-2.4v17.6L19 26.2 13 23.6 6.5 26V8.2Z M13 6.2v17.4M19 8.6v17.6",
  games:
    "M11.2 5.4h9.6l1.4 2.4H9.8l1.4-2.4Z M9.2 9h13.6v1.4c0 .5-.2 1-.6 1.3l-1.2 1.1v9.4c0 .8-.7 1.4-1.5 1.4h-7c-.8 0-1.5-.6-1.5-1.4v-9.4L9.8 11.7c-.4-.3-.6-.8-.6-1.3V9Z M16 13.4v8.2M12.4 17.4h7.2",
  eye: "M4.5 16S9.2 8.8 16 8.8 27.5 16 27.5 16 22.8 23.2 16 23.2 4.5 16 4.5 16Z M16 19.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8Z",
  "eye-off":
    "M6.2 6.2 25.8 25.8M9.2 10.1C6.8 12 5 16 5 16s4.7 7.2 11 7.2c1.6 0 3.1-.3 4.4-.9M22.6 20.4C25 18.4 27 16 27 16s-4.7-7.2-11-7.2c-.7 0-1.4.1-2 .2",
  arrowLeft: "M19.5 7.5 10 16l9.5 8.5M10 16h12",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
