import { AppError, handler, ok, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/constants";
import { Book, User } from "@/models";
import { folderPath, isOwnedAsset } from "@/lib/cloudinary-shared";
import { destroyAsset } from "@/lib/cloudinary";
import { deleteUploadSchema } from "@/lib/validators/upload";
import { logAudit } from "@/lib/services/audit";

/** Prefix for cover assets, derived from the shared constant so it cannot drift. */
const COVERS_PREFIX = `${folderPath("covers")}/`;

/**
 * DELETE /api/uploads — member+ (owner-checked).
 *
 * Two rules, both enforced server-side:
 *   - staff may delete anything inside `athenaeum/covers`, but only after
 *     confirming no book still references it, and every deletion is audited;
 *   - a member may delete **only their own current avatar**, never an arbitrary
 *     asset. Without the ownership check a crafted `publicId` could be used to
 *     destroy any image in the Cloudinary account.
 */
export const DELETE = handler(
  async (request) => {
    const { user } = await requireSession();
    const { publicId } = await parseBody(deleteUploadSchema, request);

    const isStaff = isStaffRole(user.role);

    /* ------------------------------- Cover ------------------------------- */
    if (publicId.startsWith(COVERS_PREFIX)) {
      if (!isStaff) {
        throw AppError.forbidden("Only staff can delete book covers.");
      }
      if (!isOwnedAsset(publicId, "covers")) {
        throw AppError.validation("That asset is not part of this library.");
      }

      // Clear the reference first so no book is left pointing at a deleted file.
      const result = await Book.updateMany(
        { "cover.publicId": publicId },
        { $set: { cover: null } },
      );

      const removed = await destroyAsset(publicId);

      await logAudit({
        actor: { id: user.id, role: user.role },
        action: "book.cover_delete",
        entityType: "CloudinaryAsset",
        entityId: publicId,
        summary: `Deleted cover asset, detached from ${result.modifiedCount} book(s)`,
        meta: { publicId, booksDetached: result.modifiedCount, removed },
      });

      return ok({ deleted: true, removed, booksDetached: result.modifiedCount });
    }

    /* ------------------------------- Avatar ------------------------------ */
    // Everything else must be the caller's own avatar.
    if (!isOwnedAsset(publicId, "avatars")) {
      throw AppError.validation("That asset is not part of this library.");
    }

    const owner = await User.findById(user.id)
      .select("avatar")
      .lean<{ avatar?: { publicId: string } | null }>();

    if (!owner?.avatar || owner.avatar.publicId !== publicId) {
      // 403 rather than 404: the caller is authenticated, they just do not own it.
      throw AppError.forbidden("You can only remove your own avatar.");
    }

    const removed = await destroyAsset(publicId);

    // Clear the reference so the UI does not keep showing a deleted image.
    await User.updateOne({ _id: user.id }, { $set: { avatar: null } });

    await logAudit({
      actor: { id: user.id, role: user.role },
      action: "user.avatar_remove",
      entityType: "User",
      entityId: user.id,
      summary: "Removed their own avatar",
      meta: { publicId, removed },
    });

    return ok({ deleted: true, removed });
  },
  { name: "DELETE /api/uploads" },
);
