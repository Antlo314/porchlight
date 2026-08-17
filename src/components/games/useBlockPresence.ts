"use client";

import { useEffect, useRef, useState } from "react";
import type { PresencePublic, PresenceStatus } from "@/lib/games/presence";

const GUEST_KEY = "pl_lantern";

function guestKey(): string {
  if (typeof window === "undefined") return "";
  let k = window.localStorage.getItem(GUEST_KEY);
  if (!k) {
    k = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    window.localStorage.setItem(GUEST_KEY, k);
  }
  return k;
}

export function useBlockPresence(opts: {
  course: string;
  status: PresenceStatus;
  score?: number;
  name?: string;
}) {
  const [people, setPeople] = useState<PresencePublic[]>([]);
  const [neighborhood, setNeighborhood] = useState("Atlanta");
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let stop = false;
    const guest = guestKey();

    const beat = async () => {
      const o = optsRef.current;
      try {
        const res = await fetch("/api/games/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guest,
            course: o.course,
            status: o.status,
            score: o.score ?? 0,
            name: o.name,
          }),
        });
        if (!res.ok || stop) return;
        const data = (await res.json()) as {
          neighborhood?: string;
          people?: PresencePublic[];
        };
        if (data.neighborhood) setNeighborhood(data.neighborhood);
        if (data.people) setPeople(data.people);
      } catch {
        /* keep last snapshot */
      }
    };

    void beat();
    const pulse = setInterval(() => void beat(), 2500);

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/games/presence/stream?guest=${guest}`);
      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as {
            neighborhood?: string;
            people?: PresencePublic[];
          };
          if (data.neighborhood) setNeighborhood(data.neighborhood);
          if (data.people) setPeople(data.people);
        } catch {
          /* ignore a bad frame */
        }
      };
    } catch {
      /* poll is enough */
    }

    return () => {
      stop = true;
      clearInterval(pulse);
      es?.close();
    };
  }, []);

  return { people, neighborhood, others: people.filter((p) => !p.self) };
}
