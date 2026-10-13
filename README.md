# DiscussionBridge Adapter Protocol

This repository contains the small, platform-neutral protocol used by
DiscussionBridge publishing adapters. **The Bridge — DiscussionBridge for
Discourse** is the runtime authority. The contract and conformance fixtures in
this repository describe its current public adapter boundary; they do not
introduce a broker, installer, control plane, or shared runtime.

The current local build candidate is **0.3.0-alpha.1**, identified by
[`CURRENT_CORE_CONTRACT.json`](CURRENT_CORE_CONTRACT.json) and
[`core-publication-extension.json`](core-publication-extension.json). It adds
coherent native source editions, truthful source dates/forum names, explicit
presentation choices, verified complete-content chunks, source withdrawal and
compare-and-swap source updates. Read that extension alongside the preserved
Alpha.20 base below. Historical Alpha.23 release records do not identify this
changed candidate, and no approved immutable release or runtime qualification is
claimed by these candidate declarations.

Phil confirmed use of the preserved Alpha.23 CMS specification on October13.
The additive [`cms-publication-candidate.json`](cms-publication-candidate.json)
binds that confirmed CMS subset to the same unreleased build candidate.
[`src/cms-contract.mjs`](src/cms-contract.mjs) validates the exact normative
grammar for32CMS routes, strict JSON/query/transport shapes, local receipt
constraints, ownership fingerprints and work transition/retry values. It checks
the exact unchanged normative artifact identities before loading. The v1
extension above remains a distinct compatibility surface. Operator Service,
Network, Workspace, Federation and the unfrozen URL transport amendment are
excluded from this implementation.

Run `node --test tests/*.test.mjs` for compatibility, UTF8 golden-edition and
CMS conformance author fixtures. Build the deterministic local contract ZIP
with `pwsh -File scripts/build-release.ps1`. The archive includes the preserved
base, current declarations/extensions, executable CMS validator, conformance
fixtures, unchanged approved source packet and a member-hash manifest. The
packet's network shapes remain immutable source metadata; the validator exposes
only V2-01 through V2-32 and their138reachable CMS types. No version/tag is
selected by this build. All49frozen CMS positive examples validate unchanged;
build-candidate fixture copies retain exact parsed values and source provenance.

Typed validation does not establish current connection/policy/lease authority,
actual native ownership/locking, public verification, qualification or a review
disposition. Those checks belong to the receiver and each native adapter.

Downstream Node adapters may vendor [`src/cms-runtime.mjs`](src/cms-runtime.mjs)
and [`src/cms-schema.json`](src/cms-schema.json) together byte-for-byte with
recorded provenance. That portable runtime verifies the exact138type CMS
extraction hash and does not require another checkout or the full source packet.
The source-checkout wrapper additionally verifies the frozen normative files.

## Connection authentication

Every request uses one independently issued Content Connection:

- `X-DiscussionBridge-Connection: dbc_<24 lowercase hexadecimal characters>`
- `X-DiscussionBridge-Secret: <one-time connection secret>`

The secret belongs only in protected server-side configuration. It must never
be placed in public HTML, browser JavaScript, URLs, logs, or content metadata.
Connections independently scope allowed origins, directions, and lanes.

## To Discourse

Send JSON to:

`POST /discussion-bridge/v1/bridge-records/resolve.json`

The body has one `bridge_record` object. The exact active fields and limits are
recorded in [`contract.json`](contract.json). The adapter must send the same
stable `external_id` and canonical URL for retries of the same published item.
Only the exact JSON boolean `published: true` is accepted. Draft, preview,
autosave, revision, and page-view activity must not call this endpoint.
The request includes a nonblank sanitized `content_html` snapshot of at most
48 KiB. It may include bounded source-author identities for forum-controlled
authorship mapping.

`existing_topic_id` is an optional adoption request, not a general topic
selector. It succeeds only when Discourse Core already attests that the exact
canonical source URL owns that available unlisted embed topic and no prior
DiscussionBridge mapping exists. This preserves an existing standard embed
during a standalone-to-Bridge upgrade without granting an adapter authority to
claim an arbitrary forum topic.

Successful first delivery returns HTTP 201 with `outcome: "created"`.
An idempotent retry returns HTTP 200 with `outcome: "resolved"` and the same
resource/topic identity. An identity or canonical-URL disagreement returns HTTP
409 with `outcome: "reconciliation_required"`. Adapters must not create a
replacement identity after a conflict. All responses state
`core_fallback: false`.

## From Discourse

Adapters pull records through:

- `GET /discussion-bridge/v1/bridge-records.json?page=<1..10000>`
- `GET /discussion-bridge/v1/bridge-records/<resource_id>.json`

Inventory pages contain at most 100 records. A From Discourse record includes
the cooked first-post HTML in `content_html`. The adapter owns bounded polling
or explicit refresh, safe server-side caching, and platform-native rendering.
The receiving plugin does not push into publishing systems.

## Transport and persistence requirements

Each adapter must:

- use HTTPS and the configured Discourse service origin only;
- reject redirects and cross-origin responses;
- apply bounded connect/response timeouts and request/response byte limits;
- require JSON content type and valid JSON;
- redact the connection secret from every error and log;
- persist `resource_id`, `topic_id`, `topic_url`, last outcome, correlation ID,
  and retry state durably on the server;
- expose reconciliation-required state to an authorized operator;
- never fall back to Discourse Core topic creation or API-key publication.

## Alpha integration profiles

The Alpha release requires eight independently installed and exercised profiles:
Astro, Ghost, Hugo, Statamic DB, Statamic Flat, Statamic SSG, WordPress, and The
Bridge — Discourse as Publisher. Statamic DB, Flat, and SSG share one addon but
require separate configuration, connection identity, lifecycle evidence, and
live demonstration.
