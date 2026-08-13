"use client";

import { useState, useTransition } from "react";
import { ConfirmSheet, Sheet, useToast } from "@/components/ui";
import { ReportSheet } from "@/components/report/ReportSheet";

/** Overflow (⋯) menu on a post: report it, or delete your own. */
export function PostMenu({
  postId,
  canDelete,
  deletePost,
}: {
  postId: string;
  canDelete: boolean;
  deletePost: (input: {
    postId: string;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onDelete() {
    startTransition(async () => {
      const result = await deletePost({ postId });
      if (result?.error) toast(result.error, "error");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label="Post options"
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-soft active:bg-line/60"
      >
        ⋯
      </button>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Post options"
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
            className="min-h-13 w-full rounded-card border border-line px-4 text-left font-semibold active:bg-porch-50"
          >
            🚩 Report this post
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
              className="min-h-13 w-full rounded-card border border-line px-4 text-left font-semibold text-red-600 active:bg-red-50"
            >
              🗑️ Delete post
            </button>
          )}
        </div>
      </Sheet>

      <ReportSheet
        targetType="POST"
        targetId={postId}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={onDelete}
        title="Delete this post?"
        body="Comments and reactions go with it. This can't be undone."
        confirmLabel="Delete post"
        destructive
      />
    </>
  );
}
