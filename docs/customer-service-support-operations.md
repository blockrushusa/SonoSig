# SonoSig Customer Service and Support Operations

Developer-ready support, admin, trust, safety, and launch operations specification for SonoSig.

## Assumptions

| Area | Assumption |
|---|---|
| Product | SonoSig lets creators encode, sign, verify, and publicly associate media, starting with audio, with wallet-based identity, PacStac claims, and ENS pointers. |
| URL | Primary production site is `https://sonosig.com`; staging and Firebase preview URLs may also be used by support and engineering. |
| Launch support model | SonoSig may launch without a formal ticketing platform. Support can initially run through `support@sonosig.com`, contact forms, direct messages, shared inbox labels, and manual admin tooling. |
| Users | Artists, producers, rights holders, collectors, verifiers, platforms, and developers. |
| Business model | Free/basic provenance workflows may coexist with paid API, x402, subscription, or usage-based PacStac/API features. |
| Key risks | Users may confuse technical proof with legal ownership; blockchain/ENS actions are not reversible by SonoSig; wallet loss cannot be recovered by support; public claims can create impersonation, copyright, fraud, privacy, and dispute issues. |

## 1. Product Support Overview

### What SonoSig Does

SonoSig helps users create and check wallet-signed provenance signals for media.

In plain English:

1. A creator connects a wallet.
2. SonoSig analyzes an audio file in the browser where possible.
3. The creator signs a structured proof with their wallet.
4. SonoSig embeds the proof into an exported audio file.
5. The encoded file can later be verified to confirm that it contains a valid wallet-signed SonoSig payload.
6. The creator can optionally register the claim with PacStac and publish an ENS text-record pointer so agents, apps, platforms, and people can discover the claim.

SonoSig answers technical questions like: "Which wallet signed this media proof?", "What audio fingerprint was claimed?", "Was this claim registered for discovery?", and "Is there an ENS or PacStac signal connected to it?"

SonoSig does not decide legal copyright ownership, licensing rights, authorship disputes, or royalty entitlement.

### Users and Customers

| User type | What they want | Typical support need |
|---|---|---|
| Artists | Sign and publish provenance for tracks, demos, stems, or releases. | Wallet setup, encoding help, verification explanation, dispute guidance. |
| Producers | Register work for artists, collaborators, or projects. | Multi-party workflow, metadata accuracy, duplicate/dispute handling. |
| Rights holders | Review claims for labels, publishers, managers, estates, or licensors. | Claim lookup, takedown, copyright complaint, business process support. |
| Collectors | Check provenance before collecting, licensing, or sharing media. | Verification interpretation and trust-signal explanation. |
| Platforms | Integrate claim discovery or verification into marketplaces, tools, or archives. | API support, webhooks, rate limits, abuse reporting, integration logs. |
| Verifiers | Upload a file or claim ID to check authenticity signals. | Failed verification, missing claim, file transformation guidance. |
| Developers | Build with the API, PacStac, ENS, x402, or future MCP/tool integrations. | API keys, x402 payments, request logs, docs, SDK examples. |

### Main Support Goals

- Help users complete core workflows: connect wallet, sign, encode, download, post, verify.
- Explain what a SonoSig proof means without overstating it.
- Protect users from wallet, private key, payment, and public-chain mistakes.
- Give developers and support agents enough IDs, logs, and admin tools to diagnose issues.
- Preserve evidence and escalate disputes, fraud, copyright, and privacy requests correctly.
- Build support data structures that work before a ticketing platform exists and can migrate into one later.

### What Support Should and Should Not Promise

Support may say:

- "SonoSig can verify whether a file contains a valid wallet-signed SonoSig proof."
- "A valid proof shows that a specific wallet signed a claim for a specific media fingerprint."
- "PacStac registration can make a claim discoverable and indexable."
- "ENS can publish a pointer to a claim under a creator-controlled name."
- "We can help troubleshoot wallet, encoding, verification, registration, and transaction-history issues."
- "We can review reports of abuse, impersonation, fraud, copyright complaints, and policy violations."

Support must not say:

- "SonoSig proves legal copyright ownership."
- "SonoSig guarantees the signer is the author or legal rights holder."
- "SonoSig can settle ownership disputes."
- "SonoSig can reverse blockchain transactions."
- "SonoSig can recover wallets, private keys, or seed phrases."
- "SonoSig can delete all public blockchain, ENS, PacStac, or third-party records."
- "A PacStac or ENS claim is a legal certificate of authorship."
- "A valid signature means no one else has rights in the work."

Use this safer phrasing:

> SonoSig verifies a wallet-signed provenance claim and, when registered, provides public discovery signals. Legal ownership, copyright status, licensing rights, and authorship disputes require separate review outside SonoSig.

### Important Limitations and Expectations

- Users are responsible for wallet custody, gas fees, transaction approvals, and ENS permissions.
- Blockchain transactions may be visible publicly and may not be reversible.
- SonoSig can remove or hide data from SonoSig-controlled surfaces, but may not control third-party or on-chain records.
- Audio verification may fail if a file is edited, transcoded, clipped, normalized, compressed, or stripped of metadata/proof payload after encoding.
- Support should never request private keys, seed phrases, full payment card numbers, or passwords.
- Analytics and service logs may be used to diagnose product issues, subject to the privacy policy and applicable law.

## 2. Support User Journeys

Use these journeys for help articles, contact-form routing, admin dashboard design, and manual triage.

