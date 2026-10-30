# NovaQuill privacy and security implementation review

Prepared 22 October 2026. Scope: additive safeguards around the existing app. This is a source review and implementation record, not a declaration of full POPIA compliance.

## Change boundary

All work is on local branch `security/popia-safeguards-20261022`. No remote push, production deployment, production configuration change or database migration has been performed. The PDF editor, fonts, placement, drawing, rotation, preview, sign-in-before-download and free allowance have not been redesigned or refactored. The existing signature-save checkbox starts unchecked. The existing advanced account controls gain a privacy-request form, and the privacy page adds a free public request channel. Collection notices are added beside upload and registration. Normal signing needs no extra steps.

## Enforced by this branch

| Protection | Enforcement | Evidence / limits |
| --- | --- | --- |
| Stable account ownership | Session exposes the existing signed JWT subject. Private endpoints resolve the database account by immutable ID, not reusable email. | Deleted accounts cannot regain access through a new account with the same email. Existing NextAuth JWTs already have the database ID in `sub`. |
| Authentication | Existing bcrypt and 90-day session settings preserved. Password attempts are limited per IP and account. Google account linking requires provider-verified email. | Redis is needed for consistent limits across production instances. No new MFA step. |
| Explicit signature storage | Optional checkbox unchecked; both save entry points send an explicit choice, required by the server. | Deliberate selection and placement remain required. Saving is separate from applying a signature. |
| Signature privacy | Account-scoped reads/deletes, encrypted payloads, strict envelope validation, bounded PNG/JPEG inputs. | Existing GIF/WebP reuse continues through the browser's existing PNG conversion. Removing saved handwriting does not alter past PDFs. |
| Private document delivery | New Cloudinary uploads use authenticated delivery and random object names; server retrieves them with 60-second signed URLs. AES-256-GCM remains in place. | Old objects retain their existing read path to avoid breaking documents; their delivery configuration needs a controlled provider migration. Signed provider URLs are not returned to users. |
| Deletion integrity | Cross-origin checks, throttling, provider result checks and retryable errors. File deletion must succeed before deleting its metadata. Account deletion locks the user row and uses one database transaction for account-owned records. | Cloud deletion and PostgreSQL cannot form a distributed atomic transaction. Partial external cleanup remains possible; retries treat missing files as deleted. Provider backups need separate verification. |
| Cache protection | API responses marked private/no-store for browser and CDN, and excluded from indexing. | Validate actual deployment headers before release. |
| Data minimisation | Document lists omit storage paths. Analytics allow only known event names. New PayFast records omit raw webhook bodies. Health responses omit exception details. | Historical webhook records are not rewritten. Provider/platform logs and database records remain in the assessment. |
| Access and security evidence | Security events record fixed action names, account IDs, resource IDs and server timestamps. Stored PDF events include a SHA-256 digest. No content, signature images, raw IPs or tokens are written to this table. | Operational audit trail, not an accredited signature or append-only/WORM evidence system. Browser-only PDFs never leave the browser merely to add an audit record. |
| Personal information access | Account export includes profile/usage, saved signatures, own payment summaries, document links, own security events and privacy requests/outcomes. Password hashes and OAuth tokens excluded. | Source/provider records outside this database require the manual request process. |
| Rights requests | Authenticated and public access/correction/objection/deletion submissions are bounded, encrypted, throttled and return a receipt. Public requests require a contact email and cannot claim an account identity. Owner-only history stays authenticated. | Staff must verify identity, assess the request and provide a written response. Operations tooling records an encrypted outcome and actual notification reference; it does not send messages. |
| Retention | Secret-protected maintenance endpoint deletes only expired security events and closed requests, using explicitly configured periods and excluding held records. Held requests survive account deletion with account association detached. | Daily scheduling is prepared in vercel.json, inactive until deployment. Proposed 90/365-day operational periods require approval. No contract-age purge. Held case evidence needs recorded justification and review. |
| Shared-browser cleanup | Existing document preservation across sign-in remains. Account change/sign-out clears in-memory editor state and the stored draft; resumed anonymous drafts bind to the first account and cannot be loaded by another account. Account deletion sends Clear-Site-Data. | Browser support varies. Drafts remain in IndexedDB during sign-in and expire after 24 hours when next loaded; they are not independently encrypted by this change. |

## Verification

