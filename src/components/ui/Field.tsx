// Form primitives. Font size stays at 16px on inputs — anything smaller makes
// iOS Safari zoom the viewport on focus.
const CONTROL =
  "w-full rounded-card border border-line bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-ink-soft/70 focus:border-porch-500 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-semibold">
          {label}
          {required && <span className="text-porch-600"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`.trim()} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${CONTROL} min-h-28 resize-y ${className}`.trim()}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const remaining = max - value.length;
  return (
    <span
      className={`text-xs tabular-nums ${remaining < 20 ? "text-red-600" : "text-ink-soft"}`}
    >
      {remaining}
    </span>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}