| Journey | User goal | Common failure points | What support needs to know | What the system should log | Suggested help articles | Escalation triggers |
|---|---|---|---|---|---|---|
| New user onboarding | Understand SonoSig and create a first proof. | Confusion about proof vs ownership, unsupported browser, wallet not installed. | User type, intended use, browser, whether wallet is ready. | Route, onboarding step, wallet presence, dismissed errors, analytics event IDs. | Getting started with SonoSig; What a SonoSig proof means. | Repeated onboarding failure, misleading UI, high-value partner blocked. |
| Account creation/login | Sign in and access settings/admin-safe data. | Email link expired, OAuth popup blocked, wrong account, disabled user. | Email, auth provider, UID if known, last successful login. | UID, auth provider, auth error code, IP/device summary, timestamp. | Signing in; Email verification; Account recovery. | Suspected account takeover, admin lockout, PII exposure. |
| Connecting wallet | Connect the intended wallet for signing or ENS. | Wallet locked, duplicate wallet extensions, WalletConnect stale, wrong account. | Wallet type, address, chain, browser, mobile/desktop. | Connector, address, chain ID, provider error, session ID. | Connecting a wallet; Supported wallets and networks. | Reproducible wallet failure, wrong wallet displayed, signature mismatch. |
| Core create workflow | Select audio, sign proof, encode file, download result. | File decode error, signature rejection, payload too large, download blocked. | File type/size/duration, browser/OS, wallet address, exact step. | Audio metadata, decode status, proof draft ID, error code, export status. | Creating a SonoSig proof; Best audio formats. | Supported files fail, corrupt output, data loss risk. |
| Payment/subscription flow | Pay for plan, API, registration, or usage. | Payment failed, card declined, invoice missing, plan mismatch. | Account email, payment provider customer ID, invoice ID, amount/date. | Provider event IDs, plan, status, webhook result, receipt URL. | Billing basics; Receipts and invoices. | Duplicate charge, chargeback, payment webhook outage, paid feature blocked. |
| Purchase/order flow | Buy credits, claim packages, API credits, or services if offered. | Order pending, fulfillment not applied, receipt mismatch. | Order ID, SKU, amount, payment ID, expected entitlement. | Order status, fulfillment status, provider event IDs, admin changes. | Credits and usage; Order status. | Payment captured but entitlement missing, fraud signal. |
| Account settings | Update profile, ENS preferences, API config, notifications. | Save failed, invalid ENS/domain, permission denied. | UID, current settings, desired change, role. | Settings diff, actor, validation errors, audit event. | Managing account settings; ENS setup. | Settings changed by wrong user, admin permission issue. |
| Data export/deletion | Export account data or request deletion. | Identity not verified, public/on-chain data expectations, legal hold. | Verified email, UID, wallet, request scope, jurisdiction if volunteered. | Request timestamp, verification status, data inventory, completion status. | Exporting your data; Deleting your account. | Legal hold, public-chain deletion request, regulatory deadline. |
| Troubleshooting failed actions | Fix a failed encode, verify, PacStac post, ENS transaction, or API call. | Missing error code, stale local history, RPC timeout, third-party API error. | Error code, route, timestamp, claim ID, tx hash, request ID. | Client event trail, server logs, request IDs, transaction status, retry count. | Troubleshooting; Transactions page guide. | P0/P1 workflow outage, reproducible failure, paid action failed. |
| Cancellation/refund flow | Cancel subscription or request refund. | User cannot find billing page, cancellation not reflected, refund policy unclear. | Account email, plan, invoice/payment ID, reason, requested outcome. | Subscription status, cancellation timestamp, refund status, agent action. | Cancelling a plan; Refund policy. | Chargeback threat, duplicate billing, high-value account. |
| Contacting support | Get help before ticketing exists. | No response expectations, missing IDs, user sends sensitive data. | Contact channel, user email, consent to inspect diagnostics. | Source channel, inbound message ID, triage label, assigned owner. | Contacting SonoSig support; What to include in a support request. | Legal, privacy, security, abuse, or payment-loss language. |
| Registering with PacStac | Publish a signed proof for discovery. | API key invalid, x402 payment failure, duplicate claim, PacStac 5xx. | Claim ID, proof summary, API mode, request ID, response body. | PacStac request ID, status, response, mode, x402 payment metadata. | Posting to PacStac; PacStac discovery. | Paid x402 payment settles but API denied, PacStac outage. |
| Publishing ENS pointer | Write `com.sonosig` text record for an ENS name. | Wrong resolver, no manager permission, gas error, receipt polling timeout. | ENS name, wallet, tx hash, chain ID, resolver status. | Transaction hash, submitted/confirmed/reverted status, RPC response. | ENS setup; Understanding gas and transaction status. | Etherscan success but SonoSig shows failure, wrong record written. |
| Verifying a claim or file | Check whether a file/claim has valid proof and public registrations. | Original file uploaded instead of encoded file, file modified, local transaction history absent. | File format, expected claim ID, expected wallet/ENS, changes after encode. | Extraction result, signature status, audio hash status, transaction-history match. | Verifying a track; Why verification can fail. | Valid encoded file fails after recent release, public status mismatch. |
| Disputed authorship/ownership | Report a claim that appears unauthorized. | Missing evidence, user expects legal ruling, public-chain permanence. | Claim URL/ID, reporter identity, evidence, urgency, alleged harm. | Claim data, account/wallet, status changes, abuse flags, evidence links. | Claims and disputes; Copyright complaints. | Credible impersonation, high-profile work, legal notice, active financial harm. |

## 3. Support Issue Taxonomy

Day-one support can implement these as shared-inbox labels, contact-form categories, or rows in a simple `supportCases` collection. A formal ticketing system can map the same categories later.

