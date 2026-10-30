# Privacy operations and release runbook

This branch is not deployed. Do not run production commands until the owner explicitly authorises release.

## Before a release is authorised

1. Confirm the company identity/privacy contact and complete the publication drafts.
2. Name an Information Officer and rights-request/incident owners; arrange the required registration.
3. Record each provider, processing purpose, categories, location, subprocessors, access roles, retention, contractual safeguards, cross-border transfer ground and backup/restore evidence.
4. Review the additive migration `20261022190000_add_privacy_safeguards`. It creates only `SecurityEvent` and `PrivacyRequest`; it does not modify or delete existing documents/signatures. Apply it first to an isolated test database with test credentials. Regenerate Prisma Client.
5. Test two distinct accounts, saved-signature consent, download, legacy/new Cloudinary delivery, delete retry, export, privacy requests and row-lock behaviour under concurrent upload/account deletion. Verify actual no-store headers on success and error responses. Confirm the editor behaves as before.
6. Set a strong CRON_SECRET (at least 32 characters), approved SECURITY_LOG_RETENTION_DAYS and PRIVACY_REQUEST_RETENTION_DAYS (positive whole days), configure Redis and an approved external scheduler. No values have been set by this work.
7. Arrange restricted staff access to the request queue and daily review. Configure operational alarms for failed cleanup/retention and database errors. Review platform logs for sensitive payloads and suitable retention.
8. Only after approval: back up and verify recovery; apply the additive database migration before exposing the new code. Deploy the reviewed branch through the normal reviewed release. No production commands have been run.

## Rights requests

Registered users can use Dashboard → Advanced account controls → Privacy request. Self-service account export and deletion continue to exist. People without accounts, and people whose data appears in somebody else's document, need the confirmed public privacy contact. Do not disclose customer documents just because a requester knows a filename or person’s name.

Use a restricted operational environment with authorised database credentials and the encryption key. Never paste credentials, decrypted requests or document contents into build logs or public tickets. The tool does not load environment files automatically; provision credentials securely through the operational environment. Never run it against production merely to test it.

```bash
node --experimental-strip-types scripts/privacy-requests.mjs list
node --experimental-strip-types scripts/privacy-requests.mjs read --id REQUEST_ID
```

`list` shows open request IDs/types/dates only. `read` intentionally decrypts the selected request and shows the account contact to an authorised operator. Keep its output private.

For each request:

- Acknowledge receipt and preserve the reference/date. Verify identity proportionately; request no unnecessary additional ID documents.
- Determine NovaQuill's role. If acting as operator, assist the customer responsible party under its instructions. Apply any lawful restriction or independent retention basis individually and record reasons.
- Provide access/correction/deletion or a reasoned outcome as soon as reasonably practicable. Track an internal 30-day response target and escalate unresolved requests. Objections are not marketing consent.
- Send the written outcome through the confirmed channel. This script does not send it. Retain a minimal email/ticket reference, actual notification time and concise outcome, then close the request:

```bash
node --experimental-strip-types scripts/privacy-requests.mjs close --id REQUEST_ID --outcome-file PRIVATE_OUTCOME_FILE --notification-reference MESSAGE_OR_TICKET_ID --notified-at ACTUAL_ISO_TIMESTAMP
```

The outcome file/reference are stored encrypted. Do not include authentication secrets or whole documents. The script records a staff attestation of notification evidence; it cannot verify that a message was delivered. Delete the local outcome file using the organisation's approved workstation procedure. A closed request/outcome is included in the account's personal-data export.

## Retention

GET `/api/internal/privacy-retention` accepts only an exact Bearer CRON_SECRET. Without the secret/approved periods it refuses to operate. The scheduler must keep the secret out of URLs and logs. It returns counts only.

It removes expired `SecurityEvent` rows and CLOSED requests with sufficiently old `resolvedAt`. OPEN requests, users, saved signatures, signed PDFs and billing records are not age-deleted. Set periods in the approved processing/retention schedule; do not confuse example operational periods with statutory requirements. Successful runs and failures must be monitored by the operations owner. No scheduler is enabled in this branch.

Signing drafts in the browser expire on the next app load after 24 hours; no background browser deletion is promised. Account deletion clears owned cloud documents/signatures/requests and requests browser cleanup. It does not automatically cancel an external payment subscription or prove removal of provider backups. Billing retention, subscription cancellation and restoration controls need a documented separate procedure; the existing cancellation flow has not been altered.

## Breach response

