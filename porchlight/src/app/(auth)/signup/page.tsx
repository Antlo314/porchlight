import { SignupForm } from "@/components/invite/SignupForm";
import { SIGNUP_BONUS } from "@/lib/credits";
import { INVITE_BONUS_JOINER, resolveInvite } from "@/lib/invites";

export const metadata = { title: "Join your neighborhood" };

/**
 * Server shell for signup. An ?invite=CODE is resolved here rather than in the
 * browser so the form can be certain about the neighborhood before it renders
 * — and so the code, not the client, decides where the account lands.
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.invite) ? params.invite[0] : params.invite;
  const invite = await resolveInvite(raw);

  return (
    <SignupForm
      // Display fields only — the inviter's id never leaves the server.
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
      inviteAttempted={Boolean(raw?.trim())}
      // Passed as props: the bonus constants live in server-only modules that
      // import Prisma, which must not be pulled into the client bundle.
      signupBonus={SIGNUP_BONUS}
      inviteBonus={INVITE_BONUS_JOINER}
    />
  );
}
