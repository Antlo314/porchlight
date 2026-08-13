import { BackLink } from "@/components/want/BackLink";
import { WantComposer } from "@/components/want/WantComposer";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Post a want" };

/**
 * The composer owns its own heading: on success it swaps the whole screen for
 * the listings that already match, and a stale "Post a want" title sitting
 * above that payoff would undercut it.
 */
export default async function NewWantPage() {
  const user = await requireUser();

  return (
    <div className="space-y-4">
      <BackLink href="/barter/wants" label="Wanted" />
      <WantComposer neighborhoodName={user.neighborhood.name} />
    </div>
  );
}
