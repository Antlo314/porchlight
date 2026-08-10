"use client";

import { useEffect } from "react";

/**
 * Bottom sheet — the mobile-native way to present a short form or a menu.
 * For anything longer than about half a screen, use a dedicated route instead.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up relative mx-auto w-full max-w-md rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex justify-center pb-1 pt-3">
          <span className="h-1 w-10 rounded-full bg-line" />
        </div>
        {title && (
          <h2 className="px-5 pb-2 pt-1 text-lg font-bold">{title}</h2>
        )}
        <div className="max-h-[75dvh] overflow-y-auto px-5 pb-6 pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Full-screen confirm dialog for destructive or irreversible actions. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="text-[15px] text-ink-soft">{body}</p>}
      <div className="mt-5 space-y-2">
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`min-h-13 w-full rounded-card font-semibold text-white transition-transform duration-100 active:scale-[0.98] ${
            destructive
              ? "bg-red-600 active:bg-red-700"
              : "bg-porch-600 active:bg-porch-700"
          }`}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onClose}
          className="min-h-13 w-full rounded-card border border-line font-semibold active:bg-porch-50"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
