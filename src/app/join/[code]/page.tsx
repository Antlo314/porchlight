import type { Metadata } from "next";
import { JoinScreen } from "@/components/invite/JoinScreen";
import { resolveInvite } from "@/lib/invites";
import { getSession } from "@/lib/session";

// Public by design — middleware lets /join/* through without a session. This is
// the first Porchlight screen an invited neighbor ever sees.
type Params = { params: Promise<{ code: string }> };

// The raw param is passed straight to resolveInvite, which normalises and
// regex-checks it; anything that isn't a real code resolves to null and gets
// the friendly dead end below instead of a 404.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const invite = await resolveInvite(code);
  if (!invite) {
    return {
      title: "Join your neighborhood",
      description:
        "Porchlight is your Georgia neighborhood, together — news, trades, local pros, and neighbors you can actually reach.",
    };
  }

  const title = `${invite.inviterName} invited you to ${invite.neighborhoodName}`;
  const description = `Join ${invite.neighborhoodName}, ${invite.city} on Porchlight — neighborhood news, barter, and local pros.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function JoinPage({ params }: Params) {
  const { code } = await params;
  const [invite, session] = await Promise.all([
    resolveInvite(code),
    getSession(),
  ]);

  return (
    <JoinScreen
      // Only the display fields cross to the client — the inviter's id stays
      // on the server.
      invite={
        invite
          ? {
              code: invite.code,
              inviterName: invite.inviterName,
              neighborhoodName: invite.neighborhoodName,
              city: invite.city,
            }
          : null
      }
      signedIn={session !== null}
    />
  );
}
