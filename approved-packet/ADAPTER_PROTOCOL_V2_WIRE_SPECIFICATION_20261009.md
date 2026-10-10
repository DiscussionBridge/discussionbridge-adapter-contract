# DiscussionBridge v2 Wire Specification Proposal

**Revision 7 proposal, 2026-10-10.** Phil approved CF01's contract-foundation directions and full drafting sequence. This is the completed exact wire candidate for approval, not a frozen release or implementation.

This candidate derives from the protected September 27 Component Work List,
exact Alpha.20 baseline and Phil's recorded P01/H-D01a/CF01 decisions. The
[machine-readable types and routes](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_PROPOSAL_20261009.json),
[fresh change matrix and work document](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_SUCCESSOR_CHANGE_MATRIX_20261010.md),
[Hub architecture](C:/CodeProjects/Products/DiscussionBridge/planning/DISCOURSE_HUB_ARCHITECTURE_PROPOSAL_20261009.md),
examples and conformance cases constitute one packet. There are 63 routes,
252 named types and 58 errors. Exact engineering choices remain subject to
approval of this packet; CF01 is not blanket approval of all earlier values.

Invented remote Operator Service controls, types, fields, errors and fixtures
are removed from the active candidate. Support assistance remains separate.
No historical/trash records or later implementation supply authority. Alpha.20
bytes/fixtures remain unchanged and no release version is assigned.

## Compatibility and interpretation

The existing Alpha.20 v1 authentication, resolve, inventory, detail, fixture meanings, limits, adoption checks, outcomes, and no-Core-fallback rule stay unchanged. New clients explicitly select v2. In particular, v1 numeric topic IDs remain numeric; v2 Core IDs are decimal strings so JSON implementations cannot lose signed-64-bit identity precision.

The JSON artifact uses the descriptive grammar `DB-PROPOSED-TYPES-1`, not JSON Schema and not an executable validator. It and these semantic rules constitute one proposal. A disagreement between them prevents freeze; an implementer must not choose one silently.

The JSON `discourse_network` section indexes the network extension. Actual
runtime shapes are its named Network types in `v2.types`, with NET-01 through
NET-31 routes. CMS Connection uses CmsProfile; discourse uses NetworkConnection
and the network lane, not automatic reinterpretation of CMS mappings.

The type grammar is exact:

- A `string` must satisfy its format, regular expression, byte bounds, and additional rules. Lengths count the decoded string's UTF-8 bytes, not characters or escaped JSON bytes.
- An `integer` is a finite JSON number with no fractional value, inside the inclusive minimum/maximum. Negative zero is rejected. Booleans, numeric strings, infinity, and NaN are not integers.
- A `boolean` is only JSON true or false. An `enum` is exactly one listed value with the same JSON type.
- An `array` satisfies its item type and inclusive item bounds. `unique_items` uses typed semantic equality. Author IDs must be unique even when names differ.
- An `object` allows only its declared fields. `required: true` means present. `nullable: true` permits JSON null in addition to the named type, not omission. Otherwise null is invalid. An optional field is absent or valid, never implicitly null.
- A `tagged_union` selects the single variant named by its declared discriminator field. The selected object type owns that discriminator and all remaining fields. Unknown values, fields from another branch, and absent discriminators are rejected.
- An optional default is applied only after successful validation. It does not make an explicit null valid. Object member order is immaterial. Array order is significant unless a specific rule says otherwise.

UUIDs are lowercase canonical 8-4-4-4-12 hexadecimal strings, never nil. Opaque IDs and revisions are nonblank and contain no Unicode control characters. Do not trim, case-fold, Unicode-normalize, or numerically interpret identities. Label/title fields must be nonblank after whitespace inspection, but their valid value is preserved exactly. Revisions are opaque: ordering comes from events, not revision text.

`Instant` is a valid UTC Gregorian date/time with exactly millisecond precision and terminal Z. Leap-second 60 is rejected. Where both source times are known, source-updated time cannot precede source-created time. Unknown actual source times are null, never replaced with delivery time.

`CoreId` is a canonical decimal string in 1..9223372036854775807, without a sign or leading zero. Other counters are JSON integers in 0..9007199254740991. A counter nearing exhaustion stops with attention; it never wraps.

All base64/base64url fields require strict decode and exact canonical re-encoding. Lease tokens decode to 32 random bytes and remain secret. URL-move nonces also decode to 32 random bytes but are public challenges, not credentials.

## Authentication and transport

Content Connection headers remain `X-DiscussionBridge-Connection` and `X-DiscussionBridge-Secret`. Current stored connection scope and administrator policy are the authority. Caller adapter labels, catalogs, capability claims, and support-provider claims cannot replace or expand that authority.

Every request checks enabled connection, current secret, permitted direction, lane, stored destination origin, and relevant policy. Resource reads from another connection return `resource_not_found`, without identifying the other owner. Catalog/mapping/source receipts are private server-side data, not public endpoints. Connection secret rotation invalidates the previous secret immediately; a successor receipt does not grant old credentials continued access.

Missing/invalid credentials use their authentication errors. A disabled connection gives connection_disabled; absent direction/lane/origin or enabled publication policy gives scope_denied. A scoped connection may still read its connection/policy status while publishing policy is off, but may not claim or create publication work. Unknown query keys give unknown_field; duplicate or malformed query values give invalid_field.

The configured service origin is the Discourse HTTPS origin. Clients reject redirects and cross-origin service responses. Credentials must never enter browser JavaScript, public HTML, source content, URLs, query strings, native metadata, logs, exception text, support bundles, or support output.

The configured destination origin is an HTTPS origin only: no userinfo, fragment, path other than /, or query. `publication_lane` is a stored administrator choice within the connection's authorized lanes. Source, mapping, work, and catalog routes use that lane. To-Discourse resolve's explicit lane must be allowed; omission selects the stored publication lane in v2. This does not change v1 lane handling.

POST bodies are strict UTF-8 JSON objects with media type application/json; an optional charset parameter must be UTF-8. Reject malformed UTF-8, a BOM, duplicate object keys at any depth, trailing JSON, unknown fields, and unknown/duplicate query parameters. GET bodies are invalid. Reject compressed request bodies; byte limits apply to raw accepted UTF-8 JSON. Clients request identity encoding and bound decoded responses; compression cannot bypass a response limit. A JSON number must satisfy its type without coercion.

Query strings decode UTF-8 percent escapes once. Counter query values use canonical unsigned decimal text; route path UUIDs use the UUID type. Opaque source/revision segments are encoded once; routers must not treat encoded separators as extra path components or decode them twice. Invalid encoding is `invalid_field`. No query field is required unless its type/rules say so. No undocumented query key is accepted.

Proposed bounds:

| Item | Bound |
| --- | --- |
| POST JSON | 65,536 bytes |
| Metadata response JSON | 262,144 bytes |
| Content-chunk JSON | 65,536 bytes |
| Decoded content per chunk | 32,768 bytes |
| To-Discourse sanitized HTML | 49,152 bytes |
| Feed, mapping, record, URL-history, catalog page | At most 100 items, and within response-byte bound |
| Cursor | At most 2,048 UTF-8 bytes |
| Initial/inventory snapshot or catalog upload | 86,400 seconds |
| Change-event and settled source-body retention | At least 2,592,000 seconds |
| Mutation response receipt retention | At least 2,592,000 seconds |
| Lease | 300 seconds, renewable |
| Automatic attempts including initial | 3 |
| Retry delays | 30 then 120 seconds |
| Accepted retry-after maximum | 3,600 seconds |
| Detailed settled work/audit retention | At least 365 days |

There is no total From-Discourse publication-size cap. Pages may contain fewer than 100 items to fit their byte bound. Do not truncate fields or omit a record silently. One unrepresentable metadata object produces `metadata_unavailable`, not partial success. Catalog request pages must also fit the request bound. Clients use explicit connect/response deadlines and bounded polling/backoff in their native packets; no indefinite request or busy loop is allowed.

