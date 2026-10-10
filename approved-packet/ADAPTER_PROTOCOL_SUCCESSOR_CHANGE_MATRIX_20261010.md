# DiscussionBridge successor contract change matrix and work document

**Updated:** 2026-10-10  
**Status:** CF01 approved by Phil; exact contract-foundation draft prepared,
document shapes checked, awaiting Phil's exact approval. Not a release.
**Purpose:** Connect every foundation requirement to its proposed contract
change, affected component and required evidence. This is a fresh matrix, not
the discarded September27 matrix or a reconstruction of later code.

## Authority and boundaries

Phil approved the plan with "Proposal approved, please proceed" after confirming
that foundation/publishing are the main work accompanied by this fresh matrix,
and the Hub uses the same shared plugin. Authority is the protected September27
Work List, exact Alpha.20 contract, and recorded P01/H-D01a/CF01 decisions.
Historical supporting records/trash are not working authority or implementation
sources. The completed Post-OBBBA Backfill Fix is not reopened.

CF01 expressly adds Discourse platform/recipient/hub scope now, superseding the
protected Work List's future/outside-recovery network boundary for this work.
It excludes the invented Operator Service control design; inherited references
to that direction do not revive it. The protected original is not edited.
The same DiscussionBridge plugin supplies all forum roles; no separate Hub,
Publisher or Recipient plugin and no central broker/remote publishing service.

This matrix describes required/proposed changes, not a code-gap diagnosis or
finding that a baseline already implements/does not implement native behavior.
Baseline code remains untouched. Contract data are in the
[typed artifact](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_PROPOSAL_20261009.json)
and [semantic specification](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md).
Evidence/runtime cases are in
[conformance cases](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_CONFORMANCE_CASES_20261009.json).
Rows remain exact-contract candidates; implementation, native profiles and
runtime evidence are AWAITING DEPENDENCY.

## Requirement and change matrix

P01..P14 denote successor semantic sections; H01..H14 denote Hub requirements.
C01..C44 IDs retain earlier CMS identity (removed C36..42 were the invented
control cases). NET-C01..43 are newly planned network cases. Range notation
includes each intervening ID. Native implementation is not authorized by a row.

