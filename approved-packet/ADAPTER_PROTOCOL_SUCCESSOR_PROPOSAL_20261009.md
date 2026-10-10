# DiscussionBridge Adapter Protocol successor proposal — 2026-10-09

**Proposal revision:** 7  
**Status:** CF01 approved by Phil 2026-10-10; exact contract candidate prepared for approval; not implemented, frozen, or released  
**Working name:** Alpha.20 successor; release number not assigned  
**Authorized task:** Phil directed a fresh proposal using only the September 27 Component Work List and exact Adapter Protocol Alpha.20 baseline.

## Contract foundation work plan for Phil approval

**CF01 status: APPROVED BY PHIL — 2026-10-10.** Phil stated, "Proposal approved,
please proceed," after clarification that items 1 and 2 are the main contract
work with a fresh change matrix, and the Hub uses the same shared plugin.
The approved selections below direct completion of the exact proposal. P01
and H-D01a remain approved. Exact fields, routes, values and the immutable
release identity return together for approval before freeze or implementation.
Revision 7 records approval and completes the authorized contract drafting
sequence. Semantics/typed artifact/examples/cases are revision 7; Hub
architecture revision 4; fresh matrix accompanies the main contract work.

1. **Keep the approved foundation and native ownership.** Use the protected
   Work List, exact Alpha.20 contract and Phil's recorded decisions as authority.
   Identify component requirements against the seven clean baselines, not
   discarded code or historical supporting records. Preserve v1 and place new
   functionality in v2. Keep one shared Discourse plugin with source, recipient
   and explicitly configured hub/relay responsibilities. Discourse and each
   native platform retain their users, persistence, locks, rendering, builds,
   deployment, verification and moderation. Content Connection credentials,
   not caller labels or catalogs, delimit publishing authority.
2. **Finish both publishing directions and continuing work.** Specify initial
   publication and ongoing normal/wiki revisions, stable source/native/Bridge
   identities, immutable content, mappings and URL changes, durable work,
   acknowledgement and recovery. Keep three automatic attempts including the
   initial attempt and distinguish synchronized, deployed and publicly verified
   results. Preserve the existing To-Discourse excerpt/Read More rule; use full
   From-Discourse content unless an actual native limit requires a stated
   fallback. Retain Simple, Full and Interactive presentation requirements.
   Optional author/taxonomy catalogs describe native choices; they cannot grant
   scope, publish content or take ownership of native configuration. Forum
   naming uses the native title unless a valid administrator override is set.
3. **Complete the Discourse content network now.** Specify independently
   approved directed connections, public sources/public destination categories
   for the initial scope, and explicit original-source-approved onward relay
   with independent recipient approval. Preserve original provenance through
   relays; prevent loops, duplicate topics and unauthorized routing. A distinct
   bounded-chunk v2 network lane carries full native Discourse publications,
   with explicit handling of real destination limits; it does not change the
   preserved 48 KiB resolve boundary. Distinguish pause, withdrawal and credential
   revocation, and report offline or disconnected removal honestly.
4. **Finish the reader experience and bilateral discussion controls.** Use one
   receiving topic: managed publication, labelled source discussion panel, then
   optional native local replies. Source replies remain read-only here, with
   an explicit action opening the source forum; local replies use the native
   local composer and visibly stay at the local forum. Preserve each author's
   actual forum identity and separate source versus native local activity.
   There is no synchronized writable reply stream or cross-forum login bridge.
   Specify source-reply changes, bounded pagination and a shared scoped cache,
   including stale, revoked, deleted and unavailable states.
5. **Use this proposed consent lifecycle.** Local-discussion permission at the
   source and enablement at the recipient both default off. Source permission
   is scoped to the approved receiving forum/connection; per-source-topic rules
   may narrow it. Recipient administrators may enable discussion per connection
   and override per received topic only within effective source permission.
   Relays cannot broaden that permission or enable recipient discussion.
   Withdrawing discussion permission or switching local discussion off stops
   new local replies through server-side native enforcement, without deleting
   existing local replies or transferring their moderation. Existing replies
   remain readable under local permissions unless a separate publication
   retraction/privacy action requires hiding the mirrored topic and its replies.
   Durable policy changes and explicit offline attention are required; no
   instantaneous enforcement on an independent disconnected forum is claimed.
