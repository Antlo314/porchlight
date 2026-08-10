import { Badge } from "@/components/ui";
import { listingStatusMeta, offerStatusMeta } from "./meta";

export function ListingStatusBadge({ status }: { status: string }) {
  const meta = listingStatusMeta(status);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function OfferStatusBadge({ status }: { status: string }) {
  const meta = offerStatusMeta(status);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}