| ID | Authority | Baseline contract or ownership basis | Proposed change or preservation | Affected components | Exact artifact or surface | Required evidence |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | P01 / CF01 | Alpha.20 auth/resolve/inventory/detail and six fixtures | PRESERVE exact v1 bytes/meaning; new behavior explicitly v2 | All | V2-01..32; v1 unchanged | C01 |
| M02 | Work List / CF01 | No approved mandatory identity header | Diagnostic labels only; one credential-owned profile/scope | Plugin + all adapters | Connection/CmsProfile; authentication | C02,C03 |
| M03 | Work List / CF01 | Direction/origin/lane credential authority | Current auth/scope/policy on every read/mutation/replay | Plugin + all adapters | v2 authentication/replay | C02,C03,NET-C03..05 |
| M04 | Work List / CF01 | Native owner boundaries | Native storage/locks/render/build/deploy/moderation remain native; no broker/control service | All | Ownership section; native profiles | C16,C44,NET-C11,NET-C42 |
| M05 | Work List / CF01 | New revisions/times not in Alpha.20 contract | Immutable normal/wiki revisions; actual created/updated/synchronized/publicly-verified times | Plugin + all adapters | Source/ToRecord/NetworkRevision; receipts | C04,C05,NET-C11 |
| M06 | Work List / CF01 | v1 From-Discourse cooked detail | Full revision chunks/hash/count; native-only excerpt constraint | Plugin + seven destination profiles | ContentChunk/Representation; V2-07 | C06,C07,C09 |
| M07 | Alpha.20 / CF01 | 49152 HTML /65536 JSON resolve | Keep limit; valid oversized sanitized excerpt + canonical Read More | Plugin + seven source profiles | ToResolve/ToRepresentation; V2-02 | C08 |
| M08 | Work List / CF01 | Bounded v1 inventory, not new feed | Pinned initial->changes checkpoint, resumable staging/expiry/reconciliation | Plugin + all adapters | SourceFeed; V2-06 | C10..13 |
| M09 | Work List / CF01 | Stable baseline bindings | Separate destination mapping; exact explicit adoption; no conversion/unowned overwrite | Plugin + all adapters | Mapping/NativeOwnershipReceipt; V2-09..13 | C14..16 |
| M10 | Work List / CF01 | Baseline canonical identity fail closed | Verified same-origin source/presentation URL transactions and retained reservations | Plugin + all adapters | UrlMove/SourceUrlMove; V2-22..24,29..32 | C17..19 |
| M11 | Work List / CF01 | No later queue adopted | Durable work, idempotent receipts, native journal/fence/recovery | Plugin + all adapters | Work/LeaseAuthority; V2-14..18 | C20..22 |
| M12 | Work List / CF01 | Three attempts required | Initial included;300 s lease,30/120 retries, terminal attention; native-admin explicit new cycle | Plugin + all adapters | bounds/work_transitions | C23..25 |
| M13 | Work List / CF01 | Truthful dynamic result | Sync not complete; exact native/public representation verification | Ghost, Statamic Flat/DB, WordPress + dynamic consumers | SyncResult/Verification; V2-17 | C26 |
| M14 | Work List / CF01 | Static native build/deploy ownership | Prepare/deploy/verify/finalize or protected abort; no false preparation success | Astro/Hugo/Statamic SSG + static consumers | StaticPreparation/Finalize/Abort; V2-19..21 | C27,C29 |
| M15 | Work List / CF01 | Binding withdrawal distinct from content | CMS public absence proof404/410; To-Discourse binding withdrawal does not hide topic | Plugin + all adapters | WithdrawInput/AbsentVerification | C28,C30,C31 |
| M16 | Work List / CF01 | Simple/Full/Interactive kept | Actual configured discussion, no fullInteractive alias/provenance-only downgrade | All profiles | Mode/Policy; native presentation obligations | C32 |
| M17 | Work List / CF01 | Generic forum naming required | Optional valid override else native title; invalid explicit value attention; no new plugin dependency for plugin-free profiles | All | forum_name; DISCUSSIONBRIDGE_FORUM_NAME | C33 |
| M18 | Work List / CF01 | Catalog exact authority undefined | Optional descriptive authors/taxonomy; atomic bounded snapshots; admin-written policy/native refresh only | Plugin + all adapters | Catalog*/Policy; V2-25..28 | C34,C35 |
| M19 | Work List / CF01 | Seven exact baselines | No later migrations imported; exact later component migration/adoption/backup/rollback packet required | All | Migration boundary | C43 |
| M20 | Phil role direction / CF01 | Alpha.30 enum alone not network proof | One shared plugin source/recipient/relay, explicit setup and both directed peer approvals, default-off | Shared plugin on every forum | NetworkIdentity/Peer/Connection/ReceivePolicy; NET-01..09 | NET-C01..05,NET-C39 |
| M21 | CF01 | No Alpha.20 network grant | Origin grants named recipients/relays; recipient independently approves public receiving policy | Shared plugin | NetworkGrant/SourcePolicy/ReceivePolicy | NET-C03,NET-C28,NET-C36 |
| M22 | H02/H04 / CF01 | Native/source/local identities distinct | Origin key/events/native CMS binding/canonical survive relay; visible origin/local/via/direction | Shared plugin | NetworkRevision/NativeOrigin/Provenance | NET-C06,NET-C07 |
| M23 | H03 / CF01 | No accepted multiple-path mapping | One recipient topic per origin; distinct route receipts; conflict attention | Shared plugin | NetworkLocalMapping/Delivery/NativeReceipt | NET-C08..10 |
| M24 | H05 / CF01 | Native local replies/moderation owned locally | Update managed title/first post only; unexpected local edit guarded; no silent derivative | Shared plugin | NetworkSyncReceipt/NativeReceipt | NET-C11,NET-C12 |
| M25 | H08/H09 / CF01 | Network continuation not specified by old CMS schema | Scoped native jobs/feed/chunk/claim/renew/ack/fail; dynamic state/three-attempt recovery | Shared plugin | NET-10..19; network_work_transitions | NET-C13..16 |
| M26 | H10 / CF01 | No accepted relay path schema | Approved origin/relay ceiling plus loop/path<=8 and independent origin-event dedup | Shared plugin | NetworkGrant/Provenance | NET-C08,NET-C09,NET-C35,NET-C36 |
| M27 | H11 / CF01 | A hub receipt cannot prove spoke | Verified per-hop result and retained downstream dependency/status | Shared plugin | NetworkDelivery/WorkStatus; NET-20..22 | NET-C17,NET-C34 |
| M28 | H12 / CF01 | Preserved resolve48 KiB not full forum lane | Separate full raw/cooked bounded-chunk network lane; real native-limit fallback only | Shared plugin | NetworkRevision/ContentChunk/Representation; NET-11..12 | NET-C18,NET-C19 |
| M29 | H12 / CF01 | Native rich content/assets retained | Native import/cook and public owned-upload transport; explicit MIME/8 MiB/deadline bounds; unsupported attention | Shared plugin | NetworkAsset*/Feature; NET-13..14; semantic profiles | NET-C20,NET-C21 |
| M30 | H06 / CF01 | No accepted source reply projection API | Read-only origin-owned posts/author/revisions/cursors/tombstones/shared cache; no native post conversion | Shared plugin | NetworkDiscussion*; NET-25..27 | NET-C22,NET-C24..26 |
| M31 | H06/H14 / CF01 | Display/controls now selected | One topic: publication/source panel/local replies; actual forum labels and distinct source-link/local-composer actions | Shared plugin | Hub section9A; projection/public proof | NET-C22,NET-C23 |
| M32 | H-D01a / CF01 | Bilateral consent principle already approved | Both defaults off, source receiving-forum/topic ceiling plus recipient connection/topic setting; native server guard/current authority | Shared plugin | NetworkGrant/LocalPolicy/ConsentProof; NET-24 | NET-C27,NET-C28,NET-C30 |
| M33 | CF01 consent lifecycle | Existing local posts remain locally owned | Permission loss stops new local replies; old replies retained/readable unless separate retraction/privacy | Shared plugin | apply_consent/NetworkConsentAck | NET-C29,NET-C30 |
| M34 | H13 / CF01 | Network retraction not CMS binding withdrawal | Minimal origin/route tombstone; whole topic/replies hidden proof; last-route logic/offline attention, no deletion/global-erasure claim | Shared plugin | NetworkWithdrawal/HiddenProof/WithdrawAck; NET-29 | NET-C31..34 |
| M35 | H07/H14 / CF01 | Related foreign conversations not merged | Only opted-in approved public verified discussion links; not another reply panel | Shared plugin | NetworkRelatedPage; NET-28 | NET-C37 |
| M36 | H14 / CF01 | Native administration/status kept | Read-only preview; truthful pending/sync/verified/attention; native admin retry/pause/revoke/withdraw | Shared plugin | NET-07..09,22..24,29; native UI | NET-C38 |
| M37 | Work List / CF01 | Baseline packages, not new candidates | One plugin/artifact per adapter; normal install/update; native presentation/rich assets/ownership/journals/verifiers | All | Component obligations below | C44,NET-C39,NET-C42 |
| M38 | Work List / CF01 | OBBBA backfill historical complete | New generic OBBBA-class initial/continuing acceptance for seven destination profiles; no backfill reopening/literals | Plugin + seven destination profiles | Qualification plan below | C44,NET-C40 |
| M39 | Work List / CF01 | Seven1000 native source corpus requirement | Sequential1000 /profile into isolated sandbox categories;7000 records/topics; canary/replay/restart/edit/withdraw/rollback | Plugin + seven source profiles | Qualification plan below | C44,NET-C40 |
| M40 | Phil Hub addition / CF01 | Old future/outside scope superseded only here | Separate one-hub/two-spoke all-origin/all-direction/relay/local discussion/network qualification | Shared plugin | NET-C01..43; qualification plan | NET-C40 |
| M41 | Phil clarification / CF01 | Invented Operator Service controls excluded | Remove active control fields/types/errors/examples/cases; support separate, existing download unchanged/unqualified | All | excluded_features; no remote-control dependency | NET-C38,NET-C41 |
| M42 | Phil reset/delivery direction / CF01 | GitHub unchanged; clean checkout sources | Exact packet approval/release identity/freeze before components; sandbox before new valid main/non-sandbox; exact later remote cleanup targets | All | Release boundary; checkpoint | C43,C44,NET-C39 |
| M43 | Alpha.20 transport / CF01 | Strict v2 descriptive grammar proposed | Closed shapes, safe integers/IDs/UTF-8/HTTPS/base64/date/bounds/auth-before-resource; replay guards | All | DB-PROPOSED-TYPES-1; Error | 30 shape negatives +2 raw JSON cases |