| Category | Description | Example user messages | Required information from user | Automatic metadata | Priority | Response time | Escalation path | Suggested resolution steps |
|---|---|---|---|---|---|---|---|---|
| Account/access | User cannot access account or sees wrong account data. | "I cannot access my account." "My admin role disappeared." | Email, UID if known, auth provider, screenshot. | Auth logs, account status, role claims, last login, device/session. | P1 if locked out of paid/admin account; P3 otherwise. | 4h P1, 2 business days P3. | Engineering for auth bug; leadership for VIP/admin access. | Verify identity, check account status, confirm auth provider, resend guidance, add internal note. |
| Login/password | Password or provider sign-in trouble. | "The login link expired." "Google sign-in does not work." | Email, provider, browser, timestamp. | Auth error code, popup blocked flag, session ID. | P2/P3. | 1-2 business days. | Engineering if reproducible. | Ask user to retry link, clear stale session, try supported browser, inspect auth logs. |
| Email verification | User cannot verify email or update verified status. | "I never got the verification email." | Email, spam check confirmation, last request time. | Email send event, bounce, verification status. | P3. | 2 business days. | Engineering if email provider delivery issue. | Resend verification, check bounce, update status only under policy. |
| Billing/subscription | Plan, invoice, payment, subscription, or paid feature issue. | "I was charged twice." "My API plan is not active." | Account email, invoice/payment/customer ID, date, amount. | Payment provider event, webhook result, plan status. | P1 for payment loss; P2 standard. | 4h-1 business day. | Billing admin, then engineering for webhook bugs. | Confirm payment, reconcile entitlement, issue invoice/refund if authorized. |
| Orders/purchases | One-time purchase, credits, API usage, or claim package not delivered. | "I bought credits but they are missing." | Order ID, email, amount, receipt. | Order status, fulfillment status, SKU, provider event. | P1/P2. | 1 business day. | Billing admin/engineering. | Validate payment, apply entitlement, audit manual action. |
| Refunds/cancellations | User wants cancellation, refund, or credit. | "Cancel my plan." "I want a refund." | Account email, plan, invoice ID, reason, requested outcome. | Subscription status, usage, refund eligibility. | P2. | 1 business day. | Billing admin; leadership for exceptions. | Apply policy, cancel renewal, process refund/credit, confirm in writing. |
| Product usage questions | How-to questions about creating, posting, verifying, or interpreting proofs. | "What does this proof mean?" "Should I post to ENS?" | User goal, page, screenshot if relevant. | Route, app version, recent events. | P3/P4. | 2-5 business days. | Product if docs gap. | Send help article, explain limits, note no legal ownership determination. |
| Technical errors | App errors not covered by narrower category. | "The page crashed." "Button does nothing." | Steps, expected/actual, browser/OS, screenshot, error code. | Console/server logs, route, version, request ID. | P1-P3. | 4h-2 business days. | Engineering. | Reproduce, capture logs, provide workaround, create issue. |
| Upload/download issues | File cannot upload, process, export, or download. | "My WAV will not load." "Download never starts." | File type, size, duration, browser/OS, whether another file works. | Audio decode status, payload size, export error, download event. | P2. | 1 business day. | Engineering for supported-format regression. | Recommend WAV/AIFF, smaller test file, supported browser, gather sample with consent. |
| Integrations/API issues | API key, x402, PacStac, ENS, webhooks, SDKs. | "My API call returns 402." "x402 payment settled but API failed." | Key ID, endpoint, request ID, timestamp, status code, response body. | API logs, rate limits, x402 payment status, PacStac response, wallet. | P1/P2. | 4h-1 business day. | Developer support/engineering. | Validate key/mode, check logs, rotate key if needed, test endpoint, escalate 5xx. |
| Data/privacy requests | Export, delete, correct, or restrict data. | "Delete my account." "Send me my data." | Verified email, UID, wallet, requested action. | Data inventory, verification status, retention/legal hold flags. | P1 for regulatory clock; P2 standard. | Acknowledge within 1 business day. | Privacy lead/legal. | Verify identity, identify controlled data, explain on-chain limits, complete and audit. |
| Abuse/spam/fraud | Malicious claims, spam, phishing metadata, fraud, suspicious wallets. | "This account is impersonating me." "This claim is spam." | Claim/account URL, evidence, harm/urgency. | Claim velocity, IP/device, wallet, metadata, reports count. | P0/P1. | 30m-4h. | Trust/safety, leadership for severe harm. | Preserve evidence, flag account, restrict visibility if policy allows, escalate. |
| Safety/legal complaints | Legal, copyright, takedown, threats, law enforcement, urgent safety. | "This infringes my copyright." "I represent the rights holder." | Contact info, claim IDs/URLs, legal basis, evidence. | Related account/claim, audit history, previous reports. | P0/P1. | 30m-1 business day. | Legal/leadership. | Acknowledge, do not admit liability, preserve records, route to authorized reviewer. |
| Bug reports | Reproducible product defect. | "I can make this fail every time." | Repro steps, expected/actual, environment, IDs. | Logs, app version, route, error code. | P2/P3. | 1-2 business days. | Engineering. | Reproduce, create issue, link user case, follow up after fix. |
| Feature requests | New capability, integration, or workflow request. | "Can you support FLAC?" "Add batch upload." | Use case, user type, urgency, examples. | Product area, account tier, volume. | P4. | 5 business days. | Product review. | Thank user, tag request, merge duplicates, avoid promises. |
| General contact | Partnerships, press, unclear requests. | "Can we talk?" "Who handles partnerships?" | Name, organization, reason, contact info. | Source channel, referring page. | P3/P4. | 2-5 business days. | Founder/operations as needed. | Route to owner, answer simple questions, label future category. |

## 4. Developer Requirements for Support

### Support Case Model

Even without ticketing software, store or track support cases with stable IDs. For a shared inbox, include the case ID in the email subject or internal note.

```ts
type SupportCase = {
  id: string;
  source: "email" | "contact_form" | "dm" | "admin_created" | "api" | "shared_inbox";
  status: "new" | "open" | "waiting_on_user" | "waiting_on_engineering" | "waiting_on_legal" | "resolved" | "closed";
  category: string;
  priority: "P0" | "P1" | "P2" | "P3" | "P4";
  subject: string;
  userId?: string;
  email?: string;
  walletAddress?: string;
  claimId?: string;
  audioHash?: string;
  transactionHash?: string;
  ensName?: string;
  pacstacRequestId?: string;
  paymentCustomerId?: string;
  orderId?: string;
  subscriptionId?: string;
  assignedTo?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  internalNotes: SupportNote[];
  auditLog: SupportAuditEvent[];
};
```

### Required Support Identifiers