6. **Produce one coherent exact contract packet.** Complete network types,
   routes, authorization, revisions, receipts, relay, withdrawal, discussion
   projection and policy objects. Reconcile these with the CMS wire draft.
   Remove suspended Operator Service control members and their examples/cases
   from the active candidate. Keep support-bundle/request/provider work separate;
   do not invent a remote control service or require it for the Hub. Complete
   positive/negative fixtures and the requirement-to-test ledger, with separate
   CMS and one-hub/two-spoke qualification plans. Check document consistency,
   parseability and preservation of the baseline boundary; these checks are
   not runtime qualification or a code-review disposition.
7. **Return the finished foundation for exact approval.** Present the complete
   schema, semantics, fixtures, proposed technical values and release-identity
   decision together. Approval of CF01 authorizes this whole drafting sequence
   without another prompt between its steps and adopts the selections above
   as direction for that proposal. It does not approve every field, route,
   retention value or engineering default in the earlier draft. A materially
   different product choice, unresolved contradiction or additional authority
   requirement must be brought to Phil rather than inferred.

The next gate is Phil's approval of the exact completed contract and its fresh
immutable identity before dependent implementation. CF01 does not authorize
editing the protected Work List or baseline code, committing/tagging/freezing,
installation, migration, credentials, service access, testing on live systems,
GitHub mutation or deployment.

The larger sequence remains: exact contract approval and separately authorized
freeze; authorized baseline-derived component implementation and required
review; controlled sandbox qualification; approval of a new valid GitHub main
before any non-sandbox deployment. Remote trash cleanup stays deferred until
that new main exists and Phil approves exact targets. Historical/trash material
is not reopened or salvaged.

## Current contract packet awaiting exact approval

Phil approved CF01 on 2026-10-10 after confirming that the main contract work
has a fresh matrix and the Hub uses the same shared plugin. P01/H-D01a remain
approved. The completed candidate includes both CMS publishing and the full
Discourse source/recipient/relay and source/local discussion definition.

- [Fresh change matrix and work document](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_SUCCESSOR_CHANGE_MATRIX_20261010.md): 44 requirements, native component obligations and separate qualification plans.
- [v2 semantic specification](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md) and [typed artifact](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_PROPOSAL_20261009.json): 63 routes, 252 named types, 58 errors; 32 CMS plus 31 network routes.
- [Hub architecture revision4](C:/CodeProjects/Products/DiscussionBridge/planning/DISCOURSE_HUB_ARCHITECTURE_PROPOSAL_20261009.md): one plugin, directed consent, preserved origin, native local ownership and grouped discussion controls.
- [103 synthetic positive shapes](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_EXAMPLES_20261009.json) and [30 negative shapes,2 malformed JSON cases and80 planned runtime cases](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json).

Invented remote Operator Service types/fields/errors/examples/cases have been
removed from the active candidate. The two separate old control documents stay
excluded, not a dependency or support-feature definition. No support submission,
provider enrollment or native remote-control authority is added. Existing
Alpha.30 support-bundle download remains unchanged and runtime-unverified.

Product directions are approved; exact field/route/state/profile/value choices
remain proposals requiring approval of this complete packet. A disagreement
between schema, semantics or fixtures prevents freeze. Release version remains
unassigned. Runtime/native/package/qualification tests and formal review are
NOT RUN; no native capability is claimed merely from the profile enum.

## 1. Sources and authority

Product specification:
[protected September 27 Component Work List](C:/CodeProjects/Products/DiscussionBridge/planning/DISCUSSIONBRIDGE_COMPONENT_WORK_LIST_2026-09-27_DO_NOT_EDIT_WITHOUT_PHIL_APPROVAL.md).

Existing wire contract:
[Alpha.20 contract.json](C:/CodeProjects/Products/DiscussionBridge/components/adapter-contract/contract.json),
[README](C:/CodeProjects/Products/DiscussionBridge/components/adapter-contract/README.md),
and its six committed fixtures, at commit
`27197b7472cb2486993c8b01b4a4282d8697f478`,
tree `3bb319fabbeecbb70af2785a5c0be3e171a1eb7a`.

Protected Work List SHA-256:
`9d2224298c66e4fa22f0039546c5c27a09bb97071ee5978dfda51d670c8ff0cc`.

