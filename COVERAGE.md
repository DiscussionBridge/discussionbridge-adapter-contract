# Alpha.23 Matrix Coverage Ledger

This ledger maps every item in
`planning/ADAPTER_PROTOCOL_ALPHA20_SUCCESSOR_CHANGE_MATRIX.md` to the exact
Alpha.23 candidate artifact. It prevents a green parser test from hiding a
missing approved requirement.

## Approved REC0158 static recovery correction

Phil approved the seven static-recovery definitions and coordinated Alpha.23
identity on 2026-10-07. The original matrix remains the successor authority;
this section records the subsequently approved bounded correction, not a new
matrix or rollout approval.

| Definition | Executable coverage | Limit of evidence |
| --- | --- | --- |
| Optional `static_recovery` with two pending states and real prior ACK/response | `validateWork`, `validateStaticRecovery`; fixture `static-recovery/trace.json`; shape, correlation, identity and fresh-token tests. | Schema validity does not prove actual persisted history. |
| Existing claim route reissues receipt-linked static ownership | `validateStaticRecoveryClaim`; independent receiver-context receipt/issue, active-owner, current policy/scope, retry eligibility and repeated interruption controls. | Pure validators; receiver transaction, retry authorization and restart still need native qualification. |
| First recovered ACK uses the current issue, not an old response's next token | `validateStaticRecoveryTransition`, `validateAcknowledgementIdentity`, `validateAcknowledgementExchange`; exact complete/excerpt binding, raw timestamps, lost-ACK event time, expired/stale/skipped/correlation controls. | Actual external deployment/public verification remains the adapter's responsibility. |
| Pending static renewal | `validateRenewal`; both stages, static-only context, expiry, ownership and original additive/four-hour boundaries. | Caller must supply current receiver work; no database lock is supplied by a validator. |
| Conditional available-to-pending retry and normal-vs-recovery claim | Real retained stage required; no synchronization authorization; ordinary transition body remains unchanged; existing retry registry/backoff tests retained. | Atomicity, immutable history, exact replay response and native write count require receiver tests. |

The new test module runs within the existing `npm test` suite. Exact positive
and negative counts are printed by the run, not assumed here. It independently
loads receipt fixtures instead of treating a client's claim as proof. The same
schema is exercised for Astro, Hugo and Statamic SSG; this is not qualification
of those adapter packages. Existing dynamic/ordinary static and raw-byte tests
continue running. There is no product/family, installation, release, deployment,
restart or formal-review acceptance implied by this ledger.

## Retained Alpha.20 behavior

| Matrix IDs | Candidate coverage |
| --- | --- |
| B-01–B-03 | `contract.json` authentication and retained resolve path; `README.md` Authentication and To Discourse. |
| B-04–B-07 | `contract.json` resolve required/optional fields, bounds, outcomes, and adoption rule; original response fixtures updated with revision acknowledgement. |
| B-08 | `contract.json` records index/show, page bound, and page size remain unchanged. |
| B-09–B-11 | `contract.json` transport/persistence rules, fail-closed conflict rules, and no-fallback rule; `README.md` Governing rules. |

## Approved successor additions