| Identifier | Why it matters | Example |
|---|---|---|
| User ID | Links auth, settings, claims, tickets, analytics, and admin actions. | Firebase UID |
| Email | Primary support contact and identity verification input. | `creator@example.com` |
| Wallet address | Required for signing, ENS, PacStac, abuse, and dispute cases. | `0x...` |
| ENS name | Required for text-record updates and public identity links. | `ohmslaw.eth` |
| Claim ID | Primary provenance record reference. | `sonosig:sha256:...` |
| Audio hash | Helps match proof, verification, PacStac, and disputes. | `sha256:...` |
| Transaction hash | Required for ENS/web3 status. | `0x...` |
| API key ID | Debugs developer/API issues without exposing full secret. | `pk_live_...id` |
| x402 wallet/payment ID | Debugs paid API requests and settled-but-denied scenarios. | Base wallet / payment header hash |
| Payment customer ID | Reconciles billing and subscription issues. | Stripe or future provider customer ID |
| Order/subscription ID | Required for refund, cancellation, and entitlement support. | Provider ID |

### Account and Product Data

| Record | Required fields |
|---|---|
| Account | UID, email, email verification status, account status, auth providers, roles, created date, last login, privacy flags. |
| Session/device | Browser, OS, wallet connector, chain ID, locale, timezone, app version, recent event IDs. |
| Audio processing event | Event ID, user ID, route, file type, size, duration, decode status, export status, error code. |
| Proof draft | Draft ID, wallet, chain ID, audio hash, metadata summary, created time, signed/not signed. |
| Verification event | Event ID, extracted proof hash, signature status, audio-hash status, claim match, browser, timestamp. |
| PacStac registration | Claim ID, request ID, API mode, response status, x402 payment status, created time, retry count. |
| ENS transaction | ENS name, wallet, chain ID, tx hash, submitted/confirmed/reverted/unknown, receipt, last checked. |
| API request | Request ID, API key ID, endpoint, method, status, latency, rate-limit bucket, error code. |
| Payment/order | Customer ID, invoice/order/subscription ID, status, amount, currency, provider event ID. |

### Error Codes

| Prefix | Area | Examples |
|---|---|---|
| `AUTH_` | Account/login | `AUTH_POPUP_BLOCKED`, `AUTH_EMAIL_LINK_EXPIRED`, `AUTH_TOKEN_EXPIRED`. |
| `WALLET_` | Wallet connection/signing | `WALLET_CONNECT_FAILED`, `WALLET_SIGNATURE_REJECTED`, `WALLET_WRONG_ACCOUNT`. |
| `AUDIO_` | Upload/decode/export | `AUDIO_DECODE_FAILED`, `AUDIO_UNSUPPORTED_CODEC`, `AUDIO_PAYLOAD_TOO_LARGE`. |
| `PROOF_` | Proof creation/verification | `PROOF_NOT_FOUND`, `PROOF_SIGNATURE_INVALID`, `PROOF_AUDIO_HASH_MISMATCH`. |
| `PACSTAC_` | PacStac registration | `PACSTAC_API_FAILED`, `PACSTAC_DUPLICATE_CLAIM`, `PACSTAC_X402_PAYMENT_FAILED`. |
| `ENS_` | ENS lookup/write | `ENS_RESOLVER_MISSING`, `ENS_NOT_AUTHORIZED`, `ENS_TX_REVERTED`, `ENS_RECEIPT_PENDING`. |
| `API_` | API/developer | `API_KEY_INVALID`, `API_RATE_LIMITED`, `API_SCHEMA_INVALID`. |
| `BILLING_` | Payment/subscription | `BILLING_PAYMENT_FAILED`, `BILLING_WEBHOOK_DELAYED`, `BILLING_ENTITLEMENT_MISSING`. |
| `PRIVACY_` | Data rights | `PRIVACY_EXPORT_REQUESTED`, `PRIVACY_DELETE_REQUESTED`, `PRIVACY_LEGAL_HOLD`. |

### Recommended Collections

```ts
type SupportNote = {
  id: string;
  caseId: string;
  authorId: string;
  visibility: "internal" | "user";
  body: string;
  createdAt: string;
};

type SupportAuditEvent = {
  id: string;
  caseId?: string;
  actorId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  createdAt: string;
};

type ManualAdminAction = {
  id: string;
  actorId: string;
  actionType:
    | "recheck_ens_transaction"
    | "retry_pacstac_registration"
    | "mark_claim_disputed"
    | "hide_claim"
    | "refund_payment"
    | "cancel_subscription"
    | "disable_account"
    | "export_user_data"
    | "delete_user_data";
  targetType: "user" | "claim" | "transaction" | "payment" | "api_key";
  targetId: string;
  status: "pending" | "success" | "failed";
  reason: string;
  createdAt: string;
};
```

## 5. Admin Dashboard Spec

| View | Search by | Display | Actions |
|---|---|---|---|
| User lookup | Email, UID, wallet, ENS, claim ID, transaction hash. | Profile, auth providers, roles, account status, wallets, claims, verifications, cases, risk flags. | Add note, disable/reactivate, change role, export data, start deletion, open case. |
| Account timeline | UID/email. | Login events, profile changes, wallet links, proof events, purchases, admin actions, support notes. | Filter, export timeline, attach to case. |
| Wallet lookup | Wallet, ENS. | Linked users, ENS names, signed claims, PacStac records, ENS transactions, risk flags. | Mark suspicious, open abuse case, recheck transactions. |
| Track/proof lookup | Audio hash, fingerprint, file name, title/artist, claim ID. | Proof payload summary, metadata, verification history, duplicate/similar claims. | Mark duplicate/disputed, attach case, hide UI display. |
| Claim lookup | Claim ID, wallet, audio hash, PacStac ID. | Claim status, wallet, metadata, PacStac status, ENS status, public visibility, dispute flags. | Retry PacStac, mark disputed, hide from SonoSig UI, add legal note. |
| Verification history | User, audio hash, claim ID, date range. | Extract result, signature status, audio hash status, related claim, browser/version. | Create case, compare proof, export diagnostic JSON. |
| Audio-processing status | Event ID, user, date. | Decode/export steps, payload size, file type, error code. | Request sample file, create engineering issue, mark known issue. |
| Error logs | Request ID, error code, route, user. | Stack summary, client/server logs, version, correlation IDs. | Link to case, escalate, mark resolved after deploy. |
| Order/payment lookup | Email, customer ID, invoice, order, subscription. | Plan, status, invoices, payments, refunds, webhooks, entitlements. | Cancel, refund, resend invoice, reconcile entitlement. |
| API/developer lookup | API key ID, endpoint, request ID, x402 wallet. | Usage, errors, rate limits, x402 status, PacStac mode. | Rotate/revoke key, adjust quota, test endpoint, add note. |
| Support case queue | Case ID, email, label, status. | Conversation, internal notes, linked records, SLA timer. | Assign, reply, change status, escalate, close. |
| Abuse/fraud queue | Wallet/account/claim/report ID. | Reports, evidence, risk score, claim velocity, public exposure. | Flag, hide, suspend, rate limit, escalate. |
| Privacy queue | Email/UID/request ID. | Request type, verification, data inventory, deadline, status. | Export, delete/anonymize, add legal hold, complete request. |
| Audit log | Actor, action, target, date. | Immutable admin action history. | Filter/export only; no edits. |

