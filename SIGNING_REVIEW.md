# NovaQuill signing review

## Current flow

Upload → fill and sign → preview → sign in if needed → download.

Upload and preview are available without an account, including when an account has used its monthly allowance. The download endpoint still authenticates the user and atomically enforces 3 free documents per UTC month. Pro remains unlimited. Repeat downloads of the same version within the editor do not use another credit.

Before sign-in, the original PDF and editor state are preserved in IndexedDB on the current browser. Returning from OAuth or password sign-in restores the document and reopens its preview. The saved draft expires after 24 hours and is removed after download or selecting another PDF. This is temporary browser storage, not cloud storage.

Sessions use persistent secure, HttpOnly cookies through NextAuth, with an explicit 90-day lifetime and renewal on session access. Logging out or clearing browser cookies still requires sign-in.

Navigation is the editor default. Signing starts only after tapping Sign. ShapeAssist remains automatic. Each direct signing session groups its strokes into a completed signature that can be dragged and proportionally resized while retaining vector export. Typed and uploaded signatures remain movable and resizable.

The Text tool highlights native editable PDF text widgets and suggests printed boxes, labelled horizontal rules and underline blanks. Native fields are filled and flattened in export. Detection is heuristic for printed forms and does not provide OCR for scanned pages. Manual placement remains available.

## Validation

- 38 regression tests pass, including real PDF field detection at all four rotations, native form export, grouped signature transforms, draft round-trip/expiry, safe authentication return paths, and existing quota/concurrency and PDF export coverage.
- TypeScript and ESLint pass.
- Production build passes with temporary local Google Font responses mocked. The mock is outside the repository.
- Production deployment succeeded. The live homepage exposes Upload PDF without sign-in. Browser verification stopped at a file-picker tool timeout, so editor interactions, mobile gestures and the complete OAuth/download flow remain unverified on this revision.
