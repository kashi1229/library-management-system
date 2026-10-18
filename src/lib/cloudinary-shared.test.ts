import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AVATAR_TRANSFORM,
  CLOUDINARY_UPLOAD_BASE,
  cloudinaryUrl,
  resolveCloudName,
  withTransform,
} from "@/lib/cloudinary-shared";

/**
 * Which cloud the delivery URLs point at.
 *
 * Two variables describe one cloud and they were not equal — `dbm0wycl6` on the
 * server against `lms` in the public copy — so every avatar resolved to
 * `res.cloudinary.com/lms/...` and 404'd. A wrong host produces a **valid URL to
 * an account that does not exist**, which is why no type checker, linter or 404 on
 * the upload endpoint could surface it.
 *
 * Run with `npm test`.
 */

describe("resolveCloudName", () => {
  it("prefers the server value when both are present", () => {
    // The exact mismatch that broke every avatar: the public copy is stale, and
    // trusting it on the server built URLs for a cloud that does not exist.
    assert.equal(resolveCloudName("dbm0wycl6", "lms"), "dbm0wycl6");
  });

  it("falls back to the public value on the browser", () => {
    // `CLOUDINARY_CLOUD_NAME` is stripped from the client bundle, so this is the
    // only value a Client Component can ever see.
    assert.equal(resolveCloudName(undefined, "dbm0wycl6"), "dbm0wycl6");
  });

  it("treats an empty server value as absent", () => {
    assert.equal(resolveCloudName("", "dbm0wycl6"), "dbm0wycl6");
  });

  it("returns an empty string when neither is set", () => {
    // Callers must treat "" as "cannot build a URL" rather than emitting one.
    assert.equal(resolveCloudName(undefined, undefined), "");
    assert.equal(resolveCloudName("  ", ""), "");
  });

  it("trims the value", () => {
    assert.equal(resolveCloudName(" dbm0wycl6\n"), "dbm0wycl6");
  });
});

describe("cloudinaryUrl", () => {
  const publicId = "athenaeum/avatars/abc123";

  it("builds a URL on the account's own host", () => {
    const url = cloudinaryUrl(publicId, { ...AVATAR_TRANSFORM, cloudName: "dbm0wycl6" });

    assert.equal(
      url,
      `${CLOUDINARY_UPLOAD_BASE}/dbm0wycl6/image/upload/f_auto,q_auto,w_256,h_256,g_auto,c_fill/${publicId}`,
    );
  });

  it("returns an empty string when there is no cloud name, not a broken URL", () => {
    // The browser fallback: no server variable in the bundle, and no public one
    // configured either. A URL with an empty host segment would render as a
    // relative request to our own server instead of failing visibly.
    assert.equal(cloudinaryUrl(publicId, { cloudName: "" }), "");
  });

  it("returns an empty string for a missing publicId", () => {
    assert.equal(cloudinaryUrl(null, { cloudName: "dbm0wycl6" }), "");
    assert.equal(cloudinaryUrl("   ", { cloudName: "dbm0wycl6" }), "");
  });

  it("keeps the host and the version segment when a stored URL is re-transformed", () => {
    const stored = `${CLOUDINARY_UPLOAD_BASE}/dbm0wycl6/image/upload/v123/${publicId}`;

    // `v123` must survive: dropping it would hand the browser a different cache key
    // and quietly defeat CDN invalidation.
    assert.equal(
      withTransform(stored, { width: 64, height: 64 }),
      `${CLOUDINARY_UPLOAD_BASE}/dbm0wycl6/image/upload/f_auto,q_auto,w_64,h_64,c_limit/v123/${publicId}`,
    );
  });

  it("leaves a URL that is not a Cloudinary delivery URL alone", () => {
    assert.equal(withTransform("https://example.com/a.png", { width: 64 }), "https://example.com/a.png");
  });
});