### Manual Retry and Control Actions

- Recheck ENS transaction receipt.
- Retry PacStac registration.
- Refresh PacStac claim status.
- Re-run verification against stored proof metadata.
- Re-send account verification email.
- Re-sync role claims.
- Reconcile paid entitlement after webhook delay.
- Retry failed webhook processing.
- Export diagnostic JSON for engineering.
- Mark claim `active`, `pending`, `registered`, `duplicate`, `disputed`, `hidden_from_sonosig`, `legal_hold`, or `abuse_blocked`.

Every action must require a reason and write an audit log entry. Claim controls affect SonoSig-controlled surfaces only unless a third-party API action is explicitly available.

### Role-Based Permissions

| Role | Capabilities |
|---|---|
| Support Viewer | Read users, claims, transactions, support cases. No write actions. |
| Support Agent | Reply to cases, add notes, recheck safe statuses, create escalations. |
| Senior Support | Mark duplicates/disputes, apply credits, request data export, approve manual retries. |
| Billing Admin | Refunds, invoices, subscription cancellation, entitlement reconciliation. |
| Developer Support | API keys, request logs, rate limits, x402 diagnostics. |
| Trust and Safety | Hide claims, flag wallets/accounts, handle abuse/disputes. |
| Privacy Admin | Export/delete eligible data, manage privacy deadlines, add privacy notes. |
| Engineering Admin | Technical config, job retry, deeper logs, production diagnostics. |
| Super Admin | Role management, high-risk controls, full audit access. |

## 6. Manual Support Workflows

### New Customer Inquiry Triage

1. Create or label a case in the shared inbox.
2. Assign a category, priority, and owner.
3. Capture user email, UID if signed in, wallet, claim ID, tx hash, and route if provided.
4. Send the closest macro within the SLA.
5. Add internal note with suspected issue and next action.
6. Link related admin records.
7. Escalate if the message includes security, privacy, legal, payment loss, public abuse, or core workflow outage.

### Account Access Issue

1. Verify the requester controls the email or authenticated session.
2. Check account status, auth provider, email verification, and recent login errors.
3. Send login or verification steps.
4. If disabled/suspended, confirm reason and escalation owner before reactivation.
5. Escalate suspected compromise or admin-role issues.
6. Log all manual changes in the audit log.

### Billing Issue or Refund Request

1. Ask for account email, invoice/payment/customer ID, date, amount, and requested outcome.
2. Locate payment provider record and app entitlement.
3. Check webhook delivery and subscription status.
4. Reconcile entitlement if payment succeeded but access is missing.
5. Review refund/cancellation policy and usage.
6. Process refund/cancellation only if authorized by policy.
7. Record reason, amount, actor, and timestamp.
8. Send confirmation with expected processing timing.

### Technical Bug Report

1. Collect repro steps, expected/actual result, browser/OS, route, timestamp, error code, screenshots.
2. Search existing known issues.
3. Try to reproduce on staging/local if safe.
4. Create engineering escalation with logs and IDs.
5. Give the user a workaround if one exists.
6. Follow up after engineering confirms fix or mitigation.

### Failed Product Action

1. Identify the action: encode, download, verify, PacStac post, ENS transaction, API call.
2. Collect the relevant IDs: audio hash, claim ID, request ID, transaction hash, API key ID.
3. Check admin status and logs.
4. Run safe manual retry if available.
5. If user funds, on-chain records, or paid API actions are involved, preserve logs before retry.
6. Escalate if retry fails or status conflicts with a third-party source.

### Abuse, Fraud, Privacy, or Legal Complaint

1. Preserve reported URLs, claim IDs, wallets, metadata, screenshots, and timestamps.
2. Mark priority P0/P1 depending on harm.
3. Verify requester identity where appropriate.
4. Flag account/wallet/claim for review.
5. Hide or restrict SonoSig UI display only if policy allows.
6. Route to trust/safety, privacy, legal, or leadership.
7. Do not disclose private account details or investigation specifics.

### Escalation to Engineering or Leadership

Escalate to engineering when a reproducible technical issue, data inconsistency, paid-action failure, security risk, or core workflow block exists.

Escalate to leadership when a high-profile creator, legal risk, public relations risk, large refund exception, or product policy decision is involved.

## 7. Support Macros and Canned Responses

### Welcome and Onboarding Help

Hi {{name}},

Welcome to SonoSig. SonoSig lets you create a wallet-signed provenance proof for media, embed that proof into an exported file, and optionally register it for public discovery through PacStac and ENS.

To create your first proof:

1. Connect your wallet.
2. Choose your audio file.
3. Add optional metadata.
4. Sign the proof message in your wallet.
5. Download the encoded file.
6. Use Post to register with PacStac and, if desired, ENS.

SonoSig verifies signatures and provenance claims. It does not determine legal copyright ownership.

### Login or Email Verification Problem

Hi {{name}},

It looks like sign-in or verification did not complete. Please retry in a supported desktop browser and use the same email/provider you used before. If you requested multiple email links, use the newest one.