- TypeScript, ESLint, Prisma schema validation and the production build passed. All 89 regression/security/database tests passed. The Google-font build used local mock font responses because build-time Google access is unavailable; production font configuration is unchanged.
- A locally started production server with isolated test configuration returned 401 for private endpoints with no-store/CDN/noindex headers, blocked foreign-origin deletion and refused unconfigured retention maintenance. No production database or provider credentials were used for that check.
- New security tests run the actual route/module source with explicit authentication/database/provider boundary doubles. They cover cross-account access, stale identities, cross-origin deletion, storage failure, image input, JSON/multipart limits, consent, encryption/tampering, export minimisation, private delivery and retention authentication.
- These tests do not connect to a production database, Cloudinary account, PayFast service or live OAuth provider.
- The two additive SQL migrations have not been applied to any live database. Six tests apply the exact migrations to isolated in-memory PostgreSQL (PGlite), preserving existing rows and checking constraints, rollback, holds and account-scoped cascades. Native multi-session row locking/concurrent upload-deletion and real provider integration remain release gates; PGlite does not establish those properties.
- Live two-account browser, login-provider, Cloudinary authenticated raw upload/download/delete, logout and cache-header checks remain release gates. A mocked provider result is not evidence of live provider configuration.

## Company and infrastructure items still unresolved

| Required evidence / decision | Why code cannot establish it |
| --- | --- |
| Confirm legal controller/trading entity, registration details, address and privacy contact | The source does not establish these facts. Do not publish invented names, contact details or an appointed officer. |
| Information Officer registration and delegated duties | Requires the real authorised officer and the Information Regulator process. |
| Complete/publish privacy collection notice and PAIA manual | Expanded English/Portuguese notice, public form, collection notices and PAIA page are prepared locally. Full manual and processing register drafts need verified entity/contact/provider facts and approval before publication. |
| Customer operator agreement and provider agreements | Written terms, instructions, subprocessors and section 72 transfer grounds require actual acceptance and a provider/location inventory. |
| Provider regions, encryption at rest, encrypted backups, access roles, audit log destinations and restore testing | Requires provider-console evidence. The application key alone does not prove database/backups or key-management compliance. |
| Approved retention schedule and scheduler | Document/account retention depends on service purpose and any independent legal basis. Approve operational periods, configure the prepared authenticated daily schedule and verify actual runs/monitoring after authorised deployment. |
| Staff responsible for rights requests and written responses | The queue/tool must be operated, monitored and assigned an owner. Capturing a request does not answer it. |
| Incident-response owner and reporting exercise | Notifications and judgement about actual incidents require responsible people and access to the Regulator portal. |
| Existing assets and historical webhook data review | Legacy Cloudinary paths can disclose filenames in provider object keys; legacy objects may use public encrypted delivery; historical webhook payloads may contain excess billing fields. Inventory and plan a reversible migration/purge with approved retention before applying it. |
| Independent security review and provider integration tests | Source-level tests do not prove the complete deployment is secure or compliant. |

## Closure status

See CLOSURE_STATUS.md for all ten requirements, evidence still needed and next actions. `npm run compliance:check` fails while required facts/configuration/reviewed evidence are missing. It checks references and configuration, not the truth or legal sufficiency of submitted evidence; it is not compliance certification. No evidence, registration, executed agreement, notification or deployment is fabricated.

## ECTA boundary

No signing architecture or PDF output has been changed. The app continues to create ordinary electronic signatures. Server evidence exists only for actions the server can observe. A fingerprint logged when a Pro PDF is stored is not proof that every downloaded PDF was signed by a particular natural person, is not a trusted timestamp, and is not an accredited advanced electronic signature. Comprehensive per-document signing evidence for browser-only downloads would require a separately approved design; it has deliberately not been introduced under the no-workflow-change instruction.

## Sources checked

- POPIA: https://www.justice.gov.za/legislation/acts/2013-004.pdf — notably sections 14, 18–24, 55 and 72.
- Amended regulations: https://inforegulator.org.za/wp-content/uploads/2025/04/POPIA-2021-Regulations-FINAL-21-Jan-2025.pdf
- Regulator security-compromise guidance: https://inforegulator.org.za/2025/08/19/fact-sheet-handling-of-security-compromises/
- Regulator forms and guidance: https://inforegulator.org.za/popia/ and https://inforegulator.org.za/popia-forms/
- Cloudinary delivery controls: https://cloudinary.com/documentation/control_access_to_media and https://cloudinary.com/documentation/image_upload_api_reference
- NextAuth callbacks: https://next-auth.js.org/configuration/callbacks

The amended regulation's 30-day written-notification language refers to receipt of the outcome of the request. Do not re-label it as a universal 30-day extension to delay action. Resolve requests as soon as reasonably practicable, track dates, and set an internal response target of 30 days from receipt with escalation well before that point.
