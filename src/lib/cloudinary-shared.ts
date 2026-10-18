/**
 * Cloudinary constants and URL helpers — **safe on both sides of the wire**.
 *
 * This module deliberately has no `server-only` import and no SDK dependency, so
 * Client Components (the image uploader, `BookCover`) can use it without pulling
 * server credentials or Node built-ins into the browser bundle. The signing and
 * asset-deletion code that *does* need the secret lives in `cloudinary.ts`.
 */

/** Covers and avatars live under this prefix so they are easy to audit. */
export const CLOUDINARY_PREFIX = "athenaeum";

export const CLOUDINARY_UPLOAD_BASE = "https://res.cloudinary.com";
export const CLOUDINARY_API_BASE = "https://api.cloudinary.com/v1_1";

/** Only these formats may be uploaded — a whitelist, never a blacklist. */
export const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

/** Per-folder limits. `maxFileSizeBytes` travels with the upload but is **not** part
 *  of the signature: Cloudinary excludes it from the string it signs and ignores it
 *  on a signed direct upload, so the cap is a client-side guard plus an account
 *  limit. Only `folder` and `allowed_formats` are tamper-proof. See `signUpload()`. */
export const UPLOAD_LIMITS = {
  avatars: { maxSizeMB: 3, formats: ALLOWED_FORMATS },
  covers: { maxSizeMB: 5, formats: ALLOWED_FORMATS },
} as const;

export type CloudinaryFolder = keyof typeof UPLOAD_LIMITS;

export type CloudinaryImage = {
  url: string;
  publicId: string;
};

/** What the browser needs in order to upload directly: never the secret. */
export type SignedUploadParams = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  /** Prefixed folder, e.g. `athenaeum/covers`. */
  folder: string;
  allowedFormats: string;
  maxFileSizeBytes: number;
};

/** `athenaeum/covers` — the folder actually written to. */
export function folderPath(folder: CloudinaryFolder): string {
  return `${CLOUDINARY_PREFIX}/${folder}`;
}

/** The endpoint the browser posts the file to. */
export function uploadEndpoint(cloudName: string): string {
  return `${CLOUDINARY_API_BASE}/${cloudName}/image/upload`;
}

/**
 * Whether an asset sits inside one of our folders.
 *
 * Guards `DELETE /api/uploads`: a member may only delete an avatar under
 * `athenaeum/avatars`, so a crafted `publicId` cannot destroy arbitrary assets
 * in the account.
 */
export function isOwnedAsset(publicId: string, folder: CloudinaryFolder): boolean {
  return (
    typeof publicId === "string" &&
    publicId.startsWith(`${folderPath(folder)}/`) &&
    !publicId.includes("..")
  );
}

/* -------------------------------------------------------------------------- */
/* Delivery URL helpers                                                        */
/* -------------------------------------------------------------------------- */

export type CloudinaryTransform = {
  /** Cloud name. Defaults to `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. */
  cloudName?: string;
  width?: number;
  height?: number;
  /** Output format hint passed to Cloudinary's `f_` (usually "auto"). */
  format?: string;
  /** Quality via `q_`. Defaults to "auto". */
  quality?: string | number;
  /** Gravity passed to `g_`; used with `crop: "fill"` for square avatars. */
  gravity?: string;
  crop?: "fill" | "fit" | "limit" | "thumb";
};

/** Trim slashes so callers can pass `covers/x` or `/covers/x` interchangeably. */
function normalizePublicId(publicId: string): string {
  return publicId.replace(/^\/+/, "");
}

/**
 * Build a transformed delivery URL. Returns an empty string for missing input so
 * callers can fall back to a generated cover without extra null checks.
 */
export function cloudinaryUrl(
  publicId: string | null | undefined,
  {
    cloudName,
    width,
    height,
    format = "auto",
    quality = "auto",
    gravity,
    crop,
  }: CloudinaryTransform = {},
): string {
  const cloud = cloudName ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const id = publicId?.trim();
  if (!cloud || !id) return "";

  const parts = [`f_${format}`, `q_${quality}`];
  if (width) parts.push(`w_${Math.round(width)}`);
  if (height) parts.push(`h_${Math.round(height)}`);
  if (gravity) parts.push(`g_${gravity}`);
  parts.push(`c_${crop ?? (width && height ? "fill" : "limit")}`);

  return `${CLOUDINARY_UPLOAD_BASE}/${cloud}/image/upload/${parts.join(",")}/${normalizePublicId(id)}`;
}

/**
 * Apply a transformation to an already-built Cloudinary URL.
 *
 * `next/image` needs a concrete src, so this rewrites the `/upload/` segment of
 * a URL returned by the API rather than rebuilding it from a public id.
 */
export function withTransform(
  url: string,
  {
    width,
    height,
    format = "auto",
    quality = "auto",
    gravity,
    crop = "limit",
  }: CloudinaryTransform = {},
): string {
  const marker = "/image/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  const parts = [`f_${format}`, `q_${quality}`];
  if (width) parts.push(`w_${Math.round(width)}`);
  if (height) parts.push(`h_${Math.round(height)}`);
  if (gravity) parts.push(`g_${gravity}`);
  parts.push(`c_${crop}`);

  const head = url.slice(0, index + marker.length);

  // Drop whatever transformation the source URL already carried. Segments are
  // matched individually rather than positionally, so an externally-supplied URL
  // (`q_auto,w_100/x`) is rewritten correctly too.
  const tail = url
    .slice(index + marker.length)
    .split("/")
    .filter((segment, position) => {
      if (position === 0) return !/^f_[^,]*(,|$)/.test(segment) && !/^q_[^,]*(,|$)/.test(segment);
      return segment !== "";
    })
    .join("/");

  return `${head}${parts.join(",")}/${tail}`;
}

/** Convenience wrapper for the `{ url, publicId }` shape stored in MongoDB. */
export function cloudinaryImageUrl(
  image: { url: string; publicId?: string | null } | null | undefined,
  transform?: CloudinaryTransform,
): string {
  if (!image) return "";
  return image.url?.trim() ? image.url : cloudinaryUrl(image.publicId, transform);
}

/** Cover thumbnails are 2:3 and capped at 512px wide. */
export const COVER_TRANSFORM = { width: 512, height: 768 } as const;

/** Avatars are square, face-focused crops. */
export const AVATAR_TRANSFORM = { width: 256, height: 256, gravity: "auto", crop: "fill" } as const;
