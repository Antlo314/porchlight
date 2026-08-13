import Link from "next/link";
import { redirect } from "next/navigation";
import NewMessageForm from "@/components/chat/NewMessageForm";
import {
  Avatar,
  CardLink,
  EmptyState,
  SectionHeading,
  VerifiedMark,
} from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { truncate } from "@/lib/format";
import { findDirectConversationId } from "../queries";
import { startConversation } from "./actions";

export const dynamic = "force-dynamic";

function BackLink() {
  return (
    <Link
      href="/messages"
      aria-label="Back to messages"
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft active:bg-line/60"
    >
      ←
    </Link>
  );
}

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[] }>;
}) {
  const { to } = await searchParams;
  const user = await requireUser();
  const recipientId = Array.isArray(to) ? to[0] : to;

  if (recipientId && recipientId !== user.id) {
    const recipient = await db.user.findUnique({
      where: { id: recipientId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        neighborhood: { select: { name: true } },
      },
    });

    if (recipient) {
      // Reuse an existing 1:1 thread instead of stacking up duplicates.
      const existingId = await findDirectConversationId(user.id, recipient.id);
      if (existingId) redirect(`/messages/${existingId}`);

      return (
        <div>
          <div className="-mt-2 mb-1 flex items-center gap-3 border-b border-line pb-3">
            <BackLink />
            <Avatar name={recipient.name} src={recipient.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-bold leading-tight">
                {recipient.name}
              </h1>
              <p className="truncate text-xs text-ink-soft">
                {recipient.neighborhood.name}
              </p>
            </div>
          </div>

          <NewMessageForm
            recipientId={recipient.id}
            recipientName={recipient.name}
            startAction={startConversation}
          />
        </div>
      );
    }
  }

  const neighbors = await db.user.findMany({
    where: { neighborhoodId: user.neighborhoodId, id: { not: user.id } },
    orderBy: { name: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      verifiedAt: true,
    },
  });

  return (
    <div>
      <div className="-mt-2 mb-1 flex items-center gap-2 pb-1">
        <BackLink />
        <h1 className="font-bold">New message</h1>
      </div>

      <SectionHeading title={`Neighbors in ${user.neighborhood.name}`} />

      {neighbors.length === 0 ? (
        <EmptyState
          icon="🏡"
          title="No neighbors yet"
          body="You're the first one here. Invite a neighbor, or follow a nearby area to meet more people."
          actionLabel="Explore neighborhoods"
          actionHref="/neighborhood"
        />
      ) : (
        <ul className="space-y-2">
          {neighbors.map((neighbor) => (
            <li key={neighbor.id}>
              <CardLink
                href={`/messages/new?to=${neighbor.id}`}
                padded={false}
              >
                <div className="flex min-h-16 items-center gap-3 p-3">
                  <Avatar
                    name={neighbor.name}
                    src={neighbor.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {neighbor.name}{" "}
                      {neighbor.verifiedAt && <VerifiedMark />}
                    </p>
                    <p className="truncate text-sm text-ink-soft">
                      {neighbor.bio
                        ? truncate(neighbor.bio, 60)
                        : "Say hello 👋"}
                    </p>
                  </div>
                  <span aria-hidden className="text-ink-soft">
                    ›
                  </span>
                </div>
              </CardLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
