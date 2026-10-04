/**
 * Cloudinary URL builder.
 *
 * Unit 01 ships this as a pure, network-free string builder so `next/image` can be
 * pointed at Cloudinary immediately. Signed uploads (signature helper) arrive in
 * Unit 06, together with the `CLOUDINARY_*` env plumbing.
 *
 * Usage:
 *   cloudinaryUrl("athenaeum/covers/abc", { width: 640, height: 960 })
 *   → https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_640,h_640/<publicId>
 */

export const CLOUDINARY_UPLOAD_BASE = "https://res.cloudinary.com";

export type CloudinaryTransform = {
  /** Cloud name. Defaults to `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. */
  cloudName?: string;
  width?: number;
  height?: number;
  /** Output format hint passed through to Cloudinary's `f_` (usually "auto"). */
  format?: string;
  /** JPEG/WebP quality 1–100 via `q_`. Defaults to "auto". */
  quality?: string | number;
  /** Gravity passed to `g_`; used with `crop: "fill"` for square avatars. */
  gravity?: string;
  crop?: "fill" | "fit" | "limit" | "thumb";
};

type CloudinaryImage = { url: string; publicId?: string | null } | null | undefined;

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
  { cloudName, width, height, format = "auto", quality = "auto", gravity, crop }: CloudinaryTransform = {},
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

/** Convenience wrapper for the `{ url, publicId }` image shape stored in MongoDB. */
export function cloudinaryImageUrl(
  image: CloudinaryImage,
  transform?: CloudinaryTransform,
): string {
  if (!image) return "";
  return image.url?.trim() ? image.url : cloudinaryUrl(image.publicId, transform);
}

/** Cover thumbnails are 2:3 and capped at 512px wide. */
export const COVER_TRANSFORM = { width: 512, height: 768 } as const;

/** Avatars are square, face-focused crops. */
export const AVATAR_TRANSFORM = { width: 256, height: 256, gravity: "auto", crop: "fill" } as const;