| Matrix ID | Candidate coverage | Evidence |
| --- | --- | --- |
| A-01 | `contract.json#/configuration/presentation_modes` and `presentation_rule`. | Positive presentation catalog; invalid superseded third-mode fixture and test. |
| A-02 | `contract.json#/configuration/forum_name`. | Connection capability fixture; README shared forum-name section. |
| A-03 | `contract.json#/authentication/adapter_identity_role`. | Conformance assertion; README authentication boundary. |
| A-04 | `contract.json#/connection_capability`. | From-Discourse and pure-To-Discourse capability fixtures include supported operations, finite bounds, resolved destination policy, and conditional forum name. Raw 64 KiB, 100-lane, 100-policy, 1,000-mapping, 255-byte identifier, 64-byte lane, uniqueness, exact-limit, and limit-plus-one controls are executable. |
| B-12 | Resolve/source/work `source_revision` plus positive monotonic `source_revision_sequence`. | Complete request, inventory, detail, work, acknowledgement, revocation, and revision-conflict fixtures. |
| B-13 | Source-created/source-updated fields plus acknowledgement synchronization and public-verification times. | Request, source, record, and acknowledgement fixtures. |
| B-14 | Exact applied source and destination publication revisions. | From-Discourse record and acknowledgement fixtures. |
| B-15 | Source metadata is normative; native Latest remains platform-owned. | `README.md` Platform-owned behavior; adapter qualification remains downstream. |
| C-01 | To-Discourse `complete`/`excerpt`, full-source bytes/hash, exact Read More rule. | Complete and excerpt request fixtures; parse5 enforces the exact trailing first-post-body structure, decoded canonical link, forbidden source-controlled style/script/base elements, 1,024-element and depth-64 limits, exact-limit/limit-plus-one controls, and a targeted source-reversion probe. |
| C-02 | Inline or revision-pinned base64 chunk transport with per-chunk and whole-content integrity. | Inline detail, chunked detail, chunk fixture, successful reverse-ordered complete-set reassembly across a split UTF-8 sequence, integrity/UTF-8 negatives, and an always-reject source mutation. |
| C-03 | Destination acknowledgement records content disposition; destination owns real limit/excerpt. | Acknowledgement fixture and README From Discourse section. |
| C-04 | Rich rendering remains platform-owned. | README Platform-owned behavior; no renderer semantics in wire schema. |
| D-01 | Verified source-URL ancestry, redirects, retired binding, fail-closed conflict. | `source_url_migration_attestation` and URL-proof fixture. |
| D-02 | Connection-scoped destination binding fields. | Record and acknowledgement fixtures. |
| D-03 | Destination publication revision, synchronization, deployment, and verification state/time. | Dynamic create, static pending, and static verified acknowledgement fixtures. |
| D-04 | Hold, unpublish, restore actions and durable binding states. | Work action/state registry and revocation fixture. |
| E-01 | Opaque snapshot/cursor, policy-bound initial inventory, high-water, 30-day activity retention, expiry, and restart/deduplication rule. | Initial and resumed source-inventory fixtures plus cursor/snapshot mismatch fixture. |
| E-02 | Revision-pinned source detail and bounded content transport. | Inline/chunked detail fixtures plus raw 256 KiB metadata-envelope exact/over-limit controls. |
| E-03 | Cursor/high-water revocation index/detail, reasons, retention, restart deduplication, work-owned delivery acknowledgement, and same-identity restore rule. | Revocation index/detail and restart trace plus hold/unpublish/restore work. |
| E-04 | Bounded claim, lease, renewal, staged acknowledgement, failure, serialized binding work, expiry, retention, and supersession rules. | Independent dynamic and static three-stage traces bind every response to authoritative work, receiver-owned destination mode, actual stage and terminal semantics; work items have incremental raw 128 KiB enforcement with leading/trailing/interior and multibyte exact/plus-one controls, empty-array exact-envelope positives and envelope-plus-one/former-item-sized-padding negatives, malformed escape/control, unterminated, mismatched and deep-nesting pre-parse rejection, bounded-slice/nesting instrumentation, 32/33-item ordering and guard-removal/bypass/deferred source reversions; plus 120-taxonomy, identifier/kind and duplicate-source controls, interruption states, failure fixtures, and late-superseded negatives. |
| E-05 | Receiver-owned retryable/terminal registry, one initial plus three retries, exact backoff/exhaustion, and bounded manual retry. | Complete retry trace plus failure, retry-wait, and exhausted/operator-attention fixtures. |
| E-06 | Exact immutable `policy_revision` in inventory, work, and acknowledgement. | Inventory/work/ack fixtures. |
| E-07 | Separate synchronization, deployment, and public verification; static completion rule. | Authoritative dynamic-mode acknowledgement; authoritative static synchronized → deployed → verified trace; static-as-dynamic and dynamic-as-static rejection; missing/malformed mode rejection; deployment/verification failures; destination-mode source reversion. |
| E-08 | Required header/body correlation across every route and exact error envelope. | Correlated route fixtures plus raw 4,096/4,097-byte response controls, malformed-plus-one pre-parse ordering, malformed-message-type exact errors, oversized/secret-exposure negatives, and shared raw-byte guard/removal/order source reversions. |
| F-01 | Segmented bounded descriptive catalog with exact item and GET/PUT schemas and no authorization authority. | Positive fixtures for all six segments and update; standalone raw 65,536/65,537-byte GET-response and PUT-request controls across leading/trailing/interior forms; malformed-plus-one pre-parse rejection; separate response/correlation composition; exact/max-plus-one UTF-8 controls for 255-byte identifiers/references, 200-byte names and 100-byte container kinds; independently valid aggregate overflow; unknown-field/authority negatives; raw removal/order, aggregate and identifier source reversions. |
| F-02 | Exact bounded `catalog_revision` referenced by operator policy. | Atomic update, exact/max-plus-one 255-byte response/base revisions, stale revision, removed mapping, and authority rules/fixtures. |
| F-03 | Native public pagination remains platform-owned. | README Platform-owned behavior. |
| G-01 | Bounded source-author schema both directions without shared identity. | Source detail author fixture and authorship rules. |
| G-02 | Bounded source category/tag identities for operator policy mapping. | Source detail taxonomy fixture and schema plus exact 20-category/100-tag, 255-byte ID, 200-byte name, and duplicate-source-ID controls. |
| H-01 | Separate strict I-JSON/RFC 8785/Ed25519 Operator Service entitlement contract; one provider; protected issuer/key enrollment and rotation. | Real deterministic public-key/message/signature vector, executable cryptographic verification, direct raw and correctly signed lone-surrogate/noncharacter negatives, valid supplementary controls, and targeted high-surrogate, low-surrogate and noncharacter source reversions. |
| H-02 | Scope, forum binding, validity, grace/read-only, replacement, revocation, and audit rules. | Enrollment/revocation audits plus tamper, wrong forum/key, not-yet-valid, expired, grace, revoked, replaced, and scope negatives. |
| H-03 | Customer approval and provider audit remain separate from adapter credentials. | Operator contract rules and invalid-scope fixture. |
| I-01 | Stable origin/content-authority forum provenance. | Network source detail fixture. |
| I-02 | Protected forum-ID lifecycle, durable operation replay, exact route append, and self/repeat/over-limit rejection. | Identity/replay fixtures plus clone, replay mismatch, loop, repeat, and over-limit negatives. |
| I-03 | Only `first_post` is admitted; discussion/moderation/users remain local. | Network managed-scope schema and README. |
| I-04 | Generic visible origin, direction, canonical source, local forum, and discussion boundary. | Network provenance fields and presentation rule. |
| I-05 | No automatic cross-spoke transit. | Network rules. |

