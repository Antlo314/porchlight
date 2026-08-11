import { JoinScreen } from "@/components/invite/JoinScreen";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Join your neighborhood",
  description:
    "Porchlight is your Georgia neighborhood, together — news, trades, local pros, and neighbors you can actually reach.",
};

/**
 * Someone typed the bare /join with no code (or a link lost its tail). Same
 * warm dead end as an unknown code rather than a 404.
 */
export default async function JoinIndexPage() {
  const session = await getSession();
  return <JoinScreen invite={null} signedIn={session !== null} />;
}
