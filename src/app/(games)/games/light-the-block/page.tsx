import { LightTheBlockCanvas } from "@/components/games/LightTheBlockCanvas";

export const metadata = { title: "Light the Block" };

export default async function LightTheBlockPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.level) ? params.level[0] : params.level;
  return <LightTheBlockCanvas levelId={raw ?? "kirkwood"} />;
}
