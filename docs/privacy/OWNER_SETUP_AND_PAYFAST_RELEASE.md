# NovaQuill: owner setup and PayFast review release

1 November 2026. Owner confirmed PayFast verification pending, no Cloudinary/Redis accounts yet and Information Officer not registered. This supersedes treating pending merchant verification as a malfunctioning active payment integration. Nothing here asserts that accounts or a registration already exist.

## PayFast deliverable and checkout

Contractual revision `2026-11-01.2` adds pending-payment status, digital delivery/activation, transaction-reference handling, customer support, domicile, lawful cross-border availability and hosted-payment security/method disclosures. The checkout page displays the signed rand amount and recurring interval alongside the full purchase, cancellation and refund wording, with an initially unchecked required acknowledgement. The checkbox is a browser acknowledgement; it is not a new server-stored record of a completed purchase. Terms acceptance alone does not waive cooling-off rights. Existing signing/editing behaviour and provider transaction fields are preserved.

The policy review PDF combines Terms, Subscription/Cancellation/Refunds, Privacy, Cookies/Storage and PAIA with the same prepared source text. It is a review copy, not evidence that pending changes are live or that PayFast/POPIA approval exists. PayFast's published merchant terms section 1.4 calls for an affirmative refund-policy acknowledgement and purchase terms in the checkout sequence rather than only an external link: https://payfast.io/legal/general-terms-conditions/.

Live checkout additionally requires `PAYFAST_PAYMENTS_ENABLED=true`. Leave it unset/false until actual merchant approval, the pending-availability notice is updated in a fresh contractual revision, credentials and required paid-service storage are configured, and the verified payment/cancel/refund flow passes. Sandbox remains available for authorised synthetic tests; no real payment was initiated.

## Information Officer registration

Use https://eservices.inforegulator.org.za/services.aspx and Information Officers. Owner-side registration/login, identity/authority details and the genuine final confirmation remain necessary. Known public fields:

| Field | Prepared value |
| --- | --- |
| Legal entity | ARTOBYTE, South African private company |
| Registration | 2024/359197/07 |
| Registered office/postal address | 8 Malgas Street, Birch Acres, Kempton Park, Gauteng, 1618, South Africa |
| Director in supplied certificate | Trozo Joel Antonio |
| Business email and telephone | info@artobyte.com; +27 68 497 1592 |
| Product/website | NovaQuill; https://www.novaquill.co.za |
| Officer registration/reference | Not yet completed; do not invent a number or a signature |

The director's published name is not proof of officer registration. Confirm the actual statutory head/authorised officer and appropriate contact when completing the official form. Keep private ID/identity-verification records out of public policies and Git. After genuine registration, configure approved public officer particulars and preserve registration evidence privately.

## New provider accounts

- Create the owner's Cloudinary account through the official sign-up route: https://cloudinary.com/users/register_free. Confirm contractual coverage, authenticated raw private storage, storage/support/backup locations and disposal before production use. Add the actual cloud name/API key/secret through the provider/Vercel secure settings, not chat or Git. Test with synthetic PDFs only until scope and safeguards are verified.
- Create an owner-controlled TLS Redis service, for example through https://console.upstash.com/ (service selection/plan and terms require the owner account). The current code expects an ioredis-compatible `rediss://` connection, not only a REST endpoint. Confirm TCP compatibility, region, credentials, operator terms and expiry behaviour before configuring `REDIS_URL`; verify distributed limits across instances.
- The current database supplier remains unidentified by available metadata. Obtain its provider-console identity and actual primary/backup/support regions, applicable agreement, TLS/access controls and backup/restore settings. Do not infer Supabase from repository skill files.
- Separate preview credentials/data from production before live integration tests. Review Config/readable-secret metadata for server credentials. No secret value, secret visibility or account plan has been changed.

## Exact retention proposal - awaiting explicit approval

Proposed settings: `SECURITY_LOG_RETENTION_DAYS=90`; `PRIVACY_REQUEST_RETENTION_DAYS=365`; a fresh production-only sensitive `CRON_SECRET`. The job's existing daily schedule is 02:17 UTC (04:17 South Africa). It deletes routine security events older than 90 days and CLOSED privacy/billing requests more than 365 days after closure, excluding recorded holds. It does not delete customer PDFs, signatures, accounts, contracts or open cases.

Automatic approval review rejected creation of those production settings because the exact schedule/secret could enable irreversible cleanup after a future deployment. No production settings were created. This is now an explicit owner approval item; no alternate route was used. Once approved, create the settings, release through an authorised deployment, first review eligible record counts and holds, and record a controlled run and monitoring result. Defaults in source are not statutory periods or proof that deletion is running.

## Handling requests and incidents

The published intake routes and business contact exist, but actual staffing/monitoring must be established. The owner should assign an operational reviewer (separate from claiming a registered officer), review open privacy/billing cases each business day, prioritise imminent recurring debits and suspected compromises, and record proportional identity checks, decisions and actual written notifications with the existing tooling. Rehearse one synthetic rights case and incident tabletop. No email was sent, no staff member was represented as having accepted duties, and no notification or completed exercise was fabricated.

## Release and remaining checks

- Obtain explicit main/release approval; the standing no-main restriction remains. Apply migration via the configured deployment build before running acceptance-dependent routes. Do not activate live payments merely to submit policies for merchant review.
- Confirm database backup/restore and provider contract/transfer evidence; complete customer processing schedules with actual parties, not automatic acceptance of an unfinished draft.
- Test password and OAuth accounts, two-account file boundaries, saved signatures, export/deletion, public request handling, storage and sandbox payment/cancellation/refund flows. Check real initial EN/PT HTML and readable archives after release.
- Update final public policies and the PDF when pending facts change, so the merchant copy and published pages agree. PayFast may require live website links as well as a copy; a PDF is not a substitute for that publication.
