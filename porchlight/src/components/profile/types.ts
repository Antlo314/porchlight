// Shared prop/result shapes for the profile vertical. Kept beside the
// components (not in the route folder) so a client component and its server
// action can both reference them without importing each other's modules.

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Exactly what the edit form collects — raw strings straight from the inputs. */
export type ProfileFormValues = {
  name: string;
  bio: string;
  avatarUrl: string;
};
