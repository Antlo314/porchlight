"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  // Guarded so a double-tap can't fire two logout POSTs and two navigations.
  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size="lg" onClick={logout} disabled={pending}>
      {/* Red lives on the child so it doesn't race the variant's own text color. */}
      <span className="text-red-700">
        {pending ? "Logging out…" : "Log out"}
      </span>
    </Button>
  );
}