1. Assign the incident owner immediately. Restrict compromised access, preserve minimal evidence and record discovery, affected systems/data, containment and decisions. Do not wipe evidence indiscriminately.
2. Determine the responsible-party/operator roles. As operator, immediately notify the affected responsible party under the contract.
3. Where there are reasonable grounds to believe personal information was accessed/acquired by an unauthorised person, follow POPIA section 22. Do not invent a universal 72-hour deadline or assume a low-risk exemption. Assess notification as soon as reasonably possible, including the statutory conditions.
4. The responsible party reports through the Information Regulator eServices portal and notifies affected data subjects as applicable. Do not wait for the whole investigation to finish merely to defer notification.
5. Keep the report reference, notification evidence, investigation findings, mitigations and follow-up risk assessment in restricted incident records with an approved retention basis. Test the process with a tabletop exercise.

Portal: https://eservices.inforegulator.org.za/

## Evidence and rollback

The change does not introduce accredited signatures, a WORM audit store or forensic signing certificates. Limit ordinary database credentials to necessary operations and restrict privileged access. If a code rollback is necessary, leave the additive tables in place until evidence is reviewed. Previously deployed code does not know the new authenticated Cloudinary prefix; restore a compatible reader before allowing a rollback to serve documents stored by this branch. Never change the encryption key as a quick rollback step.

## Additional closure work, 22 October 2026

- `/privacy` now includes a public encrypted rights-request channel. No account is required. Public submissions must include a contact email; identity must be checked before a disclosure/change. Public GET access to requests remains forbidden. Contact data is encrypted. Treat anonymous requests about customer documents as unverified until the responsible party/identity is established.
- Public privacy and PAIA pages are prepared. Set the real PRIVACY_* company fields before approval. The endpoint returns only an explicit public allowlist; credentials and private registration evidence are excluded. The full source drafts/registers accompany the pages. Do not treat a configured name alone as legal approval.
- A second forward-only migration, `20261022193000_public_privacy_requests_and_holds`, adds nullable account association, encrypted contact and operational retention holds. The original review migration is preserved unchanged.
- `vercel.json` prepares a daily protected retention invocation. It is not active while the branch is undeployed. Configure CRON_SECRET and the approved periods in the actual production scope after release approval. Confirm the first successful run and its monitoring.
- `npm run compliance:check` rejects incomplete company/runtime configuration and missing actual evidence references. It is a completeness check for officer review, not a legal certificate. It must remain OPEN while actual approvals/provider tests/registration/release evidence are absent. Never fill the file with fictitious approvals just to make it pass.
- Database tests use an in-memory PostgreSQL WASM engine with the exact forward SQL migrations, never a production URL. Multi-session native PostgreSQL locking, live providers and actual browser flows remain separate release checks.

### Operational holds and protected case records

Use a verified PRIVACY_OPERATOR_REFERENCE in the authorised operations environment. Record the justification, legal basis, operator, case reference, scope and next review in a restricted case record before placing a hold. Do not retain records merely because a hold is technically available.

```bash
node --experimental-strip-types scripts/privacy-requests.mjs holds
node --experimental-strip-types scripts/privacy-requests.mjs hold --resource request --id REQUEST_ID --case-reference CASE_REFERENCE
node --experimental-strip-types scripts/privacy-requests.mjs release-hold --resource request --id REQUEST_ID --case-reference CASE_REFERENCE
```

Use `--resource event` for a security event. Scheduled cleanup excludes held events/requests. Account deletion detaches held request records and preserves specifically held operational events, while ordinary account-owned records are removed. The separate restricted case record must explain any surviving personal information and must be reviewed/disposed when no longer justified. Operational holds do not create an archive/hold for arbitrary PDF copies outside these tables; preserve required case evidence under the applicable authority before its disposal.

### Hosting-access blocker

The connected Vercel service can list NovaQuill but returns 403 for project/environment metadata under team `dons-projects-5c448127`. No decryption was requested. The tool's proposed scope-authorisation capability is unavailable in this session. Grant the existing connection access to that team before attempting provider/region/backup configuration verification. Do not use a different scope or request secret values in chat.

## Main release authorised — 30 October 2026

The owner explicitly requested all updates be pushed to main. The updates are replayed on the freshly fetched remote main without rewriting remote history. Earlier statements that the branch is unpublished describe the preparation state, not a continuing prohibition after this authorisation. This authorisation does not supply missing company/provider facts or establish full compliance.

Vercel's repository build command now runs `npx prisma migrate deploy && npm run build`. This applies committed migrations to the configured deployment database before the new application can finish building. An unavailable direct database connection, unbaselined schema or failed migration stops the build rather than publishing routes against missing privacy tables. Never use reset, db push or a fabricated migration baseline to bypass a failure. Review the actual history/backup and resolve it deliberately. The new privacy migrations are additive; retain the existing encryption key and old object reader.

No production credentials are loaded into this workspace. Actual migration/deployment results must be verified through the owning Vercel team. Team access currently returns 403; a scope-consent link has been requested through the existing connection. Legal company/contact facts, operational approvals and cancellation/retention/provider evidence remain outstanding independently of the Git push.