The proposed network lane likewise transports complete eligible native Discourse
publication revisions in bounded chunks, with explicit real native-post limits
and any selected representation fallback. CF01 approves that direction; its exact wire is proposed here,
separate from the unchanged 49,152-byte To-Discourse resolve HTML
rule. A hub does not recover complete CMS source from an imported excerpt.

Validate syntax/body/media bounds before semantic processing. Authenticate before resource lookup or disclosing protected state. Then validate typed fields, resource scope, current policy/revision, lease/transition, and native receipt bindings in that order. Multiple errors at the same validation stage use the first field in the machine artifact's declared field order. A failed check causes no publication-state mutation; security audit records are allowed.

## Mutation identity and replay

Every POST has a non-nil `mutation_id`. The receiver durably stores its identity as connection + route + path-resource + mutation ID and the validated request's typed semantic tree. Object member order and equivalent numeric spelling do not change that tree; array order, string bytes, omission, and explicit null do. No Unicode or URL normalization is applied to the replay payload tree.

An identical successful replay returns the original status/body without repeating side effects. Reusing the same scoped ID with a different valid tree returns `mutation_conflict`. The original receipt is committed atomically with the receiver state change. A 204 claim receipt remains 204 on replay; a new poll needs a new mutation ID.

Replay always rechecks current authentication and connection/resource scope. A saved receipt is not authority after revocation. For an already accepted terminal/stage mutation, the expired old lease does not force a new write: return the saved receipt if current caller scope still authorizes reading it. The response describes the original transaction; use GET for current state. A new mutation must pass all current revision/policy/lease checks.

Transient request failure with no committed receiver change is not a success receipt and does not permanently consume the mutation ID. If the result is uncertain, the client retries the identical ID/payload or reads status before creating a new mutation. Native-side mutation identity is also durable; receiver idempotency does not protect an independently repeated native create.

Expired receipt retention never permits identity recreation. The receiver retains durable uniqueness/tombstones for mapping, external/native identity, URL reservations, attempt cycles, and terminal work. Any replay that cannot be proven safe stops for reconciliation rather than claiming an old success or doing a second create.

## Route index

All paths below begin `/discussion-bridge/v2/`. Types are defined field-by-field in the JSON artifact. A route without a query type permits no query keys. Success responses are the named closed object except an explicitly bodyless 204. All ordinary failures use `Error`; resolve also has its declared reconciliation response.

| ID | Method and relative path | Body or query type | Response type | Success HTTP |
| --- | --- | --- | --- | --- |
| V2-01 | GET `connection.json` | — | Connection | 200 |
| V2-02 | POST `bridge-records/resolve.json` | ToResolve | ResolveResult | 200, 201 |
| V2-03 | GET `bridge-records.json` | — / query CursorQuery | RecordPage | 200 |
| V2-04 | GET `bridge-records/{resource_id}.json` | — | Record | 200 |
| V2-05 | POST `bridge-records/{resource_id}/withdraw.json` | WithdrawInput | Record | 200 |
| V2-06 | GET `sources.json` | — / query SourceFeedQuery | SourceFeed | 200 |
| V2-07 | GET `sources/{source_id}/revisions/{source_revision}/content.json` | — / query ContentQuery | ContentChunk | 200 |
| V2-08 | GET `policy.json` | — | Policy | 200 |
| V2-09 | POST `mappings/prepare.json` | MappingPrepare | Mapping | 200, 201 |
| V2-10 | POST `mappings/adopt.json` | MappingAdopt | Mapping | 200, 201 |
| V2-11 | GET `mappings.json` | — / query CursorQuery | MappingPage | 200 |
| V2-12 | GET `mappings/{mapping_id}.json` | — | Mapping | 200 |
| V2-13 | GET `mappings/{mapping_id}/url-history.json` | — / query CursorQuery | UrlHistoryPage | 200 |
| V2-14 | POST `work/claim.json` | Claim | Lease | 200, 204 |
| V2-15 | GET `work/{work_id}.json` | — | WorkQueryResponse | 200 |
| V2-16 | POST `work/{work_id}/renew.json` | Renew | Lease | 200 |
| V2-17 | POST `work/{work_id}/acknowledge.json` | Ack | WorkQueryResponse | 200 |
| V2-18 | POST `work/{work_id}/fail.json` | Failure | WorkQueryResponse | 200 |
| V2-19 | POST `work/{work_id}/prepare.json` | StaticPreparation | WorkQueryResponse | 200 |
| V2-20 | POST `work/{work_id}/finalize.json` | StaticFinalize | WorkQueryResponse | 200 |
| V2-21 | POST `work/{work_id}/abort.json` | StaticAbort | WorkQueryResponse | 200 |
| V2-22 | POST `mappings/{mapping_id}/url-moves.json` | UrlMovePrepare | UrlMove | 201, 200 |
| V2-23 | POST `mappings/{mapping_id}/url-moves/{move_id}/finalize.json` | UrlMoveFinalize | Mapping | 200 |
| V2-24 | POST `mappings/{mapping_id}/url-moves/{move_id}/abort.json` | UrlMoveAbort | UrlMove | 200 |
| V2-25 | POST `catalog/uploads.json` | CatalogBegin | CatalogUpload | 201 |
| V2-26 | POST `catalog/uploads/{upload_id}/pages.json` | CatalogPageInput | CatalogUpload | 200 |
| V2-27 | POST `catalog/uploads/{upload_id}/finalize.json` | CatalogFinalize | CatalogResponse | 200 |
| V2-28 | GET `catalog.json` | — / query CatalogReadQuery | CatalogResponse | 200 |
| V2-29 | POST `bridge-records/{resource_id}/source-url-moves.json` | SourceUrlMovePrepare | SourceUrlMove | 200, 201 |
| V2-30 | POST `bridge-records/{resource_id}/source-url-moves/{move_id}/finalize.json` | SourceUrlMoveFinalize | Record | 200 |
| V2-31 | POST `bridge-records/{resource_id}/source-url-moves/{move_id}/abort.json` | SourceUrlMoveAbort | SourceUrlMove | 200 |
| V2-32 | GET `bridge-records/{resource_id}/url-history.json` | — / query CursorQuery | UrlHistoryPage | 200 |

The resource ID, work ID, mapping ID, move ID, or upload ID in a body must equal the corresponding path and owned stored binding. Disagreement is `identity_conflict` before mutation. Directions are To Discourse for resolve/record withdrawal/source-URL moves; From Discourse for source, mapping, work, and presentation-URL moves. Connection/policy/catalog/record inventory reads are limited to the connection's permitted directions and lanes.

## Source policy and delivery feeds

Native capabilities are descriptive stored configuration. They enumerate supported modes and dynamic/static publication, not authentication. A configured adapter and qualification must prove them. Unsupported requested modes fail visibly; capability declarations alone do not prove implementation.

Policy is written only by an authorized Discourse administrator using native admin controls, not through a Content Connection or provider entitlement. It is default-off. Enablement is explicit per destination. A disabled connection/policy starts no source or publication lifecycle jobs and queues no unattended creates.

Eligible sources are current nonprivate published Discourse topics with an available first post. Category selection or all-public selection is narrowed by connection scope. Explicit topic inclusion can add an otherwise permitted public topic; exclusion wins. A topic present in both include/exclude lists is invalid configuration. Unlisted sources require explicit include-unlisted policy. Private, deleted, unpublished, disallowed-lane, and moderator-restricted content cannot become eligible through an inclusion list.

Policy fixes publication kind, presentation mode, author/taxonomy IDs, and exact adoption allowlist. All selected catalog identities must be available; do not silently substitute authors, taxonomy, or modes. Empty author/taxonomy selections mean preserve native defaults for a new object and existing assignments on updates; no implicit reassignment. An enabled policy using missing selected metadata is attention, not a create with substitutes.

A policy revision changes whenever these approved selections or scope-relevant configuration change. Old uncompleted work is superseded or cancelled as appropriate. Create a new work intent only where current policy authorizes it. A source becoming ineligible emits revocation for destinations with a known mapping; it does not expose newly private source content.