## Deliberately downstream work

| Matrix IDs | Why not encoded as additional wire behavior | Downstream gate |
| --- | --- | --- |
| J-01–J-06 | Presentation components, rendering assets, pagination, persistence mechanics, themes, installers, services, and static-build commands are platform implementation. | Each adapter's Work List checklist and package-install qualification. |
| K-01–K-04 | Large-corpus, 1,000-page, network, and artifact-uniformity requirements are qualification evidence rather than request fields. | Component Work List Gates C/D and dedicated qualification plans. |

## CB-01 R1–R4 and R5 correction evidence

The separately authorized R5 batch extends the earlier R1–R4 corrections.
This changed source candidate is awaiting its own exact independent correction
review; no prior disposition carries forward. The executable cases below
establish candidate test coverage, not consumer/runtime, artifact, release or
product acceptance. In particular, source/work/acknowledgement compositions
do not execute native destination sizing selection, writes or rendering.

| Repair / related Matrix IDs | Candidate checks and limitations |
| --- | --- |
| R1 / C-03, D-02, E-04, E-07 | Static three-stage and dynamic full excerpt exchanges bind Read More to receiver-owned resource/revision/sequence/source URL; missing, malformed, wrong-target and stale-context negatives; persisted synchronized excerpt requirement with pre-first-ack and unrelated source-role compatibility; source-target, retained-revision and persisted-link guard-removal probes. Installed provenance/persistence remain unqualified. |
| R2 / B-09, C-02 | Feasible count/progress, one-chunk empty content, minimum/maximum decoded bytes, varying sizes, shuffled split-UTF-8 reassembly, count/index/revision/hash/padding/UTF-8 negatives. Instrumented rejection precedes decode/concat/sort; decoded-bound removal, header deferral, impossible descriptor and aggregate-before-copy/sort source reversions. Practical small-chunk amplification remains unqualified. |
| R3 / E-04 | Whole 4,259,840-byte and outside-item 65,536-byte raw bounds; 32 maximum-sized items, exact/plus-one envelope, empty-array/outer padding, escaped names, malformed/UTF-8 whole excess and preserved high-precision timestamps. Whole guards precede key processing; envelope precedes full parser. Whole/UTF-8/envelope removal and envelope-order reversions detect lost barriers. Constructed-object validation is not raw-ingress proof. |
| R4 / B-02, A-04 | Real To-Discourse resolve/capability/direction/scope and From-Discourse capability/record/source compositions; omitted lane only for empty scope, configured membership, named denial on empty scope, invalid explicit lane values, and retained nonempty rules for other capability arrays. Empty-lane admission, configured-omission and no-wildcard source reversions. No From-Discourse resolve route or wire lane field is invented. |
| R5 / C-01–C-03, A-04, B-09 | Removed aggregate source constants and obsolete capability advertisement; measured source identity retained. Above-old-threshold To excerpts and From descriptors/records, safe-integer edges, actual correctly hashed 16,777,217-byte source with variable/shuffled split-UTF-8 chunk reassembly, and progressing standalone counts above the old ceiling. Invalid size/count/index, linked feasibility and obsolete numeric/null capability negatives; the historical source-content-over-bound fixture now tests unsafe numeric representation, not policy size. Four literal/numeric reintroduction probes detect restored To, From, standalone-count and capability ceilings. Valid native-policy/complete/excerpt exchanges prove contract compatibility, not installed policy selection or runtime capacity. |

## Coordinated transition coverage

