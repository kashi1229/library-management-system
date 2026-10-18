"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { Check, ImagePlus, Loader2, Trash2, TriangleAlert, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { validateImageFile } from "@/lib/validators/upload";
import { UPLOAD_LIMITS, withTransform } from "@/lib/cloudinary-shared";
import type { CloudinaryFolder } from "@/lib/cloudinary-shared";
import { uploadsApi } from "@/lib/api-client";
import type { CloudinaryImage } from "@/types";

type ImageUploaderProps = {
  folder: CloudinaryFolder;
  /** Current stored image, or null. */
  value: CloudinaryImage | null;
  /** Called with the new image, or `null` when removed. */
  onChange: (value: CloudinaryImage | null) => void;
  /** Preview shape. `square` for avatars, `cover` for book covers. */
  aspect?: "square" | "cover";
  /** Overrides the per-folder default from `UPLOAD_LIMITS`. */
  maxSizeMB?: number;
  /** Rendered size of the preview box. */
  className?: string;
  /** Shown under the drop zone. */
  hint?: React.ReactNode;
  /** Disables the whole control (e.g. while a form is submitting). */
  disabled?: boolean;
};

type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

/**
 * Cloudinary image uploader.
 *
 * Flow: validate locally → ask the server to sign → POST the file straight to
 * Cloudinary with `XMLHttpRequest` (the only browser API that reports upload
 * progress) → hand the resulting `{url, publicId}` to `onChange`.
 *
 * The API secret is never involved on the client: only a short-lived signature
 * comes back from `POST /api/uploads/sign`.
 */
export function ImageUploader({
  folder,
  value,
  onChange,
  aspect = "square",
  maxSizeMB,
  className,
  hint,
  disabled = false,
}: ImageUploaderProps) {
  const limits = UPLOAD_LIMITS[folder];
  const sizeLimit = maxSizeMB ?? limits.maxSizeMB;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<UploadState>({ phase: "idle" });
  const [dragging, setDragging] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const reduced = usePrefersReducedMotion();

  // Object URLs must be revoked or the blob stays in memory for the page's life.
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const busy = state.phase === "uploading";

  const upload = React.useCallback(
    async (file: File) => {
      const check = validateImageFile(file, sizeLimit);
      if (!check.ok) {
        setState({ phase: "error", message: check.reason });
        return;
      }

      // Instant local preview, before the network has said anything.
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      setState({ phase: "uploading", progress: 0 });

      try {
        const signed = await uploadsApi.sign(folder);
        const result = await uploadToCloudinary(file, signed, (progress) =>
          setState({ phase: "uploading", progress }),
        );

        onChange(result);
        setState({ phase: "done" });
        toast.success(folder === "covers" ? "Cover uploaded" : "Photo updated");

        // Let the success tick read, then settle back to idle and fall back to the
        // stored image — the blob URL is revoked below and must not linger.
        window.setTimeout(() => {
          setState({ phase: "idle" });
          setPreview(null);
        }, 1600);
      } catch (error) {
        setState({
          phase: "error",
          message: error instanceof Error ? error.message : "Upload failed. Please try again.",
        });
        setPreview(null);
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    },
    [folder, onChange, sizeLimit],
  );

  const handleFiles = (files: FileList | null) => {
    const file = files?.item(0);
    if (file) void upload(file);
  };

  const handleRemove = async () => {
    setConfirmRemove(false);
    if (!value) return;

    try {
      await uploadsApi.remove(value.publicId);
      onChange(null);
      setState({ phase: "idle" });
      toast.success(folder === "covers" ? "Cover removed" : "Photo removed");
    } catch {
      toast.error("Could not remove the image", { description: "Please try again." });
    }
  };

  const display = preview ?? (value ? withTransform(value.url, displayTransform(aspect)) : null);
  const ratioClass = aspect === "square" ? "aspect-square" : "aspect-[2/3]";

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && !busy) handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "relative overflow-hidden rounded-lg border border-dashed transition-colors duration-150",
          ratioClass,
          dragging ? "border-accent bg-accent-soft" : "border-border bg-muted/50",
          disabled && "opacity-60",
        )}
      >
        {/* ------------------------------ Preview ------------------------------ */}
        {display ? (
          <Image
            src={display}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className={cn("object-cover", aspect === "cover" && "object-contain")}
            unoptimized={Boolean(preview)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <ImagePlus className="size-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-small font-medium text-foreground">
              {aspect === "square" ? "Add a photo" : "Add a cover"}
            </p>
            <p className="text-caption text-muted-foreground">
              Drag an image here, or{" "}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                browse
              </button>
            </p>
          </div>
        )}

        {/* ------------------------------ Overlay ----------------------------- */}
        <AnimatePresence>
          {busy ? (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transitions.fast}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm"
            >
              <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" />
              <div className="w-2/3 space-y-1.5">
                <div
                  role="progressbar"
                  aria-valuenow={state.phase === "uploading" ? state.progress : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Upload progress"
                  className="h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ scaleX: state.phase === "uploading" ? state.progress / 100 : 0 }}
                    style={{ originX: 0 }}
                    transition={reduced ? transitions.fast : { type: "spring", stiffness: 220, damping: 30 }}
                  />
                </div>
                <p className="text-center font-mono text-code text-muted-foreground">
                  {state.phase === "uploading" ? `${state.progress}%` : "0%"}
                </p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* --------------------------- Success tick --------------------------- */}
        <AnimatePresence>
          {state.phase === "done" ? (
            <motion.span
              key="done"
              initial={{ scale: reduced ? 1 : 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: reduced ? 1 : 0.6, opacity: 0 }}
              transition={reduced ? transitions.fast : { type: "spring", stiffness: 400, damping: 18 }}
              className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-success text-white shadow-soft"
            >
              <Check className="size-4" strokeWidth={2.5} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ------------------------------ Controls ----------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Reset so picking the same file again still fires a change event.
            event.target.value = "";
          }}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <UploadCloud className="size-4" />
          {display ? "Replace" : "Upload"}
        </Button>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || busy}
            onClick={() => setConfirmRemove(true)}
            className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        ) : null}

        <p className="text-caption text-muted-foreground">
          {hint ?? `JPG, PNG or WebP · up to ${sizeLimit}MB`}
        </p>
      </div>

      {/* ------------------------------- Error -------------------------------- */}
      {state.phase === "error" ? (
        <p role="alert" className="flex items-start gap-2 text-caption text-danger-ink">
          <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.75} />
          {state.message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={folder === "covers" ? "Remove this cover?" : "Remove your photo?"}
        consequence="The image is deleted from Cloudinary. You can upload a new one at any time."
        confirmLabel="Remove image"
        onConfirm={handleRemove}
      />
    </div>
  );
}