Initial feed creation pins one snapshot and its event high-water mark H. It emits at most one current publication entry for each eligible source as of H, ordered by canonical source-ID UTF-8 bytes, with the source's last publication event sequence. Sequence ordering is required only for changes, not initial enumeration. Events are receiver-issued durable identities; sequence counters are monotonic per connection publication lane.

Nonfinal initial pages return a next cursor and null checkpoint. The final page returns null next cursor and the changes checkpoint at H, including an empty final snapshot. All snapshot continuations bind connection, lane, scope revision, policy revision, snapshot ID, position, and expiry. Repeated pages are deterministic. A scope change invalidates the snapshot immediately; it cannot leak removed content until expiry.

A changes poll starts only with a durable checkpoint. It pins a new high-water mark, then drains events in strictly increasing event sequence. Every page returns a checkpoint through its last emitted sequence and a next cursor only when this fixed drain has more events. Empty completion advances to its pinned high-water mark. Concurrent events beyond that mark remain for the next poll. Adapters persist the checkpoint only after durably staging every entry from that page. Processing uses source/event identity to make at-least-once replay harmless.

A current revocation prevents stale source-body fetches/publication acknowledgements even if an old snapshot refers to the source. Revocation events disclose only the previously owned source identity and reason. Continued source reads require current eligibility, except work withdrawal/status can access its own identity receipts without the now-ineligible body.

Malformed cursors give `cursor_invalid`; another scope/current policy gives `cursor_scope_changed`; lost snapshot/retention gives `cursor_expired`. No silent rewind or skipped page. After expiry, start a fresh initial snapshot and reconcile against durable mapping inventory; absence from one page is not a withdrawal instruction. Outstanding revocation tombstones are retained until every affected mapping reaches withdrawn or explicit attention/reconciliation.

Source revisions fix exact complete cooked first-post HTML bytes, title, authors, topic URL, and actual source dates. Both normal and wiki edits create new revisions. No HTML body rewrite occurs as an incidental From-Discourse synchronization step. More than 20 authors or unrepresentable source metadata requires actionable metadata handling, not silent truncation.

Content fetch defaults offset to zero. The receiver returns an exact contiguous byte slice at that offset, at most 32,768 decoded bytes. A nonfinal chunk advances next_offset by its decoded byte length. Final has null next_offset and reaches content_bytes exactly. At end, an empty final chunk is valid; beyond end is invalid_field. Byte slices may split a UTF-8 character: assemble bytes before decoding. Verify full byte count, SHA-256, and valid complete UTF-8 before native rendering. Never treat missing chunks as an excerpt.

Outstanding authorized work pins required immutable revisions. Settled body retention is at least 30 days; identity and URL ancestry are retained separately. Exhaustion produces storage_exhausted/attention and prevents new unsafe work. Do not evict uncompleted source bodies, revocations, or identity receipts to claim continued success.

## Mapping identity and native ownership

One connection/source has one mapping and stable Bridge resource; another destination has its own connection, mapping, native object, receipts, and credentials. They share the source topic, not destination identity. External ID is stable and independent of URL. Native ID, Bridge resource ID, and source topic ID never change during a normal revision, retry, presentation change, or URL move.

An eligible source under explicitly enabled policy creates a receiver-authorized publication intent. Mapping prepare supplies native identity/URL reservations for that existing intent; it cannot enable a destination or select an unapproved source. When identity is ready, the receiver materializes work under that intent. This is not work created by a catalog or an unapproved caller request.

Prepare reserves the unique connection/source/external identity and URL and returns pending mapping. An exact existing binding returns its mapping. A changed identity, canonical URL, or another reservation fails closed. Canonical URL changes use a move transaction, not a second prepare. The first native create must atomically record the receipt and returned native ID; later operations must use that same ID.

Adoption is separately explicit. The admin policy must list the exact existing connection-owned From-Discourse resource. Source/topic/external/native/URL ownership must match. Adoption adds mapping/work bookkeeping without converting or rewriting the existing Bridge Record, topic, native object, or discussion. Ambiguity is attention. A claimed native ID or ownership hash is not authority to take unrelated content.

Native ownership receipts use the local `NativeOwnershipReceipt` shape. Serialize fields in its declared order as a 4-byte unsigned big-endian byte length followed by UTF-8 value bytes. Null has length 0xffffffff and no value bytes; integers are canonical unsigned decimal text. UUIDs, URLs, IDs and revisions use their exact stored values. The schema-version field is included first. SHA-256 of these exact bytes is the receipt hash. This is a provenance fingerprint, not a secret/signature or substitute for locks.

The adapter must validate the actual durable receipt under native locking before reading, replacing, moving, or withdrawing an object. Reject symlinks, traversal, unowned native objects/files, collisions, duplicate/ambiguous native lookup, or unexpected local edits. Component packets must specify native transaction, safe-path, lock, ownership, expected-native-revision, and crash-recovery rules. The receiver checks receipt binding fields but cannot independently prove CMS/database/filesystem ownership by receiving a hash.

Mapping active means the desired publication revision and mode were publicly verified. A prior verified revision remains identified while a new desired revision is pending; do not represent the new revision as delivered because the old page remains public. Withdrawal retains mapping/URL ancestry and sets mapping_state withdrawn only after actual absence verification. An attention state does not erase the last verified native identity or revision.

URL collision keys lowercase scheme/host, remove default HTTPS port 443, use / for an empty path, and otherwise preserve escaped path and query bytes/order exactly. Reject userinfo, fragments, invalid escapes, dot path segments, and non-HTTPS URLs. Native URL aliases are additionally checked by the native adapter. The receiver reserves active, prepared, and retired URLs across connections without disclosing another connection's identity.

## Work and retry transitions

Work binds mapping, source revision/action, policy revision, attempt cycle, and generation. Publish work has a nonnull source revision. Withdraw work has null source_revision; prior owned revision remains in mapping/native receipts. Attempt is zero before first claim. The receiver selects the oldest eligible pending work, breaking ties by work UUID. A filtered claim cannot create work.

Claim atomically increments attempt and generation, issues a new 32-byte secret token, and expires in 300 receiver-clock seconds. At most one live mutation lease exists per mapping. Renewal before expiry sets expiry to receiver-now + 300 without changing attempt/generation/token. Status GET never reveals a lease token. Lease authority must match path, token, generation, source revision, and policy revision. Tokens are stored as protected verifier data and redacted from logs; they are not native metadata.

Generation comes from a durable counter for the mapping, not a new work item's attempt count. It never resets for a new source/policy revision, work UUID, or explicit retry cycle. Thus an old native worker cannot regain authority merely because a later work item also has attempt 1. Receiver and native adapter must retain the mapping's last fencing generation across restart.

The allowed transitions are exactly the machine artifact's transition list. In operational terms:

| Current state | Event | Result |
| --- | --- | --- |
| pending | eligible claim | leased, attempt + 1, generation + 1 |
| leased | native synchronized receipt or static prepare | synchronized |
| synchronized | static deployment acknowledgement | deployed |
| synchronized | dynamic action-matching public verification | verified |
| synchronized or deployed | static finalize with exact prepared transaction and proof | verified |
| leased, synchronized, deployed | transient failure or expiry before attempt 3 | retry_wait |
| leased, synchronized, deployed | permanent failure, unsafe reconciliation, or attempt 3 exhausted | attention |
| synchronized or deployed | static abort | attention, preserving previous verified native result |
| retry_wait | retry time reached | pending, same cycle/count |
| attention | explicitly authorized retry | pending, new audited cycle, count zero |
| any uncompleted state | newer source/policy supersedes it | superseded; separate current work if authorized |
| any uncompleted state | scope/eligibility removed | cancelled; authorized owned withdrawal intent only if allowed |

Verified, cancelled, and superseded work is terminal; it is not reset for a new revision. Renewal and identical accepted receipt replay do not consume attempts. Every claim consumes an attempt, including no-op recovery or expiry. Attempt ceiling is three including initial. Transient retries wait 30 seconds after attempt 1, 120 after attempt 2; a valid nonnull Retry-After may lengthen that delay, never shorten it. More than 3,600 seconds is invalid_field, not an unbounded sleep. Only rate_limited, transport_timeout, and native_service_unavailable are automatically transient. public_verification_failed is attention: it may conceal wrong content, ownership, or origin rather than ordinary transport failure.

