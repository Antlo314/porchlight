"use client";

/** iOS-style segmented picker for 2–4 mutually exclusive options. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex gap-1 rounded-card border border-line bg-porch-50/70 p-1 ${className}`.trim()}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-9 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-card text-ink shadow-lift"
                : "text-ink-soft active:bg-card/50"
            }`}
          >
            {opt.icon && <span className="mr-1">{opt.icon}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontally scrolling filter chips for longer option lists (categories). */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? null : opt.value)}
            className={`min-h-8 shrink-0 rounded-full border px-3 text-sm font-semibold transition-colors ${
              active
                ? "border-porch-600 bg-porch-600 text-white shadow-glow"
                : "border-line bg-card text-ink-soft active:bg-porch-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