Local Alpha.20 contract.json SHA-256:
`f7107b8f1f777c35155a5a0f1d31ddbed2eec9835f2cdf59d5aacfc527a35a76`.

The contract hash was verified against the unchanged local baseline when
preparing this packet.
The Work List provides approved intentions and exclusions. It does not supply
the exact new wire schema. CF01 approves the product directions; exact routes, fields, states, bounds,
profiles and migration choices remain fresh proposed specifications for whole-
packet approval, not a claim that Phil approved every earlier engineering value.

The discarded Change Matrix, later contracts, code, reviews, and historical
supporting records were not used to draft this proposal. No later implementation
is selected for porting.

## 2. Preserve the existing boundary

Alpha.20 currently defines:

| Surface | Exact existing behavior |
| --- | --- |
| Authentication | `X-DiscussionBridge-Connection` and `X-DiscussionBridge-Secret`; connection ID matches `^dbc_[a-f0-9]{24}$`. Credentials scope origins, directions, and lanes. |
| Resolve | `POST /discussion-bridge/v1/bridge-records/resolve.json`, with a `bridge_record` object. |
| Resolve bounds | JSON body at most 65,536 bytes; sanitized nonblank `content_html` at most 49,152 bytes; `published` must be JSON `true`. |
| Resolve required fields | `direction`, `external_id`, `canonical_url`, `title`, `content_html`, `published`. |
| Resolve optional fields | `lane`, `adapter_id`, `adapter_version`, `correlation_id`, `visibility`, `source_authors`, `primary_source_author_id`, `existing_topic_id`. |
| Outcomes | 201 `created`, 200 `resolved`, 409 `reconciliation_required`; no Core fallback. |
| Adoption | `existing_topic_id` requires the exact available unlisted Core embed attestation for the canonical URL; it is not an arbitrary topic selector. |
| Inventory/detail | `GET /discussion-bridge/v1/bridge-records.json` and `GET /discussion-bridge/v1/bridge-records/{resource_id}.json`; maximum page 10,000, at most 100 records per page. |
| From Discourse | Detail includes cooked first-post `content_html`; adapters pull and own bounded polling, caching, and native rendering. |

**Proposal P01:** Preserve these v1 endpoints, authentication, limits, responses,
and meanings. Do not require a new identity header from existing Alpha.20
clients. Add successor functionality under `/discussion-bridge/v2/`.

**Phil's decision, 2026-10-09:** P01's preserved-v1/new-v2 compatibility
boundary is approved as the basis for completing the exact wire proposal.
This approval does not approve the other engineering choices or authorize
contract/product implementation.

One successor contract artifact will describe the preserved v1 boundary and
the new v2 boundary. This does not introduce a second publication engine or
separate publisher plugin. The plugin implementation must prove that the
preserved endpoints still satisfy the baseline fixtures and semantics.

## 3. Ownership and authorization

**Proposal P02:** Content Connection credentials remain the sole request
authentication and scope authority. Platform/profile identity is stored with
the connection by an authorized forum administrator. Caller-provided
`adapter_id` and `adapter_version` remain bounded diagnostic labels, not
authority. Do not add an adapter-identity authentication header.

| Responsibility | Owner |
| --- | --- |
| Users, sessions, posts, replies, moderation, discussion persistence | Discourse |
| Issuing/revoking Content Connections and their allowed origin/direction/lane | Discourse administrator and shared plugin |
| Source eligibility, publication policy, source revisions, mappings, bounded work and delivery receipts | Shared plugin, within each authorized connection |
| Native IDs, storage, locking, rendering, rich-content assets, discussion integration, themes, archives, pagination | Native platform and adapter |
| Native build, deployment, public verification, and platform rollback | Native platform and its normal operator/automation mechanism |
| Support request, bundle sharing and provider selection | Separate support scope, not network authority; no remote publishing-control service is assumed |

The receiver never logs into a CMS, writes its native files/database, performs
its deployment, or controls its theme. A configured adapter executes publication
through its native platform. Neither a catalog nor an entitlement can expand
connection scope or create publication work on its own.

Connection disable/revocation must be rechecked on every new read, claim,
renewal, mutation receipt, and retry request. A request label, old lease, or
historical receipt does not preserve authority after revocation.

## 4. Source revisions and times

