# Policy review corrections — 30 October 2026

This follow-up implements the actionable application/document gaps from the review. It does not establish the missing legal operator, register an officer, execute provider contracts or certify compliance. Existing signing/editing screens and the three-document Free allowance are preserved.

## Application changes

- Dashboard: linked subscriptions gain a deliberate Cancel renewal control. The account ID comes from the signed session; no submitted account ID or token is trusted. The server calls the documented PayFast cancellation API and records completion only after provider confirmation. An uncertain response is reconciled against an explicit cancelled state, otherwise the result remains unconfirmed.
- Payment evidence: verified notifications store the subscription token encrypted at rest and a separate lookup hash, not a plaintext token in event records or client responses. Both a local signature check and PayFast server confirmation precede entitlement/token changes. Checkout and REST API signatures use their distinct documented ordering rules.
- Paid-through dates: successful payments establish calendar-month/year periods. Cancellation or failure does not erase a paid period. The quota and Pro cloud-storage checks use that entitlement. Existing dated subscriptions derive the period from their last payment/plan; an undocumented legacy entitlement is not assigned an invented expiry.
- Payment idempotency and updates are one database transaction. A database failure returns a retryable error instead of silently acknowledging lost processing. A late successful debit for the same cancelled mandate does not silently restore renewal. A verified checkout finishing after account deletion has its newly created mandate cancelled and a restricted billing case queued for human review.
- Account deletion: cancels a linked mandate before erasing its credentials. An older recurring payment lacking its provider token is routed to reconciliation before deletion; the free privacy-request channel remains available so cancellation/deletion can be resolved together. Provider failure preserves a retryable account.
- Public `/billing`: free cancellation, refund, payment and security request form, also available without sign-in. Contact and details are encrypted; submissions get receipts. A public claim cannot cancel another person's mandate or acquire an account association. Receipts are explicitly not cancellation/refund confirmations.
- Restricted operations queue: `scripts/billing-requests.mjs` records actual written outcomes, notification references and verified legacy cancellation evidence. It sends no messages and performs no fictional provider action.
- New billing cases are included in the owner's account export. Detached cases retained for response handling are still subject to the request retention limit and justified holds.

## Policy changes

- Subscription terms now describe the actual dashboard control, legacy/public form, preserved prepaid period and confirmed-versus-requested distinction. Missing email addresses no longer make the only billing route unusable.
- Terms route complaints to functioning forms; legal identity gaps remain visible instead of claiming nonexistent contact details are shown above.
- Privacy notice is included in initial HTML, with the same public-only data allowlist. There is no dependency on a successful client fetch just to read the notice.
- Retention defaults and public notice share one bounded configuration: ordinary security events 90 days from creation; closed privacy/billing requests 365 days from closure. Explicit valid configuration can override these. These are service limits, not prescribed universal POPIA periods. Open requests require resolution, not blind age deletion. Specifically justified held records are excluded and need review.
- The protected daily maintenance endpoint now includes eligible closed billing cases. Its secret, actual successful runs, monitoring and provider backup disposal still need production verification. Code and a stated limit are not evidence that a cleanup job actually ran.
- PAIA page now has ten sections, direct Form 2/Form 5/guide/fee links, ordinary decision/extension timeframes, refusal/complaint routes and a free assistance channel. It still identifies unresolved company/provider facts as unresolved.
- Public company configuration additionally accepts telephone, place of registration and office bearers where applicable. No private address, company relationship or officer appointment has been inferred or published.

## Operating the billing queue

Only use a restricted authorised environment with database access, the existing encryption key and PRIVACY_OPERATOR_REFERENCE. Assign staff and monitor the queue daily, prioritising imminent recurring charges and suspected compromises. Keep the internal 30-day outcome target from becoming an excuse to defer shorter legal or urgent duties.

```bash
node --experimental-strip-types scripts/billing-requests.mjs list
node --experimental-strip-types scripts/billing-requests.mjs read --id REQUEST_ID
node --experimental-strip-types scripts/billing-requests.mjs close --id REQUEST_ID --outcome-file PRIVATE_FILE --notification-reference ACTUAL_MESSAGE_REFERENCE --notified-at ACTUAL_ISO_TIMESTAMP
```

For a verified older cancellation already performed in the real PayFast account, add `--cancelled-user VERIFIED_USER_ID --provider-reference ACTUAL_PROVIDER_REFERENCE --identity-reference RESTRICTED_VERIFICATION_REFERENCE` to close. A pre-associated request cannot be assigned to someone else. A public request requires proportionate verification before linking it. Preserve the real evidence in restricted case records; never invent references to get past a check. This records an attestation of actual action, not an API cancellation. Handle refunds through the authorised payment operations channel; this change does not automatically debit or refund a card.

After an independently justified refund/revocation, reconcile both the entitlement date and plan state appropriately; merely changing an enum is not a substitute for the recorded financial outcome. Do not remove a prepaid entitlement without a lawful basis.

## Production prerequisites still open

1. Confirm NovaQuill's legal entity/trading relationship, registration/place/office bearers as applicable, public address/email/telephone and real Information Officer. Existing context and connected sources did not supply NovaQuill-specific confirmation. Do not infer that Artobyte is its legal operator.
2. Supply verified provider names/regions/agreements/transfer safeguards, backup retention and restore/disposal evidence. Do not relabel pending provider facts as a completed section 72 assessment.
3. Grant the existing Vercel connection access to the owning team. It still returned 403 in this task. No production secrets were requested or decrypted.
4. Apply the additive billing migration before new code (the existing Vercel build command performs committed migrations first). Confirm actual PayFast recurring API enablement/passphrase/IP restrictions, test sandbox purchase/ITN/cancellation and account deletion, and verify actual production configuration. Boundary-double tests do not prove merchant-account setup.
5. Configure/verify the retention secret and actual daily job/monitoring. App defaults do not prove a successful scheduled run.
6. Appoint staff to handle requests and send real written outcomes. A database receipt and an unused operations script do not answer a customer's request.

## Primary documentation inspected

- PayFast API: https://developers.payfast.co.za/api#authentication and https://developers.payfast.co.za/api#cancel-a-subscription (including official rendered-source assets)
- PayFast ITN security checks and recurring billing: https://developers.payfast.co.za/docs
- Information Regulator forms, guidance and fees: https://inforegulator.org.za/paia/

No copied Smallpdf clauses, unsupported accreditations or fabricated company/approval details were introduced.

## Verification completed

107/107 tests passed, including real forward-migration checks in isolated PostgreSQL WASM and route/provider-boundary tests for ownership, provider failure, idempotency, prepaid periods, callback verification, account-deletion cancellation and post-deletion checkout reconciliation. TypeScript, lint, Prisma schema validation and production build passed. The build used the existing local font mock; production fonts are unchanged. Fifteen isolated production-server HTTP checks passed, including EN/PT visible text, privacy content before JavaScript, public billing form, retention defaults, authentication and foreign-origin guards. These checks used no production database, documents, payment credentials, real cancellations or refunds. Merchant sandbox/live behaviour and operational staffing remain the prerequisites above.
