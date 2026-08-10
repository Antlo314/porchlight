"use client";

import { useState } from "react";
import { Button, Sheet } from "@/components/ui";
import { updateBusiness } from "@/app/(app)/business/manage/actions";
import { BusinessForm, type BusinessFormValues } from "./BusinessForm";

/** "Edit details" on the owner dashboard — same form as onboarding, in a sheet. */
export function BusinessProfileEditor({
  initial,
}: {
  initial: BusinessFormValues;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Edit details
      </Button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit business details"
      >
        <BusinessForm
          initial={initial}
          action={updateBusiness}
          submitLabel="Save changes"
          successMessage="Business updated"
          onSuccess={() => setOpen(false)}
        />
      </Sheet>
    </>
  );
}