If it still fails, send your account email, browser, operating system, and a screenshot of the error. Do not send passwords, private keys, or seed phrases.

### Wallet Connection Failed

Hi {{name}},

Your wallet connection did not complete. Please try unlocking your wallet, refreshing SonoSig, reconnecting from the wallet button, confirming the correct account is selected, and disabling duplicate wallet extensions if more than one is installed.

If it still fails, send your wallet type, browser, OS, and a screenshot of the error.

### Signature Rejected

Hi {{name}},

The proof was not created because the wallet signature request was rejected or did not complete. No SonoSig proof is created until you approve the message signature in your wallet.

Please retry the Create flow and approve the signature. Make sure the wallet account shown in the signature prompt is the wallet you want associated with the proof.

### Payment Failed

Hi {{name}},

The payment did not complete. Please confirm your payment method is active and try again. If you were charged but the feature or plan did not activate, send us the account email, payment date, amount, and receipt or invoice ID.

Please do not send full card numbers.

### Refund Request Received

Hi {{name}},

We received your refund request and are reviewing it under our refund policy. Please send the account email, invoice or payment ID, payment date, and reason for the request if you have not already included them.

We will follow up after we review the payment record.

### Subscription Cancellation

Hi {{name}},

We can help cancel your subscription renewal. Please confirm the account email and subscription or invoice ID. Once cancellation is processed, we will confirm the effective date and whether any current access remains through the paid period.

### Product Action Failed

Hi {{name}},

We can help troubleshoot this. Please send the page where it failed, what you clicked, the error code or screenshot, your browser and operating system, and any claim ID, transaction hash, or request ID shown.

If this involved an audio file, include the file type, approximate size, and whether the file plays locally.

### Audio Failed to Process

Hi {{name}},

SonoSig could not process the selected audio file in your browser. Common causes include unsupported codec, corrupted file, very large file size, or browser decode limits.

Please try WAV or AIFF, confirm the file plays locally, and retry in a modern desktop browser. If it continues, send the file type, size, browser, OS, and visible error message.

### Verification Failed

Hi {{name}},

The file either does not contain a SonoSig proof or the proof could not be verified. This can happen if you upload the original file instead of the encoded file, or if the encoded file was edited, transcoded, trimmed, or stripped after download.

Please send the expected creator wallet, claim ID if available, file format, and a screenshot of the verification result.

### ENS or Domain Connection Failed

Hi {{name}},

SonoSig could not complete the identity link update. For ENS, please confirm the wallet owns or manages the ENS name, the ENS name has a resolver configured, your wallet is on Ethereum mainnet, and you have enough ETH for gas.

If you have a transaction hash, send it to us and we can help interpret the status.

### API Key Issue

Hi {{name}},

We can help with API access. Please send the API key ID, endpoint, timestamp and timezone, request ID if returned, HTTP status code, and error response body.

Do not send the full secret API key. If you suspect a key is exposed, revoke or rotate it immediately.

### Abuse Report Received

Hi {{name}},

Thank you for reporting this. We have preserved the report details and will review it under our abuse and trust process.

We may not be able to share private investigation details, but we will review the claim/account and take action on SonoSig-controlled surfaces where appropriate.

### Privacy Request Received

Hi {{name}},

We received your privacy request. To process it, we need to verify the account email and understand whether you are requesting export, deletion, correction, or another privacy action.

Some records, including public blockchain, ENS, or third-party records, may not be controlled by SonoSig. We will explain any limits when we process the request.

### Bug Report or Feature Request Received

Hi {{name}},

Thanks for sending this. We have logged it for review. If this is a bug, please send reproduction steps, expected result, actual result, browser and OS, screenshot or recording, and any claim ID, transaction hash, request ID, or error code.

If this is a feature request, it helps to know the workflow you are trying to support and how often you expect to use it.

### Escalation to Engineering

Hi {{name}},

We are escalating this to engineering because it appears to require deeper technical investigation. We have included the relevant logs, IDs, and reproduction details.

We will update you when engineering confirms the root cause, workaround, or fix.

### Resolution and Closing

Hi {{name}},

We believe this issue is resolved. Please retry the workflow and let us know if you still see the problem.

If we do not hear back, we will close this support thread. You can reply to reopen it if the issue continues or if you have new information.

## 8. Trust, Safety, Legal, and Privacy Guidance

### What Support Agents Can and Cannot Say

Support can say:

- "SonoSig verifies technical provenance signals."
- "The proof shows that a wallet signed a claim for a media fingerprint."
- "We can review whether a claim violates SonoSig policy."
- "We can hide or restrict eligible data on SonoSig-controlled surfaces."
- "We can explain the status of a transaction or registration based on available records."

Support cannot say:

- "This person legally owns the song."
- "This claim proves copyright."
- "SonoSig will delete blockchain history."
- "We guarantee a takedown."
- "Send your seed phrase/private key/password so we can help."
- "We can reverse an ENS transaction."
- "You are safe to license this work solely because the proof is valid."

### Sensitive Information Handling

- Never request seed phrases, private keys, full card numbers, passwords, or unnecessary government IDs.
- Avoid storing source audio files in support threads unless necessary and user consent is explicit.
- Store evidence links and attachments in access-controlled systems.
- Use internal notes for investigation details; do not include sensitive internal risk scores in user replies.
- Redact secrets from logs before sharing with users or non-engineering staff.

### Privacy, Fraud, Abuse, and Legal

- SonoSig can export/delete/anonymize data controlled by SonoSig, subject to legal, security, fraud-prevention, accounting, and abuse-retention requirements.
- Public blockchain, ENS, PacStac, or other third-party records may not be deletable by SonoSig.
- Escalate impersonation, spam, phishing metadata, fraudulent claims, and high-profile disputes to trust and safety.
- Preserve payment, usage, delivery, and communication records for chargebacks.
- Route formal legal notices, copyright complaints, subpoenas, or law enforcement requests to legal/leadership.

