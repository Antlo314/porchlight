"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js so Porchlight installs and opens like an app.
 *
 * Production only: in dev the worker would sit in front of hot reloads and hand
 * back stale chunks, which looks exactly like a broken build. Every failure path
 * (no service worker support, an insecure origin, a user blocking storage) is a
 * silent no-op — an install nicety must never break the page it is on.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Nothing to do — the app works fine without the worker.
      });
    };

    // Wait for load so registration never competes with the first paint.
    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

export default PwaRegister;
