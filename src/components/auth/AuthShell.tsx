import { BrandMark } from "@/components/ui";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <BrandMark href="/" flicker />
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <div className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {subtitle}
        </div>
      )}
      <div className="mt-7 flex-1">{children}</div>
      {footer && (
        <div className="mt-8 text-center text-sm text-ink-soft">{footer}</div>
      )}
    </main>
  );
}