Copyright/IP complaint intake should collect complainant name/contact, work identified, claim/account/URL at issue, evidence of rights or authorization, good-faith statement, accuracy statement, and signature or authorized representative statement if a formal notice is submitted.

## 9. Engineering Escalation Playbook

### Severity Levels

| Severity | Definition | Examples | Response |
|---|---|---|---|
| SEV0 | Security/privacy incident, active data exposure, production-wide outage, payment-loss incident. | Users see other users' data; signing flow down for all users; paid x402 payments settle but all API calls fail. | Immediate paging/leadership; continuous updates. |
| SEV1 | Core workflow blocked for many users or high-impact partner. | Create, verify, PacStac registration, or ENS status broken after deploy. | Engineering same day; workaround required. |
| SEV2 | Important issue with workaround or limited scope. | Specific browser cannot download; one API endpoint 500s intermittently. | Engineering triage within 1-2 business days. |
| SEV3 | Minor defect or docs issue. | Typo, confusing message, non-blocking UI bug. | Normal backlog. |

### Required Escalation Information

- Support case ID.
- Severity and user impact.
- User ID/email.
- Wallet address.
- Page/route.
- Browser/OS/device.
- Timestamp with timezone.
- App version or Git SHA.
- Reproduction steps.
- Expected vs actual behavior.
- Error code and full message.
- Claim ID, audio hash, ENS name, transaction hash, API request ID, PacStac request ID as applicable.
- Screenshots, recordings, and consented file samples.
- Whether user paid or incurred gas/x402/API costs.

### Bug Reproduction Template

```md
## Summary
Short description of the problem.

## Severity
SEV0/SEV1/SEV2/SEV3 and why.

## User Impact
Who is affected and what workflow is blocked.

## Environment
- Route:
- Browser/OS:
- Wallet:
- Chain:
- App version/Git SHA:

## IDs
- User ID:
- Wallet:
- Claim ID:
- Audio hash:
- Transaction hash:
- API/PacStac request ID:
- Payment/order ID:

## Steps to Reproduce
1.
2.
3.

## Expected

## Actual

## Logs / Screenshots

## Workaround

## User Communication Needed
```

### Example Escalation Message

```md
SEV1: ENS transaction shows failed in SonoSig but successful on Etherscan

User reports tx `0x...` completed in wallet/Etherscan, but `/transactions` displays failed.
Impact: user cannot trust transaction history after posting proof.
Route: `/create` -> Post Proof -> ENS, then `/transactions`.
ENS: `example.eth`
Claim ID: `sonosig:sha256:...`
App version: `{{gitSha}}`
Logs: client event `evt_...`, RPC receipt check returned timeout before receipt available.
Requested engineering action: confirm receipt reconciliation logic, recheck status on refresh, avoid marking failed unless receipt status is explicitly reverted.
```

### Engineering Response Workflow

1. Acknowledge escalation and severity.
2. Confirm owner.
3. Reproduce or explain why reproduction is blocked.
4. Identify workaround, mitigation, or rollback.
5. Update support with user-safe language.
6. Link fix PR/deploy.
7. Confirm monitoring or test coverage.
8. Tell support whether affected users need proactive follow-up.

Support should not speculate about root cause or promise an exact fix time unless engineering has confirmed it.

## 10. Knowledge Base Outline

| Section | Article | Summary |
|---|---|---|
| Getting started | What is SonoSig? | Plain-English overview of wallet-signed media provenance. |
| Getting started | What a SonoSig proof does and does not prove | Explains technical proof vs legal ownership. |
| Getting started | Create your first SonoSig proof | Step-by-step create, sign, encode, download, post. |
| Account management | Signing in to SonoSig | Auth providers, email verification, session basics. |
| Account management | Managing account settings | Account, wallet, ENS, API config, and notifications. |
| Wallets and signatures | Connecting a wallet | Supported wallets, account selection, mobile caveats. |
| Wallets and signatures | What am I signing? | Explains structured proof messages and safety. |
| Billing and subscriptions | Plans, billing, and API usage | Explains paid features if enabled. |
| Billing and subscriptions | Cancellations and refunds | Policy overview and support contact requirements. |
| Using the product | Encoding and watermarking audio | Supported formats, payload limits, download flow. |
| Using the product | Posting a proof | PacStac, ENS, and Download Registration options. |
| Troubleshooting | Audio failed to process | Common codec, browser, and file-size issues. |
| Troubleshooting | Verification failed | Original vs encoded file, edits/transcoding, proof stripping. |
| Orders or transactions | Understanding ENS transactions | Mainnet gas, tx hashes, receipt statuses. |
| Orders or transactions | Payment or registration failed | Paid API, x402, PacStac, and entitlement troubleshooting. |
| Integrations/API | API authentication | API key mode and safe key handling. |
| Integrations/API | x402 on Base | Wallet setup, balances, common errors. |
| Privacy and data deletion | Exporting your data | What data can be exported and how to request it. |
| Privacy and data deletion | Deleting your account | SonoSig-controlled data, retention, and public-chain limits. |
| Safety/abuse reporting | Reporting impersonation | Evidence needed and review process. |
| Safety/abuse reporting | Copyright and takedown requests | Formal complaint intake and review flow. |
| Contacting support | Contacting SonoSig support | What details to include for faster help. |
| FAQs | Common questions | Proofs, ownership, wallets, ENS, PacStac, verification, billing. |

## 11. Launch Readiness Checklist

### Support Operations

- [ ] Create `support@sonosig.com` and route to a shared inbox.
- [ ] Add contact form with category, email, message, optional wallet, claim ID, transaction hash, request ID, screenshot upload, and consent checkbox for diagnostics.
- [ ] Define shared-inbox labels matching the support taxonomy.
- [ ] Assign daily support owner and backup.
- [ ] Create escalation channels for engineering, billing, trust/safety, privacy, legal, and leadership.
- [ ] Add case ID convention, for example `SSG-YYYYMMDD-####`.

### Product, Admin, and Logging

