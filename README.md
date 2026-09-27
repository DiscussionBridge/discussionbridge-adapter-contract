# DiscussionBridge Adapter Protocol

This repository contains the platform-neutral protocol used by DiscussionBridge
publishing adapters. **The Bridge — DiscussionBridge for Discourse** is the
runtime authority. The contract and conformance fixtures describe the public
adapter boundary; they do not introduce a broker, installer, or shared adapter
runtime.

Version `0.2.0-alpha.21` is derived directly from the known-solid Alpha.20
contract. It adds the shared behavior required for source revisions,
set-and-forget initial and continuing publication, directional oversized
content, destination acknowledgement, Operator Service, and the Discourse
network profile. It contains no installation- or demo-specific behavior.

## Governing rules

- One central contract governs every adapter.
- Every Discourse installation uses the same shared plugin artifact/version.
- Every installation of a platform uses the same adapter artifact/version.
- The authenticated Content Connection is the only adapter authorization and
  scope authority.
- Adapter labels, catalog claims, presentation fields, and request bodies never
  expand connection scope.
- Stable native identity is independent of URL.
- Conflicts fail closed; no adapter invents replacement identities.
- Secrets remain server-side and are absent from browser output, URLs, content,
  logs, screenshots, fixtures, and public evidence.

## Authentication

Every adapter request uses one independently issued Content Connection:

- `X-DiscussionBridge-Connection: dbc_<24 lowercase hexadecimal characters>`
- `X-DiscussionBridge-Secret: <one-time connection secret>`
- `X-DiscussionBridge-Contract: 0.2.0-alpha.21`

Connections independently scope allowed origins, directions, and lanes. A
missing or different contract version fails before mutation; Alpha.21 does not
silently negotiate legacy behavior. Before work begins, the adapter validates
the authenticated connection's effective contract, scope, conditionally
present forum name, presentation modes, supported operations, finite bounds,
exact resolved destination policies, catalog requirement, and policy revision
through:

`GET /discussion-bridge/v1/connection.json`

That response reports receiver policy and never expands it.

`adapter_id` and `adapter_version` remain diagnostic provenance, not a second
identity or authorization mechanism.

## Shared presentation and forum name

The complete presentation vocabulary is:

- `simple`
- `full`
- `interactive`

No alias or compatibility path exists for any other value.

`DISCUSSIONBRIDGE_FORUM_NAME` is the generic human-readable forum name used for
platform headings, provenance, links, and accessible labels. It is required
for From-Discourse and Discourse-network presentation, optional for a pure
To-Discourse path that exposes no forum label, has no fallback, and never acts
as identity or authorization.

## To Discourse

Published platform content resolves through:

`POST /discussion-bridge/v1/bridge-records/resolve.json`

Alpha.21 retains Alpha.20 identity, adoption, and fail-closed reconciliation.
It additionally requires the source revision, source-created and source-updated
times, presentation mode, complete source byte count/hash, and whether the
bounded `content_html` is complete or an excerpt.

The 48 KiB `content_html` ceiling remains a To-Discourse request limit. A
larger authoritative platform publication is represented by structurally valid
bounded HTML that identifies itself as an excerpt and contains a prominent
**Read More** link to the exact canonical platform source. Blind HTML
truncation is invalid.

Normal and wiki changes deliver a new opaque `source_revision` and a greater
positive `source_revision_sequence` against the same stable native
`external_id`. Exact replay is idempotent. Reusing one sequence for different
revision/content identity, or sending a stale, ambiguous, identity-conflicting,
or unverified URL-changing request, fails closed.

## Verified source URL changes

A URL change is not a new content identity. The operator moves the authoritative
native page, establishes the required permanent redirect, and performs the
receiver's approved source-URL migration. An adapter that was offline verifies
the exact bounded ancestry through:

`GET /discussion-bridge/v1/bridge-records/{resource_id}/source-url-proof.json`

The resource, topic, and native external identity remain unchanged. Missing
links, cycles, ownership conflicts, destination collisions, retired-URL
conflicts, nonpermanent redirects, and over-limit ancestry require
reconciliation.

## From Discourse source publication

Established Bridge Record inventory/detail routes remain available. Initial
source publication uses a connection-scoped immutable snapshot with opaque,
restart-safe cursors:

- `GET /discussion-bridge/v1/source-topics.json`
- `GET /discussion-bridge/v1/source-topics/{topic_id}.json`
- `GET /discussion-bridge/v1/source-revocations.json`

The snapshot fixes an initial high-water mark and policy revision. Later source
changes arrive as durable publication work instead of repeated full-corpus
rescans. A snapshot remains valid for at least 30 days after its latest
successful page read. If an inactive snapshot expires, the receiver returns
`snapshot_expired`; the adapter starts a new snapshot and safely deduplicates
the already applied stable resource/revision identities.

Every source detail identifies the exact source revision, source-created and
source-updated times, authors, categories, tags, presentation, and content
transport. Content up to 48 KiB may be inline. Larger content uses
revision-pinned 32 KiB decoded base64 chunks. The adapter verifies every chunk,
total byte count, and complete SHA-256 before parsing or publishing the
reassembled UTF-8 HTML.

The receiver accepts no source item larger than the connection-advertised
finite Alpha.21 source bound (currently 16 MiB). This protects both sides from
unbounded work without imposing a destination-content ceiling.

Chunking bounds each API response; it is not a destination-content ceiling.
The complete source is published whenever the destination accepts it. Only a
real destination-native limit permits a safe destination excerpt with
**Read More** to the source topic.

