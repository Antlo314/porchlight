"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { ChipRow } from "@/components/ui";
import { POST_TYPE_META, PostType, type PostTypeValue } from "@/lib/validators";

const OPTIONS = PostType.options.map((value) => ({
  value,
  label: `${POST_TYPE_META[value].icon} ${POST_TYPE_META[value].label}`,
}));

/**
 * The filter lives in a search param so the feed itself stays server-rendered;
 * this component only pushes the new URL. The chip highlights instantly via
 * useOptimistic while the server round-trip is in flight.
 */
export function PostTypeFilter({ active }: { active: PostTypeValue | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(active);

  function onChange(next: PostTypeValue | null) {
    startTransition(() => {
      setSelected(next);
      router.push(next ? `/feed?type=${next}` : "/feed", { scroll: false });
    });
  }

  return (
    <div className={pending ? "opacity-70 transition-opacity" : undefined}>
      <ChipRow options={OPTIONS} value={selected} onChange={onChange} />
    </div>
  );
}
