import { z } from "zod";
import { UPLOAD_FOLDERS } from "@/lib/constants";

/**
 * Upload request schemas.
 *
 * `folder` is a **whitelist**, never a free string: only `covers` and `avatars`
 * exist, and the signed folder is derived from it on the server. A caller cannot
 * ask for an arbitrary Cloudinary path.
 */

export const uploadFolderSchema = z.enum(UPLOAD_FOLDERS);

/** `POST /api/uploads/sign` */
export const signUploadSchema = z.object({
  folder: uploadFolderSchema,
});

/** `DELETE /api/uploads` */
export const deleteUploadSchema = z.object({
  publicId: z
    .string()
    .trim()
    .min(1, "publicId is required")
    .max(200, "publicId is too long")
    // Rejects traversal and absolute paths before the value is used anywhere.
    .refine((value) => !value.includes(".."), "Invalid publicId")
    .refine((value) => !value.startsWith("/"), "Invalid publicId"),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;
export type DeleteUploadInput = z.infer<typeof deleteUploadSchema>;

/** `{ url, publicId }` as stored on a user or book document. */
export const cloudinaryImageSchema = z.object({
  url: z.string().trim().url("Invalid image URL").max(500),
  publicId: z.string().trim().min(1).max(200),
});

/**
 * Client-side guard, shared by the uploader before it asks for a signature.
 *
 * The size check below is a UX check and, because a signed direct upload makes
 * Cloudinary ignore `max_file_size`, it is also the only size gate we control.
 * The format whitelist is the genuinely enforced one: `allowed_formats` is signed,
 * so a crafted request that skips this guard is still refused by Cloudinary.
 */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export type FileRejection = { ok: false; reason: string };

/**
 * Validate a picked file. Checks MIME type *and* extension so a renamed `.exe`
 * is rejected even if a browser reports a permissive type.
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number,
): { ok: true } | FileRejection {
  const maxBytes = maxSizeMB * 1024 * 1024;

  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "Choose a JPG, PNG or WebP image." };
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, reason: "Choose a JPG, PNG or WebP image." };
  }

  if (file.size > maxBytes) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return { ok: false, reason: `That image is ${sizeMb}MB. The limit is ${maxSizeMB}MB.` };
  }

  if (file.size === 0) {
    return { ok: false, reason: "That file is empty." };
  }

  return { ok: true };
}
