# Vercel account verification — 1 November 2026

Read-only review after the owner authorised the existing connection for the known NovaQuill team. This supersedes the earlier Vercel 403 access blocker; it does not close any contract, registration or operational requirement.

## Confirmed

- Project: NovaQuill; Next.js; Node 24.x; the known owner's team.
- Latest production deployment inspected: `dpl_GGgyd6UxXGbit7xqt1jpcT4MDYTx`, READY, target production, main commit `3d6754d52a69c8bd04471f0baec64ef5badf850a`. Its aliases include `www.novaquill.co.za`. The policy improvements in PR #9 remain on a separate branch.
- The production deployment reports server-function region `iad1` (US East). This is evidence of foreign application processing, not proof of the database, logs, backups, support or every onward processing location.
- Vercel Authentication protection is enabled for deployments other than custom domains. This protects deployment access; it does not replace application account checks.
- The project environment-variable metadata lists production/preview keys for application origins/URLs, authentication, storage encryption, Google sign-in and database connections. Key presence alone does not prove a credential is correct, integrations work or required contracts exist.
- The metadata list contains no Cloudinary, Redis, PayFast, CRON_SECRET or Information Officer keys. `hiddenProductionEnvCount` is zero. A project metadata list is a configuration snapshot, not an independent account-level integration or runtime-flow test.
- Several credential-variable metadata entries are marked `visibility: config` and flagged `readable-secret`; the same entries target preview and production. Review Secret visibility and separate preview credentials before integration testing. This is configuration evidence, not evidence of disclosure or misuse; no secret visibility/type/value was changed.
- The project-view integration configuration list is empty. This does not prove external providers are absent: manually configured services can exist outside that integration list.
- A read-only request to `https://www.novaquill.co.za/api/internal/privacy-retention` returned HTTP 503, `Maintenance not configured`. The source returns this before any deletions when the maintenance secret is missing/invalid. The live automatic cleanup handler is not operational in this check.
- The public privacy-notice endpoint returned HTTP 200, version `2026-11-01`, `configured: false`, and intended defaults of 90 days for security records and 365 days after closing privacy/billing requests. Those numbers are not evidence of actual deletion while maintenance is unconfigured.

Official region mapping: https://vercel.com/docs/regions identifies `iad1` as Washington, D.C., USA.

## Not established

- The team-details response does not establish its billing plan, signed/applicable DPA, contracting entity or account-wide MFA.
- The database vendor and storage region could not be established from the available metadata. A narrowly scoped database-variable read did not produce a usable connection URL for host identification. No connection credentials or raw variable values are reproduced here, written to local environment files, or supplied to third parties.
- Cloudinary account/region/contract, Redis service/region, payment merchant agreement, backups, restore/disposal schedule, actual OAuth/provider behaviour and processing-contract coverage remain unverified.
- The officer's identity/registration and actual monitored request/incident handling still need owner evidence.

## Changes prepared on PR #9

The privacy notice now derives service availability descriptions from the runtime configuration without returning keys or credentials. It distinguishes inactive Cloudinary/Redis/checkout from configured settings, and intended retention from actual scheduler configuration. Even configured settings are not described as proof of successful execution. The Pro-storage and PAIA descriptions no longer assert that an unconfigured Cloudinary service stores documents. Privacy revision: `2026-11-01.2`; contractual archive/acceptance revision remains `2026-11-01.1`.

No main merge, deployment, environment mutation, key rotation, subscription activation, production migration or deletion job was performed. Do not enable disposal until the actual schedule, holds and monitoring have been approved and operational safeguards verified. Supply/verify actual provider credentials and agreements before representing cloud storage or checkout as operational.

## Verification of this follow-up

115 local tests pass, including inactive/partial/complete runtime-configuration disclosures and non-disclosure of test secrets. TypeScript, ESLint and diff checks pass. These tests and account metadata do not prove production provider integration or POPIA compliance.
