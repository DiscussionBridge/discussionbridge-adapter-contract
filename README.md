# DiscussionBridge V4 core candidate

This clean candidate is one protocol: V4. Its unpublished development package
version is 0.4.0-alpha.1, candidate discussionbridge-v4-core-20261029-r7, and
release_version is null. Phil selected V4 and removed earlier development and
deployment compatibility; exact candidate approval, freeze and release are separate.

normative/CONTRACT.json is the single authoritative current candidate. It contains
169 closed named types, 36 Content Connection routes, exact transport/errors/work
transitions, generated excerpt and source-move semantics, current protected native
admin interfaces, recovered direct functional decisions and their source descriptors.
CANDIDATE.json and ARTIFACTS.json identify generated outputs. Historical source
references are provenance only: normal generation/tests/build do not load the old
checkout or accept its versions. No older wire defaults/selectors/negotiation,
record initialization/conversion, unmarked To excerpts or dual profile codecs exist.

Run node scripts/generate.mjs to derive one src/cms-schema.json/JS/PHP set from the
normative source and implementation templates. Run node scripts/generate.mjs --check
for exact derivation. src/cms-contract.mjs also binds the normative source;
downstream native packages copy the exact portable runtime/schema or the PHP codec,
schema AND complete adjacent private idna/ dependency bundle and record all identities.
The PHP bundle is checked offline during generation and member-by-member before
runtime loading; copying only the former PHP/schema pair fails closed.
ROUTES.md is generated from the same source.
Historical extraction/check-vector scripts are derivation records, not normal
runtime/build dependencies or a route compatibility layer.

