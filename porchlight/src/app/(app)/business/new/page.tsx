import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessForm } from "@/components/business/BusinessForm";
import { Callout } from "@/components/business/Callout";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBusiness } from "./actions";

export default async function NewBusinessPage() {
  const user = await requireUser();

  // One business per owner for now — send repeat visitors to the dashboard.
  const existing = await db.business.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (existing) redirect("/business/manage");

  return (
    <div className="space-y-4">
      <Link
        href="/services"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft"
      >
        ← All services
      </Link>

      <header>
        <h1 className="text-2xl font-bold">List your business</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Free to list in {user.neighborhood.name}. No $170 gate, no
          pay-to-be-seen.
        </p>
      </header>

      <Callout>
        <p className="text-sm text-porch-800">
          <span className="font-semibold">What you get on Free:</span> a profile
          page, verified neighbor reviews, and one service listing. Upgrade only
          when it&apos;s actually earning you work.
        </p>
      </Callout>

      <BusinessForm
        action={createBusiness}
        submitLabel="Create business"
        successMessage="Your business is live"
        successHref="/business/manage"
      />
    </div>
  );
}