**Proposal P03:** New v2 source metadata uses these fields:

| Field | Meaning / proposed rule |
| --- | --- |
| `source_id` | Stable issuer-owned source identity, UTF-8 string at most 255 bytes; never the mutable URL. |
| `source_revision` | Opaque issuer-owned revision string, 1–128 UTF-8 bytes, bound to exact title/body/source metadata. Never compared lexically as a time or sequence. |
| `content_sha256` | Lowercase 64-hex SHA-256 of the exact complete source HTML bytes for that revision. |
| `content_bytes` | Nonnegative integer byte count for that complete HTML. No universal publication-size ceiling is inferred from transport bounds. |
| `source_created_at` | Actual source creation time. |
| `source_updated_at` | Actual source revision time, including published normal/wiki edits. |
| `synchronized_at` | Receiver receipt time after the native destination has durably applied the reported revision. |
| `publicly_verified_at` | Time the adapter's native verifier observed the exact intended publication at its public URL; not enqueue, claim, build, or deployment time. |

Timestamps use UTC RFC 3339 strings with millisecond precision. Unknown times
are `null`, not synthesized as the current time. The receiver records delivery
receipt time separately from source and adapter-reported verification times.

A destination maintains distinct `desired_source_revision`,
`synchronized_source_revision`, and `publicly_verified_source_revision`.
These are references to source revisions. `destination_native_revision` is
optional native diagnostic data, not a replacement source identity or clock.

Normal and wiki edits queue deliberate revision work for existing mappings.
They do not create new resource/topic/native identities. A source snapshot may
be taken without modifying the Discourse topic or first post.

## 5. Directional content transport

**Proposal P04:** Keep the To-Discourse 48 KiB HTML limit and 64 KiB resolve
JSON limit. An adapter whose native source exceeds the HTML limit must produce
a valid sanitized bounded excerpt with a visible **Read More** link to the
canonical native source. Do not cut raw HTML mid-element or erase rich-content
semantics silently.

For From-Discourse v2 publication, retain the complete immutable source revision.
Return metadata separately from bounded content chunks. The destination uses
the full content when its real native limit permits it. If a real native limit
requires an excerpt, the adapter records that limit and emits a bounded native
excerpt with **Read More** to the source topic. Transport limits alone are not
permission to abbreviate a publication.

Proposed content route:
`GET /discussion-bridge/v2/sources/{source_id}/revisions/{source_revision}/content.json?offset={byte_offset}`.

Each response supplies `source_id`, `source_revision`, `content_sha256`,
`content_bytes`, `offset`, `next_offset`, and `content_base64`.
Decoded chunks contain at most 32,768 bytes. Offsets refer to the original
byte stream, not JSON/base64 length. A final response has `next_offset: null`.
Adapters concatenate decoded bytes, then validate total length, SHA-256, and
UTF-8 before rendering. A mismatched revision/hash is an actionable failure,
not permission to use a newer body.

Revision content referenced by outstanding work must remain available until
that work is settled or explicitly superseded. Disabled connections cannot
read it. Exact storage retention and operator-visible exhaustion handling must
be specified in the implementation packet; no silent eviction of active work.

## 6. Bounded initial and continuing feeds

**Proposal P05:** Use one source-feed route:
`GET /discussion-bridge/v2/sources.json?stream={initial|changes}&cursor={opaque_cursor}`.

- A first `initial` request without a cursor opens a scoped snapshot. It fixes
  the admitted sources/revisions and an accompanying change-feed checkpoint.
- Pages contain `items`, `next_cursor`, and `checkpoint_cursor`.
  While initial pages remain, `next_cursor` is non-null and
  `checkpoint_cursor` is null. The final initial page has a null
  `next_cursor` and the change checkpoint fixed when the snapshot began.
- Continuing `changes` polling requires a checkpoint/cursor. Each page
  advances a durable checkpoint; an empty poll retains a valid checkpoint.
  A null next-page cursor is not interpreted as “stop polling forever.”
- Cursors are receiver-issued and bound to authenticated connection, scope,
  feed, and snapshot/change position. They are not supplied scope.
- A durable local cursor is advanced only after the adapter records all page
  items into its resumable native work state. Replay is safe by source/revision
  identity.
