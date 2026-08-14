import Link from "next/link";
import { Spinner } from "./Skeleton";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-porch-600 text-white shadow-glow active:bg-porch-700 disabled:bg-porch-300 disabled:shadow-none",
  secondary:
    "bg-card text-ink border border-line shadow-lift active:bg-porch-50 disabled:text-ink-soft",
  ghost: "bg-transparent text-ink-soft active:bg-line/60",
  danger: "bg-red-600 text-white active:bg-red-700 disabled:bg-red-300",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm rounded-xl",
  md: "min-h-11 px-4 text-[15px] rounded-card",
  lg: "min-h-13 px-5 text-base rounded-card w-full",
};

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-70 select-none";

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  extra = ""
) {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  busy?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  busy = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** Floating action button, pinned above the island tab bar. */
export function Fab({
  href,
  label,
  icon = "＋",
}: {
  href: string;
  label: string;
  icon?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-[max(1rem,calc(50%-13rem))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-porch-600 text-2xl font-light text-white shadow-glow transition-transform duration-150 active:scale-95 active:bg-porch-700 lg:bottom-10 lg:right-[max(1.5rem,calc(50%-36rem+1.5rem))]"
    >
      {icon}
    </Link>
  );
}