| M44 | H06/H14 / CF01 | Browser uses native read permissions, not peer credentials | Guarded shared-cache source panel/body chunks; no page-triggered upstream fetch or expired/private body | Shared plugin | NetworkReaderProjection/RenderedChunk; NET-30..31 | NET-C43 |

## Native component obligations

These are obligations for later explicitly authorized component packets, not
permission to salvage old code or change these checkouts. Persistence, rendering,
public pagination, builds and deployment are platform-owned. Each native packet
must make the selected mode functional, specify precise schema/config/files,
locks/fences/ownership/journal, native verifier/asset profiles, migration and
initial v1->v2 metadata reconciliation, disabled-state/data retention, packaging,
backup/rollback and qualification. Unknown native gaps must be inspected then,
not invented in this matrix.

| Component and exact baseline | Native obligations carried by its future packet |
| --- | --- |
| Contract Alpha.20 27197b7472cb2486993c8b01b4a4282d8697f478 | Preserve contract/README/six fixtures; exact approved v2 schema/semantics/fixtures/conformance; new immutable version without replacing an old tag. |
| Shared plugin Alpha.30 9e64b4a83d5fd439ffa19e59edbc9682adb2c536 | Credential scope/admin UI; current normal/wiki revision lifecycle; native users/topics/receipts/migrations/jobs; source, recipient and relay; source projection/local reply guard; public/hidden visibility profiles. One artifact everywhere. |
| Astro Alpha.21 f2a60e4a7688fac321a3c0b687e24b2f296c1685 | Stable native files/route identity, bounded scanning/lazy parsing, safe symlink/collision/atomic recovery; actual discussion components/rich assets through normal install and navigation; native static build/deploy/verification and archives. Plugin-free established paths retained. |
| Ghost Alpha.24 f8b481f9fc899941a713d73894c50e97223590a2 | One native publication-state authority for posts/pages, exact lookup/ownership/URL moves, atomic durable recovery, native timestamps/Latest, real modes/rich assets and normal Linux service/theme integration. No command replacement/parallel publication engine. |
| Hugo Alpha.20 51c077dc587c6b18064577b3a209ce20f82d0f46 | Stable external/native file identity, atomic locks/journal/URL moves; packaged discussion shortcode/assets, maintainable rich rendering/native archives; protected static prepare/build/deploy/verify/finalize/abort. |
| Statamic Alpha.29 f10e9ee620811f8a9d9285ca4d085170bb3a52ec | One addon, Flat native files vs DB transactions vs SSG authoring/generated output; installed discussion frame/rich assets, cache freshness, stable entry IDs, native authors/taxonomy; SSG protected static transaction. Each profile qualifies independently. |
| WordPress Alpha.28 9597f3c7d28e143e336c8ae92a24a561e1336dc0 | Native post/meta identity, block/shortcode/site/per-post mode and comment suppression, source dates/Latest, bounded durable retry/withdrawal/URL journal, normal rich-asset enqueue and reproducible ZIP; activation default-off. |

