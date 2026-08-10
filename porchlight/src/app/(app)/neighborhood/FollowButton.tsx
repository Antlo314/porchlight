"use client";

import { useOptimistic, useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { setFollowAction } from "./actions";

/**
 * Follow toggle for one nearby neighborhood. The label flips before the round
 * trip so the list never feels like it's waiting on the server; a rejected
 * write rolls the label back and says why.
 */
export function FollowButton({
  neighborhoodId,
  name,
  initialFollowing,
}: {
  neighborhoodId: string;
  name: string;
  initialFollowing: boolean;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [following, setOptimistic] = useOptimistic<boolean, boolean>(
    initialFollowing,
    (_, next) => next
  );

  function onTap() {
    const next = !following;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setFollowAction({
        neighborhoodId,
        follow: next,
      });
      if (!result.ok) {
        toast(result.error, "error");
      } else if (result.following) {
        toast(`Following ${name} — its posts show up for you now.`);
      }
    });
  }

  return (
    <Button
      type="button"
      variant={following ? "secondary" : "primary"}
      size="md"
      onClick={onTap}
      aria-busy={pending}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
      className="w-32 shrink-0"
    >
      {following ? (
        <>
          <span aria-hidden>✓</span> Following
        </>
      ) : (
        "Follow"
      )}
    </Button>
  );
}