Run node --test tests/*.test.mjs and native PHP -n src/php/conformance.php. The PHP
API is documented in src/php/README.md. Types preserve object/list/null/omission,
string bytes, decimal Core IDs, exact integer lexemes, closed branch fields and
strict UTF8/duplicate-key/body/query/status constraints. Typed validation does not
prove current authentication, native ownership/locks/CAS/fences, actual rendered
public content, crash recovery, qualification or code review.

PHP must be on PATH, or set DISCUSSIONBRIDGE_PHP_BINARY to the installed PHP
executable. Tests do not depend on another checkout or a private Windows tools
directory. CI runs the complete suite with Node 22/24 and PHP 8.1/8.3/8.5, checking
generation and ordinary candidate packaging as well. A missing runtime fails
qualification; it is not silently skipped. These jobs are candidate checks, not
a release or native-adapter acceptance claim.

Phil approved one fixed domain-validation policy across JavaScript, PHP and the
receiver: db-url-uts46-17-1, Unicode 17.0.0, nontransitional UTS46, Bidi/Joiner
checks and invalid-ACE rejection, with the declared non-strict hyphen/STD3/DNS-length
options. Existing bounded numeric IPv4 and bracketed IPv6 rules remain. URL Unicode
conversion is validation-local, never an identity rewrite. JS cmsUrlAuthority and
PHP Codec::urlAuthority return only rawHost/asciiHost/effectivePort comparison
facts; they do not serialize a replacement URL, collapse IP spellings, prove native
ownership, or authorize rewriting stored keys/history. Url validation returns the
unchanged original string, including case, escapes, path and query bytes.

Both runtimes privately bundle pinned IDNA and Unicode17 NFC engines/data with
complete MIT/Unicode notices and member/input provenance. JavaScript tr46's two
NFC calls bind to the published pure standalone nf.min.js from
@adraffy/ens-normalize, not its native-ICU xnf variant or ENS naming policy.
The self-contained generated JS runtime/schema still need no external module.
PHP retains a complete adjacent private idna/ directory. Its Symfony normalization
data is regenerated with the unchanged upstream compiler against exact official17
inputs, not the host intl extension. No prototype/global-polyfill patch, new
mandatory hosting extension, runtime Composer/npm or network lookup is required.
See src/js-idna/DEPENDENCIES.json, src/php/idna/DEPENDENCIES.json and the PHP README.
Normal builds verify committed bytes offline; dependency refresh is explicit.

tests/unicode-corpus.test.mjs exercises all 6,391 official17 ToASCII cases and all
100,170 NFC column checks, including a JS realm where native normalize throws.
PHP checks 6,389 IDNA scalar-string cases plus the two ill-formed-surrogate cases
at its strict UTF8 URL boundary (explicitly reported, not silently skipped), and
100,170 NFC plus 100,170 normalized-status assertions without intl/mbstring/iconv.
The expected corpus/data and Unicode-3.0 license are committed under
fixtures/unicode17. These are codec checks, not receiver/origin/lock or native
installation acceptance. Consumer integration requires the same exact candidate
and its own tests/review; older consumer copies are not silently rebound.

To full content matches the complete prepared native source byte count/SHA.
generated_excerpt is the only excerpt form: complete-source evidence stays
truthful, article prefix has its own exact count/SHA, and one terminal owned marker
identifies generated Read More. It is eligible over the 49152 HTML bound OR the
deterministic full semantic request over 65536. Actual delivery must fit both caps.
The native source owner reports omitted complete content; the receiver cannot
independently reconstruct it. No inferred general HTML safety recipe is supplied.

Phil approved meaning-preserving whole-article preparation into a safe portable
equivalent with the native original intact, and format-neutral eligibility:
unformatted text and non-text qualify. To source producers resolve copied relative
link/media targets against the captured source article URL before complete prepared
count/SHA and excerpt selection. Incoming From Source retains exact immutable cooked
wire bytes/count/SHA; verify that complete integrity FIRST, then use its edition-fixed
Source.topic_url for copied target resolution/native preparation before native-output
evidence or excerpts. No later live canonical projection replaces that captured base.
Bridge preparation/rendering inability is a Bridge
limitation, not invalid source; source hashes are not native playback/fidelity proof.
Accepted/pending/history bytes remain immutable. Canonical-only moves do not
reprepare article targets against the new base; the owned Read More rule remains.
Exact execution permissions/mechanisms and URI/media/provider/fallback/default/
true-absence rules are unselected.

Phil approved preserving active article function through a supported native
component or embed where possible. Otherwise report the specific lost function
and let the operator decide how to proceed. Retaining the native original does
not make a broken copy equivalent. Displayed code remains content. This adds no
blanket execution ban, arbitrary script/handler/javascript: permission, provider/
URI list, renderer default, fallback equivalence or UI/wire/Operator machinery.

Verified canonical source moves preserve the article prefix/title/authors/complete
evidence/native IDs and alter only the owned generated link plus current canonical
revision/time metadata. Actual normalized native segment and current managed
fingerprint guard the atomic forum edit; raw outside it, including historical
Originally published at footer, stays unchanged. A longer new URL that cannot fit
does not truncate the prefix. Fresh immutable ledger/current state/URL history and
mutation receipt commit together. Historical accepted replay is never repaired.

Normal future V4 upgrades preserve live native/discussion/resource/topic identity,
configuration, schema/data/key state, pending exact mutations/CAS/fences,
receipts/history/reservations and protected rollback. Earlier demos/deployments
are deliberately rebuilt, with no older-record conversion requirements.
Simple/Full/Interactive/Core/native public readers remain functions independent
of old wire routes. Publisher/admin actions use current native authorization,
policy and shared binding/URL transactions; no remote Operator/provider controls.

Build the normal candidate with pwsh -File scripts/build-release.ps1. It checks
exact derivation and makes an explicit-member ZIP with SOURCE_MANIFEST.json and
member hashes. Existing artifacts are never overwritten. No profile selector,
source-tree/demo wrapper, release/tag/push/install/deploy or qualification claim.

Remaining definitions are explicit: SOURCE_HTML's unselected execution permissions/
mechanisms/URI/media/
provider/fallback/default/true-absence rules; native To source-public
ownership/extraction/hash/nonce/expected-edition move profile; actual native/public qualification of the adopted attention-recovery-1 subset; and the unprescribed applied
presentation-move replacement-lease branch. Functional direction is not proof of
these implementations. Operator Service, Network, Workspace, Federation and
unfrozen URL transport amendment remain excluded.

Phil approved content_preservation_unavailable ONLY for To V4-02/V4-29 when
required native rendered-article evidence is unavailable or actual content/function/
data loss is detected. It is HTTP422, permanent/nonretryable with null retry_after_seconds,
using the unchanged six-field Error envelope. Roll back before returning; retain
accepted article/IDs/history/exact pending/move/reservations; commit no new success
or mutation receipt and schedule no automatic retry. Protected diagnostics distinguish
unavailable evidence from actual loss. Existing precise root-cause codes retain their
meanings; this code is excluded from every other route and From Failure/Work attention.
This adds no source-validity, execution, URI/provider/fallback/default or operator UI rule.

Phil approved narrow To02 invalid_field/HTTP422 operator recovery: after actual
cause correction and current source/ownership/authority/revision/CAS checks, explicit
operator Retry creates one fresh request privately linked to the retained refusal.
Never replay the known rejected UUID or automatically retry unchanged refused input;
uncertain existing intents reconcile first. Ordinary genuinely changed source editions
remain normally eligible. Preserve all actual evidence; missing historical response
fields stay UNKNOWN, without a retrospective full-Error gate. Capture future actual
validated Errors in private history. No new wire field/error/route, public failure
receipt/cache/TTL, automatic repair detector, To29 or From Work expansion is added.
Portable codecs validate existing values; operator authority/refusal lineage/recovery
state require the component's durable native implementation, not a new codec claim.

AR1/AR2/AR6 adoption adds capability-probed attention-recovery-1 routes V4-32..36,
non-writing factual inspection, explicit unique linked successor discovery/targeted
claim and native admin selected Check/Retry. Existing Connection, Work and Claim
remain closed and unchanged. The predecessor becomes superseded with a full private
attention snapshot; no fence reset or success fabrication. Only exact restored
static baseline settlement is included; applied-static-candidate adoption remains
blocked. Current r5 local journals require explicit recognized-format migration,
immutable original/pending bytes and provenance; no blind candidate relabel.

Portable JS exports assertAttentionRecoveryCapability, validateAttentionFeedPage
and validateAttentionRecoveryLease; PHP Codec exposes matching methods. They
check closed shape, scoped sequence continuity and exact selected successor
bindings, never actual authority or native/public proof. Run focused
node --test tests/attention-recovery.test.mjs for cross-runtime vectors.