Consumer theme/navigation/branding/header/footer and platform-deployment defects
stay outside adapter-contract changes. They may be listed for later native work
but do not authorize changes now. The inherited Work List's component checklists
remain the detailed requirement source, with explicit CF01 scope corrections.

## Qualification plan and evidence gates

Every runtime case is NOT_RUN. Shape fixtures or green document checks do not
prove endpoint behavior, cryptography, native ownership, content/visibility,
migration, packaging or live qualification. No prior review/CI disposition is
carried forward. Any later code review must first read the full controlling
Code Review Doctrine and verify its specified identity; no review disposition
is issued here.

1. Contract checks: preserve Alpha.20 fixture meanings/bytes and existing v1
   clients without new headers; validate all declared references, route input/
   query/response coverage, error/status choices and positive/negative data.
   Include malformed/duplicate/raw JSON parsing, bounds, replay, policy and
   state semantics in actual future conformance, not only shape checks.
2. Component unit/native integration: identity/ownership/collision, clocks,
   normal/wiki revisions, body/hash boundaries, feed concurrency/restart,
   lease fences, three-attempt ceiling, transactions/rollback/URL ancestry,
   modes/naming/rich content and no-secret output. Native files/database/
   renderer verifier evidence differs by platform and is never replaced by
   a receiver acknowledgment.
3. Normal install/update: one immutable shared plugin and one artifact per
   adapter, including one Statamic addon for Flat/DB/SSG. Test clean installs
   and upgrades from these exact baselines with existing records/state, disabled
   behavior, partial migration and protected restoration. No demo/source-tree
   wrapper or manual patch counts as packaging.
4. Discourse-to-platform acceptance: one generic large OBBBA-class corpus,
   independent Astro/Ghost/Hugo/Statamic Flat/DB/SSG/WordPress destinations;
   start initial once then bounded automatic continuing normal/wiki updates,
   large-topic content, restart/transient recovery/terminal attention, stable
   IDs/native dates/modes/rich assets/pagination and public verification.
   No hard-coded OBBBA scope or routine restart/babysitting requirement.
