import { CardLink, Stars, VerifiedMark } from "@/components/ui";
import { truncate } from "@/lib/format";
import { BUSINESS_CATEGORY_META } from "@/lib/validators";
import { BusinessLogo } from "./BusinessLogo";
import type { DirectoryBusiness } from "./types";

/** Row in the main services directory. */
export function BusinessCard({ business }: { business: DirectoryBusiness }) {
  const meta = BUSINESS_CATEGORY_META[business.category];

  return (
    <CardLink href={`/services/${business.id}`}>
      <div className="flex gap-3">
        <BusinessLogo
          name={business.name}
          category={business.category}
          logoUrl={business.logoUrl}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold">{business.name}</h3>
            {business.verified && (
              <VerifiedMark label="Verified by Porchlight" />
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-soft">
            <span aria-hidden>{meta.icon}</span> {meta.label}
          </p>
          <div className="mt-1">
            <Stars rating={business.avgRating} count={business.reviewCount} />
          </div>
          <p className="mt-1.5 text-sm leading-snug text-ink-soft">
            {truncate(business.description, 110)}
          </p>
        </div>
      </div>
    </CardLink>
  );
}