/** Cloudinary delivery transformation for the on-screen preview. */
function displayTransform(aspect: "square" | "cover") {
  return aspect === "square"
    ? ({ width: 512, height: 512, gravity: "auto", crop: "fill" } as const)
    : ({ width: 512, height: 768, crop: "limit" } as const);
}

type SignedParams = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string;
  maxFileSizeBytes: number;
};

/**
 * POST the file to Cloudinary with progress.
 *
 * `XMLHttpRequest` is deliberate: `fetch` still cannot report upload progress,
 * and a determinate bar is part of the design.
 *
 * Every field covered by the signature must be echoed back with the **same name
 * and value**, or Cloudinary rejects the upload with `Invalid Signature`. That is
 * `timestamp`, `folder` and `allowed_formats`. `max_file_size` is sent as well, but
 * only to state the cap — Cloudinary leaves it out of the string it signs, so
 * signing it server-side is what made every upload fail.
 */
function uploadToCloudinary(
  file: File,
  signed: SignedParams,
  onProgress: (percent: number) => void,
): Promise<CloudinaryImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", String(signed.timestamp));
    form.append("signature", signed.signature);
    form.append("folder", signed.folder);
    // `allowed_formats` is covered by the signature; `max_file_size` is not.
    form.append("allowed_formats", signed.allowedFormats);
    form.append("max_file_size", String(signed.maxFileSizeBytes));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const payload = JSON.parse(xhr.responseText) as {
          secure_url?: string;
          url?: string;
          public_id?: string;
          error?: { message?: string };
        };

        if (xhr.status >= 200 && xhr.status < 300 && payload.public_id) {
          resolve({
            url: payload.secure_url ?? payload.url ?? "",
            publicId: payload.public_id,
          });
          return;
        }

        reject(new Error(payload.error?.message ?? "The upload was rejected."));
      } catch {
        reject(new Error("The upload service returned an unexpected response."));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled.")));

    xhr.send(form);
  });
}