- [ ] Publish minimum help articles for getting started, wallet connection, encoding, verification, ENS/PacStac, transactions, privacy, and contact support.
- [ ] Link help from Create, Verify, Post Proof modal, Transactions, Admin API Config, and footer.
- [ ] Implement admin lookup for user, wallet, claim, transaction, payment/order, and API request.
- [ ] Add manual retry/recheck for PacStac registration and ENS receipt status.
- [ ] Add support notes, audit log, abuse/dispute flags, privacy export/delete workflow, and role permissions.
- [ ] Add stable error codes for auth, wallet, audio, proof, PacStac, ENS, API, billing, privacy.
- [ ] Include client correlation IDs, server request IDs, and app version/Git SHA in diagnostics.

### Payment, Privacy, Abuse, and Training

- [ ] Payment provider dashboard access for billing admin.
- [ ] Refund and cancellation policy approved.
- [ ] Webhook retry and entitlement reconciliation implemented.
- [ ] x402 payment diagnostics visible in admin API Config or developer logs.
- [ ] Privacy request intake and identity-verification process.
- [ ] Data inventory for export/deletion.
- [ ] Legal hold/fraud retention flags.
- [ ] Abuse report form or category.
- [ ] Claim hide/restrict action on SonoSig-controlled surfaces.
- [ ] Train support on proof vs ownership language.
- [ ] Train support never to request private keys or seed phrases.
- [ ] Run tabletop exercises for outage, dispute, privacy request, and payment failure.

### Test Support Scenarios

- [ ] New creator cannot connect wallet.
- [ ] User rejects signature.
- [ ] WAV encodes successfully and verifies.
- [ ] Unsupported audio file fails with actionable error.
- [ ] PacStac registration succeeds.
- [ ] PacStac duplicate claim is handled.
- [ ] ENS transaction submitted and later confirmed on refresh.
- [ ] ENS transaction reverted and shown as failed.
- [ ] Download Registration receipt created.
- [ ] User requests data deletion.
- [ ] User reports impersonation/copyright complaint.
- [ ] Paid API/x402 failure.

## 12. Support Metrics

Track these from the beginning, even if the first implementation is a spreadsheet plus shared inbox exports.

| Metric | Definition | Why it matters | Suggested target/reporting |
|---|---|---|---|
| Customer inquiry volume | Number of inbound requests by day/week and channel. | Staffing, launch readiness, product friction. | Daily during launch, weekly after. |
| First response time | Time from inbound request to first human response. | Measures support responsiveness. | P0: 30m, P1: 4h, P2: 1 business day, P3: 2 business days. |
| Resolution time | Time from request to resolved/closed. | Shows support and engineering efficiency. | Track by priority and category. |
| Repeat contact rate | Percent of users who contact again for same issue within 7 days. | Indicates unclear answers or unresolved defects. | Review weekly. |
| Customer satisfaction | Simple thumbs-up/down or 1-5 score after resolution. | Measures answer quality. | Start simple; add comments later. |
| Refund rate | Refunds divided by payments/orders. | Indicates billing/product mismatch. | Weekly/monthly. |
| Cancellation reasons | Categorized reasons for subscription cancellation. | Guides product and pricing decisions. | Monthly trend. |
| Bug-related inquiries | Percent of support volume caused by confirmed/suspected bugs. | Helps prioritize engineering. | Weekly with top routes/errors. |
| Top issue categories | Ranked categories by volume and severity. | Shows docs/product gaps. | Weekly. |
| Escalation rate | Percent of cases escalated to engineering/legal/leadership. | Measures complexity and support tooling gaps. | Weekly. |
| Abuse/fraud volume | Abuse, impersonation, spam, copyright, fraud reports. | Trust and safety risk indicator. | Daily during launch; weekly after. |
| Paid-action failure rate | Failed payments, x402, PacStac, or ENS paid/gas-involved issues. | Protects trust when money/gas is involved. | Daily during launch. |
| Verification failure rate | Failed verifications by reason code. | Shows audio/proof reliability and user confusion. | Weekly. |
| Transaction status mismatch rate | Transactions users report as complete but SonoSig shows pending/failed. | Critical for web3 trust UX. | Daily during launch. |

### Minimum Spreadsheet Columns Before Ticketing Exists

| Column | Purpose |
|---|---|
| Case ID | Stable reference across email/admin/engineering. |
| Date opened | SLA and volume tracking. |
| Channel | Email, contact form, DM, admin-created. |
| User email | Reply and account lookup. |
| UID | Internal lookup. |
| Wallet | Wallet/claim/ENS lookup. |
| Category | Taxonomy tracking. |
| Priority | SLA tracking. |
| Status | New/open/waiting/escalated/resolved/closed. |
| Owner | Accountability. |
| Claim ID | Provenance lookup. |
| Transaction hash | Web3 lookup. |
| Request ID | API/server log lookup. |
| Payment/order/subscription ID | Billing lookup. |
| Summary | One-line description. |
| Next action | Prevents dropped manual cases. |
| Escalated to | Engineering/legal/billing/leadership owner. |
| First response at | Response SLA. |
| Resolved at | Resolution time. |
| Close reason | Resolved, duplicate, no response, policy denied. |

## Recommended Initial Implementation Milestones

### Milestone 1: Minimum Launch Support

- Shared inbox and contact form.
- Manual support-case spreadsheet or Firestore collection.
- Error codes and diagnostic IDs in user-facing errors.
- Admin lookup for user, wallet, claim, transaction.
- Macros loaded into shared inbox.

### Milestone 2: Operational Dashboard

- Support case timeline.
- Internal notes and audit log.
- Manual recheck/retry actions.
- Privacy and abuse queues.
- Billing lookup and entitlement reconciliation.

### Milestone 3: Trust, Safety, and Legal Workflow

- Claim dispute status.
- Abuse/fraud flags.
- Claim visibility controls for SonoSig surfaces.
- Formal copyright complaint intake.
- Evidence preservation and legal hold flags.

### Milestone 4: Developer and API Support

- API request logs and request IDs.
- API key management.
- x402 payment diagnostics.
- PacStac mode visibility.
- Developer support metrics and docs feedback loop.
