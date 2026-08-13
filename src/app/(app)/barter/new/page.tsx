import { BackLink } from "@/components/barter/BackLink";
import { NewListingForm } from "@/components/barter/NewListingForm";
import { CreditBalanceCard } from "@/components/barter/CreditBalanceCard";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const user = await requireUser();
  const balance = await creditBalance(user.id);

  return (
    <div className="space-y-4">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold">Post a trade</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Neighbors in {user.neighborhood.name} will see this. Trade for
          something else, for Porch Credits, or both.
        </p>
      </div>

      <CreditBalanceCard
        balance={balance}
        caption="Completing a trade adds credits here."
      />

      <NewListingForm />
    </div>
  );
}