- Proposed page bounds: at most 100 metadata events and 262,144 JSON bytes.
  This is a page/transport limit, not a publication-content limit.
- Scope changes invalidate incompatible cursors with an explicit restart
  condition. Restart re-enumerates using stable identity; it does not create
  duplicate publications.
- Source retirement is an explicit `revocation` event in the same scoped feed,
  carrying source identity, last source revision, event identity, and reason.

Snapshot expiry, change-event retention, cursor maximum encoded length, and
restart/error schema are specified in the exact v2 packet. They remain
proposed choices pending Phil's approval, not an approved contract freeze.

## 7. Destination mapping and URL ownership

**Proposal P06:** Each independent destination uses its own scoped connection.
The logical mapping key is `(connection_id, source_id)`. One source can therefore
publish independently to Astro, Ghost, Hugo, Statamic Flat/DB/SSG, WordPress,
or multiple installations without sharing credentials or native identity.

Proposed mapping fields:
`mapping_id`, `resource_id`, `source_id`, `connection_id`,
`destination_native_id`, `canonical_url`, `retired_url_count`,
`presentation_mode`, the three revision references in section 4, and
`mapping_state`.

- `mapping_id` and `resource_id` are receiver-issued UUIDs.
- `destination_native_id` is null until a new native object is created; once
  known it is the immutable nonblank native identity, at most 255 UTF-8 bytes.
- `canonical_url` is an absolute HTTPS URL, at most 2,048 UTF-8 bytes, on the
  connection's configured destination origin.
- Proposed states are `pending`, `active`, `attention`, and `withdrawn`.
  Delivery state remains separate; one label cannot conceal conflicting facts.
- Creation/recovery must prove exact existing ownership. An unowned or
  ambiguously owned native object is a conflict, not an overwrite target.
- Established Alpha.30 Bridge Records retain their resource/topic/native
  bindings. Starting initial synchronization does not convert their meaning.

A URL change is a separate proposed mutation:
`POST /discussion-bridge/v2/mappings/{mapping_id}/url-moves.json`.
It must identify expected active URL, proposed URL, and the unchanged native
identity. Collision and ownership checks happen before a change is committed.
Retired URLs remain reserved to the same mapping; they cannot be claimed by a
different source/mapping.

The exact ancestry/public-ownership proof and move/recovery transactions are
specified for presentation URLs and native source URLs in the v2 packet.
Retired URLs use bounded history reads rather than an unbounded mapping field.
No adapter-controlled redirect or Cloudflare-specific API is assumed.

## 8. Work, leases, acknowledgement, and recovery

**Proposal P07:** The receiver coordinates work only for administrator-enabled
publication policies. Proposed work actions are `publish_revision` and
`withdraw`. No unconditional publication lifecycle jobs run when no authorized
publishing connection is enabled.

Proposed work states:

| State | Meaning / allowed next state |
| --- | --- |
| `pending` | Eligible work; may become `leased`, `cancelled`, or `superseded`. |
| `leased` | One bounded attempt; may become `synchronized`, `retry_wait`, `attention`, `cancelled`, or `superseded`. |
| `synchronized` | Exact native revision durably applied; may become `deployed`, `verified`, `retry_wait`, `attention`, `cancelled`, or `superseded`. |
| `deployed` | Native deployment reported; may become `verified`, `retry_wait`, `attention`, `cancelled`, or `superseded`. A successful build is not deployment. |
| `verified` | Exact revision publicly verified. Publication work is successful only here. |
| `retry_wait` | A transient attempt failed before the ceiling; may become `pending` when due, `cancelled`, or `superseded`. Exhaustion goes directly to attention. |
| `attention` | Actionable condition; no automatic loop. An authorized explicit retry creates a new audited attempt cycle. |
| `cancelled` | Authorization/eligibility removed. Outstanding work cannot be acknowledged as current publication. |
| `superseded` | A different desired revision/action replaces this work. Never treated as successful delivery. |

Each work item identifies `work_id`, `mapping_id`, `source_id`,
`source_revision`, `policy_revision`, `action`, `attempt`, and current state.
A lease supplies a secret `lease_token`, receiver-issued `lease_generation`,
and `expires_at`. Tokens remain server-side and are redacted.

