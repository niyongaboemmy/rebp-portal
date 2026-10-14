# Software Requirements Specification (SRS)

## REBP Portal — Real Estate Brokerage Practitioners Registration, Licensing & Public Register System

| Item | Value |
|---|---|
| Document ID | REBP-PORTAL-SRS-001 |
| Version | 1.0 (Baseline draft for stakeholder review) |
| Date | 2026-10-14 |
| Source form | REBP–REG–01 — Real Estate Brokerage Practitioners Registration and Licensing Form (10 pages) |
| Legal basis | Chapter III and Chapter IV of the *Instructions Governing Real Estate Brokerage Practitioners* |
| Owner | Professional Body for Real Estate Brokerage Practitioners (the "Professional Body") |
| Status | Draft — open items listed in §17 |
| Standard followed | ISO/IEC/IEEE 29148:2018 (requirements engineering), adapted |

### Revision history

| Version | Date | Author | Summary |
|---|---|---|---|
| 0.1 | 2026-10-14 | Engineering | First full draft from analysis of REBP–REG–01 |
| 1.0 | 2026-10-14 | Engineering | Baseline for stakeholder review |

### Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Registrar / Head of Licensing (Professional Body) | | | |
| Legal & Compliance Officer | | | |
| ICT / Data Protection Officer | | | |
| Product Owner | | | |
| Technical Lead | | | |

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Overall description](#2-overall-description)
3. [Domain model and business analysis](#3-domain-model-and-business-analysis)
4. [Application lifecycle and state machines](#4-application-lifecycle-and-state-machines)
5. [Functional requirements — applicant portal](#5-functional-requirements--applicant-portal)
6. [Functional requirements — application form sections A–K](#6-functional-requirements--application-form-sections-ak)
7. [Functional requirements — category-specific requirements (Section G)](#7-functional-requirements--category-specific-requirements-section-g)
8. [Functional requirements — back office (Sections L, M, N)](#8-functional-requirements--back-office-sections-l-m-n)
9. [Functional requirements — cross-cutting services](#9-functional-requirements--cross-cutting-services)
10. [Business rules catalogue](#10-business-rules-catalogue)
11. [User experience and interaction design requirements](#11-user-experience-and-interaction-design-requirements)
12. [Data requirements](#12-data-requirements)
13. [External interface requirements](#13-external-interface-requirements)
14. [Non-functional requirements](#14-non-functional-requirements)
15. [Security, privacy and data protection](#15-security-privacy-and-data-protection)
16. [Recommended architecture and technology](#16-recommended-architecture-and-technology)
17. [Assumptions, constraints, open questions](#17-assumptions-constraints-open-questions)
18. [Delivery phasing](#18-delivery-phasing)
19. [Acceptance criteria and verification](#19-acceptance-criteria-and-verification)
20. [Traceability matrix (source form → requirements)](#20-traceability-matrix-source-form--requirements)
- [Appendix A — Field dictionary](#appendix-a--field-dictionary)
- [Appendix B — Document checklist matrix](#appendix-b--document-checklist-matrix)
- [Appendix C — Notification catalogue](#appendix-c--notification-catalogue)
- [Appendix D — Permission matrix](#appendix-d--permission-matrix)
- [Appendix E — Glossary](#appendix-e--glossary)

---

## 1. Introduction

### 1.1 Purpose

This SRS sets out every requirement for the **REBP Portal**, the online system that puts form REBP–REG–01 into service. The portal runs the whole lifecycle of real estate brokerage practitioners and brokerage firms: registration, licensing, upgrade, renewal, change of affiliation, reinstatement, administrative review, the licensing decision, issue of an electronic license and certificate, and the official public register.

This document is written for:

- **The Professional Body**, which validates that the requirements match its regulatory intent.
- **Product, design and engineering teams**, who build and test the system.
- **QA and auditors**, who verify requirements through the traceability matrix (§20).
- **Integration partners**, such as payment, identity and company registry providers.

### 1.2 Scope

**In scope**

1. Applicant self-service portal, for individuals and firms. Web-first, responsive, mobile-friendly.
2. A guided, conditional, multi-step application wizard covering form Sections A–K.
3. Eight category-specific requirement sets (G1–G8).
4. An automated eligibility engine for age, minimum qualification, years of experience and prerequisite licenses.
5. Document upload, validation, malware scanning, secure storage and a dynamic checklist (Section I).
6. Supervisor and Principal Broker confirmation of affiliation, using digital consent.
7. Fee calculation, online payment, receipts and reconciliation (Section K).
8. A back office for administrative review (Section L) and the licensing decision (Section M), with segregation of duties.
9. Electronic license, a verifiable certificate and the official register entry (Section N).
10. A public searchable register of licensed practitioners and firms, plus license verification by QR code or number (Article 15).
11. Renewal management, reminders, expiry and lapse handling.
12. A firm (REBF) workspace for managing affiliated practitioners, branches and Managing Brokers.
13. Notifications by email, SMS and in-app; an audit trail; reporting and analytics; system configuration.

**Out of scope (v1)**, possible later extensions

- Disciplinary case management beyond recording sanctions, suspensions and revocations.
- Continuing Professional Development (CPD) tracking. It is designed for, but not required by the source form; see §17.
- Training-provider and examination-body portals. v1 consumes their results through an integration or manual verification.
- Transaction-level regulation, such as client trust account auditing.
- Native mobile apps. v1 is a responsive PWA.

### 1.3 Product vision

> *A single, trusted digital front door for real estate brokerage licensing.* Applicants see only what applies to them, know exactly what is missing, and can track their status in real time. Officers work from a clean, evidence-centred review console. The public can verify any practitioner in seconds.

Success measures (targets for 12 months after launch):

| KPI | Target |
|---|---|
| Applications submitted fully online | ≥ 98% |
| Median time from submission to decision (complete files) | ≤ 10 working days |
| Applications returned for missing documents | ≤ 15% (vs. baseline) |
| Draft abandonment rate | ≤ 25% |
| Applicant satisfaction (post-submission CSAT) | ≥ 4.3 / 5 |
| Public register uptime | ≥ 99.9% |
| Renewal on-time rate | ≥ 85% |

### 1.4 Definitions and acronyms

See [Appendix E](#appendix-e--glossary) for the full glossary. The most important terms:

| Term | Meaning |
|---|---|
| **RERA** | Real Estate Referral Agent. Referral-only practitioner (Article 10). |
| **FSLA** | Field Sales and Leasing Agent. Entry-level field practitioner, supervised. |
| **REA** | Real Estate Agent. Requires ≥ 3 years as an FSLA or a recognised equivalent. |
| **Broker** | Real Estate Broker. Requires ≥ 3 years as a licensed REA. |
| **Associate Broker** | A licensed Broker affiliated with an REBF under a Principal Broker. |
| **Managing Broker** | A licensed Broker who manages an office or branch of an REBF. |
| **Principal Broker** | A licensed Broker designated as responsible for an REBF's supervision, client funds, records, compliance and complaints. |
| **REBF** | Real Estate Brokerage Firm. A legal entity registered and licensed to carry on brokerage. |
| **Professional Body** | The regulator and professional body that issues registrations and licenses. |
| **Reviewing Officer** | The officer who performs the Section L administrative review. |
| **Approving Authority** | The authorised person who records the Section M decision. |

### 1.5 References

| Ref | Document |
|---|---|
| R1 | REBP–REG–01, Real Estate Brokerage Practitioners Registration and Licensing Form (source of this SRS) |
| R2 | Instructions Governing Real Estate Brokerage Practitioners, Chapters III and IV; Articles 10, 12 and 15 as cited in R1 |
| R3 | Law No. 058/2021 of 13/10/2021 relating to the protection of personal data and privacy (Rwanda). *Assumed applicable; see §17.* |
| R4 | Law on electronic messages, electronic signatures and electronic transactions (Rwanda). *Assumed applicable.* |
| R5 | ISO/IEC/IEEE 29148:2018, Requirements engineering |
| R6 | WCAG 2.2 Level AA, Web Content Accessibility Guidelines |
| R7 | OWASP ASVS 4.0.3 Level 2, Application Security Verification Standard |
| R8 | ISO/IEC 27001:2022, Information security management |

### 1.6 Requirement conventions

- IDs: `FR-<MODULE>-<NNN>` (functional), `BR-<NNN>` (business rule), `NFR-<AREA>-<NNN>`, `SEC-<NNN>`, `UX-<NNN>`, `INT-<NNN>`, `DATA-<NNN>`.
- Priority uses **MoSCoW**: **M** = Must, **S** = Should, **C** = Could, **W** = Won't (this release).
- "Shall" means mandatory, "should" means recommended, "may" means optional.
- A **Src** reference such as `A.3` or `G4.5` points to the section and item number of form REBP–REG–01.

---

## 2. Overall description

### 2.1 Product perspective

The REBP Portal is a new, stand-alone system that replaces paper or ad-hoc processes. It connects to:

```
                       ┌──────────────────────────────────────────┐
  Applicants  ───────► │            REBP Applicant Portal          │
 (individuals, firms)  │  (wizard, uploads, payments, tracking)    │
                       └──────────────┬───────────────────────────┘
  Supervising /                       │
  Principal Brokers ─► Confirmation   │        ┌──────────────────────────┐
                       inbox          ├──────► │  Core Licensing Services │
                                      │        │  (rules, workflow, fees, │
  Officers / Approvers ─► Back Office ┤        │  documents, register)    │
                                      │        └────────────┬─────────────┘
  Public / Consumers ──► Public       │                     │
                         Register  ◄──┘     ┌───────────────┼──────────────────────────┐
                                             ▼               ▼                          ▼
                                     National ID      Company registry        Payment gateway /
                                     (NIDA)*          (RDB)* / Tax (RRA)*     Mobile money*
                                     Email/SMS        Exam & training         Criminal record
                                     gateways         providers*              verification*
                                     (* integration, else manual verification fallback)
```

### 2.2 User classes and personas

| ID | User class | Description | Frequency | Key needs |
|---|---|---|---|---|
| U1 | **Individual applicant** | Aspiring or existing RERA, FSLA, REA, Broker, Associate, Managing or Principal Broker | Occasional (apply, renew yearly) | Clarity on what applies to them, mobile upload, status tracking, low friction |
| U2 | **Firm representative** | Director, partner or authorised officer filing the REBF registration | Occasional | Corporate data, director list, branches, document bundle |
| U3 | **Supervising practitioner** | Broker, REA or designated practitioner named as supervisor | Frequent for busy brokers | Fast confirm/decline of supervision requests, view of supervisees |
| U4 | **Principal Broker** | Responsible for an REBF | Frequent | Firm roster, affiliation approvals, branch management, renewal oversight |
| U5 | **Reviewing Officer** | Professional Body staff doing Section L | Daily | Work queue, document viewer, verification checklist, requests for information |
| U6 | **Approving Authority** | Senior officer or committee recording Section M | Daily/weekly | Recommended decisions, conditions, bulk approval with safeguards, e-signature |
| U7 | **Registrar / Register Administrator** | Maintains the register, suspensions and revocations | Weekly | Register management, status changes, corrections with an audit trail |
| U8 | **Finance Officer** | Fees, reconciliation, refunds | Daily | Payment dashboard, reconciliation, refund workflow |
| U9 | **System Administrator** | Configuration: fees, categories, rules, templates, users | Occasional | Safe configuration with versioning |
| U10 | **Auditor / DPO** | Read-only oversight, audit logs, data subject requests | Occasional | Immutable audit trail, export, DSAR tools |
| U11 | **Public user / consumer** | Anyone checking a practitioner or firm | Ad hoc | Fast search, trustworthy verification |
| U12 | **Integration client** | Partner system, e.g. a bank or land registry, verifying licenses through the API | Automated | Stable authenticated API |

**Personas** (these guide the UX decisions)

- **Aline, 22, aspiring RERA.** Uses only a smartphone and pays with mobile money. Has her A2 certificate as a phone photo. Needs a short, plain-language path, camera upload and Kinyarwanda.
- **Eric, 34, REA upgrading to Broker.** Already holds a license, so the system should pre-fill everything it knows. Wants to see "you are eligible from 12 March 2027" before he starts.
- **Grace, Principal Broker of a 40-agent firm.** Receives dozens of supervision requests. Needs a bulk confirmation inbox and a roster with renewal dates.
- **Officer Jean, Reviewing Officer.** Handles 30+ files a day. Needs side-by-side document and data viewing, one-click "verified/failed" per check, and templated information requests.

### 2.3 Operating environment

- **Clients:** the latest two versions of Chrome, Edge, Firefox and Safari; Android 9+ Chrome; iOS 15+ Safari. The site must work on low-end Android devices on 3G.
- **Hosting:** cloud or government data centre, with in-country data residency where the law requires it (see §17).
- **Languages:** English, Kinyarwanda and French (assumed; configurable).
- **Time zone:** Africa/Kigali (CAT, UTC+2). All timestamps are stored in UTC.
- **Currency:** RWF (assumed; configurable).

### 2.4 Design and implementation constraints

| ID | Constraint |
|---|---|
| C-01 | Application method is **online** (R1 header). Paper intake, if allowed at all, is captured by officers through an assisted-filing mode (FR-PORTAL-020). |
| C-02 | Personal data processing must comply with applicable data protection law (R1 J.8 and Important Note 1). |
| C-03 | Registration or licensing is **never** automatic on submission (R1 J.3). Every grant needs a recorded human decision (Section M). |
| C-04 | Licenses are issued and the register is updated **only after the required approvals are complete** (R1 workflow step 8). |
| C-05 | The portal shall show only the subsection of Section G that applies to the selected category (R1 Section G). |
| C-06 | The checklist shall be generated from the selected category and application type (R1 Section I). |
| C-07 | Electronic signature or "approved authentication" must be legally acceptable (R1 J, L, M). |
| C-08 | Address capture shall follow the administrative hierarchy Province → District → Sector → Cell → Village, plus free-text detail (R1 B.8–B.9). |

### 2.5 User documentation

- Contextual help on every field (tooltip or help drawer), in all supported languages.
- An "Am I eligible?" pre-check tool and a category comparison guide.
- Downloadable PDF guides for each category, plus short video walkthroughs (S).
- An officer operations manual and an administrator configuration guide.
- Public API documentation (OpenAPI 3.1).

---

## 3. Domain model and business analysis

### 3.1 Professional category ladder

The source form implies a progression ladder, with "Upgrade to a higher professional category" (A.3) and experience rules in G3 and G4:

```
  Entry tier            Licensed agent tier           Broker tier                     Firm roles (require Broker license)
 ┌─────────┐           ┌──────┐                      ┌────────┐                     ┌──────────────────┐
 │  RERA   │ (separate │ REA  │ ── ≥3 yrs as ──────► │ Broker │ ──► designation ──► │ Associate Broker │
 │referral │  track)   └──────┘   licensed REA       └────────┘                     │ Managing Broker  │
 └─────────┘              ▲                               │                         │ Principal Broker │
 ┌─────────┐ ≥3 yrs as    │                               │ may practise            └──────────────────┘
 │  FSLA   │ ─FSLA or ────┘                               └─ independently (where authorised)
 └─────────┘ recognised equivalent
                                                                     ┌──────────────────────────┐
                                                                     │ REBF (firm, legal entity) │◄─ requires a Principal Broker
                                                                     └──────────────────────────┘
```

> **Analysis note:** RERA is a referral-only track (Article 10). The form does not say whether RERA experience counts towards REA. The system shall make "qualifying prior categories" configurable for each target category (BR-021). **Open question Q-03.**

### 3.2 Category eligibility matrix (derived from R1)

| Requirement | RERA | FSLA | REA | Broker | Assoc. Broker | Managing Broker | Principal Broker | REBF |
|---|---|---|---|---|---|---|---|---|
| Applicant type | Individual | Individual | Individual | Individual | Individual | Individual | Individual | Firm |
| Minimum age 18 | ✔ (G1.1) | ✔ (G2.1) | ✔ (assumed, BR-002) | ✔ (assumed) | ✔ (assumed) | ✔ (assumed) | ✔ (assumed) | n/a |
| Minimum education | A2 or equiv. (G1.2) | A2 certificate or equiv. (G2.2) | Relevant A1, business A0, bachelor's, or Art. 12 recognised (G3.1) | Estate Mgmt & Valuation / Valuation & Property Mgmt / Real Estate / recognised equiv. (G4.1) | (held via Broker license) | (held via Broker license) | (held via Broker license) | n/a |
| Training | — | Entry-level training cert (G2.3) | Professional training cert (G3.3) | Advanced Broker training cert (G4.3) | — | Additional management training, where applicable (G6.7) | — | n/a |
| Examination | — | — (D.6 "Not applicable" allowed) | REA licensing exam (G3.4) | Broker licensing exam (G4.4) | — | — | — | n/a |
| Experience | — | — | ≥ 3 yrs registered & documented as FSLA or recognised equiv. (G3.2) | ≥ 3 yrs documented as licensed REA (G4.2) | — | — | — | n/a |
| Prerequisite license | — | — | — | — | Valid Broker license (G5.1–2) | Broker license (G6.1) | Broker license (G7.1) | Principal Broker named (G8.11) |
| Supervisor / affiliation | Supervising Broker or designated practitioner, firm or approved referral arrangement (G1.3–4) | Supervising REA or Broker (G2.4) | Supervising Broker (G3.5) | Practice arrangement choice (G4.5) | REBF + Principal Broker (G5.3–4) | REBF + Principal Broker + branch (G6.2–5) | REBF or proposed firm reference (G7.2) | Directors, Principal Broker, branches (G8.10–12) |
| Acknowledgment | Referral-only restrictions, Art. 10 (G1.5) | No independent negotiation or binding agreements (G2.6) | — | — | Principal Broker's supervision & responsibility (G5.6) | — | Responsibility for supervision, client funds, records, compliance, complaints (G7.6) | — |
| Territory | — | Proposed geographic territory (G2.5) | — | — | — | Office or branch (G6.3) | Registered office & branches (G7.4) | Branches (G8.12) |
| Indemnity insurance | — | — | — | — | — | — | Where required (G7.5) | Where required (G8.17) |
| Section F applies | ✔ | ✔ | ✔ | Only if affiliated (F.15–16 otherwise) | ✔ | ✔ | Partly (firm data) | n/a |
| Section E 9–13 applies | — | — | ✔ | ✔ | — | — | — | — |

### 3.3 Application type × category validity matrix

| Application type (A.3) | Valid categories | Pre-conditions |
|---|---|---|
| New registration and licensing | RERA, FSLA, REA*, Broker*, Associate/Managing/Principal Broker** | No active registration in the same category. *REA and Broker may be new where equivalent experience is recognised (E.12–13). **Requires an existing Broker license. |
| Upgrade to a higher professional category | FSLA→REA, REA→Broker, Broker→Associate/Managing/Principal; RERA→FSLA (configurable) | Holds an active license in the lower category; experience threshold met |
| License renewal | All licensed categories, including REBF | License Active, or Expired within the grace period (BR-040) |
| Change of brokerage firm or affiliation | RERA, FSLA, REA, Associate Broker, Managing Broker, Principal Broker, Broker (affiliated) | Active license; new firm and supervisor confirm |
| Reinstatement of license | All individual categories, plus REBF | License Lapsed, Suspended (term ended) or Revoked (if the law allows); conditions met |
| Registration of a Real Estate Brokerage Firm | REBF only | Applicant is a firm account; selecting this type locks the category to REBF |

**FR-DOM-001 (M):** The system shall enforce this matrix and offer only valid category options for the selected application type. It shall explain why an option is unavailable, for example "Renewal is available once you hold an active license."

### 3.4 Core domain entities (conceptual)

```
Account ─1:1─ Person ─1:N─ Application ─1:N─ ApplicationSection (A–K snapshot)
   │              │              │      ├─1:N─ Document ─1:N─ DocumentVersion
   │              │              │      ├─1:N─ EligibilityResult
   │              │              │      ├─1:N─ ConfirmationRequest (supervisor / principal)
   │              │              │      ├─1:N─ Payment ─1:N─ PaymentTransaction
   │              │              │      ├─1:1─ Review (Section L) ─1:N─ VerificationCheck
   │              │              │      ├─1:N─ InformationRequest
   │              │              │      └─0:1─ Decision (Section M)
   │              ├─1:N─ Qualification / Training / ExamResult / ExperienceRecord
   │              ├─1:N─ License ─1:N─ LicenseStatusHistory, LicenseCondition
   │              └─1:N─ Affiliation (to Firm, with Supervisor)
   │
Account ─N:M─ Firm (via FirmMembership/roles) ─1:N─ Branch ─0:1─ ManagingBroker(License)
                 ├─1:N─ Director/Partner/ResponsiblePerson
                 ├─1:1─ PrincipalBroker(License)
                 └─1:N─ License (firm license)

RegisterEntry (public projection of License + Person/Firm + Affiliation)
AuditEvent (append-only, for every entity)
```

---

## 4. Application lifecycle and state machines

### 4.1 Application status

```
 DRAFT ──submit──► PENDING_PAYMENT ──paid──► PENDING_CONFIRMATIONS ──all confirmed──► SUBMITTED
   │                    │  (if fees)                │ (if supervisor/principal            │
   │ withdraw/expire    │ payment failed            │  confirmation needed)             ▼
   ▼                    ▼ (retry)                   │ declined ─► ACTION_REQUIRED    UNDER_REVIEW
 WITHDRAWN / EXPIRED_DRAFT                          ▼                                   │
                                          ACTION_REQUIRED ◄──── info requested ─────────┤
                                          (applicant edits    ─── applicant responds ──►│
                                           only unlocked fields)                        │
                                                                         ┌──────────────┤
                                                       FURTHER_ASSESSMENT◄┘   recommendation
                                                                │                       ▼
                                                                └───────────► PENDING_DECISION
                                                                                        │
                       ┌───────────────┬──────────────────────────┬─────────────────────┤
                       ▼               ▼                          ▼                     ▼
                   APPROVED   APPROVED_WITH_CONDITIONS   DEFERRED (→ ACTION_REQUIRED)  REJECTED
                       │               │                                                │
                       └──────┬────────┘                                                ▼
                              ▼                                                   (appeal window,
                        LICENSE_ISSUED  (Section N complete, register updated)     see Q-09)
```

**FR-WF-001 (M):** The system shall implement the application state machine above. Transitions must be explicit, validated against the actor's role, and recorded in the audit trail with actor, timestamp, from-state, to-state and reason.

**FR-WF-002 (M):** Applicant edits shall be possible only in `DRAFT` and `ACTION_REQUIRED`. In `ACTION_REQUIRED`, only the fields and documents named in the information request are unlocked.

**FR-WF-003 (M):** Payment ordering shall be configurable: pay-at-submission (default) or pay-after-eligibility-screening. The state machine above shows the default.

**FR-WF-004 (S):** Drafts with no activity for N days (default 90) shall be flagged. The applicant receives reminders at N−14 and N−3 days, and the draft then moves to `EXPIRED_DRAFT`. Uploaded documents are kept according to the retention policy (§15.4).

**FR-WF-005 (M):** An applicant may withdraw an application before the decision. Refund eligibility follows the configured fee rules (FR-PAY-012).

**FR-WF-006 (M):** Service-level timers shall run for each state. For example: review starts within 3 working days of SUBMITTED, applicants have 30 days to answer an information request, and supervisors have 14 days to confirm. Each timer has escalation actions.

### 4.2 License status

```
            issue                    expiry date passes          grace period ends
 (none) ──────────► ACTIVE ─────────────────────────► EXPIRED ─────────────────────► LAPSED
                     │  ▲                               │ renew within grace            │ reinstatement
                     │  └───────── renewed ─────────────┘                               ▼ application
                     │                                                               ACTIVE
          suspend    ▼          reinstate (term ends / lifted)
                 SUSPENDED ───────────────────────────────► ACTIVE
                     │
          revoke     ▼
                  REVOKED ──(reinstatement only if permitted by law)──► ACTIVE
 ACTIVE ── surrender/upgrade-superseded ──► SURRENDERED / SUPERSEDED
```

**FR-WF-010 (M):** License status changes shall be reflected on the public register within 5 minutes.

**FR-WF-011 (M):** When a supervising license becomes SUSPENDED, REVOKED or LAPSED, the system shall flag every dependent practitioner whose supervision relies on it (RERA, FSLA, REA, Associate). It notifies them and their firm's Principal Broker and gives a configurable period to name a new supervisor (BR-050).

**FR-WF-012 (M):** When an upgrade is approved, the earlier category license shall become `SUPERSEDED`, and its history shall remain visible.

### 4.3 Confirmation request status

`PENDING → CONFIRMED | DECLINED | EXPIRED | CANCELLED`. These apply to supervisor confirmation, Principal Broker affiliation confirmation, and REBF designation of a Principal or Managing Broker.

---

## 5. Functional requirements — applicant portal

### 5.1 Account and identity (workflow step 1)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-ACC-001 | M | The system shall let a user create a **unique account** with email and mobile number. Both must be verified (email link or OTP, SMS OTP) **before** the user can reach the application functions. | WF-1; Rec. "Unique applicant account" |
| FR-ACC-002 | M | The system shall support two account types: **Individual** and **Organisation (Firm)**. One person may act for one or more firms through roles (FR-FIRM-001). | WF-3 |
| FR-ACC-003 | M | The system shall prevent duplicate individual accounts. It matches on National ID or passport number + nationality. On a match it offers account recovery instead of a new account. | B.2 |
| FR-ACC-004 | M | Authentication: password (min. 12 characters, breached-password check), plus **MFA** (TOTP app or SMS OTP). MFA is mandatory for all back-office users and Principal Brokers, and optional but encouraged for applicants. | Sec. |
| FR-ACC-005 | S | Support passkeys (WebAuthn) as a passwordless option. | Modernisation |
| FR-ACC-006 | C | Support federated login through the national digital identity service, if one is available. | INT |
| FR-ACC-007 | M | Account recovery shall use verified email or phone, with a cooling-off period and a notification when email, phone or password changes. | Sec. |
| FR-ACC-008 | M | A change of verified email or phone shall need re-verification and shall be recorded in the audit trail. | Rec. Audit |
| FR-ACC-009 | M | The profile shall hold reusable personal, education, training, experience and affiliation data. New applications pre-fill from it, and the user can review each pre-filled field. | Modernisation |
| FR-ACC-010 | M | Session management: idle timeout (applicants 30 min, staff 15 min), absolute timeout, a "sign out everywhere" option, and a list of active sessions. | Sec. |

### 5.2 Dashboard and tracking

| ID | Pri | Requirement |
|---|---|---|
| FR-PORTAL-001 | M | The applicant dashboard shall show: active licenses (category, number, status, expiry, QR certificate); applications in progress with a **progress percentage** and next action; required actions (information requests, payments, confirmations); and notifications. |
| FR-PORTAL-002 | M | Each application shall have a **status timeline** with every state change, dates, expected next step and SLA expectation, e.g. "Review normally starts within 3 working days". |
| FR-PORTAL-003 | M | The applicant shall be able to download the electronic acknowledgment of receipt, payment receipts, decision letter and license certificate (PDF). |
| FR-PORTAL-004 | M | The system shall offer smart call-to-action cards: "Your license expires in 45 days — Renew now", "Supervisor has not confirmed — Send reminder", and "You become eligible to upgrade to Broker on 12 Mar 2027". |
| FR-PORTAL-005 | S | Secure messaging thread per application between applicant and officer, with attachments. Every message is kept in the audit trail. |
| FR-PORTAL-006 | M | **Eligibility pre-check ("Am I eligible?")** — a public, no-login tool that asks a few questions (age, education, experience, current license) and recommends the matching category with a checklist of documents to prepare. |
| FR-PORTAL-007 | S | Category comparison page: what each category may and may not do, with requirements, fees and typical timeline. |
| FR-PORTAL-020 | S | **Assisted filing mode:** an authorised officer may start an application on behalf of a walk-in applicant. The applicant confirms through OTP or declaration, and the application is tagged "assisted". |

### 5.3 Guided application wizard (workflow steps 2–6)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-WIZ-001 | M | The application shall be a **guided, multi-step wizard**, not one long form. Steps are generated from application type, category and applicant type (individual or firm). | WF; "guided process" |
| FR-WIZ-002 | M | Step 1 shall be **Application type and category** (Section A). It shapes every later step, the checklist, the eligibility rules and the fees. | A.3, A.4, C-05 |
| FR-WIZ-003 | M | The wizard shall display **only applicable sections and fields**. Hidden sections are excluded from validation and from the submitted data. | Section G note; WF-2 |
| FR-WIZ-004 | M | **Save-and-resume:** autosave every field change (debounced ≤ 2 s) and on step navigation. The user can leave and resume from any device. | Rec. Save-and-resume |
| FR-WIZ-005 | M | A step navigator shows completion state per step (not started, in progress, complete, has errors). Users may move between completed steps freely. | UX |
| FR-WIZ-006 | M | **Inline validation** on blur, with clear, actionable error messages in plain language. An error summary at submission links to each failing field. | Rec. Mandatory field validation |
| FR-WIZ-007 | M | **Real-time eligibility feedback:** when data affecting eligibility is entered (date of birth, education level, experience dates, license), the system shall show eligibility status without blocking further input, e.g. "Based on your experience dates you have 2 years 7 months; REA requires 3 years." | Rec. Automatic eligibility checks |
| FR-WIZ-008 | M | A **review and summary** step before declaration shows every entered value grouped by section, with "Edit" links and the generated document checklist status. | J, I |
| FR-WIZ-009 | M | Changing the category or application type after data entry shall warn the user. Data that no longer applies is kept in the draft but hidden, so it can be restored if the user switches back. | UX |
| FR-WIZ-010 | M | For renewal, upgrade, change of affiliation and reinstatement, the wizard shall **pre-populate** from the existing license and profile. The applicant confirms or updates the data, and only the deltas need evidence. | Modernisation |
| FR-WIZ-011 | S | The wizard shall be usable **offline-tolerant**: field input is cached locally if connectivity drops and synced on reconnect, with conflict notification. | Context: mobile/3G |
| FR-WIZ-012 | M | A visible **help panel** per step explains the legal basis, e.g. "Why do we ask this? Article 12 requires…". | UX |
| FR-WIZ-013 | M | Before allowing submission, the system shall run the full rule set (BR catalogue), the document checklist and the declaration checks. Failures block submission. Warnings (e.g. "foreign qualification needs recognition evidence") are shown but may let the user proceed where the rules permit. | Rec. Eligibility checks at submission |
| FR-WIZ-014 | M | On successful submission the system shall generate the **application reference number** and an **electronic acknowledgment of receipt**, both shown on screen and sent by email and SMS. | K, after-submission note |

---

## 6. Functional requirements — application form sections A–K

### 6.1 Section A — Application details

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-A-001 | M | The system shall generate a unique, immutable **Application Reference Number** when the draft is created, in the format `REBP-{YYYY}-{TYPECODE}-{SEQ6}-{CHK}`, e.g. `REBP-2026-NEW-000123-7`. It includes a check digit. | A.1 |
| FR-A-002 | M | The system shall record the **Application Date** automatically: draft-created date, and the submission date captured separately (K.8). | A.2 |
| FR-A-003 | M | Application type single-select: New registration and licensing; Upgrade to a higher professional category; License renewal; Change of brokerage firm or affiliation; Reinstatement of license; Registration of a Real Estate Brokerage Firm. | A.3 |
| FR-A-004 | M | Professional category single-select: RERA, FSLA, REA, Real Estate Broker, Associate Broker, Managing Broker, Principal Broker, REBF. | A.4 |
| FR-A-005 | M | Valid combinations shall be enforced per §3.3. "Registration of a Real Estate Brokerage Firm" forces category REBF and the Organisation flow. | A.3/A.4 |
| FR-A-006 | M | For Upgrade, Renewal, Change of affiliation and Reinstatement, the applicant shall select the **existing license** concerned from the licenses linked to their account. If it is not linked, they claim it through license number + identity match, which is verified by an officer. | A.3; E.3 |
| FR-A-007 | S | Category selection cards shall show a short description, key requirements, indicative fee and a "Check eligibility" link. | UX |

### 6.2 Section B — Applicant's personal information (individuals)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-B-001 | M | Capture **full legal name** in structured parts (surname, given names, other names), plus the full name as it appears on the ID. | B.1 |
| FR-B-002 | M | Capture **identification**: document type (National ID / Passport / Refugee ID / Other prescribed), number, issuing country and expiry (passport). National ID format is validated, e.g. 16 digits (configurable). | B.2 |
| FR-B-003 | M | Where integration is available, verify the National ID against the national identity registry and pre-fill name, date of birth and gender. A mismatch is flagged for officer review (INT-001). | B.2, L.4 |
| FR-B-004 | M | Capture **date of birth**. Age is computed and the **minimum age of 18** is evaluated (BR-001). | B.3, G1.1, G2.1 |
| FR-B-005 | M | Capture **nationality** from an ISO 3166 list. Multiple nationalities are allowed (S). | B.4 |
| FR-B-006 | M | Capture **gender only if required by the applicable registration framework**. The field is controlled by a configuration flag and, when enabled, offers a "Prefer not to say" option where the law permits. | B.5 |
| FR-B-007 | M | Capture the **telephone number** in E.164 format, with country code (default +250). It defaults to the verified account phone. | B.6 |
| FR-B-008 | M | Capture the **email address**, defaulting to the verified account email. | B.7 |
| FR-B-009 | M | Capture the **residential address** using **cascading selects**: Province → District → Sector → Cell → Village, sourced from a maintained administrative reference dataset, plus "Street or other address details" (free text). | B.8 |
| FR-B-010 | M | Provide a **"Professional/business address same as residential"** toggle. If off, capture the professional address with the same structure. | B.9 |
| FR-B-011 | S | For applicants resident abroad, offer an "Address outside the country" mode with an international address format. | B.8 |
| FR-B-012 | C | Optional map pin (geolocation) for the professional address. | Modernisation |
| FR-B-013 | M | Capture **current occupation** (free text plus an optional classification) and **current employer, if applicable**. | B.10, B.11 |
| FR-B-014 | M | Upload a **recent colour passport-size photograph**: JPEG or PNG, ≥ 600×600 px, ≤ 2 MB. The client offers crop and guidance, and an automated quality check covers face detection, plain background and no sunglasses (S). The photo is used on the license certificate. | B.12 |
| FR-B-015 | M | Upload **proof of identity** (PDF, JPEG or PNG). Front and back for ID cards; the bio page for passports. | B.13 |
| FR-B-016 | S | Mobile **camera capture** for photograph and ID, with auto-crop and glare detection. | UX |

### 6.3 Section C — Educational qualifications

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-C-001 | M | Capture **highest level of education attained**: A2 or equivalent; A1 or equivalent; A0 or equivalent; Bachelor's degree; Postgraduate qualification; Other recognised qualification. | C.1 |
| FR-C-002 | M | For each qualification, capture: institution name (searchable list of recognised institutions + free text), qualification obtained, field of study (controlled list + free text), year of completion, and certificate or diploma number where applicable. | C.2–C.6 |
| FR-C-003 | M | Allow **multiple qualifications** (repeatable group). One is marked "highest", and one or more are marked "relied upon for this category". | C.1–C.7 |
| FR-C-004 | M | Upload **educational certificate(s)**, mandatory per qualification relied upon. | C.7 |
| FR-C-005 | M | Upload **academic transcripts where required**. The rule is configurable per category and qualification level, e.g. required for Broker field-of-study validation. | C.8 |
| FR-C-006 | M | Ask **"Is the qualification obtained outside the country?"** (Yes/No). If Yes, **evidence of recognition or equivalence** is required, e.g. an equivalence certificate from the competent education authority. The rule is configurable (BR-012). | C.9, C.10 |
| FR-C-007 | M | The eligibility engine shall evaluate the education level against the category minimum (BR-010, BR-011) and, for REA and Broker, the **field of study** relevance (BR-013, BR-014). Ambiguous fields are routed to officer judgment ("Further assessment required"). | G1.2, G2.2, G3.1, G4.1 |
| FR-C-008 | S | Maintain a configurable **Recognised Qualifications Register** (Article 12) that maps qualification titles and fields to the categories they satisfy. It is used for auto-classification and officer decisions. | G3.1 (Art. 12) |
| FR-C-009 | C | Integrate with education authority verification services (secondary-exam results, higher education council equivalence) where available. | INT |

### 6.4 Section D — Professional training and examinations

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-D-001 | M | Ask **"Have you completed the prescribed professional training for the category applied for?"** (Yes/No). If No and training is mandatory for the category, the system shall block submission and explain which training is required (BR-015). | D.1 |
| FR-D-002 | M | Capture **training provider** (select from accredited providers + "Other" with justification), **training programme** (filtered by provider and category), **date of completion** and **training certificate number**. | D.2–D.5 |
| FR-D-003 | M | Ask **"Have you passed the required licensing examination?"** (Yes / No / Not applicable). "Not applicable" is permitted only for categories without an exam (RERA, FSLA, Associate, Managing, Principal, REBF; configurable). | D.6 |
| FR-D-004 | M | Capture **examination reference number**, **examination date** and the **examination result or certificate** upload. | D.7–D.9 |
| FR-D-005 | M | Upload **additional professional certifications, if any** (repeatable, optional). | D.10 |
| FR-D-006 | S | Where integration with the training or examination provider exists, auto-verify the certificate or exam reference and attach the verified result (INT-005). | L.7 |
| FR-D-007 | M | Configurable rule: exam results remain valid for N years (default 3) from the exam date. Expired results produce a blocking error (BR-016). | D.8 |
| FR-D-008 | M | The training certificate type must match the category: entry-level → FSLA, professional → REA, advanced Broker → Broker, management → Managing Broker where applicable. | G2.3, G3.3, G4.3, G6.7 |

### 6.5 Section E — Professional experience

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-E-001 | M | Capture **total years of relevant professional experience**. This is **computed** from the experience records (FR-E-003) and shown read-only. The applicant may add a declared figure, and differences are flagged. | E.1 |
| FR-E-002 | M | Capture **current or most recent professional category** (select), and **previous registration or license number, if applicable**. If the license exists in the system, it is linked and verified automatically. | E.2, E.3 |
| FR-E-003 | M | Repeatable **experience records**: brokerage firm name (search existing REBFs + free text), category held, start and end dates (period of employment or affiliation), description of relevant professional duties (rich text, max 2,000 characters), and evidence upload. | E.4–E.7 |
| FR-E-004 | M | Capture **reference or verification contact, where required**: name, role, phone, email. Optionally the system sends a verification request to the referee (S). | E.8 |
| FR-E-005 | M | **For REA and Broker applicants** additionally capture: previous category under which the experience was acquired; date of initial registration or licensing; evidence of the required period of **registered** professional practice (upload). | E.9–E.11 |
| FR-E-006 | M | Ask **"Has the Professional Body recognised any equivalent experience?"** (Yes/No). If Yes, capture the recognition reference or supporting decision (reference + upload). | E.12, E.13 |
| FR-E-007 | M | The eligibility engine shall compute **qualifying experience** for REA (≥ 3 years as FSLA or recognised equivalent) and Broker (≥ 3 years as **licensed** REA). Overlapping periods are not double-counted. For practitioners already in the register, license history from the register is preferred to self-declared data (BR-020–BR-023). | G3.2, G4.2 |
| FR-E-008 | S | Show an **experience timeline visualisation** with qualifying and non-qualifying periods, gaps and overlaps, and the date the threshold is or will be met. | UX |
| FR-E-009 | M | Periods during which the license was SUSPENDED shall not count towards qualifying experience (configurable; BR-022). | G3.2 "registered" |

### 6.6 Section F — Brokerage firm affiliation and supervision

**Applicability:** RERA, FSLA, REA, Associate Broker and Managing Broker, plus any other category required to operate under a licensed firm. For Brokers, F.15–16 cover independent practice.

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-F-001 | M | Ask **"Are you currently affiliated with a licensed Real Estate Brokerage Firm?"** (Yes/No). For categories that must be affiliated, "No" means the applicant must name a **proposed** firm, or for RERA an approved referral-only arrangement. | F.1 |
| FR-F-002 | M | **Firm lookup:** typeahead search of licensed REBFs in the register, by name or registration number. Selecting a firm auto-fills the brokerage firm name, firm registration or license number, the firm's registered address, the Principal Broker's full name and the Principal Broker's license number. A firm not yet registered may be entered manually and flagged "unverified". | F.2–F.6 |
| FR-F-003 | M | Capture **Managing Broker's name, where applicable**: select from the firm's branches and Managing Brokers. | F.7 |
| FR-F-004 | M | Capture **Supervising Broker or designated practitioner's name** and **license number** through a register lookup. The system shall validate that the supervisor holds an **active** license in a category **permitted to supervise** the applicant's category (BR-030). | F.8, F.9 |
| FR-F-005 | M | Capture **date of commencement of affiliation**. The date cannot be in the future by more than N days (configurable) and cannot precede the firm's license date. | F.10 |
| FR-F-006 | M | Upload **supporting evidence of affiliation or appointment**, e.g. an affiliation agreement or appointment letter. | F.11 |
| FR-F-007 | M | **Digital confirmation:** on submission, the system shall send a **confirmation request** to the named supervisor and to the firm's Principal Broker. Each may Confirm or Decline (with reason) in their inbox. The application proceeds to review only when all mandatory confirmations are received, or when an officer overrides with reason. | Rec. "supervisor confirmation" notification |
| FR-F-008 | M | **RERA under an approved referral-only arrangement:** capture the name of the approved referral arrangement, the approval or authorisation reference and an evidence-of-approval upload. A lookup of approved arrangements is used if they are maintained in the system (S). | F.12–F.14 |
| FR-F-009 | M | **Independent Broker practice:** ask "Do you intend to practise independently?" (Yes/No). If Yes, capture the applicable authorisation or supporting information required by the Professional Body (reference + upload + free text). | F.15, F.16 |
| FR-F-010 | M | The system shall maintain **Affiliation** records with start and end dates. A Change-of-affiliation application, once approved, ends the previous affiliation on the approved date and starts the new one. The previous firm's Principal Broker is notified. | A.3 |
| FR-F-011 | S | The Principal Broker of the outgoing firm may record outstanding matters (e.g. open transactions or client funds) as an informational note for the officer. This note never blocks the application (the practitioner's right to move is preserved). | Domain good practice |

### 6.7 Section H — Compliance and professional integrity

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-H-001 | M | Ask, each Yes/No: (1) convicted of a criminal offence relevant to professional eligibility, subject to applicable law; (2) subject to a professional disciplinary sanction or license suspension; (3) previously had a professional registration or license revoked; (4) currently subject to any restriction that may legally prevent practice. | H.1–H.4 |
| FR-H-002 | M | If any answer is **Yes**, require a details narrative (structured: nature, date, authority, outcome, current status) and supporting documents. A "Yes" does **not** auto-reject. It routes to officer assessment (BR-060). | H.5 |
| FR-H-003 | M | Upload a **criminal record certificate or other prescribed evidence**, with configurable validity (default issued ≤ 6 months before submission; BR-061). | H.6 |
| FR-H-004 | M | Ask "Are you willing to comply with the applicable professional code of conduct and ethical standards?" (Yes/No). **"No" blocks submission** (BR-062). A link to the code of conduct is shown, and the version accepted is recorded. | H.7 |
| FR-H-005 | M | The question wording for H.1 shall be configurable so it can track the legal definition of "relevant" offences and spent-conviction rules. | H.1 "subject to applicable law" |
| FR-H-006 | M | Section H answers and uploads shall be classified **Highly Sensitive**. Access is restricted to authorised reviewing and approving roles, and every view is logged (SEC-020). | Important Note 1 |
| FR-H-007 | S | The system shall cross-check the register for previous sanctions, suspensions or revocations against the applicant's identity and flag inconsistencies with the declared answers. | H.2, H.3 |

### 6.8 Section I — Document checklist

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-I-001 | M | The system shall **generate a dynamic document checklist** from category, application type, applicant type and conditional answers (e.g. foreign qualification = Yes adds "Recognition/equivalence evidence"). | Section I |
| FR-I-002 | M | Checklist item types (master list): proof of identity; recent colour passport-size photograph; educational certificates; academic transcripts where required; professional training certificates; licensing examination results; evidence of relevant professional experience; criminal record certificate or prescribed evidence; proof of professional address where required; evidence of brokerage firm affiliation or appointment where applicable; evidence of previous registration or license where applicable; company registration documents (REBF); professional indemnity insurance evidence where required; proof of payment of prescribed fees; other documents required by the competent authority. | Section I |
| FR-I-003 | M | Each checklist item shall show: status (Missing / Uploaded / Under scan / Rejected by scan / Verified by officer / Rejected by officer, with reason), whether it is mandatory or conditional, accepted file types and size, and a short "what good looks like" example. | UX |
| FR-I-004 | M | Proof of fee payment is satisfied **automatically** by a successful online payment record. No upload is needed unless the payment was offline (bank deposit slip). | I; K |
| FR-I-005 | M | "Other documents required by the competent authority" shall be addable by an officer during review as a **specific, named requirement** attached to an information request. | I; L.12 |
| FR-I-006 | M | The checklist matrix (Appendix B) shall be **configurable** by an administrator without code changes, and versioned. Applications keep the checklist version that was in force at submission. | Maintainability |

### 6.9 Section J — Applicant's declaration and consent

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-J-001 | M | Display the **eight declaration statements** verbatim (configurable, versioned, multilingual): (1) truth and accuracy; (2) eligibility met or disclosed; (3) submission does not automatically confer registration; (4) undertaking to comply with laws, Instructions, standards and the code; (5) duty to notify material changes; (6) consequences of false statements, forged documents or omissions; (7) consent to verification; (8) acknowledgment of personal data processing. | J.1–J.8 |
| FR-J-002 | M | The applicant must tick **"I confirm that I have read and accepted the declaration."** Individual acknowledgment of each statement is configurable (S). | J checkbox |
| FR-J-003 | M | Capture **Applicant's full name**, pre-filled and locked to the verified identity; for firms, the authorised signatory's name and capacity. | J |
| FR-J-004 | M | **Electronic signature or approved authentication:** the applicant re-authenticates with an OTP sent to the verified phone or email (or passkey or national digital signature where available). The system records signer identity, method, timestamp, IP, user agent and a **hash of the submitted application snapshot**. | J |
| FR-J-005 | M | **Date** is system-captured at signing. | J |
| FR-J-006 | M | Link to the **Privacy Notice** (data controller, purposes, legal basis, retention, rights, transfers, DPO contact). The version accepted is recorded. | J.8; Note 1 |
| FR-J-007 | M | For **REBF** applications, the declaration shall be signed by an authorised director or officer of the firm, and the system shall record their authority, e.g. a board resolution upload (S). | J; G8 |

### 6.10 Section K — Payment and submission

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-PAY-001 | M | Calculate the **registration fee**, **licensing fee**, **other prescribed fees** (e.g. late renewal penalty, reinstatement fee, certificate reissue) and the **total amount payable** from a configurable **fee schedule** keyed by category × application type × applicant type × timing. | K.1–K.4 |
| FR-PAY-002 | M | Show an itemised fee breakdown **before** payment, with the legal or fee-schedule reference. | K |
| FR-PAY-003 | M | Generate a unique **payment reference** for each payment attempt, linked to the application. | K.5 |
| FR-PAY-004 | M | Support payment methods: **mobile money** (e.g. MTN MoMo, Airtel Money), **card** (Visa/Mastercard, 3-D Secure), **bank transfer or deposit**, with an offline slip upload and Finance confirmation. Methods are integrated through an aggregator or government payment gateway where mandated (INT-010). | K.6 |
| FR-PAY-005 | M | Track **payment status**: Pending / Paid / Failed / Refunded (+ Partially refunded, Expired). The status is updated from gateway webhooks or callbacks, with idempotent handling and periodic reconciliation polling. | K.7 |
| FR-PAY-006 | M | Record the **application submission date** (system-generated) when submission completes. | K.8 |
| FR-PAY-007 | M | Issue an **electronic receipt** (PDF + email) on successful payment, carrying the receipt number, payer, items, method, transaction ID and timestamp. | I "Proof of payment" |
| FR-PAY-008 | M | Fee waivers or exemptions (where prescribed) shall be approvable by Finance with a reason, and recorded in the audit trail. | K.3 |
| FR-PAY-009 | M | The fee schedule shall be versioned with effective dates. An application is charged by the schedule in force at the time payment is initiated, unless policy states otherwise. | Maintainability |
| FR-PAY-010 | M | **Daily reconciliation** of gateway settlements against internal payments, with an exception report for unmatched, duplicate and amount-mismatch items. | Finance |
| FR-PAY-011 | M | A duplicate payment for the same application shall be detected and flagged for refund. | Finance |
| FR-PAY-012 | M | **Refund workflow:** request → Finance approval (maker-checker) → gateway refund or manual → status Refunded. Refund rules are configurable, e.g. no refund after review starts unless the Professional Body is at fault. | K.7 |
| FR-PAY-013 | S | Payment links can be shared, e.g. a firm pays on behalf of an agent; the payer may differ from the applicant. | UX |
| FR-PAY-014 | M | **Applicant action: Submit application.** Submission is a single explicit action after declaration and payment (or pending-payment per FR-WF-003). | K |

---

## 7. Functional requirements — category-specific requirements (Section G)

**FR-G-000 (M):** The portal shall render **only** the G-subsection that matches the selected category (C-05). Data already captured in Sections B–F shall be **re-used**, not re-entered: G-subsections display a pre-filled confirmation and add only the category-unique items.

### 7.1 G1 — Real Estate Referral Agent (RERA)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G1-001 | M | Confirm **minimum age of 18**, computed from DOB (BR-001). | G1.1 |
| FR-G1-002 | M | Confirm **A2-level education or recognised equivalent** (BR-010). | G1.2 |
| FR-G1-003 | M | Capture the **proposed brokerage firm or approved referral-only arrangement** (one of the two is mandatory). | G1.3 |
| FR-G1-004 | M | Capture **name and license number of the supervising Broker or designated practitioner**, validated against the register (BR-030). | G1.4 |
| FR-G1-005 | M | Show the **referral-only restrictions under Article 10** in full text and require explicit acknowledgment, with the version recorded. | G1.5 |
| FR-G1-006 | S | The RERA license certificate and the public register entry shall show "Referral only" as the scope. | Art. 10; N.3 |

### 7.2 G2 — Field Sales and Leasing Agent (FSLA)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G2-001 | M | Confirm **minimum age of 18** (BR-001). | G2.1 |
| FR-G2-002 | M | Require an **A2-level secondary school certificate or recognised equivalent**, uploaded (BR-010). | G2.2 |
| FR-G2-003 | M | Require an **entry-level professional training certificate** (BR-015). | G2.3 |
| FR-G2-004 | M | Capture the **name and license number of the supervising REA or Broker**, validated (BR-030). | G2.4 |
| FR-G2-005 | M | Capture the **proposed geographical territory of operation**: multi-select of Provinces/Districts (and optionally Sectors), shown on a map preview (S). This feeds the authorised geographic scope in M.8. | G2.5, M.8 |
| FR-G2-006 | M | Require acknowledgment of the **restrictions on independent negotiation and execution of binding agreements**. | G2.6 |

### 7.3 G3 — Real Estate Agent (REA)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G3-001 | M | Require a **relevant A1-level qualification, A0-level business-related qualification, bachelor's degree, or other qualification expressly recognised under Article 12** (BR-011, BR-013). | G3.1 |
| FR-G3-002 | M | Require **evidence of ≥ 3 years of registered and documented experience as an FSLA or recognised equivalent** (BR-020). | G3.2 |
| FR-G3-003 | M | Require a **professional training certificate** (BR-015). | G3.3 |
| FR-G3-004 | M | Require an **REA licensing examination result** (BR-016). | G3.4 |
| FR-G3-005 | M | Capture the **name and license number of the supervising Broker** (BR-030). | G3.5 |

### 7.4 G4 — Real Estate Broker

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G4-001 | M | Require a qualification in **Estate Management and Valuation, Valuation and Property Management, Real Estate, or another recognised equivalent** (BR-014). | G4.1 |
| FR-G4-002 | M | Require **evidence of ≥ 3 years documented experience as a licensed REA** (BR-021). | G4.2 |
| FR-G4-003 | M | Require an **advanced Broker training certificate** (BR-015). | G4.3 |
| FR-G4-004 | M | Require a **Broker licensing examination result** (BR-016). | G4.4 |
| FR-G4-005 | M | Capture the **intended practice arrangement**: Independent practice, where authorised (→ F.15–16 required); Affiliation with a licensed REBF (→ Section F required); Proposed establishment of or participation in a licensed REBF (→ link to, or prompt to start, an REBF registration; FR-FIRM-010). | G4.5 |

### 7.5 G5 — Associate Broker

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G5-001 | M | Capture the **existing Broker license number**, auto-linked and auto-validated when held by the applicant. | G5.1 |
| FR-G5-002 | M | **Current license validity confirmation**: automatic check that the Broker license is ACTIVE and not expiring within N days (warning) (BR-031). | G5.2 |
| FR-G5-003 | M | Capture the **name and registration number of the affiliated REBF** (register lookup). | G5.3 |
| FR-G5-004 | M | Capture the **Principal Broker's name and license number**, auto-filled from the firm. | G5.4 |
| FR-G5-005 | M | **Appointment or affiliation confirmation**: an upload **and** digital confirmation by the Principal Broker (FR-F-007). | G5.5 |
| FR-G5-006 | M | Require acknowledgment of the **professional supervision and regulatory responsibility of the Principal Broker**. | G5.6 |

### 7.6 G6 — Managing Broker

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G6-001 | M | Capture the **existing Broker license number**, validated ACTIVE (BR-031). | G6.1 |
| FR-G6-002 | M | Capture the **name and registration number of the REBF**. | G6.2 |
| FR-G6-003 | M | Capture the **office or branch assigned**: select from the firm's registered branches, or propose a new branch (which triggers a firm branch update request). | G6.3 |
| FR-G6-004 | M | Upload the **appointment letter issued by the REBF**. The Principal Broker confirms digitally. | G6.4 |
| FR-G6-005 | M | Capture the **name and license number of the Principal Broker**, auto-filled. | G6.5 |
| FR-G6-006 | M | Capture a **description of the proposed supervisory responsibilities** (structured: number of practitioners supervised, functions, plus free text). | G6.6 |
| FR-G6-007 | M | Upload **evidence of any additional prescribed management training, where applicable** (configurable requirement). | G6.7 |
| FR-G6-008 | M | A branch shall have **at most one active Managing Broker** at a time (configurable; BR-033). | Domain |

### 7.7 G7 — Principal Broker

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G7-001 | M | Capture the **existing Broker license number**, validated ACTIVE (BR-031). | G7.1 |
| FR-G7-002 | M | Capture the **name and registration number of the REBF, or the proposed firm registration reference**. This supports the case where the Principal Broker application runs in parallel with a pending REBF application (linked applications, FR-FIRM-011). | G7.2 |
| FR-G7-003 | M | Upload **proof of designation as Principal Broker**, e.g. a board resolution or appointment letter. | G7.3 |
| FR-G7-004 | M | Identify the **firm's registered office and branches, where applicable**, pulled from the firm profile. | G7.4 |
| FR-G7-005 | M | Capture **professional indemnity insurance details, where required**: insurer, policy number, cover amount, period, upload. Expiry is tracked (BR-070). | G7.5 |
| FR-G7-006 | M | Require **confirmation of responsibility** for (a) practitioner supervision, (b) client funds, (c) transaction records, (d) regulatory compliance and (e) consumer complaints. Each item is acknowledged separately. | G7.6 |
| FR-G7-007 | M | An REBF shall have **exactly one active Principal Broker** (BR-032). Approving a new Principal Broker supersedes the previous designation at the effective date. | Domain |

### 7.8 G8 — Real Estate Brokerage Firm (REBF)

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-G8-001 | M | Capture the **registered legal name of the firm** and the **trading name, if different**. | G8.1, G8.2 |
| FR-G8-002 | M | Capture the **legal form of the entity** (controlled list: private limited company, public company, partnership, sole proprietorship, cooperative, other). | G8.3 |
| FR-G8-003 | M | Capture the **company or legal entity registration number** and **date of incorporation or registration**. Where integration exists, validate against the company registry and pre-fill (INT-002). | G8.4, G8.6 |
| FR-G8-004 | M | Capture the **tax identification number, where required**, validated against the tax authority where integrated (INT-003). | G8.5 |
| FR-G8-005 | M | Capture the **registered office address** and the **principal place of business** (structured address; "same as" toggle). | G8.7, G8.8 |
| FR-G8-006 | M | Capture the **firm telephone number and official email address**. Both are verified by OTP or link. | G8.9 |
| FR-G8-007 | M | Capture **directors, partners or persons legally responsible**, as a repeatable group: full name, role, ID type and number, nationality, contact, shareholding % (S). Each is screened against the register for sanctions (S). | G8.10 |
| FR-G8-008 | M | Capture the **names and license numbers of the proposed Principal Broker and other designated supervisory practitioners**. Register lookup. The Principal Broker must confirm the designation digitally. | G8.11 |
| FR-G8-009 | M | Capture the **list of proposed branches and their Managing Brokers, where applicable**: branch name, address, phone, Managing Broker (register lookup), opening date. | G8.12 |
| FR-G8-010 | M | Uploads: **business registration certificate or Certificate of Domestic Company Registration**; **Full Registration Information of Domestic Company**; **tax registration evidence, where required**; **proof of registered business address** (lease or title); **professional indemnity insurance evidence, where required**. | G8.13–G8.17 |
| FR-G8-011 | M | Uploads or structured inputs: **evidence of the firm's proposed supervisory systems and procedures** (policy manual upload + a structured questionnaire, S); **evidence of arrangements for proper management of client funds and transaction records, where applicable** (e.g. a designated client account letter from a bank and a record-keeping policy). | G8.18, G8.19 |
| FR-G8-012 | M | **Any additional corporate documentation required by the competent authority**: a configurable list plus officer-added items. | G8.20 |
| FR-G8-013 | M | For REBF applications, Sections B–E are replaced by the corporate data above. Section H shall be answered **for the firm and for each director/responsible person** (configurable). | WF-3 |

---

## 8. Functional requirements — back office (Sections L, M, N)

### 8.1 Work management

| ID | Pri | Requirement |
|---|---|---|
| FR-BO-001 | M | Work queues by status, category, application type, SLA risk, assigned officer and region. Filter, sort and saved views are supported. |
| FR-BO-002 | M | **Assignment:** auto-assign (round-robin or load-balanced, configurable) and manual assign or reassign by a supervisor. Records the **assigned reviewing officer** (L.3). |
| FR-BO-003 | M | **Conflict-of-interest guard:** an officer cannot be assigned an application where they are the applicant, the supervisor, or a member of the same firm, or where they have declared a conflict. Officers can declare a conflict and recuse. |
| FR-BO-004 | M | **SLA indicators:** time in state, due dates and breach warnings. Escalation goes to the team lead. |
| FR-BO-005 | S | Bulk actions (assign, send reminder) with confirmation and audit. |
| FR-BO-006 | M | A 360° applicant view: profile, all applications, licenses, affiliations, history, sanctions, communications and payments. |

### 8.2 Section L — Administrative review

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-L-001 | M | The review record shall show the **application reference number** and **date received** (submission timestamp). | L.1, L.2 |
| FR-L-002 | M | Record the **assigned reviewing officer** (from assignment). | L.3 |
| FR-L-003 | M | **Verification checklist** with a per-item outcome: Identity verification (Verified / Pending / Failed); Educational qualifications; Professional experience; Training and examination; Brokerage affiliation or appointment; Criminal record or prescribed integrity checks. Every item except Identity also offers "Not applicable". | L.4–L.9 |
| FR-L-004 | M | Each verification item shall show the **auto-check evidence**: integration response, eligibility engine output, document links, supervisor confirmation status. The officer can then record the outcome in one click and add an optional note. | Efficiency |
| FR-L-005 | M | **Supporting documentation:** Complete / Incomplete, pre-computed from the checklist and overridable with reason. | L.10 |
| FR-L-006 | M | **Eligibility under the applicable category:** Satisfied / Not satisfied / Further assessment required. Pre-computed by the eligibility engine and overridable with a mandatory reason (BR-090). | L.11 |
| FR-L-007 | M | **Additional information requested:** the officer composes a request from templates, selects the specific fields and documents to unlock, and sets a due date. This sends the application to `ACTION_REQUIRED` and notifies the applicant. Multiple request rounds are kept in history. | L.12 |
| FR-L-008 | M | **Reviewer's comments**: internal (not visible to the applicant) and applicant-visible comments are separated. | L.13 |
| FR-L-009 | M | **Recommended decision**: Approve / Request additional information / Refer for further assessment / Reject, with reasons. Reject requires reason codes + narrative + legal reference. | L.14 |
| FR-L-010 | M | Record the **reviewing officer's name**, **signature or electronic approval** (re-authentication) and **date**, making the review record read-only. Amendments after this create a new review version. | L footer |
| FR-L-011 | M | **Document viewer:** in-browser preview of PDF and images with zoom, rotate and side-by-side data comparison. Officers can mark each document Verified or Rejected with a reason. Documents can be downloaded only where permitted, and every download is watermarked with officer ID and timestamp. | UX/Sec |
| FR-L-012 | S | **"Further assessment":** route to a specialist or committee queue (e.g. foreign qualification equivalence, integrity disclosures), with its own SLA. | L.14 |
| FR-L-013 | S | Officer can trigger **external verification requests** (to a referee, firm, training provider or education authority) and track the responses. | L.6–L.7 |

### 8.3 Section M — Registration and licensing decision

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-M-001 | M | Only users with the **Approving Authority** role may record decisions. The approver **must not** be the officer who performed the Section L review of the same application (segregation of duties; BR-091). | M header |
| FR-M-002 | M | The decision record shall show the **application reference number**. | M.1 |
| FR-M-003 | M | **Decision:** Approved / Approved subject to legally permitted conditions / Deferred pending additional information / Rejected, with reasons. | M.2 |
| FR-M-004 | M | **Approved professional category** defaults to the applied category. The approver may approve a **lower** category only where the law allows and the applicant has consented (configurable; S). | M.3 |
| FR-M-005 | M | **Registration number:** assigned automatically on approval (a persistent practitioner or firm number, see FR-N-001). | M.4 |
| FR-M-006 | M | **License number, where applicable:** generated on approval; unique per license instance. | M.5 |
| FR-M-007 | M | **License issue date** defaults to the decision date; **license expiry or renewal date** is computed from the configured validity period (default 1 year, per "annual renewal reminder"; BR-040). | M.6, M.7 |
| FR-M-008 | M | **Authorised geographical scope, where applicable**: defaults from the FSLA territory or branch, editable by the approver. | M.8 |
| FR-M-009 | M | **Authorised practice arrangement**: Affiliated (firm X) / Independent / Referral-only arrangement Y / Firm Principal etc. | M.9 |
| FR-M-010 | M | **Supervising Broker or Principal Broker, where applicable**: from Section F and confirmations. | M.10 |
| FR-M-011 | M | **Conditions or restrictions attached to the license**: chosen from a library of standard conditions plus free text. Each condition can have an end date and a compliance-evidence requirement. Conditions appear on the certificate and public register as configured. | M.11 |
| FR-M-012 | M | **Decision reasons or reference**: mandatory for Conditional, Deferred and Rejected. | M.12 |
| FR-M-013 | M | Record the **name and title of the approving authority**, the **electronic signature or approval reference**, and the **date of decision**. | M.13–M.15 |
| FR-M-014 | S | **Committee decisions:** support multi-approver decisions (quorum, votes recorded) where the Professional Body uses a licensing committee for certain categories (e.g. Principal Broker, REBF). | M |
| FR-M-015 | M | A **decision letter** (PDF) shall be generated from a template. A rejection letter includes reasons and information on any right of appeal or reconsideration (Q-09). | N.7 |
| FR-M-016 | S | **Batch approval:** an approver may approve multiple *recommended-approve* applications in one session after viewing each summary. Each application still gets its own signed decision record. | Efficiency |
| FR-M-017 | M | Decisions are **immutable** once signed. Corrections are made by a new, linked decision record (e.g. "correction of clerical error") with reason. | Integrity |

### 8.4 Section N — Electronic license and register entry

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-N-001 | M | On approval, generate a **unique practitioner or firm registration number**, persistent across categories (e.g. `RP-000123` for practitioners, `RF-000045` for firms). | N.1 |
| FR-N-002 | M | Generate the **license** and a **downloadable electronic certificate** (PDF/A). The certificate contains the photo, name, registration and license numbers, category, scope, practice arrangement, firm, issue and expiry dates, conditions summary, a **QR code** linking to the public verification page, and a cryptographic digital seal (PAdES). | N.2 |
| FR-N-003 | M | Record the **professional category, license status and authorised scope of practice**. | N.3 |
| FR-N-004 | M | Record the **firm affiliation and supervisory relationship, where applicable**. | N.4 |
| FR-N-005 | M | Record the **license validity period and renewal requirements**. | N.5 |
| FR-N-006 | M | **Add the approved practitioner or firm to the official register**, publishing only the fields designated public (FR-REG-003). | N.6 |
| FR-N-007 | M | **Notify the applicant electronically** of the decision by email, SMS and in-app, with links to the certificate and letter. | N.7 |
| FR-N-008 | M | Give the applicant access to the **applicable license conditions and professional obligations** in their dashboard, including the code of conduct and Article 10 text where relevant. | N.8 |
| FR-N-009 | M | License issue and register update shall run as an **atomic, idempotent transaction** after decision signing (C-04). If it fails, it is retried and an alert is raised. | WF-8 |
| FR-N-010 | S | Offer **digital wallet credential** export (e.g. a verifiable credential or Apple/Google Wallet pass) with a QR code for field use. | Modernisation |
| FR-N-011 | S | A **physical card print** request option with a fee, a print-batch export and a delivery status. | Modernisation |
| FR-N-012 | M | **Certificate reissue** (lost, name change, condition change): reissuing invalidates the previous certificate's QR (it shows "superseded, see current"). | Integrity |

### 8.5 Register administration

| ID | Pri | Requirement |
|---|---|---|
| FR-RA-001 | M | Registrar can **suspend** (with start/end date and reason), **lift suspension**, **revoke**, **record surrender**, **record death or dissolution**, and **correct register data**. Each action requires a reason, a reference document and approval as configured (maker-checker for revocation). |
| FR-RA-002 | M | Every register change creates a version. The public register shows the current state; history is visible to authorised staff. A public "status history" (e.g. "Suspended 01/02/2027–01/05/2027") is configurable. |
| FR-RA-003 | M | Record **disciplinary sanctions** with outcome, linked to the person or firm. These feed H.2/H.3 cross-checks. |
| FR-RA-004 | M | Data migration tooling to import **existing practitioners and firms** (legacy register) with validation reports, duplicate detection and claim codes so existing practitioners can link their accounts. |

---

## 9. Functional requirements — cross-cutting services

### 9.1 Eligibility engine

| ID | Pri | Requirement |
|---|---|---|
| FR-ELG-001 | M | A **rules engine** evaluates eligibility from the business rules catalogue (§10) and returns, per rule: `PASS`, `FAIL`, `WARN` or `NEEDS_ASSESSMENT`, plus a human-readable message (multilingual) and the evidence used. |
| FR-ELG-002 | M | Rules are **data-driven and versioned** (e.g. JSON/DSL rules with effective dates). Administrators can change thresholds (age, years, validity periods) and qualification mappings without a code deployment. Changes go through maker-checker approval. |
| FR-ELG-003 | M | The engine runs (a) live in the wizard (FR-WIZ-007), (b) at submission (blocking), and (c) at review (shown to the officer). Results are stored with the rule version used. |
| FR-ELG-004 | M | **"Eligible-from" projection:** where a time-based rule fails (experience), the engine computes the date the applicant will become eligible, assuming continuation. |
| FR-ELG-005 | S | A rule simulation tool for administrators: test a rule change against recent applications before activation. |

### 9.2 Document management

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-DOC-001 | M | Accepted types are configurable per document type. Defaults: PDF, JPEG, PNG (photos: JPEG/PNG only); HEIC is converted to JPEG on upload. | Rec. file-type validation |
| FR-DOC-002 | M | **Size limits per upload** are configurable per type. Defaults: 5 MB per file, photograph 2 MB, 25 MB total per application section. The client checks before upload and the server enforces. | Rec. size limits |
| FR-DOC-003 | M | Server-side validation: true MIME sniffing (magic bytes) and the extension must match; PDFs with embedded JavaScript or active content are rejected; encrypted or password-protected PDFs are rejected. | Sec. |
| FR-DOC-004 | M | **Malware scanning** of every upload before it becomes available to officers. Infected files are quarantined and the applicant is notified. | Sec. |
| FR-DOC-005 | M | Client-side **image compression** and **multi-page capture into a single PDF** (e.g. a transcript photographed page by page). | UX / low bandwidth |
| FR-DOC-006 | M | **Resumable uploads** (chunked, e.g. tus protocol) for unreliable connections, with progress indicators. | UX |
| FR-DOC-007 | M | Documents are **versioned**. Replacing a document keeps the previous version for audit, and only the current version counts towards the checklist. | Audit |
| FR-DOC-008 | M | Documents are stored **encrypted at rest** in object storage, accessed only through short-lived signed URLs after an authorisation check. They are never publicly addressable. | Sec. |
| FR-DOC-009 | S | **OCR and data extraction** (e.g. certificate number, name, dates) to pre-fill fields and flag mismatches between document and entered data. | Modernisation |
| FR-DOC-010 | S | A reusable **document wallet**: profile-level verified documents (ID, education) can be reused in later applications if still valid, without re-upload. | UX |
| FR-DOC-011 | M | Document **expiry tracking** for time-sensitive documents (criminal record certificate, insurance, passport), with reminders before expiry. | BR-061, BR-070 |

### 9.3 Notifications

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-NOT-001 | M | **Automated notifications** at least at: submission, supervisor confirmation (request, confirmed, declined), request for information, approval and rejection. Full catalogue in Appendix C. | Rec. notifications |
| FR-NOT-002 | M | Channels: **email**, **SMS**, **in-app**. WhatsApp (C) and web push (S) are optional. User preferences may disable non-mandatory channels; regulatory notices are always sent by email and in-app. | UX |
| FR-NOT-003 | M | Templates are multilingual, versioned and editable by an administrator, with variables (e.g. `{{applicant.firstName}}`, `{{application.ref}}`). They are previewed before activation. | Maint. |
| FR-NOT-004 | M | Delivery status (sent, delivered, failed, bounced) is tracked; failed critical notifications are retried and fall back to another channel. | Reliability |
| FR-NOT-005 | M | An **annual renewal reminder** schedule, configurable (e.g. 90, 60, 30, 14 and 7 days before expiry, on expiry, and during the grace period). | Rec. renewal reminder |
| FR-NOT-006 | S | Digest notifications for Principal Brokers (daily summary of pending confirmations and roster expiries). | UX |

### 9.4 Renewal management

| ID | Pri | Requirement |
|---|---|---|
| FR-REN-001 | M | Renewal opens N days before expiry (default 90). It is a short, pre-filled flow: confirm details, update changes, a fresh criminal record certificate if expired, renewal-specific requirements (e.g. CPD, Q-05), declaration and payment. |
| FR-REN-002 | M | A renewal submitted before expiry keeps the license **ACTIVE** until a decision, even if the expiry date passes during review (BR-041, configurable). |
| FR-REN-003 | M | Late renewal within the **grace period** adds a late fee; after the grace period the license becomes **LAPSED** and needs a reinstatement application (BR-040, BR-042). |
| FR-REN-004 | S | **Low-risk auto-route:** renewals with no changes, no Section H "Yes" answers and all auto-checks passed may go to a fast-track queue (still human-approved, C-03). |
| FR-REN-005 | S | **Firm bulk renewal:** a Principal Broker can see all affiliated practitioners' renewal status and pay renewals on their behalf (each practitioner still signs their own declaration). |

### 9.5 Firm (REBF) workspace

| ID | Pri | Requirement |
|---|---|---|
| FR-FIRM-001 | M | Firm roles: **Firm Admin** (authorised representative), **Principal Broker**, **Managing Broker** (branch-scoped), **Firm Staff** (read-only). |
| FR-FIRM-002 | M | **Roster:** all affiliated practitioners with category, license status, expiry, supervisor and branch. Export to CSV and PDF. |
| FR-FIRM-003 | M | **Confirmation inbox** for affiliation and supervision requests: confirm or decline individually or in bulk, with reasons. |
| FR-FIRM-004 | M | **Branch management:** propose, add or close branches (subject to Professional Body approval where required) and assign Managing Brokers. |
| FR-FIRM-005 | M | **End affiliation:** the Principal Broker may record the end of a practitioner's affiliation (effective date, reason). This notifies the practitioner and the Professional Body and starts the BR-050 grace period for the practitioner. |
| FR-FIRM-006 | M | Firm profile changes (address, directors, trading name) need a **change request** with evidence, reviewed by an officer, and are reflected on the register after approval. |
| FR-FIRM-010 | S | From a Broker application (G4.5 option 3), the user can **start a linked REBF registration**. |
| FR-FIRM-011 | M | **Linked applications:** an REBF registration and its Principal Broker designation (G7) can be submitted as a linked bundle and decided together. The firm license is not issued without an approved Principal Broker (BR-032). |
| FR-FIRM-012 | S | Supervision ratio monitoring: warn if a supervisor exceeds a configurable maximum number of supervisees (Q-07). |

### 9.6 Public register and verification

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-REG-001 | M | A **public, searchable register** of licensed practitioners and firms, accessible without login. | Rec. Public register; Art. 15 |
| FR-REG-002 | M | Search by name, registration or license number, category, firm, district or province, and status. Supports typo tolerance, filters and pagination. Results are returned in < 1 s at P95. | NFR |
| FR-REG-003 | M | Public fields (configurable, default): name, photo (configurable, default off), registration number, license number, category, status (Active / Suspended / Revoked / Expired), issue and expiry dates, firm and branch, authorised scope or territory, public conditions. Firms: legal and trading name, registration number, address, Principal Broker, branches, status. **Never public:** ID numbers, DOB, home address, contact details (unless the practitioner opts in to publish business contact), Section H data. | Note 1 |
| FR-REG-004 | M | **Verification page per license** (target of the QR code), showing live status and a tamper-evident indicator. | N.2 |
| FR-REG-005 | M | Anti-scraping: rate limiting, bot protection on bulk queries, and no bulk export for the public. | Sec. |
| FR-REG-006 | S | **Verification API** for authorised partners (banks, land registry, notaries), authenticated by API key or OAuth client credentials, with rate limits and usage logging. | INT |
| FR-REG-007 | S | "Report a concern" link, where a member of the public reports suspected unlicensed practice or misconduct (routed to a complaints queue, outside v1 case management). | Consumer protection |
| FR-REG-008 | M | Open-data-friendly: an accessible, SEO-indexable page per firm and practitioner (where the individual has not opted out and the law permits). | Transparency |

### 9.7 Audit trail

| ID | Pri | Requirement | Src |
|---|---|---|---|
| FR-AUD-001 | M | An **audit trail of all changes**: every create, update and delete of business data, every state transition, document upload or view or download, decision, configuration change, login and permission change. | Rec. Audit trail |
| FR-AUD-002 | M | Each audit event records: actor (user and role or system), timestamp (UTC), action, entity type and ID, before and after values (field-level diff; sensitive values hashed or masked), IP, user agent, correlation ID, and reason where required. | |
| FR-AUD-003 | M | Audit storage is **append-only and tamper-evident** (hash chain or WORM storage), kept for ≥ 10 years (configurable; Q-10). | |
| FR-AUD-004 | M | Auditors can search, filter and export the audit trail (signed export). | |
| FR-AUD-005 | M | Applicants can see a simplified **activity log** of their own applications. | Transparency |

### 9.8 Administration and configuration

| ID | Pri | Requirement |
|---|---|---|
| FR-ADM-001 | M | Manage users, roles and permissions (RBAC + attribute scoping, e.g. region and category). See Appendix D. |
| FR-ADM-002 | M | Configure: categories (names, descriptions, enabled), application type matrix, fee schedules, eligibility rules, checklist matrix, declaration texts, code of conduct versions, notification templates, SLA timers, license validity periods, grace periods, document types and limits, reason codes, standard conditions, recognised institutions and qualifications, training providers and programmes, approved referral arrangements, and the administrative divisions dataset. |
| FR-ADM-003 | M | All configuration is **versioned with effective dates**, and changes to rules, fees and declarations need maker-checker approval. |
| FR-ADM-004 | M | Feature flags (e.g. gender field, photo on public register, payment-before-review). |
| FR-ADM-005 | S | System health dashboard: queue depths, integration status, notification failures, scan backlog. |

### 9.9 Reporting and analytics

| ID | Pri | Requirement |
|---|---|---|
| FR-RPT-001 | M | Operational dashboards: applications by status, category, type and region; SLA compliance; officer workload and throughput; information-request rate; approval and rejection rates with reasons. |
| FR-RPT-002 | M | Register statistics: practitioners by category, region, firm and gender (aggregated, where collected); firms by size; growth trends; expiries upcoming. |
| FR-RPT-003 | M | Financial reports: fees collected by type, method and period; reconciliation; refunds; outstanding payments. |
| FR-RPT-004 | S | Funnel analytics: draft-to-submission conversion, abandonment by step, average completion time per step (privacy-preserving, no PII in analytics). |
| FR-RPT-005 | M | Scheduled report export (CSV, XLSX, PDF), with access restricted by role. |
| FR-RPT-006 | S | An annual statutory report pack for the Professional Body. |

### 9.10 Data subject rights

| ID | Pri | Requirement |
|---|---|---|
| FR-DSR-001 | M | Users can download a copy of their personal data (machine-readable export). |
| FR-DSR-002 | M | Rectification requests: the user requests a correction of register data and an officer approves it. |
| FR-DSR-003 | M | Erasure and objection requests are handled by the DPO workflow, respecting the statutory retention of licensing records (the request is logged, and the legal basis for retention is explained). |
| FR-DSR-004 | S | Opt-out of public listing of optional fields (e.g. photo, business contact). |

---

## 10. Business rules catalogue

All thresholds are configurable (FR-ELG-002). The values shown are defaults derived from R1 or flagged assumptions.

| ID | Rule | Default | Severity | Src |
|---|---|---|---|---|
| BR-001 | An individual applicant must be ≥ 18 years old on the submission date. | 18 | Blocking | G1.1, G2.1 |
| BR-002 | The minimum age rule applies to all individual categories. | On | Blocking | Assumption |
| BR-010 | RERA and FSLA: highest education ≥ A2 or a recognised equivalent. | A2 | Blocking (Needs assessment if "Other recognised") | G1.2, G2.2 |
| BR-011 | REA: one of a relevant A1; a business-related A0; a bachelor's degree; or a qualification expressly recognised under Art. 12. | — | Blocking / Needs assessment | G3.1 |
| BR-012 | A foreign qualification requires recognition or equivalence evidence where configured for that level. | Required for A1+ | Blocking (warning if optional) | C.9–C.10 |
| BR-013 | REA "relevant" A1 and "business-related" A0 are judged by field-of-study mapping; unmapped fields go to officer assessment. | Mapping table | Needs assessment | G3.1 |
| BR-014 | Broker: qualification in Estate Management and Valuation, Valuation and Property Management, Real Estate, or a recognised equivalent. | Mapping table | Blocking / Needs assessment | G4.1 |
| BR-015 | Category training required: FSLA entry-level; REA professional; Broker advanced; Managing Broker management (where applicable). | — | Blocking | D.1, G2.3, G3.3, G4.3, G6.7 |
| BR-016 | REA and Broker: a passed licensing exam is required; the result is valid for N years from the exam date. | 3 years (assumption) | Blocking | D.6, G3.4, G4.4 |
| BR-020 | REA: ≥ 3 years of registered and documented experience as an FSLA, or recognised equivalent experience (E.12–13). | 36 months | Blocking (Needs assessment if equivalence claimed) | G3.2 |
| BR-021 | Broker: ≥ 3 years documented experience as a **licensed** REA. | 36 months | Blocking | G4.2 |
| BR-022 | Periods of suspension do not count towards qualifying experience. | On | Calculation | Assumption |
| BR-023 | Overlapping experience periods are merged and not double-counted. | On | Calculation | — |
| BR-030 | Supervisor validity: RERA → Broker or designated practitioner; FSLA → REA or Broker; REA → Broker. The supervisor's license must be ACTIVE and not suspended or conditioned against supervision. | Matrix | Blocking | F.8–9, G1.4, G2.4, G3.5 |
| BR-031 | Associate, Managing and Principal Broker require an ACTIVE Broker license held by the applicant. | — | Blocking | G5.1–2, G6.1, G7.1 |
| BR-032 | An REBF must have exactly one active Principal Broker; a firm license cannot be issued or remain active without one beyond the grace period. | 30 days grace | Blocking | G7, G8.11 |
| BR-033 | One active Managing Broker per branch. | On | Blocking | G6.3 |
| BR-034 | A practitioner may hold only one active affiliation per category at a time (Q-06). | On | Blocking | A.3 |
| BR-035 | Categories in the F applicability list must have an active affiliation or (RERA) an approved referral arrangement. | — | Blocking | F header |
| BR-036 | Independent Broker practice requires a recorded authorisation from the Professional Body. | — | Blocking | F.15–16, G4.5 |
| BR-040 | License validity is 1 year from issue (annual renewal); renewal opens 90 days before expiry; grace period 30 days after expiry with a late fee. | 1y / 90d / 30d | Calculation | Rec. annual renewal (assumption on values) |
| BR-041 | A timely-filed renewal keeps the license active until decision. | On | Calculation | Assumption |
| BR-042 | After the grace period the license becomes LAPSED; practice is not authorised; reinstatement is required. | — | Status | A.3 |
| BR-050 | When a supervisor's license or affiliation ends, supervisees have N days to register a new supervisor, after which their license is flagged "Supervision required" (status action per policy). | 30 days | Workflow | F |
| BR-060 | A "Yes" to H.1–H.4 never auto-rejects; it requires assessment. | — | Needs assessment | H.5 |
| BR-061 | The criminal record certificate must be issued ≤ N months before submission. | 6 months | Blocking | H.6 |
| BR-062 | "No" to H.7 (code of conduct) blocks submission. | — | Blocking | H.7 |
| BR-070 | Where indemnity insurance is required, the policy must be valid at issue and cover at least the configured minimum; expiry triggers a reminder and a compliance flag. | Config | Blocking | G7.5, G8.17 |
| BR-080 | Fees are calculated from the fee schedule version effective at payment initiation. | — | Calculation | K |
| BR-081 | No application proceeds to review without full payment (unless waived), when pay-at-submission is configured. | — | Blocking | K |
| BR-090 | An officer override of any auto-computed eligibility or verification outcome needs a reason and is flagged in reports. | — | Control | L.11 |
| BR-091 | The reviewer (L) and the approver (M) for one application must be different users. | — | Control | L, M |
| BR-092 | A license is issued only after a signed Approved or Conditionally Approved decision. | — | Control | C-04 |
| BR-093 | No staff member may review or decide an application in which they have a conflict of interest. | — | Control | FR-BO-003 |
| BR-100 | Upgrade: the applicant's lower-category license must be ACTIVE (not suspended) at submission and decision. | — | Blocking | A.3 |
| BR-101 | Change of affiliation: the license must be ACTIVE; the new firm's Principal Broker and the new supervisor must confirm. | — | Blocking | A.3 |
| BR-102 | Reinstatement: allowed for LAPSED; for SUSPENDED after the term ends; for REVOKED only if the configured minimum period has passed and the law permits (Q-08). | Config | Blocking | A.3 |

---

## 11. User experience and interaction design requirements

### 11.1 UX principles

1. **Show only what applies.** Progressive disclosure is driven by application type, category and answers (C-05, FR-WIZ-003).
2. **Ask once, reuse forever.** Profile data, document wallet and register data pre-fill every later application.
3. **Tell people where they stand.** Live eligibility, checklist progress and status timeline, with expected timelines.
4. **Mobile-first, low-bandwidth-first.** Most applicants in entry categories will apply from phones.
5. **Plain language, three languages.** The legal wording is kept verbatim where it is legally required (declarations), with plain-language helper text next to it.
6. **Trust and transparency.** Explain why each sensitive item is collected, who sees it and how long it is kept.
7. **Efficient for experts.** Back office with keyboard shortcuts, split-screen and minimal clicks.

### 11.2 UX requirements

| ID | Pri | Requirement |
|---|---|---|
| UX-001 | M | Responsive layout from 320 px to 2560 px; touch targets ≥ 44×44 px. |
| UX-002 | M | **WCAG 2.2 AA** compliance: keyboard navigation, focus visibility, screen-reader labels, error identification, colour contrast ≥ 4.5:1, no reliance on colour alone, reduced-motion support. |
| UX-003 | M | **Multilingual UI** (English, Kinyarwanda, French) with a language switcher on every page and the preference remembered. Legal texts carry translations approved by the Professional Body. |
| UX-004 | M | Wizard pattern: one topic per step, a sticky progress indicator, "Save and exit", "Back" without data loss, and an estimated time remaining per step. |
| UX-005 | M | Error messages say what went wrong and how to fix it, e.g. "The photo must be at least 600×600 pixels. Yours is 400×400. Try taking a new photo." |
| UX-006 | M | **Smart defaults and lookups:** firm and supervisor typeahead from the register, address cascades, institution and programme lists, date pickers with typed entry. |
| UX-007 | M | **Upload UX:** drag-and-drop on desktop, camera on mobile, preview, replace, progress, and scan status shown. |
| UX-008 | S | Light and dark themes; a design system with tokenised colours, spacing and typography; a consistent component library (e.g. shadcn/ui on Radix primitives). |
| UX-009 | M | Empty states, skeleton loaders and optimistic UI for fast perceived performance. |
| UX-010 | S | **Contextual assistant:** an in-portal help assistant (AI-assisted FAQ grounded on official guidance, with no access to personal data unless the user explicitly shares it) that answers "Which category should I apply for?", "What is an A2 equivalent?" and similar. It always links to the authoritative source and never makes eligibility decisions. |
| UX-011 | M | Accessible **PDF outputs** (tagged PDF) for certificates, receipts and letters. |
| UX-012 | M | Officer console: split view (data | document), keyboard shortcuts (e.g. `V` verify, `F` fail, `N` next document), quick filters, and inline templates. |
| UX-013 | S | Onboarding tour for first-time applicants and for officers; changelog ("What's new"). |
| UX-014 | M | Consistent date format (DD/MM/YYYY in UI, ISO 8601 in APIs) and currency format (RWF with thousands separators). |
| UX-015 | S | **Progressive Web App:** installable, with offline cache of drafts and the dashboard. |
| UX-016 | M | Usability testing with representative users (≥ 5 per persona) before go-live; SUS score ≥ 75. |
| UX-017 | S | In-app feedback widget and post-submission CSAT survey (1 question + optional comment). |

### 11.3 Key screen inventory

| # | Screen | Primary users |
|---|---|---|
| 1 | Landing page (categories, eligibility checker, verify a practitioner) | Public |
| 2 | Sign up / Verify email & phone / Sign in / MFA / Recovery | U1, U2 |
| 3 | Applicant dashboard | U1, U2 |
| 4 | Application wizard: Type & Category → Personal / Corporate → Education → Training & Exams → Experience → Affiliation → Category requirements → Integrity → Documents → Review → Declaration & Sign → Payment → Confirmation | U1, U2 |
| 5 | Application detail & status timeline, messages, information requests | U1, U2 |
| 6 | License wallet (certificate, QR, conditions, obligations) | U1 |
| 7 | Confirmation inbox (supervisor, Principal Broker) | U3, U4 |
| 8 | Firm workspace (roster, branches, renewals, profile change requests) | U2, U4 |
| 9 | Officer work queue | U5 |
| 10 | Review console (Section L) | U5 |
| 11 | Decision console (Section M) incl. batch & committee | U6 |
| 12 | Register administration (suspend, revoke, correct) | U7 |
| 13 | Finance (payments, reconciliation, refunds, waivers) | U8 |
| 14 | Configuration (fees, rules, checklists, templates, reference data) | U9 |
| 15 | Audit & DSAR console | U10 |
| 16 | Reports & dashboards | U5–U10 |
| 17 | Public register search & verification page | U11 |
| 18 | API developer portal | U12 |

---

## 12. Data requirements

### 12.1 Logical data model (principal entities and key attributes)

| Entity | Key attributes |
|---|---|
| `account` | id, type (INDIVIDUAL/ORG_USER/STAFF), email, email_verified_at, phone, phone_verified_at, password_hash, mfa_methods, locale, status, created_at |
| `person` | id, account_id, surname, given_names, other_names, id_type, id_number (encrypted + blind index), id_country, id_expiry, dob, nationality[], gender (nullable), phone, email, residential_address_id, professional_address_id, occupation, employer, photo_document_id, identity_verified_status |
| `address` | id, country, province_code, district_code, sector_code, cell_code, village_code, details, lat/long (opt.) |
| `admin_division` | code, level (PROVINCE…VILLAGE), name_{en,rw,fr}, parent_code, valid_from/to |
| `qualification` | id, person_id, level, institution_id/name, qualification_title, field_of_study, year_completed, certificate_number, is_foreign, recognition_reference, verified_status |
| `training` | id, person_id, provider_id, programme_id, completed_on, certificate_number, training_type, verified_status |
| `exam_result` | id, person_id, exam_type, reference, exam_date, result, document_id, verified_status |
| `experience_record` | id, person_id, firm_id/name, category, start_date, end_date, duties, referee_*, verified_status |
| `firm` | id, legal_name, trading_name, legal_form, company_reg_no, tin, incorporated_on, registered_address_id, business_address_id, phone, email, status, registration_number (RF-…) |
| `firm_responsible_person` | id, firm_id, name, role, id_type, id_number (enc.), nationality, contact, shareholding_pct |
| `branch` | id, firm_id, name, address_id, phone, opened_on, closed_on, status |
| `firm_membership` | account_id, firm_id, role (FIRM_ADMIN/PRINCIPAL/MANAGING/STAFF), branch_id, from/to |
| `application` | id, reference_no, type, category, applicant_person_id / applicant_firm_id, related_license_id, status, rules_version, checklist_version, fee_schedule_version, created_at, submitted_at, decided_at, linked_bundle_id, assisted_by |
| `application_section_data` | application_id, section_code (A…K, G1…G8), data JSONB (validated by schema version), schema_version, updated_at |
| `application_snapshot` | application_id, version, data JSONB, sha256, created_at (at submission and each resubmission) |
| `document` | id, owner_type/id, application_id, doc_type, current_version_id, checklist_item_code, status, expiry_date |
| `document_version` | id, document_id, storage_key, filename, mime, size, sha256, scan_status, uploaded_by, uploaded_at, ocr_data JSONB |
| `eligibility_result` | id, application_id, run_context (LIVE/SUBMIT/REVIEW), rule_id, outcome, message_key, evidence JSONB, rules_version, run_at |
| `confirmation_request` | id, application_id, type (SUPERVISOR/PRINCIPAL/DESIGNATION), addressee_person_id, status, reason, responded_at, expires_at |
| `affiliation` | id, person_id, firm_id, branch_id, supervisor_license_id, referral_arrangement_id, category, start_date, end_date, end_reason, evidence_document_id |
| `referral_arrangement` | id, name, approval_reference, approved_on, status, evidence_document_id |
| `payment` | id, application_id, reference, amount, currency, items JSONB, method, provider, provider_txn_id, status, paid_at, payer_*, receipt_no |
| `refund` / `fee_waiver` | id, payment_id/application_id, amount, reason, requested_by, approved_by, status |
| `fee_schedule` | id, version, effective_from/to, rows (category, app_type, applicant_type, item, amount) |
| `review` (Section L) | id, application_id, version, officer_id, received_at, checks JSONB (identity, education, experience, training_exam, affiliation, integrity), docs_complete, eligibility_outcome, internal_comments, applicant_comments, recommendation, recommendation_reasons, signed_at, signature_ref |
| `information_request` | id, application_id, review_id, items JSONB (fields/docs unlocked), message, due_at, responded_at, status |
| `decision` (Section M) | id, application_id, decision, approved_category, registration_no, license_no, issue_date, expiry_date, geo_scope JSONB, practice_arrangement, supervisor_license_id, conditions JSONB, reasons, approver_id, approver_title, signature_ref, decided_at, supersedes_decision_id |
| `license` | id, license_no, holder_type/id, category, status, issue_date, expiry_date, scope JSONB, practice_arrangement, firm_id, supervisor_license_id, conditions, superseded_by, certificate_document_id, qr_token |
| `license_status_history` | license_id, from_status, to_status, effective_at, reason, reference, actor_id |
| `sanction` | id, subject_type/id, type, authority, decided_on, period, outcome, reference |
| `register_entry` | denormalised public projection: license/firm public fields, search vector |
| `notification` | id, recipient, channel, template_key, template_version, payload, status, sent_at, delivered_at |
| `audit_event` | id, ts, actor_id, actor_role, action, entity_type, entity_id, diff JSONB, ip, ua, correlation_id, reason, prev_hash, hash |
| `config_*` | rules, checklists, declarations, code_of_conduct, templates, reason_codes, standard_conditions, institutions, providers, programmes, feature_flags (all versioned) |

### 12.2 Data requirements

| ID | Pri | Requirement |
|---|---|---|
| DATA-001 | M | Each application stores **section data as schema-versioned JSON** with server-side validation (JSON Schema/Zod), plus normalised core entities for querying and reporting. |
| DATA-002 | M | At submission (and at each resubmission), an **immutable snapshot** with a SHA-256 hash is stored. The declaration signature binds to this hash. |
| DATA-003 | M | Identifiers (National ID, passport, TIN) are **encrypted at field level**. Exact-match lookup uses a keyed blind index (HMAC). |
| DATA-004 | M | Reference data (administrative divisions, institutions, providers) is maintained with validity dates; historical records keep their original codes. |
| DATA-005 | M | Number formats: Application `REBP-YYYY-TTT-NNNNNN-C`; Practitioner registration `RP-NNNNNN`; Firm registration `RF-NNNNNN`; License `{CAT}-{YYYY}-{NNNNNN}` e.g. `REA-2026-000321`; Payment ref `PAY-YYYYMMDD-XXXXXXXX`; Receipt `RCT-YYYY-NNNNNNN`. All formats are configurable, gap-free where legally required, and use sequences with a check digit. |
| DATA-006 | M | Legacy data migration: field mapping, cleansing rules, duplicate resolution, reconciliation report (counts and spot checks), signed off by the Registrar. |
| DATA-007 | M | Soft delete only for business entities; hard delete only under the retention policy, through scheduled, audited purge jobs. |

---

## 13. External interface requirements

### 13.1 Integrations

All integrations shall have a **manual verification fallback**: the officer verifies against the uploaded document and records the outcome. The portal must go live without depending on any single external integration.

| ID | Pri | System | Purpose | Notes |
|---|---|---|---|---|
| INT-001 | S | National identity registry (e.g. NIDA) | Verify ID, pre-fill name/DOB/gender/photo | Subject to a data-sharing agreement |
| INT-002 | S | Company registry (e.g. RDB) | Verify company number, legal name, directors, status | G8.3–G8.4, G8.10, G8.13–14 |
| INT-003 | C | Tax authority (e.g. RRA) | Verify TIN, tax compliance | G8.5, G8.15 |
| INT-004 | C | Criminal record verification (police / government e-services) | Verify certificate authenticity | H.6 |
| INT-005 | S | Training providers and examination body | Verify certificates and results; import results by batch | D |
| INT-006 | C | Education authorities (secondary exams, higher education equivalence) | Verify certificates and foreign recognition | C |
| INT-010 | M | Payment gateway / aggregator / government e-payment platform (e.g. Irembo pay, MoMo, card acquirer) | Collect fees, webhooks, refunds, settlement files | K |
| INT-011 | M | Email service (SMTP/API with DKIM, SPF, DMARC) | Transactional email | |
| INT-012 | M | SMS gateway (local aggregator) | OTP and notifications; sender ID registered | |
| INT-013 | S | Electronic signature / PKI provider (local CA if mandated) | Seal certificates and decisions (PAdES); optional qualified e-signature for decisions | J, L, M, N |
| INT-014 | S | Government service portal / single window | List the service, deep-link, optional SSO | |
| INT-015 | S | Partner verification API consumers | License verification | FR-REG-006 |
| INT-016 | C | Land/property registry | Cross-reference practitioner licenses in transactions | Future |

### 13.2 Public and partner API

| ID | Pri | Requirement |
|---|---|---|
| INT-020 | M | REST API (JSON) with OpenAPI 3.1 documentation; versioned (`/api/v1`). |
| INT-021 | M | Public endpoints: register search, license verification by number or QR token. Rate limited. |
| INT-022 | S | Partner endpoints (OAuth2 client credentials): bulk verification, webhooks on status change for subscribed licenses. |
| INT-023 | M | Webhook endpoints for payment providers: signature verification, idempotency keys, replay protection. |
| INT-024 | M | The integration layer uses an outbox pattern, retries with exponential backoff, circuit breakers and dead-letter queues; every external call is logged (without sensitive payloads). |

---

## 14. Non-functional requirements

### 14.1 Performance and capacity

| ID | Requirement |
|---|---|
| NFR-PERF-001 | Page interactive (TTI) ≤ 3 s at P75 on a mid-range Android phone over 3G Fast; Largest Contentful Paint ≤ 2.5 s; Interaction to Next Paint ≤ 200 ms. |
| NFR-PERF-002 | API latency P95 ≤ 300 ms for reads and ≤ 800 ms for writes (excluding file upload and external calls). |
| NFR-PERF-003 | Public register search P95 ≤ 1 s with 100k register entries. |
| NFR-PERF-004 | Capacity: 50,000 registered accounts, 20,000 applications per year, 2,000 concurrent users at the renewal-season peak, and 10 file uploads per second, with linear horizontal scaling. |
| NFR-PERF-005 | JS bundle for the applicant portal ≤ 200 KB gzipped on the initial route; images lazy-loaded; fonts subset. |

### 14.2 Availability and resilience

| ID | Requirement |
|---|---|
| NFR-AVL-001 | Applicant portal and back office: 99.5% monthly availability. Public register and verification: 99.9%. |
| NFR-AVL-002 | RPO ≤ 15 minutes; RTO ≤ 4 hours. Point-in-time recovery for the database; cross-zone object-storage replication. |
| NFR-AVL-003 | Daily backups kept 35 days, monthly kept 12 months, yearly kept 10 years (encrypted, restore tested quarterly). |
| NFR-AVL-004 | Graceful degradation: if a payment or integration is down, the user can save and is told to retry later; the public register remains read-only available from a cache if the core is degraded. |
| NFR-AVL-005 | Planned maintenance outside 07:00–20:00 local time, announced 72 h ahead on the portal. |

### 14.3 Maintainability, operability and quality

| ID | Requirement |
|---|---|
| NFR-MNT-001 | Modular codebase with domain modules (identity, applications, eligibility, documents, payments, review, licensing, register, notifications, audit, admin). |
| NFR-MNT-002 | Automated test coverage ≥ 80% lines on domain and services modules; 100% of business rules covered by table-driven tests; E2E tests for every application type × category happy path and the main exception paths. |
| NFR-MNT-003 | CI/CD with lint, type-check, tests, SAST, dependency and container scanning, and preview environments for each pull request. |
| NFR-MNT-004 | Infrastructure as code; separate dev / test / staging / production environments; production data never used in lower environments without anonymisation. |
| NFR-MNT-005 | Observability: structured logs (no PII), metrics, distributed tracing (OpenTelemetry), uptime checks, alerting with on-call runbooks. |
| NFR-MNT-006 | Configuration changes (fees, rules, templates) take effect without redeployment. |
| NFR-MNT-007 | Documentation: architecture decision records (ADRs), API docs, runbooks, a data dictionary. |

### 14.4 Usability and accessibility

| ID | Requirement |
|---|---|
| NFR-USE-001 | A first-time applicant shall complete an FSLA application (with documents ready) in ≤ 25 minutes median, measured in usability testing. |
| NFR-USE-002 | WCAG 2.2 AA conformance verified by automated (axe) and manual audits before release. |
| NFR-USE-003 | All user-facing text externalised for i18n; no hard-coded strings. |

### 14.5 Compatibility and portability

| ID | Requirement |
|---|---|
| NFR-CMP-001 | Supported browsers per §2.3. |
| NFR-CMP-002 | Containerised deployment (OCI images), portable across cloud and on-premise Kubernetes or managed container platforms. |

### 14.6 Legal and regulatory

| ID | Requirement |
|---|---|
| NFR-LEG-001 | Compliance with the applicable personal data protection law (R3), including registration of the controller and processor where required and data residency rules. |
| NFR-LEG-002 | Electronic signatures and records are admissible under the applicable electronic transactions law (R4). |
| NFR-LEG-003 | Records retention schedule approved by the Professional Body and archives authority (Q-10). |

---

## 15. Security, privacy and data protection

### 15.1 Security requirements

| ID | Pri | Requirement |
|---|---|---|
| SEC-001 | M | Build to **OWASP ASVS Level 2**; annual third-party penetration test and a pre-go-live test; critical and high findings fixed before go-live. |
| SEC-002 | M | TLS 1.2+ everywhere (TLS 1.3 preferred); HSTS; secure cookies (HttpOnly, Secure, SameSite); CSP; protection against CSRF and clickjacking. |
| SEC-003 | M | Encryption at rest (AES-256) for the database, backups and object storage; field-level encryption for identifiers and Section H data; keys managed in a KMS/HSM and rotated. |
| SEC-004 | M | **RBAC + ABAC:** least privilege; officer access scoped (e.g. by assignment, region or category); the staff role matrix in Appendix D. |
| SEC-005 | M | MFA mandatory for staff and privileged firm roles; step-up authentication for signing, decisions, configuration changes and exports. |
| SEC-006 | M | Rate limiting and lockout on authentication; bot protection on registration, OTP and the public search. |
| SEC-007 | M | Input validation server-side for every field (schema-based); output encoding; parameterised queries. |
| SEC-008 | M | File security per FR-DOC-003/004/008; uploads are processed in an isolated service. |
| SEC-009 | M | Secrets in a vault; no secrets in code or images; dependency vulnerability management (SBOM). |
| SEC-010 | M | Security event logging and SIEM integration; alerts on anomalies (bulk viewing of Section H, mass downloads, privilege changes). |
| SEC-011 | M | Staff access review every quarter; joiner, mover and leaver process; break-glass accounts with alerting. |
| SEC-020 | M | **Highly sensitive data** (ID documents, criminal records, Section H, photos) is viewable only by roles with a need to know. Every access is logged and periodically reviewed, and download is watermarked or restricted. |
| SEC-021 | M | Admin and back-office access may be restricted by network (VPN or IP allow-list) and device posture (configurable). |
| SEC-022 | M | Certificates and decision letters are digitally sealed; the QR verification token is unguessable (≥ 128-bit) and maps to the live status. |

### 15.2 Privacy by design (R1 Important Note 1)

| ID | Pri | Requirement |
|---|---|---|
| PRV-001 | M | **Data minimisation:** collect each data item only when the selected category or type needs it (conditional fields). Gender is collected only if the framework requires it (B.5). |
| PRV-002 | M | **Privacy notice** at account creation and at declaration; purposes and legal basis documented in a Record of Processing Activities. |
| PRV-003 | M | A **Data Protection Impact Assessment (DPIA)** is completed before go-live and reviewed annually. |
| PRV-004 | M | Data processing agreements with all processors (hosting, SMS, email, payments). |
| PRV-005 | M | Personal data breach procedure: detection, assessment, and notification of the authority and data subjects within statutory timelines (e.g. 48–72 h; per R3). |
| PRV-006 | M | Analytics shall not collect PII; cookie consent for non-essential cookies. |
| PRV-007 | M | Public register exposure is limited to the fields in FR-REG-003. |

### 15.3 Access to sensitive categories (summary)

| Data | Applicant | Supervisor / Principal | Reviewing Officer | Approver | Registrar | Finance | Auditor | Public |
|---|---|---|---|---|---|---|---|---|
| Identity docs, ID number | Own | ✗ | Assigned | Assigned | ✔ | ✗ | Logged view | ✗ |
| Criminal record / Section H | Own | ✗ | Assigned | Assigned | ✔ | ✗ | Logged view | ✗ |
| Education / training / exam | Own | ✗ | Assigned | Assigned | ✔ | ✗ | Logged view | ✗ |
| Affiliation evidence | Own | Own firm | Assigned | Assigned | ✔ | ✗ | Logged view | Partial (firm) |
| Payments | Own | If payer | View | View | View | ✔ | View | ✗ |
| License public fields | Own | Own firm | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

### 15.4 Retention (defaults pending Q-10)

| Record | Retention |
|---|---|
| Expired drafts never submitted | Deleted 12 months after expiry |
| Submitted applications (approved) | Life of registration + 10 years |
| Rejected / withdrawn applications | 5 years after closure |
| Criminal record certificates | Until the decision + 1 year, then a summary of the verification outcome only (minimisation) |
| Licenses, decisions, register history | Permanent (archival) |
| Audit events | ≥ 10 years |
| Payment records | Per financial regulations (≥ 10 years) |
| Notification logs | 2 years |

---

## 16. Recommended architecture and technology

> This is a recommendation for the engineering team. The final choice is recorded in ADRs.

### 16.1 Architecture style

A **modular monolith** with clearly bounded domain modules and an event outbox. It is simpler to operate for a regulator-sized workload, and modules can be extracted into services later (e.g. documents or notifications) if scale demands it.

```
┌────────────────────────────── Clients ──────────────────────────────┐
│  Applicant PWA   │  Firm workspace  │  Back office  │  Public register│
└─────────┬────────┴─────────┬────────┴──────┬────────┴───────┬────────┘
          │      (Next.js App Router, SSR/ISR, i18n)           │ (ISR + CDN cache)
          ▼                                                    ▼
┌──────────────────────── API Gateway / WAF / CDN ─────────────────────┐
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────── Core API (NestJS, TypeScript) ───────────────────┐
│ identity │ applications │ eligibility │ documents │ payments │ review │
│ licensing│ register     │ firms       │ notifications │ audit │ admin │
└────┬───────────┬──────────────┬───────────────┬──────────────┬───────┘
     ▼           ▼              ▼               ▼              ▼
 PostgreSQL   Redis +       Object storage   Search (Postgres  Workers (BullMQ):
 (primary,    BullMQ        (S3-compatible,  FTS/pg_trgm or    scan (ClamAV), OCR,
 RLS, PITR)   (cache,       encrypted)       OpenSearch)       PDF/cert generation,
              queues)                                          notifications, reconciliation,
                                                               reminders, integrations
```

### 16.2 Suggested stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | **Next.js (App Router) + React + TypeScript**, Tailwind CSS, shadcn/ui (Radix), React Hook Form + **Zod**, TanStack Query, next-intl | Modern, accessible components; shared Zod schemas between client and server; SSR/ISR for the SEO public register |
| Backend | **NestJS (TypeScript)** with modular domains, OpenAPI generation | Structured DI, guards for RBAC, mature ecosystem |
| ORM / DB | **PostgreSQL 16+** with Prisma or Drizzle; JSONB for section data; Row-Level Security for defence in depth | Relational integrity + flexible schema-versioned forms |
| Rules | JSON-based rules (e.g. json-rules-engine) or a small typed DSL, versioned in DB | Admin-configurable eligibility |
| Workflow | An explicit state machine (e.g. XState in the domain layer) + outbox events; Temporal (C) if workflows grow | Auditable transitions, SLA timers |
| Queue / cache | Redis + BullMQ | Background jobs, rate limiting |
| Files | S3-compatible storage (AWS S3 / MinIO) + tus resumable uploads + ClamAV + Sharp/libvips + Tesseract or a cloud OCR | Secure, resumable, scanned |
| Documents | PDF generation (React-PDF/Playwright) → PDF/A + PAdES sealing | Certificates, letters, receipts |
| Auth | Self-hosted IdP (Keycloak) or Auth library with OIDC; WebAuthn; TOTP | MFA, passkeys, staff SSO |
| Observability | OpenTelemetry, Prometheus/Grafana, Loki or ELK, Sentry | Full-stack visibility |
| Infra | Docker, Kubernetes or a managed container platform, Terraform, GitHub Actions | IaC, CI/CD |
| Testing | Vitest/Jest, Playwright E2E, Pact (contract tests for integrations), k6 load tests, axe accessibility | Quality gates |

### 16.3 Key design decisions to record (ADRs)

1. Form section data in schema-versioned JSONB, with core facts normalised.
2. A single eligibility engine shared by the wizard, submission and review.
3. Supervisor and Principal confirmations as first-class workflow steps.
4. Register as a read-optimised projection, updated by events after decision.
5. Pay-at-submission default, switchable by config.
6. Segregation of duties enforced in the domain layer, not only in the UI.

---

## 17. Assumptions, constraints, open questions

### 17.1 Assumptions

| ID | Assumption |
|---|---|
| AS-01 | The jurisdiction is Rwanda (inferred from the address hierarchy Province/District/Sector/Cell/Village, the A2/A1/A0 education levels and the "Certificate of Domestic Company Registration"). Integrations and laws are named on that basis and must be confirmed. |
| AS-02 | License validity is annual ("annual renewal reminder"). |
| AS-03 | Minimum age 18 applies to all individual categories (explicit only for RERA and FSLA). |
| AS-04 | UI languages: English, Kinyarwanda, French. |
| AS-05 | The fee schedule will be provided by the Professional Body; amounts are not in the source form. |
| AS-06 | The legal text of the Instructions (Articles 10, 12, 15 and the full Chapters III and IV) will be provided for exact wording of acknowledgments and rules. |
| AS-07 | External integrations may not be available at launch; manual verification is the baseline. |

### 17.2 Open questions (to resolve with the Professional Body)

| ID | Question | Impact |
|---|---|---|
| Q-01 | Is the professional body a statutory regulator with a confirmed legal name, logo and domain? Who is the data controller? | Branding, privacy notice, certificates |
| Q-02 | Exact fee amounts per category and application type; late, reinstatement and reissue fees; refund policy. | FR-PAY |
| Q-03 | Does RERA experience count towards FSLA or REA? Is RERA → FSLA an "upgrade"? | BR-020, §3.3 |
| Q-04 | What exactly counts as "recognised equivalent" experience (E.12) and qualifications (Art. 12)? Is there a published list? | BR-011–014, BR-020 |
| Q-05 | Is Continuing Professional Development (CPD) required for renewal? | FR-REN-001 |
| Q-06 | Can a practitioner be affiliated with more than one firm at the same time? | BR-034 |
| Q-07 | Is there a maximum supervisor-to-supervisee ratio? | FR-FIRM-012 |
| Q-08 | Can a revoked license be reinstated? After what period and under what conditions? | BR-102 |
| Q-09 | Is there an appeal or reconsideration procedure after rejection, and with what deadline? | FR-M-015, lifecycle |
| Q-10 | The statutory retention periods for each record type. | §15.4 |
| Q-11 | Is professional indemnity insurance mandatory, and at what minimum cover, for Principal Brokers and REBFs? | BR-070 |
| Q-12 | Which payment channels are mandated (e.g. a government e-payment platform)? | INT-010 |
| Q-13 | Should practitioner photos be shown on the public register? | FR-REG-003 |
| Q-14 | Is a qualified electronic signature required for decisions, or is authenticated approval enough? | INT-013 |
| Q-15 | Is the exam result validity period 3 years, and who administers exams (an internal body or an external one)? | BR-016, INT-005 |
| Q-16 | Which categories need a committee decision rather than a single approver? | FR-M-014 |
| Q-17 | Is a validity period for the criminal record certificate defined (e.g. 3 or 6 months)? | BR-061 |
| Q-18 | Is the data hosting required to be in-country (data localisation)? | §2.3, NFR-LEG-001 |
| Q-19 | Do existing practitioners need to "re-register" through the portal, or will legacy data be migrated and claimed? | FR-RA-004 |
| Q-20 | What is the policy for practitioners whose supervisor or firm leaves (grace period and status)? | BR-050 |

---

## 18. Delivery phasing

| Phase | Scope | Indicative duration |
|---|---|---|
| **0 — Discovery & design** | Resolve open questions; legal text; fee schedule; DPIA; service blueprint; high-fidelity prototype; usability test of the wizard with personas; ADRs | 4–6 weeks |
| **1 — MVP (go-live)** | Accounts with email + phone verification and MFA; New registration for **all 8 categories**; full wizard A–K + G1–G8; eligibility engine; documents with scan; supervisor and Principal confirmations; payments (mobile money + card); Section L review; Section M decision; Section N license, certificate with QR and register; public register and verification; core notifications; audit trail; admin configuration (fees, rules, checklists, templates); legacy data migration | 16–20 weeks |
| **2 — Lifecycle** | Renewal (with reminders, grace and lapse); Upgrade; Change of affiliation; Reinstatement; firm workspace (roster, branches, bulk confirmations); register administration (suspend, revoke); refunds and reconciliation; reporting dashboards | 8–10 weeks |
| **3 — Integrations & modernisation** | National ID, company registry, tax, training and exam providers; partner API; OCR pre-fill; document wallet; digital wallet credential; contextual help assistant; PWA offline; committee decisions; WhatsApp notifications | 8–12 weeks |
| **4 — Continuous improvement** | CPD module (if adopted), complaints and discipline case management, advanced analytics, land registry integration | Ongoing |

---

## 19. Acceptance criteria and verification

### 19.1 Verification methods

Each requirement is verified by **T**est (automated or manual), **D**emonstration, **I**nspection (document or code review) or **A**nalysis. Requirements with Must priority need at least one automated test where technically feasible.

### 19.2 Representative acceptance scenarios (Gherkin)

```gherkin
Feature: Conditional wizard
  Scenario: FSLA applicant sees only FSLA requirements
    Given I am a verified individual applicant
    When I choose "New registration and licensing" and category "FSLA"
    Then I see sections A, B, C, D, E (items 1–8 only), F, G2, H, I, J, K
    And I do not see G1, G3–G8 or E items 9–13
    And the checklist includes "Entry-level professional training certificate"

Feature: Eligibility
  Scenario: Under-age applicant blocked
    Given my date of birth makes me 17 years old on today's date
    When I attempt to submit an RERA application
    Then submission is blocked with the message "You must be at least 18 years old to apply as a RERA."

  Scenario: REA experience shortfall shows eligible-from date
    Given I have registered FSLA experience from 2024-05-01 to today (2026-10-14)
    When I enter my experience for an REA application
    Then I see "You have 2 years 5 months of qualifying experience. REA requires 3 years. You will be eligible from 01/05/2027."

Feature: Supervisor confirmation
  Scenario: Application waits for supervisor
    Given I submitted and paid for an FSLA application naming supervisor "REA-2025-000111"
    Then my application status is "Pending confirmations"
    And the supervisor receives an email, SMS and in-app request
    When the supervisor confirms
    Then my application status becomes "Submitted" and enters the review queue

Feature: Segregation of duties
  Scenario: Reviewer cannot approve own review
    Given officer "Jean" signed the Section L review for application X
    When "Jean" opens the Section M decision for application X
    Then the decision actions are disabled with the message "You reviewed this application; another approver must decide."

Feature: License issuance
  Scenario: Approval updates the public register
    Given application X is approved and signed by an Approving Authority
    Then a registration number and license number are generated
    And a sealed PDF certificate with QR code is available in the applicant's wallet
    And the practitioner appears on the public register as "Active" within 5 minutes
    And the applicant is notified by email, SMS and in-app

Feature: Integrity disclosures
  Scenario: Yes answer routes to assessment, not rejection
    Given I answer "Yes" to "Have you been subject to a professional disciplinary sanction?"
    Then I must provide details and supporting documents
    And on submission the eligibility outcome for integrity is "Needs assessment"
```

### 19.3 Go-live readiness checklist

- [ ] All Must requirements in the phase pass acceptance.
- [ ] Penetration test: no open critical or high findings.
- [ ] WCAG 2.2 AA audit passed.
- [ ] DPIA approved; privacy notice published; processor agreements signed.
- [ ] Load test at 2× expected peak passed.
- [ ] Backup and restore drill passed (RPO and RTO met).
- [ ] Legacy data migration reconciled and signed off.
- [ ] Officers trained; runbooks and support desk ready.
- [ ] Fee schedule, rules, declarations and templates approved by the Professional Body and loaded.

---

## 20. Traceability matrix (source form → requirements)

| Source (REBP–REG–01) | Requirement IDs |
|---|---|
| Header: Form code, application types, Online method, Legal basis | §1, C-01, FR-A-003, FR-WIZ-001 |
| A.1 Application reference number | FR-A-001, DATA-005 |
| A.2 Application date | FR-A-002 |
| A.3 Application type | FR-A-003, FR-A-005, FR-A-006, §3.3, FR-DOM-001 |
| A.4 Professional category | FR-A-004, FR-A-007, §3.2 |
| B.1–B.7 Personal details | FR-B-001 – FR-B-008, INT-001 |
| B.8 Residential address | FR-B-009, FR-B-011, C-08 |
| B.9 Professional address | FR-B-010, FR-B-012 |
| B.10–B.11 Occupation / employer | FR-B-013 |
| B.12 Photograph | FR-B-014, FR-B-016, FR-N-002 |
| B.13 Proof of identity | FR-B-015, FR-B-016 |
| C.1–C.10 Education | FR-C-001 – FR-C-009, BR-010 – BR-014 |
| D.1–D.10 Training & exams | FR-D-001 – FR-D-008, BR-015, BR-016 |
| E.1–E.8 Experience | FR-E-001 – FR-E-004, FR-E-007 – FR-E-009 |
| E.9–E.13 REA/Broker experience | FR-E-005, FR-E-006, BR-020 – BR-023 |
| F.1–F.11 Affiliation & supervision | FR-F-001 – FR-F-007, FR-F-010, FR-F-011, BR-030, BR-034, BR-035 |
| F.12–F.14 RERA referral arrangement | FR-F-008 |
| F.15–F.16 Independent Broker practice | FR-F-009, BR-036 |
| G (display rule) | FR-G-000, FR-WIZ-003, C-05 |
| G1.1–G1.5 RERA | FR-G1-001 – FR-G1-006 |
| G2.1–G2.6 FSLA | FR-G2-001 – FR-G2-006 |
| G3.1–G3.5 REA | FR-G3-001 – FR-G3-005 |
| G4.1–G4.5 Broker | FR-G4-001 – FR-G4-005, FR-FIRM-010 |
| G5.1–G5.6 Associate Broker | FR-G5-001 – FR-G5-006 |
| G6.1–G6.7 Managing Broker | FR-G6-001 – FR-G6-008 |
| G7.1–G7.6 Principal Broker | FR-G7-001 – FR-G7-007, FR-FIRM-011 |
| G8.1–G8.20 REBF | FR-G8-001 – FR-G8-013, INT-002, INT-003 |
| H.1–H.7 Compliance & integrity | FR-H-001 – FR-H-007, BR-060 – BR-062, SEC-020 |
| I Document checklist | FR-I-001 – FR-I-006, Appendix B |
| J.1–J.8, signature, date, checkbox | FR-J-001 – FR-J-007, DATA-002 |
| K.1–K.8, Submit, acknowledgment | FR-PAY-001 – FR-PAY-014, FR-WIZ-014 |
| L.1–L.14, officer signature | FR-L-001 – FR-L-013, FR-BO-001 – FR-BO-006 |
| M.1–M.15 | FR-M-001 – FR-M-017, BR-091, BR-092 |
| N.1–N.8 | FR-N-001 – FR-N-012 |
| Workflow 1 Create account | FR-ACC-001 – FR-ACC-010 |
| Workflow 2 Select type & category | FR-WIZ-002, FR-A-003 – FR-A-007 |
| Workflow 3 Personal or corporate info | FR-ACC-002, FR-G8-013 |
| Workflow 4 Upload & validate | FR-DOC-001 – FR-DOC-011, FR-WIZ-006 |
| Workflow 5 Declarations & payment | Section J, Section K reqs |
| Workflow 6 Submit, reference, trackable status | FR-WIZ-014, FR-PORTAL-001 – 002 |
| Workflow 7 Verify & decide with reasons | Sections L & M reqs |
| Workflow 8 Issue license after approvals | FR-N-009, BR-092, C-04 |
| Important Note 1 Protect applicant information | §15, PRV-001 – PRV-007, SEC-003, SEC-020 |
| Important Note 2 Master form + separate review + decision record | Whole SRS; §4; §8 |
| Rec: Save-and-resume drafts | FR-WIZ-004, FR-WIZ-011 |
| Rec: Automatic eligibility checks | FR-WIZ-007, FR-WIZ-013, §9.1, §10 |
| Rec: Field and file-type validation, size limits | FR-WIZ-006, FR-DOC-001 – 004 |
| Rec: Unique account, email & phone verification | FR-ACC-001, FR-ACC-003 |
| Rec: Automated notifications | FR-NOT-001 – 006, Appendix C |
| Rec: Public searchable register (Art. 15) | FR-REG-001 – 008 |
| Rec: Audit trail & annual renewal reminder | FR-AUD-001 – 005, FR-NOT-005, §9.4 |

---

## Appendix A — Field dictionary

Legend: **Req** = M (mandatory), C (conditional; the condition is given), O (optional). **Type**: text, enum, date, bool, file, lookup, number, email, phone, address, richtext.

### A.1 Section A — Application details

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `a.referenceNo` | Application Reference Number | text (system) | M | Generated; immutable | A.1 |
| `a.applicationDate` | Application Date | datetime (system) | M | Draft creation | A.2 |
| `a.applicationType` | Application Type | enum | M | NEW, UPGRADE, RENEWAL, CHANGE_AFFILIATION, REINSTATEMENT, FIRM_REGISTRATION | A.3 |
| `a.category` | Professional Category | enum | M | RERA, FSLA, REA, BROKER, ASSOCIATE_BROKER, MANAGING_BROKER, PRINCIPAL_BROKER, REBF; filtered by §3.3 | A.4 |
| `a.relatedLicenseId` | Existing license | lookup | C: type ≠ NEW, FIRM_REGISTRATION | Must belong to the applicant | A.3 |

### A.2 Section B — Personal information

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `b.surname` / `b.givenNames` / `b.otherNames` | Full legal name | text | M/M/O | 1–100 chars, letters, spaces, hyphens, apostrophes | B.1 |
| `b.idType` | Identification type | enum | M | NATIONAL_ID, PASSPORT, REFUGEE_ID, OTHER | B.2 |
| `b.idNumber` | ID / passport number | text | M | NID: 16 digits (configurable); passport: 6–20 alphanumeric | B.2 |
| `b.idCountry` | Issuing country | enum (ISO 3166) | C: passport | | B.2 |
| `b.idExpiry` | Document expiry | date | C: passport | Must be future | B.2 |
| `b.dateOfBirth` | Date of birth | date | M | Past date; age ≥ 18 (BR-001) | B.3 |
| `b.nationality` | Nationality | enum[] | M | ISO 3166 | B.4 |
| `b.gender` | Gender | enum | C: feature flag on | Options per framework | B.5 |
| `b.phone` | Telephone number | phone | M | E.164 | B.6 |
| `b.email` | Email address | email | M | RFC 5322 | B.7 |
| `b.residentialAddress` | Residential address | address | M | Province, District, Sector, Cell, Village (cascading), details | B.8 |
| `b.professionalSameAsResidential` | Same as residential | bool | M | | B.9 |
| `b.professionalAddress` | Professional / business address | address | C: not same | | B.9 |
| `b.occupation` | Current occupation | text | M | ≤ 100 | B.10 |
| `b.employer` | Current employer | text | O | ≤ 150 | B.11 |
| `b.photo` | Passport-size colour photograph | file | M | JPEG/PNG, ≥ 600×600, ≤ 2 MB | B.12 |
| `b.proofOfIdentity` | Proof of identity | file[] | M | PDF/JPEG/PNG ≤ 5 MB each; 1–2 files | B.13 |

### A.3 Section C — Education (repeatable `qualifications[]`)

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `c.highestLevel` | Highest level attained | enum | M | A2, A1, A0, BACHELOR, POSTGRADUATE, OTHER_RECOGNISED | C.1 |
| `c.q[].institution` | Name of institution | lookup/text | M | | C.2 |
| `c.q[].qualification` | Qualification obtained | text | M | | C.3 |
| `c.q[].fieldOfStudy` | Field of study | lookup/text | M | Mapped for BR-013/014 | C.4 |
| `c.q[].yearCompleted` | Year of completion | number | M | 1950–current year | C.5 |
| `c.q[].certificateNo` | Certificate / diploma number | text | O | | C.6 |
| `c.q[].certificateFile` | Educational certificate | file | M | | C.7 |
| `c.q[].transcriptFile` | Academic transcript | file | C: rule per category/level | | C.8 |
| `c.q[].isForeign` | Obtained outside the country? | bool | M | | C.9 |
| `c.q[].recognitionEvidence` | Recognition / equivalence evidence | file + text | C: isForeign & rule | | C.10 |

### A.4 Section D — Training and examinations

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `d.trainingCompleted` | Completed prescribed training? | bool | M | No blocks if required | D.1 |
| `d.trainingProvider` | Training provider | lookup | C: trainingCompleted | Accredited list | D.2 |
| `d.trainingProgramme` | Training programme | lookup | C | Filtered by provider and category | D.3 |
| `d.trainingCompletedOn` | Date of completion | date | C | ≤ today | D.4 |
| `d.trainingCertificateNo` | Training certificate number | text | C | | D.5 |
| `d.trainingCertificateFile` | Training certificate | file | C | | D.5, I |
| `d.examPassed` | Passed required licensing exam? | enum | M | YES, NO, NOT_APPLICABLE (per category) | D.6 |
| `d.examReference` | Examination reference number | text | C: YES | | D.7 |
| `d.examDate` | Examination date | date | C: YES | Within validity (BR-016) | D.8 |
| `d.examResultFile` | Exam result / certificate | file | C: YES | | D.9 |
| `d.additionalCertifications` | Additional certifications | file[] | O | | D.10 |

### A.5 Section E — Professional experience

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `e.totalYears` | Total years of relevant experience | number (computed) | M | Computed from records; declared value optional | E.1 |
| `e.currentCategory` | Current / most recent category | enum | O | | E.2 |
| `e.previousLicenseNo` | Previous registration / license number | lookup/text | O | Auto-verify against register | E.3 |
| `e.records[].firm` | Name of previous/current firm | lookup/text | C: has experience | | E.4 |
| `e.records[].category` | Category held | enum | C | | E.4/E.9 |
| `e.records[].from` / `.to` | Period of employment/affiliation | date | C | from ≤ to ≤ today | E.5 |
| `e.records[].duties` | Description of duties | richtext | C | ≤ 2,000 chars | E.6 |
| `e.records[].evidence` | Evidence of documented experience | file[] | C | | E.7 |
| `e.referee` | Reference / verification contact | group | C: rule | name, role, phone, email | E.8 |
| `e.priorCategoryForExperience` | Previous category of experience | enum | C: REA/Broker | | E.9 |
| `e.initialRegistrationDate` | Date of initial registration/licensing | date | C: REA/Broker | | E.10 |
| `e.registeredPracticeEvidence` | Evidence of registered practice period | file[] | C: REA/Broker | | E.11 |
| `e.equivalentRecognised` | Equivalent experience recognised? | bool | C: REA/Broker | | E.12 |
| `e.equivalenceReference` | Recognition reference / decision | text + file | C: E.12 = Yes | | E.13 |

### A.6 Section F — Affiliation and supervision

| Field key | Label | Type | Req | Validation / notes | Src |
|---|---|---|---|---|---|
| `f.isAffiliated` | Currently affiliated with a licensed REBF? | bool | C: F-applicable category | | F.1 |
| `f.firm` | Brokerage firm (name) | lookup/text | C | Register lookup | F.2 |
| `f.firmRegNo` | Firm registration / license no. | text (auto) | C | | F.3 |
| `f.firmAddress` | Firm's registered address | address (auto) | C | | F.4 |
| `f.principalBrokerName` / `f.principalBrokerLicenseNo` | Principal Broker | text (auto) | C | | F.5, F.6 |
| `f.managingBroker` | Managing Broker | lookup | O/C | | F.7 |
| `f.supervisorName` / `f.supervisorLicenseNo` | Supervising Broker / designated practitioner | lookup | C | BR-030 | F.8, F.9 |
| `f.affiliationStart` | Date of commencement of affiliation | date | C | | F.10 |
| `f.affiliationEvidence` | Evidence of affiliation/appointment | file[] | C | | F.11 |
| `f.referralArrangementName` | Approved referral arrangement | lookup/text | C: RERA referral-only | | F.12 |
| `f.referralApprovalRef` | Approval / authorisation reference | text | C | | F.13 |
| `f.referralApprovalEvidence` | Evidence of approval | file | C | | F.14 |
| `f.intendsIndependent` | Intend to practise independently? | bool | C: Broker | | F.15 |
| `f.independentAuthorisation` | Authorisation / supporting info | text + file | C: F.15 = Yes | | F.16 |

### A.7 Section G — Category-specific (unique fields only; others re-use B–F)

| Field key | Label | Type | Req | Src |
|---|---|---|---|---|
| `g1.ageConfirmed` | Minimum age 18 confirmation | computed + bool | M | G1.1 |
| `g1.educationConfirmed` | A2 or equivalent confirmation | computed + bool | M | G1.2 |
| `g1.firmOrArrangement` | Proposed firm or referral arrangement | ref (F) | M | G1.3 |
| `g1.supervisor` | Supervising Broker / designated practitioner | ref (F) | M | G1.4 |
| `g1.art10Ack` | Acknowledgment of referral-only restrictions (Art. 10) | bool + version | M | G1.5 |
| `g2.ageConfirmed` | Minimum age 18 confirmation | computed + bool | M | G2.1 |
| `g2.a2Certificate` | A2 secondary school certificate / equivalent | ref (C) | M | G2.2 |
| `g2.entryTrainingCert` | Entry-level training certificate | ref (D) | M | G2.3 |
| `g2.supervisor` | Supervising REA or Broker | ref (F) | M | G2.4 |
| `g2.territory` | Proposed geographical territory | enum[] (admin divisions) | M | G2.5 |
| `g2.restrictionsAck` | Acknowledgment of negotiation/binding agreement restrictions | bool + version | M | G2.6 |
| `g3.qualification` | Qualifying education (Art. 12) | ref (C) | M | G3.1 |
| `g3.fslaExperience` | ≥ 3 years FSLA / equivalent evidence | ref (E) | M | G3.2 |
| `g3.trainingCert` | Professional training certificate | ref (D) | M | G3.3 |
| `g3.examResult` | REA exam result | ref (D) | M | G3.4 |
| `g3.supervisingBroker` | Supervising Broker | ref (F) | M | G3.5 |
| `g4.qualification` | Estate Mgmt & Valuation / Valuation & Property Mgmt / Real Estate / equivalent | ref (C) | M | G4.1 |
| `g4.reaExperience` | ≥ 3 years licensed REA evidence | ref (E) | M | G4.2 |
| `g4.advancedTrainingCert` | Advanced Broker training certificate | ref (D) | M | G4.3 |
| `g4.examResult` | Broker exam result | ref (D) | M | G4.4 |
| `g4.practiceArrangement` | Intended practice arrangement | enum: INDEPENDENT, AFFILIATED, ESTABLISH_OR_JOIN_REBF | M | G4.5 |
| `g5.brokerLicenseNo` | Existing Broker license number | lookup | M | G5.1 |
| `g5.licenseValid` | Current license validity confirmation | computed | M | G5.2 |
| `g5.rebf` | Affiliated REBF name & registration no. | lookup | M | G5.3 |
| `g5.principalBroker` | Principal Broker name & license no. | auto | M | G5.4 |
| `g5.appointmentConfirmation` | Appointment/affiliation confirmation | file + digital confirmation | M | G5.5 |
| `g5.supervisionAck` | Acknowledgment of Principal Broker supervision/responsibility | bool + version | M | G5.6 |
| `g6.brokerLicenseNo` | Existing Broker license number | lookup | M | G6.1 |
| `g6.rebf` | REBF name & registration no. | lookup | M | G6.2 |
| `g6.branch` | Office or branch assigned | lookup | M | G6.3 |
| `g6.appointmentLetter` | Appointment letter from REBF | file | M | G6.4 |
| `g6.principalBroker` | Principal Broker name & license no. | auto | M | G6.5 |
| `g6.supervisoryResponsibilities` | Proposed supervisory responsibilities | richtext + structured | M | G6.6 |
| `g6.managementTraining` | Additional management training evidence | file | C: rule | G6.7 |
| `g7.brokerLicenseNo` | Existing Broker license number | lookup | M | G7.1 |
| `g7.rebfOrProposedRef` | REBF name & reg. no. or proposed firm reference | lookup/text | M | G7.2 |
| `g7.designationProof` | Proof of designation as Principal Broker | file | M | G7.3 |
| `g7.officesAndBranches` | Registered office and branches | auto/list | C | G7.4 |
| `g7.indemnityInsurance` | Professional indemnity insurance details | group (insurer, policy no., cover, from, to, file) | C: rule | G7.5 |
| `g7.responsibilityConfirmations` | Responsibility for supervision, client funds, records, compliance, complaints | bool ×5 + version | M | G7.6 |
| `g8.legalName` | Registered legal name | text | M | G8.1 |
| `g8.tradingName` | Trading name | text | O | G8.2 |
| `g8.legalForm` | Legal form | enum | M | G8.3 |
| `g8.companyRegNo` | Company / legal entity registration no. | text | M | G8.4 |
| `g8.tin` | Tax identification number | text | C: rule | G8.5 |
| `g8.incorporatedOn` | Date of incorporation / registration | date | M | G8.6 |
| `g8.registeredOffice` | Registered office address | address | M | G8.7 |
| `g8.principalPlaceOfBusiness` | Principal place of business | address | M | G8.8 |
| `g8.phone` / `g8.email` | Telephone and official email | phone / email | M | G8.9 |
| `g8.responsiblePersons[]` | Directors / partners / responsible persons | group[] | M (≥1) | G8.10 |
| `g8.principalBroker` / `g8.supervisoryPractitioners[]` | Proposed Principal Broker & supervisory practitioners | lookup | M / O | G8.11 |
| `g8.branches[]` | Proposed branches & Managing Brokers | group[] | C | G8.12 |
| `g8.registrationCertificate` | Business registration certificate / Certificate of Domestic Company Registration | file | M | G8.13 |
| `g8.fullRegistrationInfo` | Full Registration Information of Domestic Company | file | M | G8.14 |
| `g8.taxRegistrationEvidence` | Tax registration evidence | file | C: rule | G8.15 |
| `g8.addressProof` | Proof of registered business address | file | M | G8.16 |
| `g8.indemnityEvidence` | Professional indemnity insurance evidence | file | C: rule | G8.17 |
| `g8.supervisorySystems` | Evidence of supervisory systems & procedures | file + questionnaire | M | G8.18 |
| `g8.clientFundsArrangements` | Client funds & transaction records arrangements | file | C: applicable | G8.19 |
| `g8.additionalDocs[]` | Additional corporate documentation | file[] | C: authority requires | G8.20 |

### A.8 Section H — Compliance and integrity

| Field key | Label | Type | Req | Src |
|---|---|---|---|---|
| `h.criminalConviction` | Convicted of a relevant criminal offence? | bool | M | H.1 |
| `h.disciplinarySanction` | Subject to a disciplinary sanction or suspension? | bool | M | H.2 |
| `h.licenseRevoked` | Previously had a registration/license revoked? | bool | M | H.3 |
| `h.currentRestriction` | Currently subject to a restriction preventing practice? | bool | M | H.4 |
| `h.disclosureDetails[]` | Details & supporting documents | group (nature, date, authority, outcome, status, files) | C: any Yes | H.5 |
| `h.criminalRecordCertificate` | Criminal record certificate / prescribed evidence | file + issue date | M | H.6 |
| `h.codeOfConductAgreement` | Willing to comply with code of conduct? | bool (+ version) | M (must be Yes) | H.7 |

### A.9 Section J — Declaration

| Field key | Label | Type | Req | Src |
|---|---|---|---|---|
| `j.declarationVersion` | Declaration text version | text (system) | M | J.1–J.8 |
| `j.statementAcks[1..8]` | Per-statement acknowledgment | bool[] | C: config | J.1–J.8 |
| `j.confirmed` | I confirm that I have read and accepted the declaration | bool | M | J |
| `j.signatoryName` | Applicant's full name | text (locked) | M | J |
| `j.signature` | Electronic signature / approved authentication | object (method, ts, ip, ua, snapshotHash) | M | J |
| `j.date` | Date | date (system) | M | J |

### A.10 Section K — Payment and submission

| Field key | Label | Type | Req | Src |
|---|---|---|---|---|
| `k.registrationFee` | Registration fee | money (system) | M | K.1 |
| `k.licensingFee` | Licensing fee | money (system) | M | K.2 |
| `k.otherFees[]` | Other prescribed fees | money[] (system) | C | K.3 |
| `k.total` | Total amount payable | money (system) | M | K.4 |
| `k.paymentReference` | Payment reference | text (system) | M | K.5 |
| `k.paymentMethod` | Payment method | enum | M | K.6 |
| `k.paymentStatus` | Payment status | enum: PENDING, PAID, FAILED, REFUNDED, PARTIALLY_REFUNDED, EXPIRED | M | K.7 |
| `k.submittedAt` | Application submission date | datetime (system) | M | K.8 |

### A.11 Section L — Administrative review (official use)

| Field key | Label | Type | Values | Src |
|---|---|---|---|---|
| `l.referenceNo` | Application reference number | text (auto) | | L.1 |
| `l.receivedAt` | Date received | datetime (auto) | | L.2 |
| `l.officer` | Assigned reviewing officer | user | | L.3 |
| `l.identity` | Identity verification | enum | VERIFIED, PENDING, FAILED | L.4 |
| `l.education` | Educational qualifications | enum | VERIFIED, PENDING, FAILED, NA | L.5 |
| `l.experience` | Professional experience | enum | VERIFIED, PENDING, FAILED, NA | L.6 |
| `l.trainingExam` | Training and examination | enum | VERIFIED, PENDING, FAILED, NA | L.7 |
| `l.affiliation` | Brokerage affiliation / appointment | enum | VERIFIED, PENDING, FAILED, NA | L.8 |
| `l.integrity` | Criminal record / integrity checks | enum | VERIFIED, PENDING, FAILED, NA | L.9 |
| `l.documentation` | Supporting documentation | enum | COMPLETE, INCOMPLETE | L.10 |
| `l.eligibility` | Eligibility under category | enum | SATISFIED, NOT_SATISFIED, FURTHER_ASSESSMENT | L.11 |
| `l.infoRequested` | Additional information requested | list (information_request) | | L.12 |
| `l.comments` | Reviewer's comments | richtext (internal / applicant-visible) | | L.13 |
| `l.recommendation` | Recommended decision | enum | APPROVE, REQUEST_INFO, REFER, REJECT (+ reasons) | L.14 |
| `l.signature` | Officer name, e-approval, date | object | | L footer |

### A.12 Section M — Decision (authorised personnel)

| Field key | Label | Type | Src |
|---|---|---|---|
| `m.referenceNo` | Application reference number | text (auto) | M.1 |
| `m.decision` | Decision | enum: APPROVED, APPROVED_WITH_CONDITIONS, DEFERRED, REJECTED | M.2 |
| `m.approvedCategory` | Approved professional category | enum | M.3 |
| `m.registrationNo` | Registration number | text (auto) | M.4 |
| `m.licenseNo` | License number | text (auto) | M.5 |
| `m.issueDate` | License issue date | date | M.6 |
| `m.expiryDate` | License expiry / renewal date | date (computed) | M.7 |
| `m.geoScope` | Authorised geographical scope | admin divisions[] | M.8 |
| `m.practiceArrangement` | Authorised practice arrangement | enum + refs | M.9 |
| `m.supervisor` | Supervising Broker / Principal Broker | license ref | M.10 |
| `m.conditions[]` | Conditions / restrictions | library + text, end date | M.11 |
| `m.reasons` | Decision reasons / reference | richtext + reason codes | M.12 |
| `m.approver` | Name and title of approving authority | user + title | M.13 |
| `m.signatureRef` | Electronic signature / approval reference | object | M.14 |
| `m.decidedAt` | Date of decision | datetime | M.15 |

---

## Appendix B — Document checklist matrix

Legend: **M** mandatory, **C** conditional (condition noted), **–** not applicable, **R** for renewal only if changed or expired. Columns apply to *New/Upgrade*; Renewal (REN), Change of affiliation (CHG) and Reinstatement (RST) are summarised in the last columns.

| Document | RERA | FSLA | REA | Broker | Assoc. | Managing | Principal | REBF | REN | CHG | RST |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Proof of identity | M | M | M | M | M | M | M | – (directors' IDs: M) | R | – | M |
| Colour passport-size photograph | M | M | M | M | M | M | M | – | R | – | M |
| Educational certificate(s) | M (A2) | M (A2) | M | M | – (on file) | – | – | – | – | – | C |
| Academic transcripts | C | C | C | C (field check) | – | – | – | – | – | – | – |
| Foreign recognition / equivalence | C: foreign | C | C | C | – | – | – | – | – | – | – |
| Professional training certificate | – | M (entry) | M (professional) | M (advanced) | – | C (management) | – | – | C (CPD, Q-05) | – | C |
| Licensing exam result | – | – | M | M | – | – | – | – | – | – | C |
| Evidence of professional experience | – | – | M (≥3y FSLA) | M (≥3y REA) | – | – | – | – | – | – | C |
| Equivalence recognition decision | – | – | C: E.12 | C: E.12 | – | – | – | – | – | – | – |
| Criminal record certificate | M | M | M | M | M | M | M | M (each director, configurable) | M | – | M |
| Integrity disclosure documents | C: H Yes | C | C | C | C | C | C | C | C | C | C |
| Proof of professional address | C | C | C | C | – | – | – | – | – | C | – |
| Evidence of affiliation / appointment | M | M | M | C: affiliated | M | M (appointment letter) | M (designation proof) | – | C | M | C |
| Referral arrangement approval | C: referral-only | – | – | – | – | – | – | – | – | C | – |
| Independent practice authorisation | – | – | – | C: independent | – | – | – | – | C | – | – |
| Evidence of previous registration/license | – | – | C | C | – | – | – | – | – | – | M |
| Company registration documents (G8.13, G8.14) | – | – | – | – | – | – | – | M | R | – | M |
| Tax registration evidence | – | – | – | – | – | – | – | C | R | – | C |
| Proof of registered business address | – | – | – | – | – | – | – | M | R | – | M |
| Professional indemnity insurance | – | – | – | – | – | – | C | C | C | – | C |
| Supervisory systems & procedures | – | – | – | – | – | – | – | M | – | – | C |
| Client funds & records arrangements | – | – | – | – | – | – | – | C | – | – | C |
| Proof of payment | Auto | Auto | Auto | Auto | Auto | Auto | Auto | Auto | Auto | Auto | Auto |
| Other documents required by authority | C | C | C | C | C | C | C | C | C | C | C |

---

## Appendix C — Notification catalogue

| Code | Trigger | Recipients | Channels |
|---|---|---|---|
| N-001 | Account created / verify email & phone | Applicant | Email, SMS |
| N-002 | Security events (password/MFA/email/phone change, new device) | Account holder | Email, SMS |
| N-003 | Draft inactivity reminder / draft expiring | Applicant | Email, in-app |
| N-010 | Payment successful (receipt) / failed / refunded | Payer, applicant | Email, SMS, in-app |
| N-011 | **Application submitted** — acknowledgment with reference | Applicant | Email, SMS, in-app |
| N-020 | **Supervisor confirmation requested** | Supervisor | Email, SMS, in-app |
| N-021 | Principal Broker affiliation/designation confirmation requested | Principal Broker | Email, SMS, in-app |
| N-022 | Confirmation reminder (day 3, 7, 12) / expired | Supervisor / PB; applicant | Email, SMS |
| N-023 | **Supervisor confirmed / declined** | Applicant | Email, SMS, in-app |
| N-030 | Application assigned (internal) | Officer | In-app, email |
| N-031 | SLA breach warning | Officer, team lead | In-app, email |
| N-040 | **Request for additional information** | Applicant | Email, SMS, in-app |
| N-041 | Information request reminder / overdue | Applicant | Email, SMS |
| N-042 | Applicant responded | Officer | In-app |
| N-050 | Referred for further assessment | Applicant (generic), specialist | Email, in-app |
| N-060 | **Approved** (with certificate link) / approved with conditions | Applicant; firm PB (if affiliated) | Email, SMS, in-app |
| N-061 | Deferred pending information | Applicant | Email, SMS, in-app |
| N-062 | **Rejected** (with reasons & next steps) | Applicant | Email, SMS, in-app |
| N-070 | **Renewal reminder** (90/60/30/14/7 days), expiry day, grace period, lapse | License holder; firm PB | Email, SMS, in-app |
| N-071 | Document expiring (criminal record, insurance, passport) | Holder; PB | Email, in-app |
| N-080 | Supervisor/firm license suspended, revoked or lapsed → action needed | Supervisees, PB | Email, SMS, in-app |
| N-081 | Affiliation ended by firm | Practitioner | Email, SMS, in-app |
| N-082 | License suspended / revoked / reinstated | Holder; PB | Email, SMS, in-app |
| N-090 | Upgrade eligibility reached ("You can now apply for Broker") | Practitioner | Email, in-app |
| N-100 | Configuration change pending approval (maker-checker) | Checker | In-app, email |

---

## Appendix D — Permission matrix

Legend: **C** create, **R** read, **U** update, **A** approve/decide, **—** none, *own* = own records only, *assigned* = assigned applications, *firm* = own firm.

| Capability | Applicant | Supervisor | Principal Broker | Firm Admin | Reviewing Officer | Approving Authority | Registrar | Finance | Sys Admin | Auditor/DPO | Public |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Create/edit application | C/U *own* | — | C/U *firm (REBF)* | C/U *firm* | C (assisted) | — | — | — | — | — | — |
| View application | R *own* | R summary *supervisee* | R summary *firm* | R summary *firm* | R *assigned* | R *assigned* | R | R payment | — | R (logged) | — |
| Confirm supervision/affiliation | — | A | A | — | Override (reason) | — | — | — | — | — | — |
| Section L review | — | — | — | — | C/U *assigned* | R | R | — | — | R | — |
| Section M decision | — | — | — | — | — | A (not own review) | R | — | — | R | — |
| Suspend/revoke/correct register | — | — | — | — | — | A (revoke) | C/U | — | — | R | — |
| Payments, refunds, waivers | Pay *own* | — | Pay *firm* | Pay *firm* | R | R | R | C/U/A | — | R | — |
| Configuration (fees, rules, templates) | — | — | — | — | — | A (checker, if delegated) | — | Fees (maker) | C/U (maker) | R | — |
| User & role management | — | — | Firm roles | Firm roles | — | — | — | — | C/U | R | — |
| Audit trail | Own activity | — | — | — | Own actions | Own actions | R | — | R | R / export | — |
| Reports | — | — | Firm reports | Firm reports | Operational | Operational | All | Financial | System | All | — |
| Public register search | R | R | R | R | R | R | R | R | R | R | R |

---

## Appendix E — Glossary

| Term | Definition |
|---|---|
| A2 / A1 / A0 | Education levels: A2 = completed advanced secondary school; A1 = advanced diploma; A0 = bachelor's-level degree (in the local education framework). |
| Affiliation | The formal relationship between a practitioner and an REBF, under named supervision. |
| Applicant | An individual or firm applying through the portal. |
| Approved referral-only arrangement | An arrangement approved by the Professional Body under which a RERA operates without being affiliated with an REBF. |
| Assisted filing | An application started by an officer on behalf of an applicant. |
| Checklist | The dynamic list of documents required for a specific application. |
| Conditions | Legally permitted restrictions attached to a license (e.g. scope, supervision, time-bound obligations). |
| Designated practitioner | A practitioner authorised to supervise a RERA in place of a Broker. |
| Eligibility engine | The rules component that evaluates whether an applicant meets the category requirements. |
| Grace period | The time after license expiry during which late renewal is possible. |
| Information request | A formal request by an officer for additional information or documents. |
| Lapsed | A license status after expiry and grace period without renewal. |
| Maker-checker | A control in which one user proposes a change and a different user approves it. |
| Professional indemnity insurance | Insurance covering liability for professional negligence. |
| Register | The official record of licensed practitioners and firms, partly public. |
| Segregation of duties | The rule that the reviewer and the approver of an application must be different people. |
| Snapshot | An immutable copy of application data at submission, bound to the declaration signature. |
| Supervisor | The licensed practitioner responsible for supervising a lower-category practitioner. |

---

*End of document — REBP-PORTAL-SRS-001 v1.0*
