# NovaQuill signing review

Changes are prepared on `improve-signing-experience`. They have not been published or deployed.

## The ten criteria

| Criterion | What the implementation provides | Verification |
| --- | --- | --- |
| Easy to use | One Fill & Sign editor for all entry points; drawing directly on the PDF is the default; saved/type/upload options are optional | Source reviewed; hosted usability test pending |
| Fast for urgent documents | PDF is parsed once per file; page changes and zoom reuse the loaded document; local download does not wait for server calls | Source reviewed; end-to-end timing pending |
| No printing or scanning | Signature and entered form details are embedded directly into the original PDF | Actual export regression tests pass |
| Form filling and signing together | Text, dates, initials, checkboxes and signatures remain in the same editor | Existing capability retained; form-only export tested |
| Saved signatures reused | Existing encrypted account signature API retained; saved signatures load and can be applied | Source reviewed; signed-in database/browser test pending |
| Avoid pixelation | Direct handwriting exported as vector paths; typed/reusable raster signatures exported at 3x resolution; uploaded raster resolution preserved; low-resolution placement warning; PDF page content retained | High-resolution export and original-text tests pass |
| No forced horizontal signatures | Rotation retained; clockwise preview and export agree; native page rotation and CropBox offsets handled | Rotation, crop and zoom regression tests pass |
| Signature customisation | Colour, pen width, automatic ShapeAssist and existing typed-font controls | Source reviewed; browser interaction test pending |
| Clear free signing allowance | User-approved exception: free accounts retain 3 completed documents per month. Remaining allowance is shown before editing; previews are free; Pro is unlimited | Atomic quota, month renewal and concurrent-download tests pass; hosted account test pending |
| Refined signing behaviour | JPEG export fixed; legacy GIF/WebP converted in the browser; aspect ratio and page placement preserved; mobile PDF canvas preview replaces iframe; shared dashboard editor | JPEG and PDF export tests pass; phone/browser test pending |

## Direct signing flow

Upload the PDF, draw directly where the signature belongs, preview and download. The handwriting does not require a separate signature box, image upload or placement step. Mouse, finger and pen use pointer input. The editor fits the PDF to the available width, keeps drawing controls visible, applies ShapeAssist automatically without a strength setting, and provides page-specific undo, redo and clear. Select/move mode permits scrolling and editing other items. Saving handwriting for reuse is optional. Typed and uploaded signatures remain available in secondary controls. Zooming preserves placement and does not count as another completed document.

## Plan behaviour

Free accounts receive 3 completed documents per month, reusable account signatures and all existing form-fill tools. Pro retains the existing price and adds unlimited signing, completed-document cloud storage and priority support. Credits are checked before entering the editor and allocated atomically on the first final download. Previewing and re-downloading the same completed version within the editor do not consume another credit. A new month renews the allowance. Existing stored documents remain accessible to their owners. Homepage and pricing copy reflect this change.

Image clarity still depends on the resolution of an uploaded image and the size at which it is placed. Upscaling cannot recover missing source detail; the editor warns when the chosen image is likely to look pixelated.

## Validation completed

- TypeScript and ESLint checks pass.
- Twenty-six regression tests pass, covering quota/concurrency, zoom-independent output identity, handwriting smoothing/cropping, PDF placement and actual export. Native handwriting is rendered with Poppler to check its visible location on cropped pages at all four rotations. Tests also cover multiple pages, dots, vector export, original text, image resolution, form-only export, JPEG and invalid-page rejection.
- Production build passes with local Google Font responses mocked because this environment cannot reach Google Fonts. Application code is unchanged by the font mock.
- Lockfile repaired for the already-declared Cloudinary dependency; clean-install dry run succeeds. Existing unrelated lockfile package entries are preserved.

Tests use Node 22.6+ with TypeScript stripping (validated on Node 24):

```sh
node --experimental-strip-types --test tests/*.test.mjs
npm run typecheck
npm run lint
npm run build
```

## Remaining verification

The cloud browser cannot access this container's local development server (`ERR_BLOCKED_BY_CLIENT`). A hosted preview is needed to verify the actual signed-in upload, drawing, customisation, rotation, save/reuse, form filling, preview and download flow on desktop and mobile. Google authentication, persistent saved signatures and Pro cloud storage have not been tested end to end in this session.

Automatic approval review rejected the remote GitHub push because it would publish project contents to a public repository without explicit authorization to push. No pull request or deployment was created.