The lease generation is one durable monotonically increasing mapping counter;
new work/revisions/explicit retry cycles do not reset it. Native source URL
migration preserves identities/content but advances the source metadata
revision because the canonical URL belongs to that revision.

Proposed routes:

- `POST /discussion-bridge/v2/work/claim.json`
- `POST /discussion-bridge/v2/work/{work_id}/renew.json`
- `POST /discussion-bridge/v2/work/{work_id}/acknowledge.json`
- `POST /discussion-bridge/v2/work/{work_id}/fail.json`

A claim returns at most one work item. The proposed lease duration is 300
seconds, renewable while authority/policy/work remain current. An
acknowledgement identifies the exact work, lease generation, source revision,
mapping, native identity, and attained stage. Repeating an identical receipt
is idempotent; a changed/stale/conflicting receipt cannot overwrite a current
result.

Only one current work item may mutate a mapping at a time. The native adapter
must also use durable native locking, ownership checks, and revision/lease
generation checks. A lease is not a distributed transaction: an expired worker
may have produced a partial native result. Expiry requires reconciliation of
the native receipt/state before retry; it is not permission for a blind second
create. Native transaction/fencing details belong in each adapter's packet.

**Proposal P08:** Three automatic attempts per work/revision/policy cycle,
counting the initial attempt. Proposed transient delays are 30 seconds then
120 seconds. A bounded server retry-after may lengthen a delay to at most
3,600 seconds; a longer request produces explicit attention. Retry state is
durable and restart-safe.

Authentication denial, scope conflict, ownership/identity conflict, invalid
source hash, unsupported requested presentation, and permanent native limits
are not retried as transient failures. Exceptions must map to a central
failure code and safe operator detail, not raw credential-bearing errors.

Exact error-code enumeration, attempt consumption on expired/no-op leases,
acknowledgement schemas, and supersession transitions are specified in the
v2 packet and remain subject to Phil's approval.

## 9. Publication completion and withdrawal

**Proposal P09:** Dynamic native publication can proceed directly from
`synchronized` to `verified` after public verification. Static publication
must record preparation/synchronization, native build/deployment, and exact
public verification before success is reported. An aborted build/deploy has
an explicit recoverable native result and receiver attention/failure receipt.

The native verifier must inspect the actual public URL and bind the result to
mapping, native identity, exact source revision, and selected full/excerpt
representation. A queue claim, HTTP upload receipt, output file, or source
hash copied into metadata is not by itself verification evidence.

The receiver records a scoped adapter verification receipt; it does not claim
to have independently proved the page merely by receiving that receipt.
Independent public verification is also required in qualification evidence.

Withdrawal acts only on the exact owned native publication. It removes that
publication from public delivery through native mechanisms, preserves
mapping/history and the source discussion, and does not delete unrelated
native content or local discussion. Native edits/ownership disagreement stop
with attention. Source withdrawal, connection disable, and explicit native
content destruction must have distinct meanings and receipts.

The v2 packet specifies static prepare/finalize/abort and public-verification
proof for publication and withdrawal. No incomplete static state is called
complete; receiver acknowledgement is not independent native proof.

## 10. Presentation and forum naming

**Proposal P10:** The only presentation wire values in new fields are
`simple`, `full`, and `interactive`, displayed as Simple, Full, and
Interactive. No `fullInteractive` token, alias, or fallback is introduced.
Requested presentation is either applied or rejected with an actionable
unsupported-presentation result. A provenance link alone is not fulfillment.

**Proposal P11:** The receiver supplies one effective plain-text
`forum_name`. `DISCUSSIONBRIDGE_FORUM_NAME` is an optional override; otherwise
the effective name is the forum's native title. The effective name must be
nonblank after trimming, contain no control characters, and be at most 200
UTF-8 bytes. An invalid explicit override is a configuration error; do not
silently ignore it. Escape the value for each output context.

The name is descriptive, never an origin, identity, or authorization proof.
An adapter must not invent a different source-forum naming authority.
Existing plugin-free integration profiles remain available; the precise
configuration/output mapping for those profiles must be specified before
their packages change.

## 11. Descriptive catalogs

**Proposal P12:** If a catalog is retained, its records describe available
native authors, taxonomy, presentation, and destination capability. They do
not grant scope, choose source topics, enable publication, or create work.

