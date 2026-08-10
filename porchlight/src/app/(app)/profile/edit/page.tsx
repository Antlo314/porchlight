import { BackLink } from "@/components/profile/BackLink";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { requireUser } from "@/lib/auth";
import { updateProfile } from "./actions";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-4">
      <BackLink href="/profile" label="Profile" />

      <div>
        <h1 className="text-xl font-bold">Edit profile</h1>
        <p className="mt-1 text-sm text-ink-soft">
          This is what neighbors see. Your email and address stay private.
        </p>
      </div>

      <EditProfileForm
        initial={{
          name: user.name,
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl ?? "",
        }}
        neighborhoodLabel={`${user.neighborhood.name}, ${user.neighborhood.city}`}
        action={updateProfile}
      />
    </div>
  );
}
