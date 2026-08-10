import { BackLink } from "@/components/profile/BackLink";
import {
  ProfilePostRow,
  type ProfilePostRowData,
} from "@/components/profile/ProfilePostRow";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { pluralize } from "@/lib/format";

export const metadata = { title: "My posts" };

export default async function MyPostsPage() {
  const user = await requireUser();

  const posts = await db.post.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      images: true,
      pinned: true,
      createdAt: true,
      _count: { select: { comments: true, reactions: true } },
    },
  });

  const rows: ProfilePostRowData[] = posts;

  return (
    <div className="space-y-4">
      <BackLink />

      <div>
        <h1 className="text-xl font-bold">My posts</h1>
        {rows.length > 0 && (
          <p className="mt-1 text-sm text-ink-soft">
            {pluralize(rows.length, "post")} on the block
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="📝"
          title="You haven't posted yet"
          body="Ask for a recommendation, flag something on the street, or give away that spare patio chair."
          actionLabel="Write a post"
          actionHref="/feed/new"
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((post) => (
            <li key={post.id}>
              <ProfilePostRow post={post} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