An explicit native administrator retry may start a new cycle only after attention, only within current scope/policy, and only after native state is reconciled. It is audited and never resets a live/verified/cancelled/superseded work item. An unattended worker cannot invoke it merely to defeat the three-attempt ceiling.

Expiry and supersession do not prove that native mutation did not happen. Before the next native write, the adapter must reconcile any prior native result under a durable lock, compare expected native revision/ownership, and prevent the old worker from writing after a newer generation. If it cannot establish fencing/reconciliation, leave attention and do not issue a second create. Receiver leases are not distributed transactions.

Connection disable/revocation cancels outstanding authority immediately. It does not issue new CMS access or imply that every public native page was removed. If credentials are disabled before withdrawal can run, the forum UI shows publication/withdrawal attention requiring separately authorized native action; it must not claim removal. Eligibility/policy withdrawal on a still-authorized connection can create owned withdraw work.

## Dynamic and static completion

A dynamic synchronized acknowledgement contains an action-matching SyncResult. Publication reports durable exact native identity and full/native-limit-excerpt representation; withdrawal reports the same owned identity after native unpublish. It is not yet public verification. A dynamic verified acknowledgement must then contain PublishedVerification for publish_revision or AbsentVerification for withdraw.

Static work first prepares a UUID transaction for exact work/generation/action/revision. Its native staged object/file and prior verified state are durable. Prepare records synchronized only. Build and deployment run through the native platform, never through Discourse CMS credentials. A static deployment receipt may record deployed before verification, but cannot imply success.

Finalize supplies that exact prepared transaction, deployment identity/time, and action-matching verification. It can atomically record the deployment and verification from synchronized, or finish an already deployed state. Static verified acknowledgement cannot bypass finalize. For withdrawal, prepare stages owned removal, build/deploy removes it publicly, and finalize requires verified absence of the old exact native URL/object.

A static abort is accepted only before verified. It records whether the prior native result was actually restored. Both true and false leave attention; true preserves the previous verified receipt, while false is native_restore_required and retains all ownership/URL reservations. A later explicit retry begins after native reconciliation. Build/deploy rollback itself belongs to the native platform; a receiver abort receipt cannot make a rollback happen.

A new lease may resume the same prepared transaction only by repeating prepare with a new mutation ID, identical transaction/native bindings, and current authority for the same desired action/revision/policy. The receiver rebinds that open transaction to the new generation only after native reconciliation. A different revision/policy or conflicting prepared result remains attention; do not finalize stale work using a replacement lease.

Public verification fetches the exact configured public URL without connection/lease/operator credentials, rejects redirects, and verifies actual owned native content and discussion presentation. The component packet must define a versioned verification_profile: exact extraction of the owned rendered publication fragment and hashing of its bytes, comparison with expected rendered output, ownership/revision markers, requested mode, Read More/source link when relevant, and native identity. A copied source SHA marker alone is insufficient. Native-publication hash is not assumed equal to cooked-source hash.

checked_at must be at or after native synchronization/deployment/transaction preparation and no more than 300 seconds ahead of receiver time. Receiver receipt time is retained separately; publicly_verified_at is actual adapter verification time. The receiver acknowledges a scoped adapter report, not independent external proof. Qualification still requires independent public verification.

Absent proof requires the exact owned native object unpublished and its canonical public URL returning 404 or 410. A login wall, 401/403, unrelated page, timeout, redirect, or HTTP 200 error template is not withdrawal proof. If a platform cannot supply that absence behavior, it needs an explicitly approved native verification extension before claiming withdrawal qualification.

From-Discourse normally publishes the complete immutable cooked source. A real native destination limit may use native_excerpt only with its measured native limit, named native constraint, exact source hash, and a visible Read More to the authoritative source topic. JSON/chunk/body/page bounds are never native limits. The complete source is fetched and verified first; any native excerpt is chosen by the native adapter, not a shared universal excerpt service.

## Verified URL migration

Presentation URL moves and native source URL moves are distinct routes. Neither changes external ID, resource ID, topic ID, or native object identity. No route permits an arbitrary topic rebind.

Presentation move prepare requires current lease, mapping revision, old URL and ownership receipt. New URL must be on the same authorized destination origin and collision-free. It reserves the new URL while the old URL remains authoritative, and issues a public nonce. Native work moves the same object under its native lock and durable journal.

Finalize requires the issued nonce, current mapping/revision/generation, unchanged native identity, native ancestry receipt, and actual new-URL public verification of the current desired publication. Native verification must observe the nonce in the owned native receipt/public identity evidence and match the receiver move, not accept a nonce supplied by an unrelated page. Switch active URL atomically, increment mapping revision, and retire/reserve old URL. A later source revision during the move supersedes old work; no stale proof may switch the binding.

Native source moves apply to a current initialized v2 To-Discourse record. Prepare checks exact external ID, source revision, old URL and same permitted native origin. Finalize is an adapter report of the same native source identity/content at new URL and the issued nonce; it does not independently let Discourse crawl arbitrary caller URLs. Discussion/native/external/resource/topic identities remain unchanged. Concurrent revision change makes finalize revision_conflict; reconcile/reprepare rather than discard the revision guard.

Because a source revision binds its URL metadata, finalize also supplies a fresh unused new_source_revision and the actual nullable source_updated_at. Verification names that new revision; it must differ from expected_source_revision. The atomic move advances only canonical URL/ancestry and source metadata revision/time, retaining title, delivered body, complete source hash/count, authors, native ID, external ID, resource and topic. It does not rewrite the forum topic body. A later same-revision resolve must match this updated metadata; no URL alias is silently admitted as the old revision.

For either direction, abort releases the proposed URL only if the native move did not happen and exact old ownership is still established. Applied or uncertain native movement leaves attention and both reservations. No time-based garbage collection frees these URLs. A lost prepare/finalize response is recovered by identical mutation replay and scoped GET/history. Repeating an identical open presentation move under reconciled current authority can rebind it to the replacement lease; a conflicting move cannot.

Cross-origin URL movement, reuse of retired URL by another identity, and native identity replacement are out of this proposal's automatic path. They require an exact separately authorized reconciliation decision. URL history remains while the binding exists, including withdrawal, disabled connection, failed work, or retry. No expiry creates an opportunity to capture the old discussion.

## To Discourse revisions and binding withdrawal

v2 resolve adds source revision, expected revision, actual source times, complete-source byte count/hash, and representation to the preserved content inputs. It accepts only published true and permitted direction/origin/lane. Native draft/autosave/revision-object/page-view activity must not call it. A normal published-source edit is distinct from those forbidden native revision-object events.

For new creation expected_source_revision is null. For an existing initialized v2 record it is the current stored revision; a different one gives revision_conflict. The same source_revision with a changed authoritative source payload gives revision_conflict. A same-revision exact delivery is resolved without a write; a new revision updates only explicitly source-owned imported title/body metadata, preserving discussion, moderation, topic/resource/native identity and stable URL. Unexpected local/moderator edits require native_ownership_conflict/reconciliation, never overwrite.

Source payload identity includes external ID, canonical URL, title, delivered HTML, complete source hash/count, source dates, representation, effective lane/visibility, and author mapping; adapter/correlation labels and expected revision are diagnostic/control data, not the source's content identity.

Full means source_content_bytes/hash equal the exact sanitized content_html bytes/hash. If full sanitized source exceeds 49,152 bytes, bounded_excerpt contains valid sanitized HTML with visible Read More to canonical native source; source count/hash still describe the complete source. The serialized excerpt including link stays within 49,152 bytes. No mid-tag, invalid UTF-8, or silent clipping is accepted. The receiver may reject unsafe HTML rather than silently changing an already hashed representation.

