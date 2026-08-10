import { BUSINESS_CATEGORY_META } from "@/lib/validators";
import type { BusinessCategoryValue } from "@/lib/validators";

const SIZES = {
  md: "h-12 w-12 text-xl rounded-xl",
  lg: "h-16 w-16 text-2xl rounded-2xl",
} as const;

/**
 * Business avatar: the uploaded logo when there is one, otherwise the category
 * emoji on a warm tile so every card keeps the same visual rhythm.
 */
export function BusinessLogo({
  name,
  category,
  logoUrl,
  size = "md",
}: {
  name: string;
  category: BusinessCategoryValue;
  logoUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  const cls = `${SIZES[size]} shrink-0 border border-line object-cover`;

  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- logos come from
    // arbitrary owner-supplied hosts; next/image would need each allowlisted.
    return <img src={logoUrl} alt={`${name} logo`} className={cls} />;
  }

  return (
    <span
      aria-hidden
      className={`${cls} flex items-center justify-center bg-porch-50`}
    >
      {BUSINESS_CATEGORY_META[category].icon}
    </span>
  );
}
