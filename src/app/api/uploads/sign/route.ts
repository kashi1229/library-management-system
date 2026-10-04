import { AppError, handler, ok, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/constants";
import { consume } from "@/lib/auth/rate-limit";
import { signUpload } from "@/lib/cloudinary";
import { signUploadSchema } from "@/lib/validators/upload";

/**
 * Signing is cheap for us but not free for the account: each signature is a
 * potential upload. Capped per user so the endpoint cannot be used to fill
 * Cloudinary storage.
 */
const SIGN_RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 } as const; // 30 / hour

/**
 * POST /api/uploads/sign — member+ (`covers` requires staff).
 *
 * Returns only what the browser needs to upload directly to Cloudinary:
 * signature, timestamp, API key, cloud name and the prefixed folder. The API
 * secret signs the request on the server and is never sent (invariant 9).
 */
export const POST = handler(
  async (request) => {
    const { user } = await requireSession();
    const { folder } = await parseBody(signUploadSchema, request);

    // `covers` is staff-only: a member must not be able to publish artwork.
    if (folder === "covers" && !isStaffRole(user.role)) {
      throw AppError.forbidden("Only staff can upload book covers.");
    }

    const limit = consume({ key: `upload-sign:${user.id.toString()}:${folder}`, ...SIGN_RATE_LIMIT });
    if (!limit.ok) {
      throw new AppError("RATE_LIMITED", "Too many uploads. Please try again later.");
    }

    const params = await signUpload(folder);

    // `allowedFormats` is already a comma-separated string, exactly as signed.
    return ok(params);
  },
  { name: "POST /api/uploads/sign" },
);