existing_topic_id still requires the exact available unlisted Core embed attestation for canonical URL, no previous mapping, and current connection authorization. It is not permission to adopt an arbitrary topic. created is 201; resolved/updated is 200. Identity/URL/ownership/adoption disagreement may return 409 reconciliation_required with its specified reason, null protected identities, and core_fallback false. Syntax/auth/revision errors use Error. A replay never makes a Core publication fallback.

An existing v1 record starts with no v2 source revision. Its first v2 initialization may attach revision metadata only after exact baseline-owned content/title/identity/authorship is reconciled without rewriting or changing record meaning. If that equivalence cannot be proved, return reconciliation_required. Implementation must specify this operation in the baseline-derived plugin migration packet; enabling initial sync is never blanket conversion authority.

Record withdrawal is To-Discourse binding withdrawal only. It requires expected current revision, preserves record/topic/discussion and URL tombstones, and stops further delivery. It does not hide/delete Discourse discussion or claim forum privacy enforcement. Resume of a withdrawn binding requires explicit administrator reconciliation/re-enable; resolve cannot silently recreate it.

v2 record views use pending/active/attention/withdrawn as delivery/binding projections, not replacement values for the existing Alpha.30 database record semantics. v1 detail and content remain unchanged. v2 From-Discourse bodies use revision/chunk routes; v2 detail is metadata only.

## Catalogs and forum name

The proposed optional catalog describes native authors and taxonomy only. Native presentation/build capabilities are separate stored descriptive connection metadata. Catalog absence is valid where policy has no selected catalog IDs; uploading a catalog does not enable publication, change destination scope, or approve entries.

Begin declares kind, native revision, and total. Uploads are connection/lane-owned and expire after 86,400 seconds. Pages are sequential from zero with at most 100 unique-ID entries each and within body bounds. Nonfinal pages must be nonempty; total zero requires no pages. Repeating an already accepted page succeeds only with the same typed entries. Missing/out-of-order/changed pages or duplicate IDs give catalog_page_conflict.

Finalize requires exact upload/path identity and declared/received total. Switch the active descriptive snapshot atomically and issue catalog_revision; failure leaves the previous snapshot active. Return only the first bounded page. Catalog read cursors bind snapshot/kind/connection/scope and expire after 86,400 seconds; a concurrent refresh does not splice snapshots. Entry disappearance/unavailability leaves selected policy unchanged and its affected work in attention, never silently reassigned.

Catalog refresh is native administrator/scheduler work using the bounded
catalog upload routes. There is no catalog_refresh_request field, remote
operator action or provider authority in this candidate. A changed native
catalog never independently changes publication policy or creates work.

Category/per-topic controls, explicit retry, preview, and truthful badges/summaries remain native forum administration. A preview is read-only validation/presentation inspection within current scope: it cannot enable publication, create work, or call a native draft/page-view resolve path. Their exact UI/component implementation belongs in the approved Alpha.30-derived plugin packet, not a provider entitlement or descriptive catalog.

forum_name is one effective plain-text label. Optional DISCUSSIONBRIDGE_FORUM_NAME overrides the native Discourse title. Unset uses the title; blank/invalid explicit override or invalid resulting native title gives forum_configuration_invalid. Do not silently fall back. Value is at most 200 UTF-8 bytes, no control characters, nonblank, and escaped separately in each native output context. It is descriptive, not an origin or authority.

For plugin-free profiles, the native adapter's same optional DISCUSSIONBRIDGE_FORUM_NAME setting selects a configured forum label; unset uses the configured source forum's native title obtained by the profile's existing supported integration. It must never invent the forum hostname as a substitute label. If that title cannot be obtained safely, expose configuration attention rather than manufacture a name. These profiles remain plugin-free: v2/Content Connection is not a new dependency just to render their existing Full/Interactive discussion integration. Exact native configuration keys/output integration belong in each baseline-derived component packet.

## Error semantics

The closed Error object is outcome rejected, code, receiver-derived retryable, nullable retry_after_seconds, nullable correlation_id, and core_fallback false. Correlation IDs are bounded diagnostics, not secrets. Error detail never includes credentials, lease tokens, or another connection's identities. Work failure safe_detail is a short redacted operator message; raw native exceptions are forbidden.

retry_after_seconds is null for permanent errors and otherwise null or 1..3600. HTTP Retry-After, if emitted, is the same integer. A request-level transport/service error does not imply a work failure receipt was accepted. Native workers reconcile before reporting/attempting another mutation.

| Code | HTTP | Automatically transient |
| --- | --- | --- |
| `invalid_json` | 400 | no |
| `unknown_field` | 400 | no |
| `invalid_field` | 422 | no |
| `body_too_large` | 413 | no |
| `unsupported_media_type` | 415 | no |
| `authentication_required` | 401 | no |
| `authentication_failed` | 401 | no |
| `connection_disabled` | 403 | no |
| `scope_denied` | 403 | no |
| `resource_not_found` | 404 | no |
| `revision_conflict` | 409 | no |
| `identity_conflict` | 409 | no |
| `native_ownership_conflict` | 409 | no |
| `url_collision` | 409 | no |
| `mapping_conflict` | 409 | no |
| `mutation_conflict` | 409 | no |
| `cursor_invalid` | 400 | no |
| `cursor_scope_changed` | 409 | no |
| `cursor_expired` | 410 | no |
| `revision_unavailable` | 410 | no |
| `content_hash_mismatch` | 422 | no |
| `work_busy` | 409 | no |
| `lease_expired` | 409 | no |
| `lease_conflict` | 409 | no |
| `policy_changed` | 409 | no |
| `work_superseded` | 409 | no |
| `invalid_transition` | 409 | no |
| `presentation_unsupported` | 422 | no |
| `catalog_entry_unavailable` | 409 | no |
| `catalog_upload_expired` | 410 | no |
| `catalog_page_conflict` | 409 | no |
| `metadata_unavailable` | 422 | no |
| `native_limit_exceeded` | 422 | no |
| `public_verification_failed` | 409 | no |
| `native_restore_required` | 409 | no |
| `rate_limited` | 429 | yes |
| `transport_timeout` | 504 | yes |
| `native_service_unavailable` | 503 | yes |
| `storage_exhausted` | 507 | no |
| `source_ineligible` | 403 | no |
| `forum_configuration_invalid` | 503 | no |

User-visible status uses actual mapping/work state
and last failure; enqueued, leased, synchronized, and deployed are never
advertised as publicly verified.

## Discourse Hub exact semantic extension

CF01 approves one shared plugin with source, recipient and explicit relay
responsibilities, public-only initial networking, origin-approved relay and
the stated source/local discussion model. The named Network types and routes
below supply the exact proposed wire. The numerical limits and verification
profiles are engineering selections awaiting approval of this packet.

### Peer setup and administration

NET-01 is a native-administrator read, not discovery/enrollment; an unconfigured
forum has no network identity and returns resource_not_found. NET-02 explicitly
creates one persistent local forum UUID from normal native configuration.
Installation does not create peers, issue credentials, enable policy or start
polling. NET-03 records administrator-confirmed exact peer UUID, HTTPS origin
and identity revision. Same UUID/different origin is peer_identity_conflict
unless NET-09's explicit rebinding process applies. A copied active identity
cannot become a second forum without reconciliation.

All native-administrator routes require the current local Discourse admin
session, native same-origin/CSRF protection and local resource ownership.
A Content Connection cannot authenticate these routes. A source administrator
uses ordinary native Content Connection issuance/rotation, then NET-04 attaches
that existing locally owned from_discourse connection to one approved recipient
and a network-only publication lane. NET-05 is a recipient-admin operation:
store the source-issued secret in protected server configuration, read NET-06
over the exact approved source origin, match source/recipient IDs/origins and
scope, and independently approve receiving policy. The secret never appears
in responses, audit bodies, logs, public markup or support output.

Receiving and exporting default disabled; reverse publishing needs another
directed connection and credential. An enabled source cannot enable receiving
or local discussion at another forum. NET-07/08 mutate policy only with the
exact current expected revision and a fresh new revision. Category/tag/topic
filter IDs belong to the immediate sender's native forum; the original origin
key remains separate. Required tags all apply, an excluded tag/topic vetoes,
and original origin/destination/grant ceilings apply before any local filter.
Only public native topics/receiving categories are admitted; private/staff/group
topics, private messages, drafts and deleted content cannot be included by rule.

