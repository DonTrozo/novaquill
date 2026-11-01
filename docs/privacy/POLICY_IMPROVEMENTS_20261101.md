# Policy improvements — 1 November 2026

Prepared on `improvements/legal-policies-20261101`, based on main commit `3d6754d52a69c8bd04471f0baec64ef5badf850a`. No main merge, production configuration change, migration or deployment is performed by this work.

## Result

- English and Portuguese refund wording now describes the same written-outcome process, internal response target and escalation, applicable ECTA seven-day service cooling-off and 30-day refund period, and the need for actual consent/service commencement before relying on the statutory exception. Targets and bank posting estimates never extend statutory obligations.
- Storage/support descriptions preserve existing plan entitlements: no new storage cap; technical file limits remain; no invented permanent-archive, 24-hour staffing or response-time guarantee. Urgent legal/security work is not subordinated to paid support.
- Public PAIA instructions include direct email/registered-office delivery, the section 10 guide description, confirmed company registration and relevant record frameworks, plus data-subject/information categories. Unverified finance/personnel holdings are conditional, not invented.
- Password registration requires explicit current-version acceptance. The database records the version and server time in the same create as the account. Two nullable fields and a paired-value constraint preserve existing records without fabricating historical acceptance.
- Existing and OAuth accounts receive a nonblocking review notice. Only an explicit button press records agreement; sign-in, continued use and policy publication do not. The notice is not an editor/download access control or evidence of acceptance by everyone. No subscription mandate or marketing consent is created by it. OAuth users receive policy links before continuing.
- The account-scoped acceptance endpoint checks origin, authentication, current version, body size and rate limit. Idempotent writes retain the first server timestamp for the current version. Database errors are not reported as success. Account exports include current acceptance evidence; account deletion removes these user fields through the existing deletion flow.
- Version `2026-11-01.1` has an exact bilingual JSON snapshot in `docs/privacy/versions/` and a readable, printable public HTML copy in `public/legal/`. Do not alter a published archive; publish a new version and keep older archives. The snapshot contains contractual terms/subscriptions/browser-storage wording, not an assertion that unresolved provider/officer facts were verified.
- Privacy wording now includes acceptance records, their account lifetime and separate payment-provider/backup handling. Unknown backup retention remains explicitly unknown rather than receiving an invented statutory number.

## Outstanding factual work

1. Confirm the Information Officer's authority/contact particulars and genuine registration. Corporate evidence does not prove this.
2. The Vercel project-details read still returned 403 for the known project/team. Authorize the existing connection for that team, then inspect actual account configuration. Do not paste credentials or use another team's settings.
3. Confirm actual database/Redis suppliers, enabled services and processing/support/backup destinations; establish applicable written operator agreements and section 72 grounds, including onward recipients.
4. Complete and agree the customer processing schedules with actual parties; the current processing agreement remains a draft. Account acceptance does not automatically execute that separate draft.
5. Approve actual accounting/payment and backup retention schedules, deletion/restore handling and monitored request channels. Complete the company-wide PAIA inventory, officer approval and required availability arrangements.
6. Apply the additive migration before deploying this release. Verify real password/OAuth accounts, export/deletion, billing and retention jobs against the authorised deployment. Test results do not establish production configuration or legal compliance.

## Verification

- 113 tests passed, including actual route-source boundary tests for strict acceptance, forged user/time input, stale versions/accounts, replays, rate limits, malformed/oversized requests and database failures; exact contractual snapshot comparison; and the additive SQL migration on pre-existing records in isolated PGlite PostgreSQL.
- TypeScript, ESLint, Prisma schema validation and `git diff --check` passed.
- The normal production build cannot fetch Google Fonts from this environment. Production build passes with local font CSS mocks; no production font or dependency setting was changed.
- Real local production-server HTTP checks passed for registration, terms, subscription/refund policy, PAIA, pricing and the readable archive; Portuguese initial HTML; unauthenticated 401 and foreign-origin 403 acceptance responses with private/no-store headers.
- Full browser verification could not run: no installed Chromium and the browser download failed. No visual or live OAuth/payment/provider end-to-end verification is claimed.

## Sources checked

- POPIA: https://www.justice.gov.za/legislation/acts/2013-004.pdf (sections 18, 21, 22, 55 and 72).
- Information Regulator private-body manual template: https://inforegulator.org.za/wp-content/uploads/2020/07/PAIA-Manual-Template-Private-Body.pdf.
- ECTA: https://www.gov.za/documents/electronic-communications-and-transactions-act and consolidated text linked by that government page: https://www.saflii.org/za/legis/consol_act/ecata2002427/ (sections 42 and 44; consolidated extract retrieved in search; full-page retrieval failed).

This record does not close the ten compliance requirements, appoint/register an officer, execute agreements, send correspondence or certify compliance.

## Owner-authorised Vercel follow-up

The earlier Vercel access blocker is resolved. VERCEL_VERIFICATION_20261101.md supersedes that pending access item and records new read-only account/live endpoint evidence, remaining configuration gaps and corrected runtime-aware public disclosures. No production settings or disposal jobs were changed.
