# NovaQuill processing register and lawful-basis assessment

Service: https://www.novaquill.co.za. Prepared 22 October 2026. The operating legal entity, Information Officer and corporate approval must be supplied before publication/sign-off. This register describes the code on the security branch, not a claim that it is deployed.

## Processing inventory

| Activity | Information necessary | Role and purpose | Proposed lawful ground / instruction | Retention and access |
| --- | --- | --- | --- | --- |
| Account registration/login | Optional name, email, password hash or OAuth account identifier; session subject | NovaQuill responsible party; provide and secure requested account | POPIA 11(1)(b), requested service/contract; security assessment below | Account duration, deletion controls; owner-only application access; restricted infrastructure admins |
| Local PDF editing/signing | User-selected PDF, entered text, handwriting/position/zoom | Customer determines document purpose; browser processing supports requested service | Customer must have a lawful basis and authority for third-party information; operator instructions where applicable | Browser memory; temporary sign-in draft; no content added to analytics |
| Sign-in draft preservation | PDF and editor state, account association, save time | Preserve requested work across authentication | Necessary requested service, bounded purpose | Existing 24-hour expiry checked on next load; clears on observed logout/account change, new selection or completed download; not independently encrypted |
| Cloud signed-PDF storage | Final PDF, account ID, filename, size/storage reference | Operator for customer documents; service administration where applicable | Customer's documented storage instruction/service contract | Owner access and deletion; no arbitrary age purge of agreements; provider backups assessed separately |
| Optional reusable handwriting | Signature image/name, account ID, creation time | Requested reusable signature storage | Explicit storage choice under 11(1)(a); separate from applying it | Encrypted payload; user may remove it without modifying old agreements |
| Subscription/payment administration | User/payment reference, plan, amount and status | NovaQuill responsible party; requested payment/subscription | Contract/service administration; specific statutory finance duties to be confirmed for legal entity | Minimal application records; finance schedule/holds require actual company review |
| Abuse prevention and usage | Account ID, monthly count; short-lived rate-limit keys derived from account/IP | NovaQuill responsible party; prevent unauthorised use and enforce service allowance | Proposed legitimate interests under 11(1)(f), balancing assessment below | Rate-limit windows; operational logs under configured period; platform logs separately controlled |
| Aggregate analytics | Fixed event name and count only | Service operation; no personal text accepted as event names | Minimal non-identifying counters; assess any provider request metadata separately | Aggregate counters; do not attach document contents, emails or signature images |
| Security evidence | Account/resource ID, fixed action, server time, stored-document fingerprint | NovaQuill responsible party; security investigation and accountability | Proposed legitimate interest and relevant legal security duties | Configured operational period; documented hold where justified; restricted access |
| Privacy requests/outcomes | Contact email where supplied, request text, identity-assessment record, outcome and notification reference | NovaQuill responsible party for its requests; assist customer when operator | Legal obligation/request handling; collect proportionate identity evidence only | Encrypted request/contact/outcome; closed-request period; holds; public requests need no account |
| Incident response | Minimal incident facts, relevant logs and affected contacts | Role determined for each incident | Statutory duties and necessary investigation; operator/customer instructions | Separate restricted case record and justified hold, reviewed and released when no longer required |

## Legitimate-interest balancing record

Purpose: prevent account compromise, abuse, impersonation, accidental disclosure and service manipulation. These interests protect both users and the service. Necessity: account-scoped checks, limited rate controls and action logs provide protection without recording document contents or introducing another signing step. Less intrusive measures are used where possible: fixed aggregate events, short rate windows and redacted public errors.

Potential impact: account identifiers and operational references can still relate to people; IP-derived rate keys and provider metadata require access/retention restrictions. Mitigation: no content in operational events, restricted admin access, limited purposes, approved cleanup periods, no advertising/training reuse and an accessible objection channel. The officer must assess the deployed provider metadata, actual retention and proportionality, approve the balance and reassess after material changes. An objection is assessed individually; do not automatically deny access to a necessary security control or assume every objection must be refused.

## Higher-risk records

Documents can contain health, identity, children's or other sensitive information. Static signature images are personal information. This app does not use handwriting dynamics to identify a person. Customers must establish the applicable authority/grounds before processing third-party or special information. Do not assume a customer's upload alone establishes legality. Assess intended categories, transfer destination protections and any prior-authorisation issue before approving a provider/use case; unresolved coverage blocks sign-off.

## Further processing and information quality

Use data only for the recorded service/security/legal purposes. A new AI, advertising, profiling, recipient or biometric-identification purpose requires a fresh assessment, lawful basis and notice before introduction. Do not silently repurpose saved handwriting. Users may submit correction requests; verify identity and amend the appropriate records under a documented outcome. A correction request is not permission to alter an executed agreement unilaterally. Preserve provenance and refer customer-controlled documents to the appropriate responsible party.

## Required approval evidence

The officer records the legal entity, version, date, reviewer, purpose/basis decisions, provider inventory, residual risks and next review. Approval is not supplied or fabricated by this document. Review at least annually and on changes of purpose, provider, location, signature-identification technology or material incident.
