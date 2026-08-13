import { QuiltBoot } from "@/components/quilt/QuiltPlay";
import { isNightId } from "@/lib/quilt/nights";

export const metadata = { title: "Ember's Quilt" };

export default async function QuiltPage({
  searchParams,
}: {
  searchParams: Promise<{ night?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.night) ? params.night[0] : params.night;
  const night = raw && isNightId(raw) ? raw : "night-0";
  return <QuiltBoot nightId={night} />;
}