## Durable publication work

Continuing publication uses:

- `POST /discussion-bridge/v1/publication-work/claim.json`
- `POST /discussion-bridge/v1/publication-work/{work_id}/renew.json`
- `PUT /discussion-bridge/v1/publication-work/{work_id}/acknowledgement.json`
- `PUT /discussion-bridge/v1/publication-work/{work_id}/failure.json`

Claims are bounded to at most 32 items. Each item names one exact source
revision, policy revision, destination-policy ID, catalog revision, resolved
native mappings/limit policy, action, connection, presentation, attempt, and
lease. Workers may request leases up to one hour and renew within a four-hour
maximum total lease for bounded static build/deploy/verification work.

The first `synchronized` acknowledgement is valid only for the exact active
lease after the native operation succeeds. It preserves destination identity
and separately records source revision, destination publication revision,
synchronization, content disposition, deployment, and public verification.
Dynamic destinations finish at `synchronized` with deployment and verification
`not_required`. Static work persists at `awaiting_deployment`, then
`awaiting_verification`, with new bounded stage tokens; only the exact ordered
`synchronized` → `deployed` → `verified` trace becomes terminal. An
interruption never repeats the native mutation or discards the binding.

The initial attempt is attempt 1. Registered transient failures after attempts
1, 2, and 3 retry at 60, 300, and 900 seconds; a failure on attempt 4 enters
operator attention. Authentication, scope, validation, unsupported
content, identity, destination collision, reconciliation, and explicit
operator-action conditions are terminal. Error detail is bounded, sanitized,
and never controls retry classification.

This lifecycle implements the required product outcome: configure and validate
once, start initial synchronization once, resume after interruption, apply
subsequent normal/wiki revisions automatically, recover bounded transient
failures, and require no routine babysitting.

## Descriptive platform catalog

The bounded platform catalog reports native containers, taxonomies, terms,
authors, supported presentation modes, and actual native limits in segments of
at most 100 items. Operator-approved mapping policy references an exact catalog
revision.

Each segment has an exact item schema and stable opaque native IDs. Updates
atomically replace complete named segments only when the base catalog revision
matches. Removed referenced items remain identifiable as unavailable and put
dependent policy into operator attention rather than silently remapping it.

Catalog data is descriptive only. It never authorizes a destination, expands a
connection, selects presentation by itself, creates work, or silently remaps an
existing publication.

## Discourse network profile

The Discourse-as-Publisher profile supports an explicitly authorized hub and
spoke network. Each operation carries stable origin, content-authority,
relationship, route, and first-post managed-scope provenance. A forum rejects
its own origin, repeated routes, excessive hops, wrong relationships, and any
scope other than the synchronized first post.

The shared plugin creates one protected forum ID exactly once. Restores retain
it; a clone stays network-disabled until an explicit audited rotation and peer
reauthorization. A durable one-year replay ledger keys each operation by origin
forum and operation ID: exact replay returns the retained result without a
second mutation, while any immutable-field mismatch fails closed. The
authenticated sender and route are checked before the local forum ID is
appended exactly once.

Readers must be able to distinguish hub-origin, Spoke A-origin, Spoke B-origin,
and local topics. The shared plugin presents the origin forum, direction,
canonical source, current local forum, and synchronized-first-post versus local-
discussion boundary. Replies, users, flags, whispers, moderation, private
content, and trust remain local. Received spoke content does not automatically
transit to another spoke.

## Operator Service

Operator Service is governed by `operator-service-contract.json`, a separate
signed-entitlement and audit boundary in this contract set. There is one active
provider per forum. Enrollment is explicit and default-off. Provider authority
is bounded, expiring, replaceable, revocable, and auditable.

Trusted Ed25519 public keys are enrolled in protected forum-local configuration
by a separate customer-approved action. Entitlement-controlled URLs never
supply trust keys. Rotation enrolls the next key before use; revocation disables
affected active entitlements while preserving verification of retained audit
history.

Entitlements sign the RFC 8785 canonical JSON object with `signature` omitted,
prefixed by the exact `DiscussionBridge-Operator-Service-Entitlement-v1\n`
domain. The unpadded base64url signature must decode to 64 bytes and verifies
against the protected 32-byte Ed25519 key bound to the exact issuer/key pair.

Operator entitlements and credentials never appear in adapter requests and
never grant, replace, reveal, or expand Content Connection authorization.

## Correlation and errors

Every request supplies `X-DiscussionBridge-Correlation`. Every success and
error response echoes the same bounded identifier in both that header and its
`correlation_id` body field. Body/header mismatch fails before mutation. All
errors use the exact `{error_code, message, correlation_id}` envelope and
sanitize protected values.

## Platform-owned behavior

The central protocol does not govern native public page sizes, pagination URLs,
themes, navigation, headers, footers, branding, Mermaid/math/table assets,
database/file transaction mechanics, static build commands, installers, or
service units. Each platform package implements these through its normal native
mechanisms without changing the shared meaning of identity, presentation,
revision, authorization, failure, or recovery.

## Qualification profiles

The product qualifies eight profiles: Astro, Ghost, Hugo, Statamic DB,
Statamic Flat, Statamic SSG, WordPress, and The Bridge — Discourse as Publisher.
Statamic uses one addon artifact across its three separately qualified profiles.
There is no separate Discourse-as-Publisher plugin.

The same contract/plugin combination must pass both the large-corpus,
seven-profile Discourse-to-platform set-and-forget run and the seven-profile
platform-to-Discourse 1,000-native-page sandbox qualification.