An administrator must separately approve the destination policy referencing
catalog identities. Requested author/taxonomy/presentation entries that are
missing, retired, or unsupported produce attention; do not silently choose a
replacement. Policy changes have a receiver-issued revision bound into work
and receipts. A refreshed catalog alone does not alter approved policy.

The v2 packet proposes optional descriptive author/taxonomy catalogs, bounded
atomic upload/read, read-only administrator policy, and unavailable-entry
failures. Retention of that catalog is still Phil's decision. No catalog
dependency is added to preserved v1 clients or plugin-free presentations.

## 12. Support is separate and P13 control design excluded

CF01 excludes the invented remote Operator Service. OperatorAction,
CatalogRefreshRequest, Connection.catalog_refresh_request and six operator/
entitlement errors, their fixtures and planned cases are removed from the active
candidate. No provider credential, signed entitlement, enrollment or remote
health/status/retry/catalog-control dependency remains. Support-bundle/request/
provider work requires its separate definition/authority; download is unchanged.
Native catalog refresh and administrator retry need no support provider.

## 12A. Discourse Hub contract integration

H01..H14 are part of this contract foundation now. One plugin supplies source,
recipient and explicitly approved relay. NetworkConnection/NetworkRevision/
NetworkGrant/NetworkLocalMapping/NetworkDelivery and NET-01..31 distinguish
source identity, current peer authority and local native ownership.

P01/H-D01a and CF01 fix the approved direction: preserved v1/new v2; one-topic
source read projection and bilateral-consented local native replies; directions
independent, no writable reply federation. Grouped layout, explicit source-link/
local-composer actions, both consent defaults off, bounded connection/topic
controls and permission-loss retention are CF01 directions. Exact source
cache/expiry/read/native enforcement/profile choices are proposed in revision7.

Initial public scope, explicit origin-approved onward relay, full raw/cooked
chunked network content and honest retraction are CF01 directions. Peer setup,
source/receive policy, grants, identity/event order, loop/dedup, shared native
fence/journal, rich uploads, source replies and local reader endpoints now have
exact typed shapes, routes, errors, fixtures and planned tests. Native import/
render/visibility/migration hooks remain later component work, not missing
wire filled by assertion or implemented behavior.

## 13. Affected artifacts and qualification

Every proposed v2 field/state/route affects the central schema, conformance
fixtures, shared plugin routing/validation/authentication, and any adapter
which claims the corresponding capability. Native runtime/schema changes must
be specified in component packets derived from their exact baselines.

| Proposal group | Required evidence before accepting an implementation |
| --- | --- |
| P01–P02 | All six baseline fixtures and preserved v1 behavior; missing new headers remain valid; forged labels/catalogs cannot grant scope; disabled/revoked credentials fail before authorized work. |
| P03–P04 | Normal/wiki revisions update the same identities; exact timestamps/hash; HTML boundaries; full large-content transport; native-limit excerpt with Read More; bad/incomplete/replayed chunks. |
| P05 | Initial snapshot concurrent edits, full continuation, empty ongoing polls, interruption/restart, cursor scope/expiry, explicit revocation, no skipped/duplicate publication. |
| P06 | One source to independent destinations; existing owned/native mappings preserved; unowned-file refusal; URL collision, ancestry proof, interrupted move and recovery. |
| P07–P09 | Concurrent claim/expiry/renewal/replay, native locks/fencing, stale acknowledgements, exact three-attempt ceiling, restart recovery, dynamic verification, static prepare/deploy/verify/finalize/abort, withdrawal. |
| P10–P12 | All three actual discussion presentations; forum-name unset/blank/invalid/Unicode cases; catalog/policy separation; retired mapping choices fail visibly; native pagination/rendering/build ownership. |
| P13 | **EXCLUDED.** Invented control cases removed; no support-control qualification is claimed. |
| H01–H14 | One identical plugin on hub/two spokes; each origin and both directions, explicit relay/provenance, stable local topics on edits, native local replies, loops/duplicate paths, spoofed origin/forbidden relay, lost receipt/restart, local-edit conflict, privacy/retraction and offline attention. Exact network fixtures are included; runtime cases remain NOT_RUN. |

These are planned checks, not executed tests or a code-review disposition.
The required review doctrine applies when implementation review is performed.
No earlier review or green CI is carried forward.

