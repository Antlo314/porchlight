/**
 * Tinted note box. Deliberately not built on <Card>: Card hard-codes
 * `border-line bg-card`, and passing a competing `border-porch-200 bg-porch-50`
 * through className is a coin flip on which rule wins in the generated
 * stylesheet. Own the whole class list here instead.
 */
export function Callout({
  tone = "porch",
  children,
}: {
  tone?: "porch" | "quiet";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "porch"
      ? "border-porch-200 bg-porch-50"
      : "border-dashed border-line bg-card";

  return <div className={`rounded-card border p-4 ${toneClass}`}>{children}</div>;
}
