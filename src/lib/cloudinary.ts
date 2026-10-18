import "server-only";

/**
 * Server-only Cloudinary operations: upload signing and asset deletion.
 *
 * Invariant 9: `CLOUDINARY_API_SECRET` never reaches the client. The browser
 * receives only a short-lived signature, a timestamp, the API key, the cloud name
 * and the target folder.
 *
 * The SDK is imported **lazily inside the functions**, and every client-safe
 * helper lives in `cloudinary-shared.ts`. That split is what keeps Node built-ins
 * (`fs`) and the credentials out of the browser bundle: a Client Component may
 * import `cloudinary-shared` freely but importing this file would fail the build
 * rather than silently ship a secret.
 */

import { folderPath, UPLOAD_LIMITS, type CloudinaryFolder, type SignedUploadParams } from "@/lib/cloudinary-shared";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

/** Read credentials from the environment, failing loudly when they are absent. */
function config(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  const missing = [
    !cloudName && "CLOUDINARY_CLOUD_NAME",
    !apiKey && "CLOUDINARY_API_KEY",
    !apiSecret && "CLOUDINARY_API_SECRET",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Cloudinary is not configured. Missing: ${missing.join(", ")}. Copy .env.example to .env.local.`,
    );
  }

  return { cloudName: cloudName as string, apiKey: apiKey as string, apiSecret: apiSecret as string };
}

/**
 * Produce signed upload parameters for a folder.
 *
 * Every value the signature covers is returned so the client can echo them back
 * unchanged — Cloudinary rejects the upload otherwise. `folder` and
 * `allowed_formats` are **signed**, so the client cannot redirect the write or
 * widen the whitelist: verified against the live API, a `.gif` upload is refused
 * with `Image file format gif not allowed` even though the browser check is bypassed.
 *
 * `max_file_size` is deliberately **not** signed. Cloudinary excludes it from the
 * string it signs — verified: an otherwise identical request produces the same
 * `String to sign` with and without it, so a signature built over it can never
 * match and *every* upload fails with `Invalid Signature` (401). It is still
 * returned and sent so the request documents the intended cap.
 *
 * Consequence worth knowing: a signed direct upload honours `folder` and
 * `allowed_formats` but **ignores** `max_file_size` (verified: a 1.9MB PNG
 * uploaded under a 1KB cap returns 200). The size cap is therefore enforced by
 * `validateImageFile` on the client and by account storage limits, not by
 * Cloudinary. Making it tamper-proof means a signed **upload preset**, where
 * Cloudinary pins `folder`, `allowed_formats` and `max_file_size` itself — an
 * account change, tracked as a follow-up in `progress-tracker.md`.
 */
export async function signUpload(folder: CloudinaryFolder): Promise<SignedUploadParams> {
  const { cloudName, apiKey, apiSecret } = config();
  const timestamp = Math.floor(Date.now() / 1000);
  const limits = UPLOAD_LIMITS[folder];
  const maxFileSizeBytes = limits.maxSizeMB * 1024 * 1024;

  const { v2 } = await import("cloudinary");

  const signature = v2.utils.api_sign_request(
    {
      timestamp,
      folder: folderPath(folder),
      allowed_formats: limits.formats.join(","),
    },
    apiSecret,
  );

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    folder: folderPath(folder),
    allowedFormats: limits.formats.join(","),
    maxFileSizeBytes,
  };
}

/**
 * Delete an uploaded asset.
 *
 * Best-effort by design: a stale Cloudinary asset is harmless, so a failure must
 * never fail the database write that replaced the reference. The error is logged
 * and `false` returned.
 */
export async function destroyAsset(publicId: string): Promise<boolean> {
  if (!publicId) return false;

  try {
    const { v2 } = await import("cloudinary");
    const { cloudName, apiKey, apiSecret } = config();

    v2.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

    const result = await v2.uploader.destroy(publicId, { invalidate: true });
    return result.result === "ok" || result.result === "not found";
  } catch (error) {
    console.error("[cloudinary] Failed to destroy asset", { publicId }, error);
    return false;
  }
}

// Re-exported so server modules have a single import site.
export {
  ALLOWED_FORMATS,
  CLOUDINARY_API_BASE,
  CLOUDINARY_PREFIX,
  CLOUDINARY_UPLOAD_BASE,
  UPLOAD_LIMITS,
  cloudinaryImageUrl,
  cloudinaryUrl,
  folderPath,
  isOwnedAsset,
  uploadEndpoint,
  withTransform,
  AVATAR_TRANSFORM,
  COVER_TRANSFORM,
} from "@/lib/cloudinary-shared";

export type {
  CloudinaryFolder,
  CloudinaryImage,
  CloudinaryTransform,
  SignedUploadParams,
} from "@/lib/cloudinary-shared";
