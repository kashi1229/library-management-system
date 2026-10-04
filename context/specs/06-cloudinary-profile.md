# Unit 06: Cloudinary Uploads & Profile

## Goal
Secure signed uploads to Cloudinary with a reusable, beautiful upload component, plus a complete Profile page (details, avatar, password).

## Design
Profile: two-column on desktop (left identity card with big avatar, name, role badge, membership ID in mono, member-since; right tabbed forms "Details" and "Security"). Upload component: dashed drop zone (`UploadCloud` icon), drag-over highlight, instant local preview, determinate progress bar, success check, remove button (`Trash2`).

## Implementation

### Server
- `lib/cloudinary.ts`: configure SDK from env; `signUpload(folder)` returns `{signature, timestamp, apiKey, cloudName, folder}`; `destroyAsset(publicId)`.
- `POST /api/uploads/sign`: folder whitelist `covers` (staff only) | `avatars` (any signed-in); folder prefixed `athenaeum/`. Also include allowed formats and max size parameters in the signed params (`allowed_formats: jpg,jpeg,png,webp`, eager none).
- `DELETE /api/uploads`: body `{publicId}`; staff may delete `covers`; users may delete only their own current avatar.
- `PATCH /api/profile`: validates name, phone, department, avatar `{url,publicId}`; deletes previous avatar asset if replaced/removed; returns updated safe user.
- Validators: `lib/validators/profile.ts`, `lib/validators/upload.ts`.

### Client
- `components/common/ImageUploader.tsx`: props `folder`, `value`, `onChange`, `aspect` (1:1 or 2:3), `maxSizeMB` (default 3). Validates type/size client-side, requests signature, uploads directly to `https://api.cloudinary.com/v1_1/<cloud>/image/upload` via XHR (for progress), returns `{url, publicId}`.
- Square-crop preview for avatars (CSS object-fit; Cloudinary `c_fill,g_face` transformation on display).
- `cloudinaryUrl(url, {w,h,crop})` helper completed (inserts transformation string, `f_auto,q_auto`).
- `next.config`: `images.remotePatterns` for `res.cloudinary.com`.

### Profile page `/profile` (member) and staff access via topbar menu to the same page
- Details tab: name, phone, department (editable); email, membership ID, role (read-only with lock icon).
- Security tab: change password (current, new, confirm) with strength meter.
- Avatar: upload / replace / remove with confirm. Updates topbar avatar immediately (context update).
- Staff reach the same page at `/profile` (route allowed for all roles; middleware updated accordingly).

## Dependencies
cloudinary (server SDK).

## Verify when done
- [ ] Avatar upload shows progress, appears in profile and topbar without reload.
- [ ] Non-image or >3MB files are rejected client-side with a clear message.
- [ ] Signing endpoint rejects `covers` for members and unauthenticated calls.
- [ ] Replacing/removing avatar deletes the old asset in Cloudinary.
- [ ] `CLOUDINARY_API_SECRET` never appears in the client bundle or network responses.
- [ ] Password change works and old password stops working.
- [ ] Responsive at 360px; light/dark OK.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