NET-09 does not follow an old host's redirect: both administrators independently
confirm the unchanged identity/new HTTPS origin out of band, pause affected
work, update matching bindings and rotate the connection secret before resume.
The protocol trusts the explicitly approved immediate peer within named origin
and relay ceilings. It does not claim end-to-end cryptographic origin proof.

Native-admin POST mutation receipts are scoped by local forum, current native
admin user, route/path and mutation_id, rather than Content Connection.
Peer POST receipts retain connection/route/path/mutation scope. Both recheck
current authority on replay. A receiving-setup replay stores/compares only the
server-private SHA-256 fingerprint of the UTF-8 supplied secret, not an
unredacted request copy; the actual secret stays in protected credential
storage. Mutation receipts and configuration writes commit atomically.
Unknown fields/query keys, duplicate JSON keys, GET bodies and redirects follow
the shared strict transport rules. Network typed path identities match all
body, lease and stored bindings; mismatches never grant new scope.

### Network route index

All success bodies are the named closed types. NET-15 alone may return bodyless
204. Errors use the shared Error type, with the added network codes below.
Native-admin reads expose only that forum's owned configuration and mappings;
peer reads expose only the assigned directed connection, its publications,
work and receipts. Anonymous readers never receive peer endpoints/credentials. NET-30/31 are separate native-topic-reader routes,
with normal local topic permissions rather than peer headers.

| ID | Method and relative path | Authority | Input | Response | HTTP |
| --- | --- | --- | --- | --- | --- |
| NET-01 | GET `network/identity.json` | Native admin | — | NetworkIdentity | 200 |
| NET-02 | POST `network/identity.json` | Native admin | NetworkIdentityCreate | NetworkIdentity | 200 |
| NET-03 | POST `network/peers.json` | Native admin | NetworkPeerApprove | NetworkPeer | 200 |
| NET-04 | POST `network/export-connections.json` | Native admin | NetworkExportCreate | NetworkConnection | 200 |
| NET-05 | POST `network/receiving-connections.json` | Native admin | NetworkReceivingCreate | NetworkReceivingConnection | 200 |
| NET-06 | GET `network/connection.json` | Scoped peer | — | NetworkConnection | 200 |
| NET-07 | POST `network/export-connections/{connection_id}/policy.json` | Native admin | NetworkSourcePolicyWrite | NetworkConnection | 200 |
| NET-08 | POST `network/receiving-connections/{receiving_id}/policy.json` | Native admin | NetworkReceivePolicyWrite | NetworkReceivingConnection | 200 |
| NET-09 | POST `network/peers/{forum_id}/rebind.json` | Native admin | NetworkPeerRebind | NetworkPeer | 200 |
| NET-10 | GET `network/feed.json` | Scoped peer | — / query NetworkFeedQuery | NetworkFeed | 200 |
| NET-11 | GET `network/publications/{publication_id}/revisions/{source_revision}/manifest.json` | Scoped peer | — | NetworkManifest | 200 |
| NET-12 | GET `network/publications/{publication_id}/revisions/{source_revision}/content.json` | Scoped peer | — / query NetworkContentQuery | NetworkContentChunk | 200 |
| NET-13 | GET `network/publications/{publication_id}/revisions/{source_revision}/assets.json` | Scoped peer | — / query CursorQuery | NetworkAssetPage | 200 |
| NET-14 | GET `network/publications/{publication_id}/revisions/{source_revision}/assets/{asset_id}/content.json` | Scoped peer | — / query ContentQuery | NetworkAssetChunk | 200 |
| NET-15 | POST `network/work/claim.json` | Scoped peer | NetworkClaim | NetworkLease | 200, 204 |
| NET-16 | GET `network/work/{work_id}.json` | Scoped peer | — | NetworkWorkStatus | 200 |
| NET-17 | POST `network/work/{work_id}/renew.json` | Scoped peer | NetworkRenew | NetworkLease | 200 |
| NET-18 | POST `network/work/{work_id}/acknowledge.json` | Scoped peer | NetworkAck | NetworkWorkStatus | 200 |
| NET-19 | POST `network/work/{work_id}/fail.json` | Scoped peer | NetworkFailure | NetworkWorkStatus | 200 |
| NET-20 | GET `network/deliveries.json` | Scoped peer | — / query CursorQuery | NetworkDeliveryPage | 200 |
| NET-21 | GET `network/deliveries/{delivery_id}.json` | Scoped peer | — | NetworkDelivery | 200 |
| NET-22 | POST `network/work/{work_id}/retry.json` | Native admin | NetworkRetry | NetworkWorkStatus | 200 |
| NET-23 | GET `network/local-mappings.json` | Native admin | — / query CursorQuery | NetworkLocalMappingPage | 200 |
| NET-24 | POST `network/local-mappings/{local_resource_id}/discussion-policy.json` | Native admin | NetworkLocalPolicyWrite | NetworkLocalMapping | 200 |
| NET-25 | GET `network/publications/{publication_id}/discussion.json` | Scoped peer | — / query NetworkDiscussionQuery | NetworkDiscussionPage | 200 |
| NET-26 | GET `network/discussion-changes.json` | Scoped peer | — / query NetworkFeedQuery | NetworkDiscussionFeed | 200 |
| NET-27 | GET `network/publications/{publication_id}/discussion/posts/{post_id}/revisions/{post_revision}/content.json` | Scoped peer | — / query ContentQuery | NetworkDiscussionChunk | 200 |
| NET-28 | GET `network/publications/{publication_id}/related-discussions.json` | Scoped peer | — / query CursorQuery | NetworkRelatedPage | 200 |
| NET-29 | POST `network/withdrawals.json` | Native admin | NetworkWithdrawInput | NetworkWithdrawalStatus | 200 |
| NET-30 | GET `network/local-topics/{local_topic_id}/source-discussion.json` | Native topic reader | query NetworkDiscussionQuery | NetworkReaderProjection | 200 |
| NET-31 | GET `network/local-topics/{local_topic_id}/source-replies/{post_id}/revisions/{post_revision}/cache/{cache_revision}/content.json` | Native topic reader | query ContentQuery | NetworkRenderedChunk | 200 |

### Immutable source and representation

NetworkRevision binds origin forum/topic, publication UUID, origin event ID
and monotonic per-publication origin sequence, opaque source revision, exact
title/canonical URL, actual nullable source times, authors, origin category/tag
metadata, features and exactly one raw_discourse plus one cooked_html descriptor.
Each blob has its own byte count and SHA-256. Do not normalize revision IDs or
compare them as clocks. Every relay preserves those fields and original bytes,
not its locally recooked topic or native-limit excerpt. A category/tag or URL
metadata change creates a new publication revision without inventing a native
content-edit timestamp. Source revisions, events and current control generations
are durable; exhaustion never wraps or silently evicts outstanding bodies.

A CMS-derived topic also retains NetworkNativeOrigin's existing native profile,
origin/external/Bridge resource/canonical binding, available full/excerpt
representation, original author labels and known native source dates. It cannot
manufacture missing complete CMS content or become its CMS owner. Such a topic
requires explicit network selection; it is not ordinary native origin discovery.

NET-11 returns the exact immutable revision with current scoped grant,
provenance and source authority lifetime. Grant/path fields are current delivery
authority, not new immutable content. NET-12 returns one requested blob in
contiguous decoded chunks at most32768 bytes, with identical bytes on replay,
strict total/hash/UTF-8 validation and final next_offset null. The original
raw/cooked bytes are both verified before import. There is no whole native
Discourse publication cap and no 48KiB restriction on this separate lane.
Existing CMS resolve's49152-byte sanitized HTML rule remains unchanged.

