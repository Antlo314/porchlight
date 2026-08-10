import { PostComposer } from "@/components/post/PostComposer";
import { requireUser } from "@/lib/auth";
import { PostType } from "@/lib/validators";
import { createPostAction } from "./actions";

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  await requireUser();
  const params = await searchParams;

  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const parsed = PostType.safeParse(rawType);

  return (
    <PostComposer
      defaultType={parsed.success ? parsed.data : "GENERAL"}
      createPost={createPostAction}
    />
  );
}