Qualification must use one identical shared plugin artifact and one identical
artifact per adapter across installations. Statamic Flat, DB, and SSG qualify
independently with one addon. Discourse as Publisher remains a profile of the
shared plugin. OBBBA-class From-Discourse and the seven sequential 1,000-item
To-Discourse corpora use the Work List's acceptance requirements, not discarded
runbooks or old receipts.

## 14. Migration, sandbox, GitHub, and rollback

**Proposal P14:** Preserve Alpha.30 schema meanings and established record
identities. Do not import later migration chains, reinterpret existing
Bridge Records when enabling initial publication, or create duplicate native
publications. New schema/state adoption needs its own exact approved packet,
backup, disabled-state behavior, migration failure handling, and rollback.

The intended order is:

1. Settle the open contract decisions below and obtain Phil's approval of the
   exact resulting contract/schema/fixtures.
2. Freeze the approved contract locally with a new immutable identity before
   dependent plugin/adapter implementation. A local commit/tag and exact
   artifact identity do not authorize a GitHub push.
3. Prepare authorized baseline-derived component packets and implementations,
   perform required review, packaging, normal-install/update qualification,
   and controlled sandbox tests with protected backups/rollback.
4. Once sandbox results and required gates support a new valid main, obtain any
   remaining release authority and update GitHub main to the exact tested
   artifacts before non-sandbox deployment. Remote trash cleanup is deferred
   to that point and requires exact agreed targets.
5. Perform separately authorized non-sandbox deployment and public verification.

Existing v1 connections remain valid. New publishing is default-off until an
operator enables exact scope. No testing, installation, migration, tag,
commit, GitHub mutation, or deployment is authorized merely by this draft.

Rollback must preserve exact source/native/Bridge identities and revision
receipts. Disabling new work is not a database downgrade. If new state cannot
be read safely by Alpha.30, the packet must specify protected restoration or
another explicitly approved rollback; do not invent lossy reverse migrations.

## 15. Exact approval gate

CF01 drafting and the fresh matrix are prepared. Phil's approval of product
directions is recorded; the exact engineering packet returns as one candidate.
No need to reopen the Hub inclusion, same plugin, bilateral consent or reply
ownership decisions. Approval of this draft work was not exact-contract freeze.

| Area | Approved direction and proposed exact selection |
| --- | --- |
| Compatibility/identity | P01 preserves v1; credential scope/stored profile authoritative, caller labels diagnostic. CMS and NetworkConnection distinct; no new identity header. |
| Content/feed | Immutable revision/hash/chunks, truthful dates, pinned initial/changes. Exact proposed snapshot24h, event/settled body/receipt retention30days and native-limit fallback rules. |
| Mapping/work | Stable owned IDs/adoption and verified same-origin URL moves; native fences/journals; three attempts including initial. Exact proposed lease300s/retry30,120/Retry-After<=3600; dynamic/static proof and abort rules. |
| Presentation/catalog/name | Actual Simple/Full/Interactive, optional native-title override and descriptive authors/taxonomy catalogs; native policy/refresh ownership. Exact field/rule spelling proposed. |
| Network/reader | Same plugin; explicit directed peers/relay, public-only, preserved origin/per-hop status, full chunked lane; one-topic source/local sections and clear reply destinations. Exact peer/grant/native reader/asset/verification profiles proposed. |
| Consent/retraction | Both defaults off; source receiving-forum/topic ceiling plus local connection/topic controls. Permission loss stops new replies, retains local posts; separate retraction hides mirrored topic/replies. Exact authority300s/poll60s/latest20/page100/asset8MiB/cache24h/deadline10/30 values proposed. |
| Excluded support controls | No invented Operator Service members/dependency. Actual support assistance is separate; no new service implemented or defined. |
| Release identity/freeze | No version assigned or tag reused. Exact packet and fresh immutable release identity need Phil's approval, followed by separate freeze/implementation authority and applicable review/conformance gates. |

The matrix contains the complete requirement/test linkage and component/scale
obligations. Document checks do not establish runtime/API/native/rendering/
visibility/migration/packaging/qualification or a formal code-review disposition.
Gate A/B/C/D remain unchecked. GitHub/sandbox/services/installations/deployments
are unchanged. Next: Phil's exact completed-packet approval and release identity,
then only the separately authorized freeze/implementation sequence.
