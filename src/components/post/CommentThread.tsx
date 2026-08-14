"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  Avatar,
  Button,
  CharCount,
  ConfirmSheet,
  EmptyState,
  Input,
  useToast,
} from "@/components/ui";
import { timeAgo } from "@/lib/format";

const MAX_BODY = 2000;
const COMPOSER_INPUT_ID = "comment-composer-input";

export type CommentAuthor = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CommentNode = {
  id: string;
  body: string;
  createdAt: Date;
  author: CommentAuthor;
  replies: {
    id: string;
    body: string;
    createdAt: Date;
    author: CommentAuthor;
  }[];
};

type Pending = { tempId: string; body: string; parentId: string | null };

export function CommentThread({
  postId,
  comments,
  currentUser,
  createComment,
  deleteComment,
}: {
  postId: string;
  comments: CommentNode[];
  currentUser: CommentAuthor;
  createComment: (input: {
    postId: string;
    parentId?: string;
    body: string;
  }) => Promise<{ error?: string } | undefined>;
  deleteComment: (input: {
    commentId: string;
  }) => Promise<{ error?: string } | undefined>;
}) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [thread, addOptimistic] = useOptimistic<CommentNode[], Pending>(
    comments,
    (state, pending) => {
      const draft = {
        id: pending.tempId,
        body: pending.body,
        createdAt: new Date(),
        author: currentUser,
      };
      if (!pending.parentId) return [...state, { ...draft, replies: [] }];
      return state.map((c) =>
        c.id === pending.parentId
          ? { ...c, replies: [...c.replies, draft] }
          : c
      );
    }
  );

  function startReply(id: string, name: string) {
    setReplyTo({ id, name });
    // The design-system Input is a plain function component, so it is focused
    // by id rather than by threading a ref through it.
    document.getElementById(COMPOSER_INPUT_ID)?.focus();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    const parentId = replyTo?.id ?? null;
    setBody("");
    setReplyTo(null);

    startTransition(async () => {
      addOptimistic({
        tempId: `pending-${Date.now()}`,
        body: text,
        parentId,
      });
      const result = await createComment({
        postId,
        parentId: parentId ?? undefined,
        body: text,
      });
      if (result?.error) {
        toast(result.error, "error");
        setBody(text);
      }
    });
  }

  function onDelete(commentId: string) {
    startTransition(async () => {
      const result = await deleteComment({ commentId });
      if (result?.error) toast(result.error, "error");
    });
  }

  const total = thread.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <>
      <div className="pb-28 lg:pb-0">
        {total === 0 ? (
          <EmptyState
            icon="💬"
            title="No replies yet"
            body="Be the first neighbor to answer. That's how the block stays alive."
          />
        ) : (
          <ul className="space-y-4">
            {thread.map((comment) => (
              <li key={comment.id}>
                <CommentRow
                  body={comment.body}
                  createdAt={comment.createdAt}
                  author={comment.author}
                  pending={comment.id.startsWith("pending-")}
                  onReply={() =>
                    startReply(comment.id, comment.author.name)
                  }
                  onDelete={
                    comment.author.id === currentUser.id &&
                    !comment.id.startsWith("pending-")
                      ? () => setConfirmDelete(comment.id)
                      : undefined
                  }
                />
                {comment.replies.length > 0 && (
                  <ul className="mt-3 space-y-3 border-l-2 border-line pl-3">
                    {comment.replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentRow
                          body={reply.body}
                          createdAt={reply.createdAt}
                          author={reply.author}
                          pending={reply.id.startsWith("pending-")}
                          onDelete={
                            reply.author.id === currentUser.id &&
                            !reply.id.startsWith("pending-")
                              ? () => setConfirmDelete(reply.id)
                              : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Composer sits directly above the tab bar, the way a chat input does. */}
      <form
        onSubmit={onSubmit}
        className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md border-t border-line bg-cream/95 px-4 py-2 backdrop-blur lg:static lg:z-0 lg:mx-0 lg:mt-6 lg:max-w-none lg:rounded-card lg:border lg:bg-card lg:px-3 lg:py-3"
      >
        {replyTo && (
          <div className="mb-1.5 flex items-center justify-between rounded-xl bg-porch-50 px-3 py-1.5 text-sm">
            <span className="truncate text-porch-800">
              Replying to <strong>{replyTo.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="-my-1.5 ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-soft active:bg-line/60"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Input
            id={COMPOSER_INPUT_ID}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            placeholder={replyTo ? `Reply to ${replyTo.name}…` : "Write a reply…"}
            aria-label="Reply"
            enterKeyHint="send"
          />
          {body.length > MAX_BODY - 200 && (
            <CharCount value={body} max={MAX_BODY} />
          )}
          <Button
            type="submit"
            size="sm"
            disabled={body.trim().length === 0}
            className="min-h-11 shrink-0 px-4"
          >
            Post
          </Button>
        </div>
      </form>

      <ConfirmSheet
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) onDelete(confirmDelete);
        }}
        title="Delete this comment?"
        body="It will be removed for everyone. This can't be undone."
        confirmLabel="Delete"
        destructive
      />
    </>
  );
}

function CommentRow({
  body,
  createdAt,
  author,
  pending,
  onReply,
  onDelete,
}: {
  body: string;
  createdAt: Date;
  author: CommentAuthor;
  pending: boolean;
  onReply?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`flex gap-2.5 ${pending ? "opacity-60" : ""}`}>
      <Avatar name={author.name} src={author.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-card rounded-tl-sm bg-card px-3 py-2">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">
              {author.name}
            </span>
            <span
              suppressHydrationWarning
              className="shrink-0 text-xs text-ink-soft"
            >
              {pending ? "sending…" : timeAgo(createdAt)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed">
            {body}
          </p>
        </div>
        {/* gap-2, not gap-1: Delete sits next to Reply, so the destructive
            action needs breathing room from the one people mean to tap. */}
        {(onReply || onDelete) && (
          <div className="mt-0.5 flex gap-2">
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                className="min-h-11 px-3 text-xs font-semibold text-ink-soft active:text-porch-700"
              >
                Reply
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="min-h-11 px-3 text-xs font-semibold text-ink-soft active:text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
