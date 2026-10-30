# Operational retention and incident response records

This is a concrete operating proposal for owner/officer approval. It does not invent a statutory lifetime for contracts. Live configuration remains inaccessible; no production cleanup has run.

## Retention schedule

| Category | Proposed limit / disposal trigger | Basis and exception |
| --- | --- | --- |
| Browser sign-in draft | Existing 24-hour expiry on next load; clear after download/new selection/observed logout or account change | Temporary service continuity; no promise of background browser erasure |
| Reusable signature | Until owner removes it or account is deleted | Optional requested use; existing signed documents unchanged |
| Account/cloud PDF | Requested service duration and explicit owner deletion | No arbitrary contract-age purge; separately justified records/holds handled by officer |
| Security events | 90 days for ordinary operational events | Security review window; retain only specifically justified held evidence beyond it, with restricted case records and review |
| Closed privacy requests | 365 days from closure | Demonstrate response/notification handling; justified holds reviewed separately; open requests must be actively resolved, not abandoned |
| Rate-limit keys | Existing minute/hour-limited windows and cleanup | Abuse prevention; confirm Redis TTLs and provider logs |
| Billing records | Company-specific finance schedule | Confirm entity/applicable finance duties and actual provider obligations before age-deleting; future payloads minimise unnecessary fields |
| Provider backups and logs | Actual verified provider schedule | Confirm encryption, access, restore testing, disposal and treatment of previously deleted data on restore |

The 90/365 values in `.env.example` are operational choices for approval, not POPIA-mandated periods. The protected maintenance endpoint refuses missing/invalid periods. Retention holds protect scheduled cleanup; staff must record the legal/incident justification in the restricted case register and review it. A Vercel daily schedule is prepared in `vercel.json`, 02:17 UTC (04:17 South Africa time), with platform timing precision depending on plan. It will not activate before deployment and requires CRON_SECRET plus approved periods. Check actual execution/alarms after authorised deployment.

## Rights request record

Request reference; receipt date/time; contact channel; responsible party/operator role; category/scope; proportionate identity/authority checks; customer referral if applicable; record search; applicable lawful restrictions; action/outcome; date and channel of written notification; delivery/message reference; reviewer; closure time; retention/hold and next review. Keep sensitive evidence restricted. Do not request full ID scans by default or disclose a record based only on an email claim.

## Incident assessment record

Incident reference; detection/discovery time; reporter; affected systems/accounts/categories; evidence of unauthorised access/acquisition; responsible-party/operator role; containment and evidence preservation; known scope/uncertainty; security and communications owners; customer notification time if operator; section 22 decision and reasons; regulator submission reference/time; affected-person notice/channel; lawful delay/exception if any; updates; remediation; restoration safeguards; root cause; residual risks; officer review; retention/hold and next review.

## Prepared notification content (not sent)

Identify the correct responsible party and actual incident. Describe what is known, when it was discovered, categories affected, foreseeable consequences, measures taken/proposed, practical protection steps, contact point and further update arrangements. Do not speculate, conceal uncertainty or include unnecessary personal information. For an operator notice, give the customer the facts needed to meet its own duties immediately. Submit actual regulator notices through https://eservices.inforegulator.org.za/ when the statutory threshold applies. No fictional incident, report reference, recipient notice or notification time has been created.

## Tabletop exercise to complete with the officer

Scenario: a storage credential is exposed and access logs suggest an unauthorised party retrieved encrypted objects. Determine the actual affected data/keys and scope; contain access; preserve necessary evidence; assess the statutory threshold and roles; escalate immediate operator notice where applicable; prepare responsible-party notices; rehearse portal access without submitting a false report; plan key/recovery actions that preserve required records; verify cleanup/restore safeguards; record decisions and follow-up owners. Mark the exercise complete only after real participants perform it and record the findings.
