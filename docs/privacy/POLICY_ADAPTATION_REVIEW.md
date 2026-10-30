# NovaQuill policy additions — 30 October 2026

Prepared locally on `security/popia-safeguards-20261022`. No push or deployment. User instruction: preserve existing application behaviour; do not refactor or push to main. This change adds policy content and links only; it does not add subscription operations, alter payment mandates or execute contracts.

## Primary comparison sources

Reviewed Smallpdf's current Terms and Conditions (January 2026 version), Privacy Notice and Data Processing Agreement:

- https://smallpdf.com/terms
- https://smallpdf.com/privacy
- https://smallpdf.com/dpa

Smallpdf's terms identify content rights, account duties, prohibited conduct, recurring charges, service limitations and contract termination. Its privacy notice separates account, payment, technical and file processing, browser technologies and rights. Its DPA describes the customer/processor relationship and documented instructions. These are comparison topics only: no Smallpdf wording, corporate facts, certifications or contract terms are incorporated into NovaQuill's documents.

NovaQuill's substantive provisions were drafted independently from its source behaviour and South African statutory requirements. The documents retain user rights rather than importing broad liability waivers, a Swiss monetary cap or foreign dispute restrictions.

## Added to the app

| Location | NovaQuill-specific additions |
| --- | --- |
| `/terms` | Twelve sections: actual scope, authority/account security, document rights, deliberate signing and legal limitations, reviewing/keeping PDFs, misuse, free/paid plans, software/providers, proportionate restrictions, care/remedies, changes and complaints |
| `/subscription-policy` | Five sections: EUR reference/ZAR checkout, annual billing, indefinite recurring mandate, initial fixed rand recurring amount, manual cancellation contact process, downgrade behaviour, refund assessment and preserved statutory rights |
| `/cookies` | Four sections: sign-in cookies/up-to-90-day session, actual IndexedDB draft/lazy expiry, aggregate event counters versus network metadata, browser controls versus cloud deletion/billing |
| `/privacy` | Ten sections total, including optional/required fields, OAuth sources, consent withdrawal, restricted personnel access/disclosure, technical metadata, children/special information, incidents and updates |
| Pricing and registration | Readable policy links/disclosures without a new checkbox, redirect, sign-in step or charge |
| Customer operator agreement | Clarified actual service boundary, documented instructions/change control, no unrelated secondary use, assurance confidentiality and execution conditions |

English and Portuguese policy text is supplied. The new policy pages render from the browser's request language through the existing locale mechanism. Draft version dates are not represented as a past effective date or proof of acceptance. No signed acceptance/version audit was added.

## Verified application behaviour used in drafting

- Free allowance: three completed documents per UTC calendar month. No paid free-trial conversion is implemented.
- Pricing: reference EUR 9/month or EUR 90/year; PayFast checkout converts once to ZAR and uses that amount for the recurring mandate. FX has a cached/live rate and fallback; it is not a guaranteed spot exchange rate. Checkout amount must be checked.
- Checkout: monthly/annual recurring authority with `cycles: 0`. No automatic exchange-rate repricing logic is implemented for renewals.
- No cancellation button/API or payment-provider cancellation call exists. Account deletion currently does not revoke a PayFast mandate.
- Cancellation/failed-payment ITN can set an account to FREE immediately. No paid-through date/end-of-period entitlement system exists. Policy text discloses this and preserves correction/remedies; it does not declare that an implementation shortfall is lawful.
- Existing document GET/DELETE checks owner authentication, not Pro status. Downgrade itself does not delete documents.
- Reusable signatures require explicit save choice and deliberate placement. Removing the reusable image does not rewrite completed PDFs.
- Browser draft includes document content and editor state; expiry is checked on next load, not by a background deletion promise. Browser draft encryption is not claimed.
- Aggregate action counters exclude document text/filenames. IP-based request/abuse processing means no blanket claim of anonymous platform logs.

## Release blockers and operational commitments

These are **not resolved by publishing words**:

1. Confirm legal provider, service/privacy contact, address, appropriate telephone, company registration/place/office-bearer disclosures where applicable, Information Officer and actual notice details. Existing privacy environment configuration does not cover every ECTA supplier disclosure. The policy pages show a preparation warning when configured company fields are absent.
2. Establish a monitored cancellation/refund contact channel. Before offering the prepared manual cancellation procedure publicly, assign staff who can stop the actual PayFast mandate, acknowledge/record the request, reconcile submitted debits and issue applicable refunds. The existing privacy-request form is for privacy requests, not a substitute billing queue. Do not falsely advertise in-app cancellation.
3. Verify paid-through rights and cancellation/failed-payment handling with actual provider/account evidence. Correct the immediate-downgrade shortfall or operate a documented, tested manual entitlement/remedy procedure before promising a complete cancellation service. This policy-only change does not alter payment logic.
4. Verify checkout total/tax disclosure, currency, mandate interval, service-provider information, ability to review/correct the transaction and valid agreement/mandate acceptance. A link on pricing/registration does not prove acceptance of a specific terms version.
5. Confirm provider destinations, actual contracts, backup/disposal arrangements and approved retention schedule. Replace remaining draft qualifications with verified customer-facing facts before release approval. Public notices and internal operating instructions must remain distinguishable.
6. Obtain owner/officer approval of the service, complaint, proportionate refund and discontinuation commitments and operational capacity to fulfil them. No blanket no-refund rule, new cancellation charge, unsupported accreditation or silent mandate increase was introduced.
7. Test provider and two-account browser flows and perform an explicitly authorised production release. The previous no-main-push instruction remains in force. Current production remains unchanged.

The existing compliance check evaluates configured fields/evidence references; it does not mechanically test all policy content, billings or operational promises. Keep these release blockers alongside CLOSURE_STATUS.md. Passing source tests is not executed agreement, officer registration or compliance certification.

## Legal sources checked

- ECTA (sections 13, 42–44, 48 and Schedule 2): https://www.gov.za/sites/default/files/gcis_document/201409/a25-02.pdf
- Consumer Protection Act (including sections 48–51, as applicable): https://www.gov.za/sites/default/files/gcis_document/201409/321864670.pdf
- POPIA (including sections 11, 14, 18–24, 26–35 and 72): https://www.justice.gov.za/legislation/acts/2013-004.pdf
- Information Regulator published guidance/manual templates: https://inforegulator.org.za/paia/

No assumption is made that an ordinary website visit waives statutory rights, that every cooling-off exception applies, or that a customer must accept foreign arbitration to complain.

## Verification of this change

- 89/89 existing regression, security and database tests passed. The public-notice test now expects the ten documented sections; no production test records were used.
- Production build, TypeScript, ESLint and whitespace checks passed. The build used the existing local font mock; production font configuration is unchanged.
- Nine isolated production-server HTTP checks passed: visible EN/PT policy content (excluding framework script payloads), consistent legal navigation, draft/company warning, ten-section versioned notice API, pricing policy link and registration terms link.
- React review: new policy content renders on the server using the existing request locale, stable section IDs, semantic heading/navigation structure and wrapping links. No new dependency, fetch waterfall, client effect or payment/editor state change was introduced by the policy-page renderer.
- No live provider, billing cancellation, refund, acceptance or production-policy publication was tested or performed. Those remain the release checks above.