NetworkReceivePolicy.full_only is the default. Import the source raw through
native post validation/cooking; never put peer cooked HTML directly into native
post storage. Preserve source snapshots and record asset-URL rewriting/local
native raw/cooked hashes separately. If a real native post limit prevents full
publication, report native_limit_exceeded/attention unless the recipient
explicitly selected native_limit_excerpt. That report includes measured native
constraint/limit, a safe native excerpt and visible canonical Read More. It
never describes an excerpt as a full publication or uses a transport bound as
a native limit. Unsupported rich content gives rich_content_unsupported rather
than silent removal or substitution.

The initial import profile is db-discourse-network-import-1: ordinary native
Markdown, tables, fenced code, links and images through native cooking;
Mermaid/math require installed, qualified native rendering capability. Feature
claims are descriptive, not proof or scope. Native account, upload, cooker,
theme and feature hooks are specified in the later component packet; no
proposed field claims those hooks already exist in Alpha.30.

NET-13 pins an asset inventory to the immutable publication/revision/asset
revision; NET-14 transports only admitted source-owned public native uploads,
not arbitrary content URLs. Each copied asset is at most8388608 bytes, complete
hash/count verified, and enters normal recipient upload ownership/validation.
Initial admitted media are image/png, image/jpeg, image/gif, image/webp,
image/avif, application/pdf and text/plain, additionally narrowed by each
native host's allowed types. HTML/JS/SVG executable assets and private/signed
upload access are not admitted. Other unsupported attachments produce explicit
attention, not silently dropped content. External HTTPS links/images remain
sanitized references; the worker does not fetch them as upload instructions.
No peer credential is forwarded to an asset URL or browser. Native upload
reference rewriting is journalled with the same publication transaction.

### Origin grants, relay and one local mapping

NetworkGrant is origin-issued and carries an immutable publication/origin
binding, grant revision and monotonic generation, explicit recipients, permitted
relay forums and forums permitted local discussion. Discussion/relay lists
are subsets of recipients. Per-topic origin rules may only narrow connection
ceilings. Relays preserve the grant, then apply their own narrower route policy;
they cannot add recipients or grant local discussion. Current generation and
scope govern every read, claim, native write and receipt. Stale authority is
not resurrected by an old content revision or idempotent success.

The provenance path starts at the origin and ends at the immediate sender.
It contains distinct forum UUIDs, excludes the intended recipient and has at
most seven entries before appending that recipient: at most eight total forums.
Immediate sender must be the origin or an admitted relay; recipient and allowed
origin must match source assignment and local receiving approval. Repeated/
already-present recipient is relay_loop; exceeding eight is relay_path_limit.
Path alone is not authority. Original event/sequence and exact immutable fields
deduplicate independently of route path.

NetworkFeed uses the CMS pinned initial snapshot/high-water-mark/changes
mechanism, with one monotonic delivery_sequence per directed export. An initial
item is the latest admitted revision; concurrent publication/grant/withdraw
changes after its mark remain in changes. Origin sequence orders one origin
publication, not events from unrelated forums. Recipients durably stage every
event before cursor advancement. Revocation/scope loss prevents obsolete body
reads; minimal controls remain available for known deliveries when normal
publication policy is paused but credential/control scope remains enabled.
Expired cursors require fresh scoped snapshot plus durable mapping reconciliation;
absence from one page is not removal evidence.

One recipient-local mapping is unique on local forum + original forum/topic.
Agreeing direct and relayed routes share its native topic, first post and Bridge
resource; each route has its own delivery/work/receipt. Origin event/revision
disagreement in any immutable field or bytes is origin_event_conflict/attention.
Older origin events cannot revert a newer native result. Source owns only the
managed title/first-post publication; category placement, local replies, native
users and moderation remain local. Unexpected managed native edits are
native_local_edit_conflict, never an overwrite or a new duplicate topic.

NET-15..19 use the shared durable work/lease/three-attempt discipline, with
NetworkAction publish_revision, withdraw or apply_consent. Network work is
dynamic only, never deployed/static prepared. Publish records synchronized
then verified; withdrawal/consent may atomically record durable application
and matching verification from leased. Exact allowed edges are
network_work_transitions; terminal work is never reset. NET-22 native-admin
retry starts a new audited cycle only from attention after safe reconciliation.

Source lease generations are durable per delivery. They are not globally
comparable across peers. All paths serialize through one recipient-native
mapping fence and durable mutation journal, preserving native_fence_generation
across restart/retry/new work. Under the native lock, recheck origin order,
ownership, expected native revision, current grant, local policy and local
fence before a write. Native recovery after lost report finds the same object/
receipt; it cannot blind-create again. NetworkNativeReceipt's declared scalar
fields use the shared length-prefixed fingerprint serialization, without
secret/lease token. Receipt hashes are provenance, not independent proof.

Source work records per-hop scoped recipient reports. NET-20/21 show that hop
only. A hub separately retains every admitted downstream dependency/work/
receipt and withdrawal status, including after route removal or policy change.
An upstream success never means every spoke succeeded. Local mappings and
route dependencies retain origin/native/resource identities and unresolved
control tombstones while they exist; detailed settled work/audit >=365 days,
settled bodies/events >=30 days, and unresolved bodies/control cannot be evicted.

### Source conversation and native local replies

One received topic contains managed publication/provenance, Discussion at
[Source Forum], then Discuss here at [Local Forum]. The source panel is a
read-only projection; its source reply action opens the original topic/post
in a new tab with source login/posting. Local Reply/Quote uses native local
composer, actual local permissions and a visible stays-here statement. No
generic action silently chooses a forum, foreign source post becomes a native
local parent, username merge, cross-forum account creation or inline source
write endpoint is present. Source posts do not affect native local post counts,
unread or notifications. Every author/profile link keeps its owning forum.

NET-25 reads latest20 source-public replies initially, bounded older pagination,
known count or null (never unknown-as-zero), origin reply IDs/revisions/parent
context and a snapshot cursor. Requested limit1..100. Source post numbers are
descriptive, not local positions. First post is the managed publication, not
duplicated in the reply panel. NET-27 fetches complete cooked reply bytes with
bounded chunks and source hash validation; large reply bodies are not stuffed
into the metadata response. Native local post creation is forbidden here.

NET-26 is one connection-wide initial/change stream using the pinned snapshot/
checkpoint discipline. Initial seeds the current latest20 visible replies per
admitted publication through bounded pages. A per-topic page's checkpoint is
a consistency watermark for that topic: it must not advance the connection-wide
cursor past other topics. Persist connection changes before advancing. Source
discussion_sequence is monotonic per original conversation; relay preserves
original event/post/revision order. Editing/deleting/moderating/privacy changes
send upsert/minimal tombstones; never a newly private/deleted body. Source
conversation authority remains the original forum, not relay-owned replies.

The projection profile db-source-discussion-html-1 verifies original source
bytes before native-safe rendering. Allowed structural tags: p, br, strong, em,
s, u, del, blockquote, pre, code, ul, ol, li, h1..h6, hr, table, thead, tbody,
tfoot, tr, th, td, a, img, span, div, details, summary, sub and sup. Permit only
native-recognized language/code/Mermaid/math class markers, table span numbers,
escaped title/alt, safe HTTPS href/src and native-owned public upload references.
No scripts, event handlers, arbitrary styles, forms/inputs, iframe/object/embed
or executable SVG/MathML from a peer. External source reply links use noopener/
noreferrer. Unsupported meaningful content is an explicit unavailable/attention
state, not a false empty conversation. Trusted rendering JS/CSS is local native
code; remote snippets cannot supply executable enhancements.

Use a shared server-side scoped cache and native bounded jobs, not a polling
loop per reader/topic. Default network poll60 seconds, connect deadline10 and
response deadline30 seconds; source mutation attempts remain three/30/120.
Source responses carry server_time or checked_at and expiry300 seconds later.
Recipient records its own monotonic receipt time and never extends lifetime
beyond300 seconds, even if a peer clock is ahead. Known revocation/privacy/
scope loss invalidates ordinary display immediately. An interrupted read may
show clearly stale cache only while authority is still valid. After expiry,
hide source projection and deny new local replies until current permission is
refreshed. Cache bodies retain at most24 hours while authorized, independently
of longer publication-event retention. Purged/tombstoned bodies do not reappear
on stale snapshots. A timeout is not an empty source.

