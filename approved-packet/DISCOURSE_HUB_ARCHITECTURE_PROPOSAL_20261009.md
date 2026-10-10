# DiscussionBridge Discourse Hub — architecture and contract proposal

**Revision:** 4 — 2026-10-10  
**Status:** CF01 product architecture/reader-control/consent directions approved by Phil; exact wire candidate awaiting approval; not frozen or implemented
**Authority for this work:** Phil approved CF01 and directed proceeding on 2026-10-10, after confirming the Hub is part of the same shared plugin. P01 and H-D01a remain approved. Exact engineering values/wire and freeze/implementation retain their later approval gates.

## Product outcome

Make a Discourse forum a working content and discussion-network hub, not merely
a place to switch community identities. An administrator can connect forums,
choose which content travels in each direction, publish an initial collection,
and leave continuing publication running. Readers can see what came from each
forum, what was received locally, and which forum owns each discussion.

The official [Discourse Hub app](https://www.discourse.org/app) describes
multi-community access, discovery, notifications, posting and replying. This
proposal is a different capability: administrator-authorized publication,
revision synchronization and routing between independently operated forums.
It does not replace the mobile app, account system or native Discourse.

One identical DiscussionBridge plugin is installed everywhere. There is no
separate Hub, Publisher or Recipient plugin. A forum can be a source, recipient
and hub simultaneously, per connection and per publication policy. "Hub" is
a configured responsibility, not a privileged owner of other forums.

## 1. Same plugin; independent responsibilities

| Responsibility | What the plugin does on that forum |
| --- | --- |
| Discourse as Platform / source | Makes explicitly eligible native topics available as immutable publication revisions; sends subsequent edits and withdrawal events. |
| Discourse as recipient | Creates and maintains owned local topic copies through native Discourse, in locally approved categories; preserves local discussion and moderation. |
| Hub / relay | Receives eligible content from one forum, then makes that same origin-owned publication available to separately approved destinations. It does not turn the copy into a new original. |

Receiving and sending are independent switches. Relaying requires both, plus
an explicit route. Recipient role is not a fourth presentation mode: Simple,
Full and Interactive retain their existing meanings. The native local topic
provides a real discussion; provenance text alone is not a discussion feature.
Any embedded discussion presentation remains a separate selected capability.

Plugin installation does not enroll peers, enable publication/receipt/relay,
issue peer credentials or start network polling. An administrator's network
setup creates the forum's persistent network identity and approved connections.
Existing non-network features and preserved v1 clients are not reconfigured.

Each forum continues to own its users, authentication, categories, tags, topics,
posts, moderation, uploads, search, notifications, backups and runtime. The
plugin adds routing, publication bindings, synchronization work and status;
it does not usurp native Discourse or the native CMS/build/deployment owners.

## 2. What an actual hub does

Proposed example: a national forum is the hub; state/affiliate forums are
spokes. Each directed connection needs its own approval.

| Publication | Configured path | Result |
| --- | --- | --- |
| National announcement | Hub → Spoke A and Hub → Spoke B | Both receive independent local topics linked to the same original. |
| State A report | Spoke A → Hub | Hub receives the report and can discuss it locally. |
| State A report selected for wider circulation | Spoke A → Hub → Spoke B | B receives the original A publication, labelled "via Hub", not a fictitious Hub original. |
| State B report | Spoke B → Hub | Independent publication and discussion; it cannot overwrite A's report. |

A source can also have native-platform destinations. Existing CMS-to-Discourse
and Discourse-to-CMS publishing remain distinct paths with their established
ownership rules. A CMS-imported topic is not automatically eligible for the
forum network. If explicitly selected, retain its native canonical source and
existing Bridge identity; identify the first network forum separately from
the native content origin. Relaying never makes Discourse the CMS owner.

Routing policy selects permitted source forums, categories/tags and explicit
topic inclusion/exclusion, approved receiving categories, and whether an
imported publication may be relayed to particular peers. There is no implicit
"send everything to every connected forum" rule. Recipients may reject a
publication even when the sender permits it.

## 3. Pairing and two-way authority

Use Content Connections, not support-provider enrollment or a remote operator
service. The proposed network direction is unambiguous `source forum →
recipient forum`. Existing `to_discourse` / `from_discourse` labels alone do
not distinguish a Discourse-to-Discourse pair.

For A → Hub:

1. A's administrator approves the exact Hub peer identity/origin, eligible
   sources and whether further relay is permitted to named destinations.
2. Hub's administrator approves A's identity/origin, inbound scope, local
   destination category and attribution/presentation policy.
3. A issues a separate scoped Content Connection credential. Hub stores it
   server-side and pulls the admitted publication work from A. The credential
   permits only that export feed, its revision content and scoped receipts;
   it is not a native Discourse administrative API key.
4. Hub validates the current peer, source scope and its own receiving policy
   before native mutation. Either administrator can stop the relationship.

Hub → A is a separate directed connection with a separate credential and both
administrators' approval. "Two-way" must not create an implicit reverse grant.
Hub → B also needs B's receiving approval and any A-origin relay permission.
No credential is forwarded to another forum, native platform or browser.

Bind peer identity to the administrator-approved HTTPS origin. Reject redirect
or origin substitution, credential-bearing public URLs and arbitrary URL
fetches. Forum title is a display label, not identity. A hostname move needs
an explicit verified peer-rebinding procedure; a copied database retaining
another active forum's identity needs reconciliation before network activation.
No automatic discovery or advertised capability can enroll a peer.

## 4. Identities and provenance — proposed contract requirements H01–H04

**H01 — Roles and direction.** Add the `discourse` native profile and independent
source, recipient and relay responsibilities. Define source forum and recipient
forum explicitly in network connections. Existing v1 remains unchanged.

**H02 — Origin identity.** A native Discourse network publication is identified
by `(origin_forum_id, origin_topic_id)`, not by its URL, topic title or a hub's
local topic number. The forum ID is persistent; topic IDs use the v2 canonical
decimal-string type. Preserve an origin-issued event ID and monotonic event
sequence through every relay; revision text remains opaque. An imported native-platform publication additionally
retains its existing native-origin/resource binding and canonical native URL;
the first network forum is not mislabelled the authoritative content source.

**H03 — Local identity.** Maintain at most one active owned local network topic
per origin key on a receiving forum. It has its own immutable local topic,
first-post and Bridge resource IDs. Immediate-peer deliveries have separate
route/connection receipts. Two authorized paths carrying the same origin do
not create duplicate topics; they converge only when the exact origin,
revision, content and approved authority agree. Disagreement or route ownership
ambiguity requires attention, not arbitrary "latest arrival wins".

**H04 — Visible provenance.** Every received topic shows original source,
canonical source link, immediate sending forum / "via" path, current receiving
forum, last synchronized source revision/time, and a clear boundary before
the local discussion. Preserve origin across every relay. Foreign author
credit is descriptive, not a claim that a corresponding local account exists.
Discussion links must say which forum owns the conversation.

## 5. Managed content and native discussions — H05–H07

**H05 — Content ownership.** The origin owns the synchronized publication's
title/body and source authorship. A local, clearly identified bridge posting
account creates the recipient topic; do not create accounts, impersonate
foreign users, federate logins or import identity permissions automatically.

Only the managed title and first-post content are updated by an origin revision.
Local replies, local category placement, moderator actions and local metadata
are not overwritten. Ordinary local editing of synchronized content is guarded;
an unexpected native/moderator edit stops synchronization for reconciliation.
If an administrator deliberately creates a separately owned local derivative,
it gets a new local source identity and explicit attribution, not a silent
rewrite of the imported origin. No last-write-wins multi-master body editing.

**H06 — Discussion/consent principle APPROVED BY PHIL, 2026-10-09.** Phil
replied "agreed" to this restatement:

> A recipient displays the source publication and source conversation. It may
> also host its own local discussion in the same receiving topic, only when
> the source permits it and the recipient enables it. Local replies remain
> locally owned and moderated; they are not synchronized into the source
> conversation. Publishing can independently be one-way or two-way.

This is bilateral consent for local discussion, not bidirectional reply
synchronization. Displaying conversations together does not merge ownership.

Display the authoritative source
conversation on the receiving topic, with optional native local discussion
in that same receiving topic. "Discuss here" does not create another local
topic. Source replies retain their source forum's identity, ownership,
moderation and reply destination; local replies retain the receiving forum's.
Displaying both on one page does not convert source replies into native local
posts or create one synchronized writable conversation.

The grouped layout, explicit source/local reply actions, bilateral default-off
connection/topic controls and consent lifecycle are approved directions under
CF01. Exact wire/profile/limit choices are in the completed proposal packet,
not frozen runtime behavior. Source and local discussion remain independently
owned. Multi-writer reply federation and recipient-hosted source composition
are excluded; neither is a hidden substitute for this model.

A shared conversation would need a separately specified reply object and
origin-post identity, reply-parent mapping across copies, account attribution,
edit/delete/redaction/tombstone events, recipient consent, anti-abuse controls,
moderation conflicts, permission rules and delivery receipts. A forum-to-forum
topic copy cannot be claimed to provide those features. If Phil selects that
product, specify it in this contract before freeze rather than defer the choice
or disguise it as ordinary publication.

**H07 — Routing is not discussion ownership.** The hub can expose its own
discussion of an imported topic and link the related spoke discussions.
Listing a foreign discussion does not synchronize its posts. Received topics
are excluded from ordinary source discovery unless an explicit relay policy
selects them; a relay preserves the origin and cannot manufacture a new source.

## 6. Set-and-forget delivery — H08–H11

**H08 — Native recipient worker.** The same plugin runs a bounded server-side
receiving worker on each enabled recipient through the normal Discourse job
mechanism. Source jobs create durable revisions and admitted work; recipient
jobs claim work, pull the exact snapshot, create/update the native topic and
report a durable receipt. No visiting user, page render or browser session
drives delivery. Ordinary installation/update must install the worker as
part of the same plugin; no per-forum publisher addon or hand-started loop.

**H09 — Initial and continuing publication.** Use the proposal's durable initial
snapshot/change checkpoint, immutable revisions, hashes, work identities,
claims/leases and bounded retry discipline. Source revisions are ordered by
source events, not lexicographic revision text or clocks from different forums.
A receiver advances its feed cursor only after durably recording the work.
Replayed events and lost receipts cannot create a second topic or revert a
newer revision. Native locking/fencing and a durable mutation journal must
resolve a write whose acknowledgement was lost before another write occurs.

Three automatic attempts include the initial attempt. Exhaustion or permanent
failure produces actionable attention. An explicit authorized retry is audited;
polling or relay cannot defeat the ceiling. Retention must preserve outstanding
revisions and withdrawals; expired cursors trigger explicit scoped resync and
owned-mapping reconciliation, not re-creation or silent omission.

**H10 — Relay and loop prevention.** Preserve the origin key, origin revision,
canonical source and complete source hash. Each relay contributes its own
authenticated peer delivery record and ordered forum path. Reject a path that
already contains the receiving forum, repeats a forum or exceeds its specified
bound. The proposed exact packet bound is eight forums including the final recipient;
that engineering value still awaits exact packet approval. Never re-export a received copy as a new local original.
Deduplication and origin/revision ordering still apply across different paths;
a hop counter alone is insufficient.

The recipient trusts an explicitly approved immediate peer within a named
origin/relay ceiling, not arbitrary asserted origin fields. This is delegated
peer trust, not end-to-end cryptographic origin proof. Named origin and relay
scope is approved at each hop. A relay may narrow scope, never broaden the
origin's approved recipients. Later withdrawal or scope removal must reach
every recorded downstream delivery; the hub retains that dependency record.
Changing route policy does not turn a stale copy into an independent original.

**H11 — Honest completion.** A Discourse receipt proves the exact owned local
topic/revision is durably stored and its intended reader-facing representation
is verified in the recipient's native context. Enqueued, fetched or rendered
in preview is not success. These are dynamic native publications, not static
build/deploy transactions. Each hub hop completes independently: A → Hub
success is not Hub → B success. Display downstream pending/attention separately.

## 7. Content representation and assets — H12

The source snapshot contains the immutable complete source and sanitized
delivery representation with separate hashes/counts where the bytes differ.
The recipient handles content through native Discourse validation, cooking,
storage and upload ownership. Do not paste untrusted cooked HTML directly into
native post storage, impersonate the foreign cooking environment or assume
remote upload links remain safe and available.

**Recommended new network behavior:** Deliver the complete eligible native
Discourse publication through a distinct v2 network lane using bounded revision
chunks, not the existing To-Discourse resolve body. Transport bounds are not
publication-size caps. An actual recipient-native post limit must be identified
and tested; a destination that cannot accept the publication reports attention
or uses an explicitly selected, visibly labelled excerpt/Read More fallback.
It cannot silently claim a full copy. CF01 approves this new lane's product direction; its exact wire still awaits
packet approval and does not claim existing runtime behavior.

The existing 48 KiB To-Discourse resolve HTML rule and its valid bounded
excerpt/Read More behavior stay unchanged for preserved v1 and the proposed
native-platform resolve path. A CMS-imported excerpt does not supply the missing
complete CMS source. Network relay preserves that representation and canonical
source; it cannot invent full native content or fetch it with new authority.

For native Discourse network relay, retain the admitted immutable original
snapshot for outstanding onward work rather than reconstructing it from the
hub's locally cooked copy or excerpt. Preserve original hashes/events and
identify a different delivered representation separately. Storage exhaustion
must stop with attention; no silent eviction, truncation or hash substitution.

Native receiving design must specify the exact import/cook representation,
supported rich content, upload copying/link policy, attachment access checks,
external-fetch allowlists and byte/time bounds. Never fetch arbitrary URLs
found in content with peer credentials. Unsupported content goes to attention
or an explicitly approved representation fallback, never silent degradation.
An asset-copy pipeline is not implemented or proved by this architecture.

## 8. Visibility, withdrawal and loss of authority — H13

**CF01 approved initial network scope:** Publicly readable source
publications delivered into explicitly approved public categories. Private
messages, staff/private/group-restricted topics and automatic cross-forum
permission translation are excluded pending Phil's decision. Public-source
scope is not account federation. Exact enforcement/withdrawal wire is proposed,
not already implemented.

Native events must detect source deletion, privacy change, loss of eligibility
and intentional retraction, even if the source is no longer readable to the
publishing worker. Admit only a minimal authorized control/tombstone event;
do not expose newly private content in a publication feed.

Distinguish three administrator actions:

- **Pause:** stop new writes without claiming removal of existing public copies.
- **Withdraw/retract:** durably request hiding the owned mirrored topic from
  ordinary readers, retaining local replies and bindings for local moderation.
  Local replies/quotes can contain the retracted content: a public replacement
  stub alone is not sufficient evidence of removal.
- **Revoke credentials/connection:** immediately stop its API authority. This
  cannot guarantee an offline or now-disconnected recipient has removed content.

For a still-authorized connection, withdrawal and relay withdrawal are durable
control work, supersede obsolete publication work, and require per-destination
reader-facing verification. Pending/offline/disconnected removal stays visible
as withdrawal attention. No claim of instantaneous global erasure or privacy
enforcement across an independent offline forum. Revocation without a completed
withdrawal needs separately authorized local/native action.

Do not apply the earlier CMS binding-withdrawal rule, which leaves a discussion
publicly untouched, as if it were a network-content retraction. The exact
network withdrawal lifecycle and local moderation policy need their own typed
objects and native implementation evidence before freeze.

## 9. Administration and reader experience — H14

Use understandable controls inside the same plugin:

- **Network connections:** peer name/origin, Receive from, Publish to, allowed
  sources, receiving category, relay destinations, enable/pause/revoke.
- **Publishing policy:** initial selection, category/tag rules, per-topic
  include/exclude, relay permission, preview and explicit apply.
- **Network publications:** original source, local topic, approved paths,
  desired/synchronized/verified revision, per-destination state and safe error,
  explicit retry and withdraw. A queued publication is not labelled published.
- **Received topic:** provenance panel, actual managed content, canonical Read
  More when excerpted, links to approved related discussions, and visibly local
  replies. Forum labels and author credit are escaped native output.

A preview is read-only and never enrolls a peer, creates work or publishes a
topic. Health/support-bundle download remains support tooling. It creates no
remote support session, provider entitlement, peer authority or network route.
Settings content/redaction and support submission/provider selection remain
unverified/separately defined; no new Operator Service is needed for the hub.

### 9A. Proposed receiving-topic layout and reply controls

The plan is one native receiving topic with three consecutive areas. Use
labelled sections, not one interleaved chronology, for this proposed first UI:

| Area | Display | Reply action |
| --- | --- | --- |
| Publication | Managed first post with source, "via" path, canonical link and synchronization status. | The normal local topic action is available only when local discussion is enabled and native permissions permit it. |
| Discussion at [Source Forum] | Read-only source conversation panel immediately after the publication and before local replies. Each item shows source author, actual forum label, source time and original-post link. | **Reply at [Source Forum] ↗** opens the authoritative source topic/post in a new tab. Authentication and posting happen at the source. |
| Discuss here at [Local Forum] | Normal native local reply stream in this same receiving topic, with local forum identification. | **Reply here at [Local Forum]** opens the normal local composer; native local permissions and moderation apply. |

No generic Reply button may silently choose between forums. Native topic-level
Reply, per-post Reply and local quote actions are local-only; their labels
identify the local forum. The source panel uses its own explicit external reply
action and cannot send a native local composer a foreign post ID. The local
composer states, "This reply stays at [Local Forum]; it is not sent to
[Source Forum]." Source profile links go to the source forum; identical user
names do not link or merge accounts. Source replies do not inflate native local
post counts, native unread markers or local notification activity.

CF01 local-discussion policy: source permission and recipient enablement both
default off. Source grant is scoped to the receiving forum/connection with
per-source-topic narrowing; recipient native admin sets connection default and
per-received-topic override only within current source permission. Relays cannot
broaden consent. Only local native controls enable local replies. Turning it
on uses the same received topic; turning either side off stops new replies by
native server-side enforcement, preserving existing local posts and moderation.
Existing posts remain readable unless separate retraction/privacy requires
hiding the mirrored topic/replies. Source permission grants no local moderation
and cannot force recipient discussion on. Exact source authority lifetime is
proposed at 300 seconds, renewed by scoped reads; unknown/expired permission
forces new-reply denial. No instantaneous offline enforcement is claimed.

When local discussion is off, ordinary readers see a brief "Local discussion
is not enabled" state and no active local composer. When on but the reader
cannot reply, use the normal native login/permission/closed-topic state.
Recipient moderation may restrict local discussion independently of the source.
Source edits refresh managed content/source display, never rewrite local replies.

Proposed exact source-panel default: latest 20 visible source replies, with bounded
older-reply pagination and a separate source reply count when known. Source order
and reply context remain source-owned; do not renumber displayed source items
as local posts. Additional forums' conversations, if separately authorized,
have their own named panels and forum-specific reply actions, not an ambiguous
"sources" pool. That capability is not automatically enabled by a relay.

Source discussion changes use a scoped connection-level change feed and shared
server-side read cache; do not create an independent polling loop for every
topic or reader. Paginated older source history is a scoped read, not publication
work. Display last refresh time. A temporary interruption may show already
authorized cached replies with a clear stale indicator; known privacy change,
revocation or scope loss disables ordinary-reader access to the affected source
projection and requires current authority before reuse. Unknown/unavailable
counts are not displayed as zero. A fetch error never creates native fallback
replies or claims the source is empty. Source retraction still follows H13.

This read projection must reflect source edits/deletions/moderation changes and
support bounded restart/reconciliation. That is refresh of one authoritative
conversation, not independent forums accepting writes into replicated threads.
The exact source discussion feed, read cursor, post/revision/author identity,
tombstones, sanitizer/cache/asset and native visibility profiles are defined
in the [wire specification](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md)
and its Network types. Native hook implementation/qualification remains later
component work, not proof supplied by Alpha.30 or these documents. Cached
ordinary display and new local reply permission expire after the proposed
300-second authority window; known revocation/privacy disables them immediately.

For this first proposed UI there is no recipient-hosted source composer and
no cross-forum authentication bridge. Readers can watch the conversation here;
participating in it uses the clearly labelled source action. A later source-
controlled inline composer requires separate explicit authority and an exact
authentication/write contract, not a hidden change to "Reply here."

## 10. Integration into the successor contract

The completed exact proposal is overview/semantics/typed artifact revision7,
with 63 routes, 252 types and 58 errors; NET-01..31 define this network extension.
The [fresh matrix and work document](C:/CodeProjects/Products/DiscussionBridge/planning/ADAPTER_PROTOCOL_SUCCESSOR_CHANGE_MATRIX_20261010.md)
links each requirement to component obligations and 80 planned runtime cases.
P01, H-D01a and CF01 are approved directions. Exact fields/profiles/values remain
proposed pending approval of the complete packet.

Preserve Alpha.20 v1 bytes/meaning. New network capabilities belong under v2;
CMS Connection/CmsProfile and NetworkConnection are distinct. Reuse shared
work/lease/retry/replay mechanisms where meanings match; no second publisher
engine or new control service. Network types explicitly cover peers, directed
export/receive policy, immutable raw/cooked revisions, original grants/paths,
local mapping and per-hop receipts, native fencing, assets, dynamic work,
source reply projection and local discussion policy, related links and minimal
withdrawals with ordinary-reader hiding proof.103 positive shapes and30
negative shapes accompany 2 malformed JSON cases; runtime tests remain NOT_RUN.

The invented Operator Service control packet is excluded. Its active types,
fields/errors/examples/cases were removed, not used as a Hub/freeze dependency.
Separate old control documents remain excluded; support assistance is not
redefined or enabled by the network.

## 11. Decisions and implementation boundary

The same-plugin source/recipient requirement and work on this proposal are
directed by Phil. The preserved-v1/new-v2 boundary is approved. The following
approval scope and remaining product choices are recorded below:

| Decision | Recommended proposal |
| --- | --- |
| H-D01a — Discussion/consent principle | **APPROVED BY PHIL, 2026-10-09:** source publication/conversation displayed on recipient; optional same-topic local discussion requires source permission and recipient enablement; local replies stay locally owned/moderated without synchronization into source; publishing directions independent. |
| H-D01b — Exact controls and consent lifecycle | Section 9A layout/navigation, defaults/admin scope and exact source-consent scope/defaults/revocation/existing-reply handling. **Direction approved under CF01; exact wire/profile choices await packet approval.** |
| H-D02 — Can the hub redistribute spoke content? | **CF01 direction approved.** Yes, only to explicitly origin-approved and independently recipient-approved peers, retaining origin and "via" provenance. |
| H-D03 — Visibility scope | **CF01 direction approved.** Public content/public destination categories first; no implicit private permission or identity federation. |
| H-D04 — Large forum-received content | **CF01 direction approved:** a distinct full-publication v2 network lane with bounded chunks and explicit native-limit handling; preserve existing 48 KiB resolve semantics. This is new direction with proposed exact wire, not an existing exemption. |

CF01 approves the listed product directions, grouped UI and consent lifecycle.
Technical values, exact schemas and native verification/import profiles return
for whole-packet approval before freeze. No code/migration/runtime change is
authorized by architecture approval.

Before a hub implementation can be accepted, planned qualification must use
one exact plugin build on one hub and two spokes and demonstrate each origin
in both directions, onward relay, stable topics on edits, actual local replies,
visible provenance, category/author ownership, no loops/duplicates, three-attempt
attention, restart/lost-receipt recovery, forbidden relay, local moderation
conflict, public-to-private retraction and offline withdrawal attention. Keep
this distinct from existing CMS path qualification. These tests are NOT RUN;
no code review disposition or product readiness is claimed.

Implementation begins only after exact contract approval/freeze and explicit
implementation authority, from clean Alpha.30 and the selected native adapter
baselines. Sandbox comes first; GitHub main and non-sandbox deployment retain
their separate existing gates. No discarded code or historical supporting
record was used to produce this proposal.
