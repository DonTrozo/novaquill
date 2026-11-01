# NovaQuill: ten-requirement closure record

Prepared 22 October 2026. Branch: `security/popia-safeguards-20261022`.

**Implementation prepared; all ten remain open for final verification/sign-off.** This is not ten completed legal obligations. No compliance changes have been pushed, deployed, or applied to production. The user's instruction not to push to main remains in force. Existing editing/signing behaviour is preserved; no architectural refactor was performed.

## Requirement-by-requirement work

| # | Requirement | Concrete work prepared | Evidence/action still needed to close |
| --- | --- | --- | --- |
| 1 | Lawful processing | Activity/category/role/basis register, separate optional signature storage, draft customer operator terms | Confirm legal operator, approve purposes/bases and legitimate-interest assessment, establish actual contractual coverage and sensitive-data rules |
| 2 | Data minimisation | Bounded requests/images, allowlisted analytics, no new raw payment payloads, private exports, content-free security events | Review legacy payment/object metadata and actual provider logs, approve necessary fields/retention and carry out justified cleanup |
| 3 | Privacy notification | EN/PT expanded notice and collection notices; public request channel; PAIA page/manual prepared | Confirm public company/contact/officer details, complete provider disclosures, approve notice/manual and publish through an authorised release; genuine officer registration |
| 4 | Security | Immutable user identity checks, password throttling, encrypted private new cloud objects/signatures/requests, no-store headers, robust deletion/error handling | Verify production TLS/distributed limits/access roles/keys, encrypted backups and restore; exercise real storage/OAuth flows, review findings and release fixes |
| 5 | Restricted access | Server-side owner checks on documents/signatures/rights records; stale-account and cross-account tests; shared-browser draft ownership | Real two-account browser/provider checks including logout and old assets; verify actual deployment before sign-off |
| 6 | Data retention | Protected daily job configuration, configurable periods, retention holds and operations tooling, account/file deletion | Approve complete schedule (including billing, logs and backups), configure/run/monitor job after release, review holds, verify provider disposal/restore behaviour |
| 7 | User rights | Free public requests without sign-in; encrypted contact/message; authenticated owner history/export/delete; recorded written outcomes and notification references | Assign staff/monitoring, rehearse receipt→identity checks→search/action→actual written outcome, verify accessible live channels and independently justified retained records |
| 8 | Breach notification | Incident procedure, decision/notification record fields, prepared notice content and tabletop scenario | Identify authorised officer/response owner, verify portal access, perform and record exercise; actual incidents require real assessment and notifications where applicable |
| 9 | Third-party processing | Provider register/questions; detailed customer operator agreement draft | Confirm actual providers/plans/roles; obtain applicable written security agreements, customer acceptance where required, and subprocessor evidence |
| 10 | International transfers | Transfer assessment structure and account-specific evidence checklist; primary provider terms reviewed | Confirm actual destinations/support/subprocessors and binding safeguards; assess and document a permitted section 72 ground for each relevant transfer |

## Verification completed locally

- 89/89 regression, security and database tests passed.
- Exact additive migrations applied to isolated in-memory PostgreSQL (PGlite): existing rows, constraints, rollback, holds and scoped cascades checked.
- TypeScript, ESLint, Prisma validation and production build passed. Build-only local font mocks were used because Google font fetching is unavailable in this environment; production font configuration was preserved.
- Local production-server HTTP smoke checks cover unauthenticated access, foreign-origin rejection, maintenance fail-closed behaviour, private cache headers and public notice/PAIA routes.
- No test connects to production providers or uses real user documents. Tests using boundary doubles do not establish actual provider configuration. Native multi-session concurrency, live two-account UI and provider integration remain gates.

## Required facts and access

1. Confirm NovaQuill's legal operator: registered company (exact legal name and registration number) or sole proprietor. Artobyte ownership does not establish that it is the contracting entity.
2. Confirm the privacy contact, authorised public business address and Information Officer. Do not publish a remembered personal address as company information without confirmation. Supply the genuine officer registration reference when registered; do not invent one.
3. Grant the existing Vercel connection access to `dons-projects-5c448127` / `team_8rp65v9cdqQLvJuG1OA7AKjb`, project `prj_iPaCVakcjepMGi4ePN4K2nFhWJ4w`. Project/env-metadata reads returned 403. The suggested team-authorisation capability is not exposed in this session. Do not paste secrets or reconnect as a workaround.
4. Obtain actual database/Redis identities, regions, provider contracts, backups/security evidence and relevant billing schedule. The provider register contains the prepared questions; none have been sent.
5. The authorised owner/officer must approve factual policies/agreements and complete genuine appointments, registrations and exercises. Draft documents do not appoint an officer or execute a contract.
6. Obtain explicit release/main authorisation only after the change and evidence are reviewable. Apply migrations/configuration, deploy, then verify live results. No production closure can be asserted while production remains unchanged.

## How to record closure

Use `npm run compliance:check` in a restricted environment with approved configuration. Populate `compliance/evidence.json` only with references to real restricted evidence, the actual reviewer's name/reference and actual review date; never commit secrets, private contracts, ID scans or user records. The checker currently rejects absent facts/evidence. It validates structure/configuration, not truth, contractual enforceability or legal sufficiency. A passing result means ready for human sign-off, not certified compliance.

Supporting records: REVIEW.md, OPERATIONS.md, PROCESSING_REGISTER.md, PAIA_MANUAL.md, OPERATOR_AGREEMENT.md, PROVIDER_AND_TRANSFER_REGISTER.md, RETENTION_AND_INCIDENT_RECORDS.md.

## 30 October policy additions

See POLICY_ADAPTATION_REVIEW.md for the original NovaQuill terms, subscription/refund and browser-storage additions following comparison with Smallpdf's legal documents. Expanded EN/PT policies and links are prepared locally. Cancellation operations, immediate downgrade/paid-through treatment, complete supplier disclosures and agreement acceptance remain release checks; no code or policy change is evidence that these operations have occurred.

## Policy-review follow-up

POLICY_GAP_FIXES_20261030.md records cancellation/paid-period enforcement, public encrypted billing requests, specific shared retention limits, initial-HTML privacy text and expanded PAIA procedures. These changes do not complete the absent company/officer/provider evidence. All ten still require the genuine evidence/sign-off described above. Retention job execution and actual payment-provider account integration must be verified separately from local tests.

## Operator identity supplied — 1 November 2026

The user confirmed that NovaQuill is an Artobyte product and supplied its COR14.3. OPERATOR_IDENTITY_VERIFICATION.md records the verified public corporate particulars and business contacts, now used consistently by the public policies. Prior entries requesting the legal entity/name/number/office/contact are superseded by that record. Information Officer confirmation/registration and the separate provider/operational evidence remain outstanding; those are not established by a company certificate.

## Policy improvements — 1 November 2026 follow-up

POLICY_IMPROVEMENTS_20261101.md records bilingual refund/retention and PAIA improvements, preserved storage/support entitlements, explicit account acceptance with an additive migration and readable version archive. This follow-up is prepared on `improvements/legal-policies-20261101`; no main merge, deployment or production migration has occurred. Existing/OAuth acceptance is offered through a nonblocking notice and is not inferred. Provider/officer/contract/backup evidence and production verification remain outstanding. Historical deployment statements above describe earlier work and do not prove current production state.
