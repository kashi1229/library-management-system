import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UPLOAD_LIMITS, type CloudinaryFolder } from "@/lib/cloudinary-shared";
import { uploadLimitLabel, validateImageFile } from "@/lib/validators/upload";

/**
 * The max file size this app accepts, per folder.
 *
 * The size cap is the one upload constraint a crafted request walks straight past:
 * a signed direct upload makes Cloudinary **ignore** `max_file_size` (measured — see
 * `signUpload()` in `lib/cloudinary.ts`), so `validateImageFile` here *is* the
 * enforcement. An off-by-one or a stale constant is therefore a silent policy change
 * that no compiler can see, which is why the boundary is pinned.
 *
 * Run with `npm test`.
 */

const MB = 1024 * 1024;

/** A real `File` of an exact byte length (a global since Node 20). */
function png(bytes: number, name = "image.png", type = "image/png"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("upload limits", () => {
  it("caps avatars at 3MB and covers at 5MB", () => {
    assert.equal(UPLOAD_LIMITS.avatars.maxSizeMB, 3);
    assert.equal(UPLOAD_LIMITS.covers.maxSizeMB, 5);
  });

  it("signs the same formats the guard accepts", () => {
    // `allowed_formats` is signed, so this list is the one Cloudinary enforces.
    assert.deepEqual([...UPLOAD_LIMITS.covers.formats], ["jpg", "jpeg", "png", "webp"]);
  });
});

describe("validateImageFile — the size boundary", () => {
  for (const folder of Object.keys(UPLOAD_LIMITS) as CloudinaryFolder[]) {
    const { maxSizeMB } = UPLOAD_LIMITS[folder];
    const capBytes = maxSizeMB * MB;

    it(`${folder}: accepts a file of exactly ${maxSizeMB}MB`, () => {
      assert.deepEqual(validateImageFile(png(capBytes), maxSizeMB), { ok: true });
    });

    it(`${folder}: rejects a file one byte over ${maxSizeMB}MB`, () => {
      const result = validateImageFile(png(capBytes + 1), maxSizeMB);

      assert.equal(result.ok, false);
      // The size is rounded **up**, so the message can never read "5.0MB · limit 5MB".
      assert.equal(
        result.ok === false && result.reason,
        `That image is ${maxSizeMB}.1MB. The limit is ${maxSizeMB}MB.`,
      );
    });

    it(`${folder}: reports the real size of a grossly oversized file`, () => {
      const result = validateImageFile(png(capBytes + 7 * MB), maxSizeMB);

      assert.equal(result.ok, false);
      assert.equal(
        result.ok === false && result.reason,
        `That image is ${maxSizeMB + 7}.0MB. The limit is ${maxSizeMB}MB.`,
      );
    });
  }

  it("accepts a 3MB file under the 5MB covers cap", () => {
    // The regression that prompted these tests: covers always took a 3MB file, while
    // the uploader's own hint told the user 3MB was the ceiling.
    assert.deepEqual(validateImageFile(png(3 * MB), UPLOAD_LIMITS.covers.maxSizeMB), { ok: true });
  });
});

describe("validateImageFile — everything else", () => {
  it("rejects an empty file", () => {
    assert.deepEqual(validateImageFile(png(0), 3), {
      ok: false,
      reason: "That file is empty.",
    });
  });

  it("rejects a non-image MIME type", () => {
    assert.deepEqual(validateImageFile(png(1024, "notes.pdf", "application/pdf"), 3), {
      ok: false,
      reason: "Choose a JPG, PNG or WebP image.",
    });
  });

  it("rejects a renamed executable even when the browser reports an image MIME", () => {
    assert.deepEqual(validateImageFile(png(1024, "payload.exe", "image/png"), 3), {
      ok: false,
      reason: "Choose a JPG, PNG or WebP image.",
    });
  });

  it("honours a lower per-call cap", () => {
    // The `maxSizeMB` prop on ImageUploader tightens the guard; it must not widen it.
    assert.equal(validateImageFile(png(2 * MB), 1).ok, false);
    assert.equal(validateImageFile(png(2 * MB), 3).ok, true);
  });
});

describe("uploadLimitLabel — the cap shown to the user", () => {
  it("names the formats and the real cap for each folder", () => {
    assert.equal(uploadLimitLabel("covers"), "JPG, JPEG, PNG or WebP · up to 5MB");
    assert.equal(uploadLimitLabel("avatars"), "JPG, JPEG, PNG or WebP · up to 3MB");
  });

  it("reflects an overridden cap", () => {
    assert.equal(uploadLimitLabel("covers", 2), "JPG, JPEG, PNG or WebP · up to 2MB");
  });

  it("always agrees with the cap validateImageFile enforces", () => {
    for (const folder of Object.keys(UPLOAD_LIMITS) as CloudinaryFolder[]) {
      const { maxSizeMB } = UPLOAD_LIMITS[folder];

      assert.match(uploadLimitLabel(folder), new RegExp(`up to ${maxSizeMB}MB$`));
      assert.equal(validateImageFile(png(maxSizeMB * MB), maxSizeMB).ok, true);
      assert.equal(validateImageFile(png(maxSizeMB * MB + 1), maxSizeMB).ok, false);
    }
  });
});
