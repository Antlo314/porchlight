"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CharCount,
  ConfirmSheet,
  EmptyState,
  Field,
  FormError,
  Input,
  Sheet,
  Textarea,
  useToast,
} from "@/components/ui";
import { PLAN_META, type PlanValue } from "@/lib/validators";
import {
  createServiceListing,
  deleteServiceListing,
  setServiceListingStatus,
  updateServiceListing,
} from "@/app/(app)/business/manage/actions";
import type { ServiceListingRow } from "./types";

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 2000;
const PRICE_MAX = 60;

type Editing =
  | { mode: "create" }
  | { mode: "edit"; listing: ServiceListingRow }
  | null;

/**
 * Owner-side listing management: add, edit, pause/resume, delete.
 * Status toggles apply optimistically so a tap feels instant; the server
 * action is the source of truth and any failure rolls the row back.
 */
export function ServiceListingManager({
  listings,
  plan,
}: {
  listings: ServiceListingRow[];
  plan: PlanValue;
}) {
  const [rows, setRows] = useState(listings);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceListingRow | null>(
    null
  );
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  // Re-sync when a revalidated server render sends a fresh list.
  useEffect(() => setRows(listings), [listings]);

  const limit = PLAN_META[plan].listingLimit;
  const atLimit = limit !== null && rows.length >= limit;

  function openCreate() {
    if (atLimit) {
      setUpgradeMessage(
        `${PLAN_META[plan].label} includes ${limit} service listing${
          limit === 1 ? "" : "s"
        }. Local Pro is $19/mo for unlimited listings — still a fraction of NextDoor's ~$170.`
      );
      return;
    }
    setEditing({ mode: "create" });
  }

  function toggleStatus(listing: ServiceListingRow) {
    const next = listing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const previous = rows;
    setRows((current) =>
      current.map((r) => (r.id === listing.id ? { ...r, status: next } : r))
    );

    startTransition(async () => {
      const result = await setServiceListingStatus({
        listingId: listing.id,
        status: next,
      });
      if (result.ok) {
        toast(next === "PAUSED" ? "Listing paused" : "Listing is live");
      } else {
        setRows(previous);
        toast(result.error, "error");
      }
    });
  }

  function remove(listing: ServiceListingRow) {
    const previous = rows;
    setRows((current) => current.filter((r) => r.id !== listing.id));

    startTransition(async () => {
      const result = await deleteServiceListing(listing.id);
      if (result.ok) toast("Listing deleted");
      else {
        setRows(previous);
        toast(result.error, "error");
      }
    });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No service listings yet"
          body="Listings are what neighbors search. Add the one thing you'd most like to get hired for."
        />
      ) : (
        rows.map((listing) => (
          <Card key={listing.id}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{listing.title}</h3>
              <div className="flex shrink-0 gap-1">
                {listing.priceInfo && (
                  <Badge className="bg-porch-100 text-porch-800">
                    {listing.priceInfo}
                  </Badge>
                )}
                {listing.status === "PAUSED" && (
                  <Badge className="bg-line text-ink-soft">Paused</Badge>
                )}
              </div>
            </div>
            <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">
              {listing.description}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={pending}
                onClick={() => toggleStatus(listing)}
              >
                {listing.status === "ACTIVE" ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setEditing({ mode: "edit", listing })}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmDelete(listing)}
              >
                {/* Colour lives on the child: the ghost variant already sets a
                    text colour on the button itself. */}
                <span className="text-red-600">Delete</span>
              </Button>
            </div>
          </Card>
        ))
      )}

      <Button size="lg" variant="secondary" onClick={openCreate}>
        ＋ Add a service listing
      </Button>

      {limit !== null && (
        <p className="text-center text-xs text-ink-soft">
          {rows.length} of {limit} listing{limit === 1 ? "" : "s"} used on{" "}
          {PLAN_META[plan].label}.{" "}
          <Link href="/business/pricing" className="font-semibold text-porch-700">
            Compare plans
          </Link>
        </p>
      )}

      <ListingSheet
        // Remount per target so the form's initial values are right on the
        // first paint rather than filling in a frame later.
        key={editing?.mode === "edit" ? editing.listing.id : "create"}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          setEditing(null);
          toast(message);
        }}
        onUpgradeRequired={(message) => {
          setEditing(null);
          setUpgradeMessage(message);
        }}
      />

      <ConfirmSheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) remove(confirmDelete);
        }}
        title="Delete this listing?"
        body={
          confirmDelete
            ? `"${confirmDelete.title}" will disappear from your profile. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete listing"
        destructive
      />

      <Sheet
        open={upgradeMessage !== null}
        onClose={() => setUpgradeMessage(null)}
        title="Time to upgrade"
      >
        <p className="text-[15px] text-ink-soft">{upgradeMessage}</p>
        <div className="mt-5 space-y-2">
          <ButtonLink href="/business/pricing" size="lg">
            See plans
          </ButtonLink>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setUpgradeMessage(null)}
          >
            Not now
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ListingSheet({
  editing,
  onClose,
  onSaved,
  onUpgradeRequired,
}: {
  editing: Editing;
  onClose: () => void;
  onSaved: (message: string) => void;
  onUpgradeRequired: (message: string) => void;
}) {
  const listing = editing?.mode === "edit" ? editing.listing : null;
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [priceInfo, setPriceInfo] = useState(listing?.priceInfo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset each time the sheet opens — the "create" instance isn't remounted
  // between opens, so leftover text from an abandoned draft has to be cleared.
  useEffect(() => {
    if (!editing) return;
    setTitle(listing?.title ?? "");
    setDescription(listing?.description ?? "");
    setPriceInfo(listing?.priceInfo ?? "");
    setError(null);
  }, [editing, listing]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = listing
        ? await updateServiceListing({
            listingId: listing.id,
            title,
            description,
            priceInfo,
          })
        : await createServiceListing({ title, description, priceInfo });

      if (result.ok) {
        onSaved(listing ? "Listing updated" : "Listing published");
      } else if (result.upgradeRequired) {
        onUpgradeRequired(result.error);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Sheet
      open={editing !== null}
      onClose={onClose}
      title={listing ? "Edit listing" : "New service listing"}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title" required>
          <Input
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fence repair & gate alignment"
          />
        </Field>

        <Field label="Details" required>
          <Textarea
            value={description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Most repairs done same week. Free estimates."
          />
          <div className="flex justify-end">
            <CharCount value={description} max={DESCRIPTION_MAX} />
          </div>
        </Field>

        <Field label="Price info" hint='Freeform — "from $95", "free estimates"'>
          <Input
            value={priceInfo}
            maxLength={PRICE_MAX}
            onChange={(e) => setPriceInfo(e.target.value)}
            placeholder="from $95"
          />
        </Field>

        <FormError>{error}</FormError>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : listing ? "Save changes" : "Publish listing"}
        </Button>
      </form>
    </Sheet>
  );
}