5. Platform-to-Discourse acceptance: deterministic1000 native items/profile,
   seven profiles run sequentially through isolated non-indexable sandbox
   categories/connections. Corpus includes reproducible fake/Latin prose,
   tables/Mermaid/math/code/Unicode,48 KiB boundaries and separate negatives.
   Require7000 reconciled native items/Bridge Records/topics, plus canary,
   exact replay, interruption/restart, edit/wiki, URL move, withdrawal,
   ambiguity, health, backup and rollback evidence. No permanent synthetic sites.
6. Separate network acceptance: one hub and two spokes with identical plugin
   artifact, explicit peer/direction approval. Every forum originates/receives,
   Hub routes approved A->Hub->B without re-origin; edits preserve topics,
   local discussion follows all consent combinations and clear reply actions,
   source projection changes/moderation/privacy work, paths/dedup/fences/lost
   receipts/retries behave, retraction hides whole topics/replies, and offline
   dependencies stay attention. Inspect provenance/direction/canonical/local
   forum and source/local discussion boundary as ordinary readers.
7. Delivery gates: approve exact central contract and new immutable identity;
   separately authorize freeze and baseline-derived implementations/review;
   controlled backups/sandbox qualification; approve/update a new valid main
   to exact accepted artifacts before non-sandbox deployment. Remote cleanup
   only after that main and exact approved targets. No remote mutation now.

## Technical selections awaiting exact packet approval

The approved product direction is not repeated as a new permission request.
Exact fields/routes/proofs and proposed values return together: snapshot24h,
event/settled body/mutation receipt retention30 days, lease300 s, retry30/120
with Retry-After<=3600 s, audit>=365 days; network path<=8 including recipient,
authority300 s/poll60 s, latest20/older<=100, public owned asset<=8 MiB with the
specified native MIME profile, request connect10 s/response30 s, authorized
discussion cache24h, and versioned native import/public/hidden/projection profiles.
No universal From-Discourse/network publication-size cap.

## Execution status and current evidence

| Work | Status | Result and next gate |
| --- | --- | --- |
| CF01 direction and fresh matrix authority | APPROVED BY PHIL 2026-10-10 | Whole proposal-completion sequence authorized; exact contract approval/freeze still separate. |
| Exact CMS/network contract drafting | AWAITING APPROVAL | 63 routes/252 types/58 errors prepared; operator-control members removed. Exact packet and release identity are the next gate. |
| Fixtures/test linkage | DRAFT PREPARED | 103 positive shapes accepted and 30 negative shapes rejected by document checks; route/type linkage checked. Two raw JSON negatives and 80 runtime cases remain NOT_RUN. |
| Native candidates/install/update/sandbox | AWAITING DEPENDENCY | Exact contract approval, immutable identity and applicable implementation/review/environment authority. |
| GitHub/main/cleanup/non-sandbox | AWAITING DEPENDENCY | No remote changes; approved later gates above. |

The working copied Work List is the successor checkpoint and mutation ledger:
[Bridge Builder working copy](C:/CodeProjects/Products/DiscussionBridge/planning/DISCUSSIONBRIDGE_COMPONENT_WORK_LIST_2026-09-27_BRIDGE_BUILDER_WORKING_COPY.md).

## Document checks recorded 2026-10-10

All three active JSON artifacts were read back and parsed. Type-reference,
unique-ID, route input/query/response fixture coverage and error-enumeration
checks found no missing/dangling reference or duplicate case/route ID. The
checker accepted all 103 positive field shapes and rejected all 30 negative
shapes. The 39-byte content example's UTF-8 length, SHA-256 and canonical base64
were independently recomputed and agree. These checks cover declared primitive,
closed-object/array/enum/union shapes, not all prose semantic rules.

Both malformed raw JSON cases and all 80 planned runtime cases remain NOT_RUN.
No native/publication/visibility/cryptographic/migration/package/scale evidence
or formal code-review disposition is supplied by these document checks.

All seven exact HEAD/tree identities matched and git statuses were empty after
drafting. Alpha.20 contract/README/six fixture hashes are unchanged. Protected
Work List is 51,468 bytes with its fixed hash; inherited working-copy text from
the line-anchored Prepared line through EOF remains identical. Current artifact
hashes and authorization boundaries are in the working checkpoint.