NET-30 serves the ordinary-reader projection from this shared native cache,
not an upstream request triggered by a page view. Normal local topic permission
is required even when a source was public. NetworkReaderProjection separates
source/local forum labels, current cache state, actual post metadata, rendered
body descriptors, known count and bilateral-local-discussion versus viewer
reply rights. warming/unavailable uses empty items/null count with an explicit
state, never a claim that the source has no replies. NET-31 returns exact cached
sanitized body chunks bound to local topic/source post/revision/cache revision;
recheck normal topic access and source authority on every chunk. Assemble and
verify complete sanitized bytes before display. These endpoints never expose
connection/grant lists, secrets or browser upstream-fetch authority. Native
anonymous readers are allowed only when normal public-topic rights allow them.

### Bilateral local discussion consent

Source policy.allow_local_discussion defaults false, recipient
local_discussion_enabled defaults false, and native topic override defaults
inherit. Origin per-receiving-forum grant plus per-source-topic denial determines
effective source permission; relays cannot broaden it. Recipient admin can
enable/disable per connection and use NET-24 per-topic override only inside
current source permission. Effective new-reply permission is source permit AND
recipient setting/override AND native topic/user/moderation rights. Unknown/
expired permission or known revocation forces false. Native server-side posting
authorization enforces this even if a reader bypasses UI controls.

apply_consent work/durable grant updates refresh policy without rewriting
publication or local posts. Removing source discussion permission or local
enablement stops new local replies, retains old native replies for local
reading/moderation, and does not send them to the source. It is not publication
retraction. Source permission grants no control of recipient accounts, old
posts or local moderation, and cannot prohibit unrelated independent discussion
outside this managed publishing relationship.

### Withdrawal and visibility proof

Pause stops normal publication without claiming existing copies removed.
Revocation stops credential authority immediately, but cannot prove an offline
recipient erased content. Explicit origin_retraction carries origin event
sequence and minimal reason; only the original network forum can originate it.
Deletion/privacy/unpublish/ineligibility must create a control even when the
ordinary worker can no longer read the source. Never put private body/title/
authors in a tombstone. Route removal has null origin event fields and cannot
pretend the original globally withdrew.

Known origin retraction supersedes obsolete work, disables source projection/
new local replies and queues durable native hiding of the whole owned mirrored
topic and local replies. Native posts and moderation remain; a public stub alone
is insufficient because local quotes may contain source content. Source/relay
retains all downstream dependencies and reports pending/offline/disconnected
removal as attention. Connection revocation before completion needs separately
authorized local action, not a new remote credential.

Route removal may retain the same local topic only with another current
original-source-authorized route and corresponding public proof. Otherwise
last-route removal requires hidden proof. NetworkWithdrawAck's proof branches
are exclusive: remaining_authorized_route true requires remaining public proof
and null hidden proof; false requires hidden proof and null remaining-route
proof. Origin retraction always requires false. No native post deletion.

db-discourse-network-public-1 checks the actual ordinary-reader native topic/
first post, preserved binding/revision, managed publication/provenance and
selected source/local controls. Expected and observed owned rendered-fragment
hashes must match normal native cooked output, not just a copied source SHA
marker. Source bytes and local recooked bytes are distinct. checked_at is after
sync and <=300 seconds ahead of source receipt time; report time and receipt
time remain distinct. This is a scoped recipient report, not independent source
verification of another forum. Later qualification requires independent readers.

db-discourse-network-hidden-1 verifies anonymous and ordinary nonstaff member
access denied for the whole mirrored topic/replies/projection, ordinary topic
lists/search/feed excerpts removed, and native local posts/moderation retained.
The component packet defines native visibility/cache/search hooks and negative
reader contexts; no CMS404/410-only absence rule is misapplied. A timeout or
partly hidden first post is not proof. Off-forum copies/quotes not owned by this
mapping and independent offline forums are not claimed as globally erased.

NET-28 lists only explicitly advertised, currently public verified related
topics within approved origin/recipient scope, each labelled by actual discussion
owner. advertise_related_discussion defaults false. Listing a link does not
enable another forum's reply panel or authorize private access/federation.

### Network limits and errors

Shared transport/page/chunk/cursor bounds apply. Additional proposed constants:
eight forums including final recipient, source permission/cache authority300s,
poll60s, latest20 replies, older page<=100, per-upload8MiB, connect10s/
response30s, authorized read-cache body retention24h. Native constraints may
narrow these but cannot silently relax identity, consent or content meaning.
Counter exhaustion/unsupported metadata is explicit attention, never wrap/
truncation. Network raw/cooked content remains uncapped by transport.

- `peer_identity_conflict`: HTTP409, permanent/actionable, not automatically transient.
- `peer_origin_changed`: HTTP409, permanent/actionable, not automatically transient.
- `network_not_enrolled`: HTTP403, permanent/actionable, not automatically transient.
- `recipient_policy_denied`: HTTP403, permanent/actionable, not automatically transient.
- `origin_not_admitted`: HTTP403, permanent/actionable, not automatically transient.
- `relay_not_authorized`: HTTP403, permanent/actionable, not automatically transient.
- `relay_loop`: HTTP409, permanent/actionable, not automatically transient.
- `relay_path_limit`: HTTP422, permanent/actionable, not automatically transient.
- `origin_event_conflict`: HTTP409, permanent/actionable, not automatically transient.
- `native_local_edit_conflict`: HTTP409, permanent/actionable, not automatically transient.
- `source_discussion_unavailable`: HTTP503, permanent/actionable, not automatically transient.
- `discussion_consent_denied`: HTTP403, permanent/actionable, not automatically transient.
- `discussion_authority_expired`: HTTP409, permanent/actionable, not automatically transient.
- `asset_not_admitted`: HTTP403, permanent/actionable, not automatically transient.
- `asset_limit_exceeded`: HTTP422, permanent/actionable, not automatically transient.
- `rich_content_unsupported`: HTTP422, permanent/actionable, not automatically transient.
- `native_visibility_verification_failed`: HTTP409, permanent/actionable, not automatically transient.

Only shared rate_limited/transport_timeout/native_service_unavailable are
automatically transient. Safe detail is redacted and connection-scoped; failure
classification cannot be overridden by a caller. No operator/entitlement errors
remain. Runtime tests and formal review are not performed by this packet.

## Migration and release boundary

The specification is a protocol proposal, not an Alpha.30 database migration design or platform implementation. Before a dependent candidate starts, Phil must approve the exact packet, assign a fresh immutable release identity, and authorize the local freeze under applicable review requirements. No reused tag, branch-only executable identity, or changed released Alpha.20 file is allowed.

The exact approval/freeze candidate includes preserved Alpha.20 bytes/fixtures,
CMS/network types/semantics/routes,103 positive shape fixtures,30 negative shape
fixtures,2 malformed raw JSON cases,80 planned runtime cases and the fresh
requirement/change/test matrix. Runtime cases remain NOT_RUN; document checks
are not conformance or formal review. No Operator Service dependency remains.

Plugin migrations begin from exact Alpha.30. Adapter packets begin from their listed clean baselines. Each packet must specify schema/files, native locking/ownership/fencing, source-revision initialization/adoption, exact presentation and verifier profiles, disabled-state behavior, state retention, failure/partial migration, normal package install/update, and protected backup/rollback. No later migration chain or trash code may be imported as a shortcut.

The same exact shared-plugin artifact must qualify the seven native-platform
destination profiles plus proposed Discourse network roles; Statamic Flat/DB/SSG
use one addon but separate native profile evidence. Network qualification uses
one hub and two spokes, separately from CMS qualification. Set-and-forget means
durable initial-to-continuing progress through normal native scheduling, not
repeated manual starts. No task may claim readiness merely from these proposals.

Sandbox qualification comes before a new valid main. GitHub remains unchanged now. Update main to exact accepted/tested artifacts before non-sandbox deployment; remote trash disposition awaits exact agreed targets at that point. No commit, tag, push, CMS login, installation, migration, test run, or deployment is performed or authorized by writing this proposal.
