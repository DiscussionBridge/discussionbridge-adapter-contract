# Alpha.21 Matrix Coverage Ledger

This ledger maps every item in
`planning/ADAPTER_PROTOCOL_ALPHA20_SUCCESSOR_CHANGE_MATRIX.md` to the exact
Alpha.21 candidate artifact. It prevents a green parser test from hiding a
missing approved requirement.

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
| A-04 | `contract.json#/connection_capability`. | `fixtures/connection-capability.json`. |
| B-12 | Resolve/source/work `source_revision` plus positive monotonic `source_revision_sequence`. | Complete request, inventory, detail, work, acknowledgement, revocation, and revision-conflict fixtures. |
| B-13 | Source-created/source-updated fields plus acknowledgement synchronization and public-verification times. | Request, source, record, and acknowledgement fixtures. |
| B-14 | Exact applied source and destination publication revisions. | From-Discourse record and acknowledgement fixtures. |
| B-15 | Source metadata is normative; native Latest remains platform-owned. | `README.md` Platform-owned behavior; adapter qualification remains downstream. |
| C-01 | To-Discourse `complete`/`excerpt`, full-source bytes/hash, exact Read More rule. | Complete and excerpt request fixtures; mismatch negative fixture. |
| C-02 | Inline or revision-pinned base64 chunk transport with per-chunk and whole-content integrity. | Inline detail, chunked detail, chunk fixture, and hash tests. |
| C-03 | Destination acknowledgement records content disposition; destination owns real limit/excerpt. | Acknowledgement fixture and README From Discourse section. |
| C-04 | Rich rendering remains platform-owned. | README Platform-owned behavior; no renderer semantics in wire schema. |
| D-01 | Verified source-URL ancestry, redirects, retired binding, fail-closed conflict. | `source_url_migration_attestation` and URL-proof fixture. |
| D-02 | Connection-scoped destination binding fields. | Record and acknowledgement fixtures. |
| D-03 | Destination publication revision, synchronization, deployment, and verification state/time. | Dynamic create, static pending, and static verified acknowledgement fixtures. |
| D-04 | Hold, unpublish, restore actions and durable binding states. | Work action/state registry and revocation fixture. |
| E-01 | Opaque snapshot/cursor, policy-bound initial inventory, high-water, 30-day activity retention, expiry, and restart/deduplication rule. | Initial and resumed source-inventory fixtures plus cursor/snapshot mismatch fixture. |
| E-02 | Revision-pinned source detail and bounded content transport. | Inline/chunked detail fixtures. |
| E-03 | Cursor-based revocation index/detail, reasons, retention, and same-identity restore rule. | Revocation, hold/unpublish, and restore fixtures. |
| E-04 | Bounded claim, lease, renewal, acknowledgement, failure, concurrency, expiry, and supersession rules. | Claim/renew/ack/failure fixtures and wrong-token, expired, over-limit, and superseded fixtures. |
| E-05 | Receiver-owned retryable/terminal failure registry, attempts, backoff, exhaustion, and bounded manual retry. | Failure, retry-wait, and exhausted/operator-attention fixtures. |
| E-06 | Exact immutable `policy_revision` in inventory, work, and acknowledgement. | Inventory/work/ack fixtures. |
| E-07 | Separate synchronization, deployment, and public verification; static completion rule. | Dynamic create, static pending, and static verified acknowledgement fixtures plus README durable-work section. |
| E-08 | Work/correlation IDs across work and response flows. | Claim/ack/failure fixtures and bounds. |
| F-01 | Segmented bounded descriptive catalog with no authorization authority. | Catalog schema and presentation segment fixture. |
| F-02 | Exact `catalog_revision` referenced by operator policy. | Catalog fixture and authority rule. |
| F-03 | Native public pagination remains platform-owned. | README Platform-owned behavior. |
| G-01 | Bounded source-author schema both directions without shared identity. | Source detail author fixture and authorship rules. |
| G-02 | Bounded source category/tag identities for operator policy mapping. | Source detail taxonomy fixture and schema. |
| H-01 | Separate signed Operator Service entitlement contract; one provider; protected forum-local trust-key enrollment and rotation. | `operator-service-contract.json` and valid entitlement fixture. |
| H-02 | Scope, expiry, grace/read-only, replacement, revocation, and audit rules. | Operator contract states/rules, enrollment and revocation audit fixtures, expiry and invalid-signature fixtures. |
| H-03 | Customer approval and provider audit remain separate from adapter credentials. | Operator contract rules and invalid-scope fixture. |
| I-01 | Stable origin/content-authority forum provenance. | Network source detail fixture. |
| I-02 | Operation ID, bounded route, self/repeat/over-limit rejection. | Network schema and loop-negative fixture. |
| I-03 | Only `first_post` is admitted; discussion/moderation/users remain local. | Network managed-scope schema and README. |
| I-04 | Generic visible origin, direction, canonical source, local forum, and discussion boundary. | Network provenance fields and presentation rule. |
| I-05 | No automatic cross-spoke transit. | Network rules. |

## Deliberately downstream work

| Matrix IDs | Why not encoded as additional wire behavior | Downstream gate |
| --- | --- | --- |
| J-01–J-06 | Presentation components, rendering assets, pagination, persistence mechanics, themes, installers, services, and static-build commands are platform implementation. | Each adapter's Work List checklist and package-install qualification. |
| K-01–K-04 | Large-corpus, 1,000-page, network, and artifact-uniformity requirements are qualification evidence rather than request fields. | Component Work List Gates C/D and dedicated qualification plans. |

## Coordinated transition coverage

- Exact version header and connection capability prevent a partial deployment
  from silently operating under the wrong contract.
- `MIGRATION.md` preserves Alpha.20 identities and directions, rejects
  superseded presentation values rather than normalizing them, initializes
  revision state, keeps new publication scope default-off, defines sequential
  canaries, and fixes the rollback boundary.
- The candidate is derived from exact tag `v0.2.0-alpha.20`; the dirty Alpha.21
  working tree is not an implementation base.

## Current audit result

All matrix IDs have an explicit candidate or downstream owner. The required
successor fixture categories have positive and negative representatives in the
expanded conformance suite. This is a coverage result, not a formal code-review
disposition and not a release claim.
