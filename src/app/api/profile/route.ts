import { AppError, handler, ok, parseBody } from "@/lib/api";
import { requireSession, toPublicUser } from "@/lib/auth/session";
import { User } from "@/models";
import { updateProfileSchema } from "@/lib/validators/profile";
import { AVATAR_TRANSFORM, cloudinaryUrl, destroyAsset, isOwnedAsset } from "@/lib/cloudinary";
import type { CloudinaryImage } from "@/types";

/**
 * PATCH /api/profile — member+.
 *
 * Ownership comes from the session, never from the request body (invariant 3):
 * there is no id parameter, so a user can only ever edit themselves.
 *
 * Read-only fields (email, membership ID, role, status) are not in the schema,
 * and zod strips unknown keys, so a crafted payload cannot change them.
 */
export const PATCH = handler(
  async (request) => {
    const { user } = await requireSession();
    const input = await parseBody(updateProfileSchema, request);

    // `avatar` is a normal field (not `select: false`), so it comes back by default.
    const record = await User.findById(user.id);

    if (!record) {
      throw AppError.unauthenticated("Your account no longer exists.");
    }

    const previous = (record.avatar ?? null) as CloudinaryImage | null;

    // `undefined` means "leave unchanged" (the details form omits it);
    // `null` means "remove"; an object means "replace".
    let nextAvatar: CloudinaryImage | null | undefined;

    if (input.avatar === null) {
      nextAvatar = null;
    } else if (input.avatar) {
      // Only accept an asset that was uploaded into our own avatars folder.
      if (!isOwnedAsset(input.avatar.publicId, "avatars")) {
        throw AppError.validation("That avatar was not uploaded through this library.", {
          avatar: "Upload the image again",
        });
      }

      // The delivery URL is **derived from the publicId on the server**, never
      // taken from the client. A crafted `url` would otherwise be stored and
      // rendered to other users (staff see it in the circulation desk), turning
      // the avatar field into a stored cross-user content/tracking primitive.
      nextAvatar = {
        publicId: input.avatar.publicId,
        url: cloudinaryUrl(input.avatar.publicId, {
          ...AVATAR_TRANSFORM,
          cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        }),
      };
    }

    record.name = input.name;
    record.phone = input.phone ?? null;
    record.department = input.department ?? null;
    if (nextAvatar !== undefined) record.avatar = nextAvatar;

    await record.save();

    // Only clean up Cloudinary once the database write has succeeded, otherwise a
    // failed save would leave the user with no avatar *and* no asset. Replaced or
    // removed assets are destroyed best-effort; a stale asset is harmless.
    if (nextAvatar !== undefined && previous?.publicId && previous.publicId !== nextAvatar?.publicId) {
      void destroyAsset(previous.publicId);
    }

    return ok({ user: toPublicUser(record) });
  },
  { name: "PATCH /api/profile" },
);

/** `GET /api/profile` — the signed-in user's own record, for hydration. */
export const GET = handler(
  async () => {
    const { user } = await requireSession();

    const record = await User.findById(user.id)
      .select("name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt")
      .lean();

    if (!record) throw AppError.unauthenticated("Your account no longer exists.");

    return ok({ user: toPublicUser(record) });
  },
  { name: "GET /api/profile" },
);