- Exact version header and connection capability prevent a partial deployment
  from silently operating under the wrong contract.
- `MIGRATION.md` preserves Alpha.20 identities and directions, rejects
  superseded presentation values rather than normalizing them, initializes
  revision state, keeps new publication scope default-off, defines sequential
  canaries, and fixes the rollback boundary.
- The synthetic cutover manifest binds independently versioned protocol,
  shared-plugin, adapter, schema, configuration, policy, and consumer
  identities; rehearsal evidence binds the canonical manifest content by
  SHA-256 and rejects identity or artifact mismatches before mutation.
- The candidate is derived from exact tag `v0.2.0-alpha.20`; the dirty Alpha.21
  working tree is not an implementation base.
- Every positive fixture is accepted through an executable validator, every
  negative fixture is rejected with its exact expected protocol code, real
  Ed25519 verification runs locally, and mutation classes cover missing and
  unknown fields, enum, bound, hash, and signature failures.
- Excerpt validation uses only the lockfile-pinned standards HTML parser
  exercised by CI. Iterative traversal enforces the 1,024-element/depth-64
  budget and forbidden-element rule; exact parsed first-post-body structure,
  text and decoded canonical href replace unsound browser/CSS visibility
  simulation. Installed presentation remains a downstream qualification gate.
- Claim/acknowledgement traces compose request, authoritative work, response,
  correlation, lease, receipt, stage, terminal destination semantics, and event
  chronology rather than validating shapes in isolation. Dynamic authoritative
  work identity is sourced independently from the response. Targeted in-memory
  source reversions prove response-work, response-terminal, synchronization
  chronology, authoritative destination mode, excerpt structure, bounded exact-
  integer parsing, catalog-ID and aggregate bounds, raw endpoint limits and
  pre-parse ordering, claim-work ordering and incremental in-scanner budget,
  successful chunk reassembly, and each I-JSON Unicode branch exercise their
  intended individual guards.
- Protocol JSON parsing preserves `existing_topic_id` numeric source tokens as
  exact integers before JavaScript Number rounding. Adjacent values above
  `2^53` remain distinct, the signed-64 maximum accepts, rounded fractional
  tokens reject, maximum plus one rejects, and all-zero coefficients return
  without exponent-sized string construction.

## Central source-detail and enumeration declarations

The synthetic runner checks complete-only source-detail admission for inline,
chunked and network examples, whole-current-post byte/hash integrity when that
post is already an upstream excerpt, actual chunk reassembly, and continued
To-Discourse/native-acknowledgement excerpt admission. It checks strict terminal
and nonterminal cursor combinations (including empty pages), each operation's
pinned-context mismatch checks, finite in-memory page traces and duplicate replay.
Two in-memory source reversions detect restoration of the ambiguous detail enum
or independently validated completion/cursor fields.

These checks qualify the declarations and validator boundary only. They do not
prove authoritative producer selection, real empty-page progress, installed
restart persistence, current authorization enforcement or native publication.
They do not close the separately recorded acknowledgement-correlation,
forum-name boundary, two-destination interaction or padded-empty-claim wording
findings. No persistent fixtures, dependencies or consumers are changed.

## Current audit result

All matrix IDs have an explicit candidate or downstream owner. The required
successor fixture categories have positive and negative representatives in the
expanded conformance suite. This is a coverage result, not a formal code-review
disposition and not a release claim.

## CB-CENTRAL-WC01-04-01 correction evidence

The full acknowledgement exchange helper now requires explicit request/response
headers and composes the existing request-header/request-body/response-header/
response-body correlation check. Identity-only helpers remain separately named.
Existing fixture traces supply synthetic headers; the new adversarial matrix
supplies independent mismatches for complete/excerpt static stages and dynamic
outcomes. This is conformance evidence, not observed native HTTP traffic.

Forum-name assertions cover required From and optional pure-To branches,
omission, malformed types/blank names and multibyte exact/over-byte bounds.
Existing omission rules and limits are unchanged.

One-source/two-destination local compositions use distinct policies, bindings,
native limits, work and receipts. They reject foreign policy/work receipts,
select the expected persisted binding in a test-only receiver model, preserve
the sibling through one-sided failure/withdrawal, and let it continue staging.
These finite models and test-only state transitions do not prove installed
producer persistence, authorization, native noninterference or restart recovery.

Five new detecting source-reversion probes remove full ACK wire correlation,
required-name validation, optional-name validation, forum-name byte bounds and
destination-policy binding. Direct assertions are not counted as fixture files
or as mutation classes. The existing fixture census is unchanged; exact run
counts, failures and independent result dispositions belong in WORKING.

The E-04 row describes the current empty-array exact-envelope positive and
envelope-plus-one/former-item-sized-padding negatives. No content/JSON limit was
changed. Historical reports and the earlier definitions-only scope are preserved.
