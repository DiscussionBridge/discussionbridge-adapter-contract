// Initial historical extraction. Normal generation uses only this repo's source/templates.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = resolve(root, '../../adapter-contract');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readPinned = (path, sha256) => {
  const bytes = readFileSync(resolve(evidence, path));
  if (hash(bytes) !== sha256) throw new Error('Historical evidence pin mismatch: ' + path);
  return bytes;
};
const baselineBytes = readPinned('src/cms-schema.json', 'b5ce03ac60379a60e9adc3b4193b9f49e9f6c0687010a91a138577d4cbf95760');
const amendmentBytes = readPinned('amendments/to-v2-delivery-20261014/AMENDMENT.json', 'b7a4bdc7024769b60c1b178d2fa764260f4f1d21ac93f177ddc960b8673395b9');
const wireBytes = readPinned('approved-packet/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md', '56f327cf5a9815b65c003a2fd42723c89946f6456905161d497d30dd8b1399e7');
const runtimeBytes = readPinned('amendments/to-v2-delivery-20261014/generated/cms-runtime.mjs', '51e37325343ae7bcf0da7da900b36ae74366d5643751646abe96f8da3e494cfa');
const phpBytes = readPinned('amendments/to-v2-delivery-20261014/generated/CmsCodec.php', 'aa15add4717371fb1082094793251b05a369691c17f6b361cd058df602f8d00d');
const baseline = JSON.parse(baselineBytes);
const amendment = JSON.parse(amendmentBytes);
const wireLines = wireBytes.toString('utf8').split(/\r?\n/);
const line = (number) => wireLines[number - 1];
const types = structuredClone(baseline.types);
Object.assign(types, structuredClone(amendment.types));
types.ToRepresentation.variants = { full: 'ToFull', generated_excerpt: 'ToGeneratedExcerpt' };
delete types.Policy.fields.existing_record_adoption;
delete types.Policy.fields.adoptable_resource_ids;
types.Policy.rules = types.Policy.rules.slice(0, 1);
types.Connection.rules = [
  'publication_lane is administrator-configured within the connection allowed lanes. Source/mapping/work routes use that lane without caller authority. destination_origin is an origin, not a path/query URL.',
  'Native profile/capability/catalog declarations are descriptive, not authorization.',
];
types.ToRecord.rules = [
  'Core IDs are canonical decimal strings. Initial creation requires expected_source_revision=null; every existing owned record uses its exact current source revision. Same source_revision with changed authoritative payload conflicts; an exact same edition resolves without write. Ordinary published native source editions only, never draft/autosave/revision-object/page-view activity. Unexpected local/moderator edits stop source-owned updates rather than overwrite discussion.',
  'source_content_sha256/source_content_bytes describe complete sanitized native source before excerpt selection. full matches content_html exactly. generated_excerpt follows generated_excerpt selection, boundary/hash/link/cap rules. No old unmarked representation or earlier-record initialization is admitted.',
];
types.Record.rules = [
  'Metadata-only current binding/delivery view. From-Discourse body uses immutable source revision/chunk routes. To records have established source revision evidence; nullable fields of another direction/state are not earlier-record conversion privilege.',
];
types.WithdrawInput.fields.expected_source_revision.nullable = false;
types.WithdrawInput.rules = [
  'Withdraw only existing exactly owned current To binding with established nonnull source revision, exact expected revision and native ownership. Null is not absence-CAS or earlier-record initialization. Retain topic/discussion/native/resource IDs and URL tombstones; no implicit resume.',
];
types.SourceUrlMovePrepare.rules = [
  'to_discourse only; exact owned current external/resource/topic binding and source revision. Reserve same-origin collision-free new source URL. Native source-public proof profile remains separately unresolved; declared fields do not establish it.',
];
types.SourceUrlMoveFinalize.rules = [
  'Issued nonce/current source revision/exact native identity and actual new-URL verification. Fresh unused new_source_revision differs from expected_source_revision. Retain title/authors/complete-source hash/count/native/external/resource/topic identity. For full retain delivered body. For generated_excerpt replace only owned generated Read More suffix/read_more_url, preserving exact article prefix and native raw outside its bound normalized segment.',
  'Check projected HTML<=49152 and exact ToResolve envelope<=65536 before mutation; an infeasible longer/escaped URL returns body_too_large without prefix truncation. Native segment/current input/canonical metadata/fingerprint/fresh immutable ledger/URL history/reservations/mutation receipt commit atomically. No fabricated proof, same-revision repair or accepted-history rewrite.',
];
types.ResolveResult.rules = [
  'created/resolved/updated have all protected resource/topic/revision/time fields nonnull. reconciliation_required has four identity/URL/native ownership/Core embed association reasons and protected fields null. adoption_unavailable names exact native Core embed association only, not earlier-record migration.',
];
const coreErrorEnd = baseline.errors.findIndex((item) => item.code === 'forum_configuration_invalid');
if (coreErrorEnd < 0) throw new Error('Core error boundary missing');
const errors = baseline.errors.slice(0, coreErrorEnd + 1);
types.ErrorCode.values = errors.map((item) => item.code);
const routeMap = [];
const routes = baseline.routes.filter((route) => route.input !== 'MappingAdopt').map((route, index) => {
  const mapped = structuredClone(route);
  mapped.id = 'V4-' + String(index + 1).padStart(2, '0');
  mapped.path = mapped.path.replace('/discussion-bridge/v2/', '/discussion-bridge/v4/');
  routeMap.push({ historical_id: route.id, current_id: mapped.id, path: mapped.path });
  if (route.id === 'V2-02') mapped.rules = [
    'to_discourse required. created=201, resolved/updated=200, reconciliation_required=409. Core IDs are decimal strings. Exact Core TopicEmbed canonical association allowed only with no prior Bridge mapping/current authority; no arbitrary claim or earlier-Bridge initialization.',
  ];
  if (route.id === 'V2-05') mapped.rules.push(types.WithdrawInput.rules[0]);
  return mapped;
});
const reachable = new Set(['Error', 'NativeOwnershipReceipt']);
for (const route of routes) for (const type of [route.input, route.query, route.response]) if (type) reachable.add(type);
const visit = (name) => {
  const spec = types[name];
  if (!spec) throw new Error('Missing V4 type: ' + name);
  const dependencies = spec.kind === 'object' ? Object.values(spec.fields).map((field) => field.type)
    : spec.kind === 'array' ? [spec.items] : spec.kind === 'tagged_union' ? Object.values(spec.variants) : [];
  for (const dependency of dependencies) if (!reachable.has(dependency)) { reachable.add(dependency); visit(dependency); }
};
for (const type of [...reachable]) visit(type);
const currentTypes = Object.fromEntries(Object.entries(types).filter(([name]) => reachable.has(name)));
const generatedExcerpt = {
  selection: structuredClone(amendment.selection), generated_link: structuredClone(amendment.generated_link),
  source_move: Object.fromEntries(['eligible','local_projection','native_projection','bounds','atomicity','prepared','applied_uncommitted','committed'].map((key) => [key, amendment.source_move[key]])),
};
generatedExcerpt.selection.stored_identity =
  'SHA256 of semanticIdentity excluding adapter_id/adapter_version/correlation_id/expected_source_revision; defaults visibility=unlisted,lane=empty string,source_authors=empty list. Trusted current receiver input supplies context, never caller wire testimony.';
generatedExcerpt.source_move.eligible = 'Current stored generated_excerpt with validated boundary/current native managed fingerprint, or unchanged full representation.';
const semantics = {
  type_grammar: [32,33,34,35,36,37,38,40,42,44,46].map(line),
  authentication: [50,52,54,56].map(line).concat(['Destination origin is HTTPS origin only. Stored publication_lane selects authorized lane when To resolve omits lane. No older-version lane interpretation or negotiation.']),
  transport: [60,62,84,92,145].map(line),
  mutations: [96,98,100,102,104].map(line),
  policy: [149,151,153,157].map(line).concat(['Policy selects supported publication kind/mode/current native author/taxonomy catalog IDs. Missing/unavailable selection is attention, never substitute. Empty selections retain native creation defaults/update assignments. No earlier-record adoption allowlist/conversion route.']),
  feeds: [159,161,163,165,167,169,171,173].map(line),
  mapping_ownership: [177,179,181,185,187,189,191].map(line),
  work: [195,197,199,218,220,222,224].map(line),
  completion: [228,230,232,234,236,238,240,242,244].map(line),
  presentation_moves: [248,250,252,258,260].map(line),
  to_source: [
    'Only published=true/current direction/origin/lane. New creation expected_source_revision=null; existing current binding requires exact current revision. No legacy initialization/adoption/conversion. Ordinary native published editions may update source-owned content; draft/autosave/revision-object/page-view events may not.',
    line(266).replace('initialized v2 record', 'current record'), line(268), types.ToRecord.rules[1],
    'existing_topic_id requires exact available unlisted native Core TopicEmbed association for canonical URL/no prior Bridge mapping/current authority. No arbitrary topic or earlier-Bridge conversion. Typed 409 reconciliation_required has null protected IDs; never Core publication fallback.',
    line(276), 'Binding views are pending/active/attention/withdrawn current native projections. Detail is metadata-only; immutable source revision/chunk routes supply From bodies.',
  ],
  source_moves: [
    'Existing owned current To record/exact current revision/old URL; same authorized native origin and unchanged native/external/resource/topic/discussion identity. Issued nonce and actual native new-URL proof; concurrent edition change conflicts.',
    ...types.SourceUrlMoveFinalize.rules, line(258), line(260),
  ],
  catalogs: [282,284,286].map(line).concat(['Refresh is native administrator/scheduler bounded upload work. Catalog change never enables policy or creates work. No remote Operator/provider/catalog-refresh control.']),
  forum_name: [line(295), 'Plugin-free discussion uses the same optional override/native source-title integration, never hostname fallback. Invalid/unavailable label is attention. No Content Connection/Bridge credential added just to render existing native Simple/Full/Interactive.'],
  native_administration: [
    'Native forum administrators own policy/category/topic/connection/catalog selection, truthful preview/status/badges, enable/disable/reconciliation and current-authority retry. Content Connection callers cannot write admin policy or invoke remote Operator/provider controls.',
    'Preview is read-only current-scope validation/presentation; never enablement/work creation/draft or page-view source resolve.',
    'Native publisher remains session/CSRF/XHR/staff/Guardian protected current topic/resource operation. Mapped native endpoints/parameters are coordinated with plugin owner; no old Bridge wire required.',
    'Explicit retry state-machine meaning retained; concrete native-reconciled evidence/verifier remains unresolved. No generic operator attestation invented.',
  ],
  upgrades: [
    'One new baseline; no earlier development/deployment compatibility. Demos/deployments deliberately rebuilt. Historical packets/archives/testwork are external evidence, not multiple active grammars.',
    'Future baseline upgrades preserve native/resource/topic/discussion IDs/ownership, configuration/templates/assets, authorized schema/data/key migrations, exact pending trees/CAS/leases/fences, immutable receipt/history, URL reservations/tombstones, crash/partial failure recovery/protected rollback.',
    'Local receipt/ledger/encryption format1 is not APIv1. Do not rename/delete keys/state needed for current-baseline recovery, retag accepted history or manufacture source editions on config changes.',
  ],
};
const decisionFiles = [
  'core-completion-3rd-20261012/cms-url-move-lane/PHIL_APPROVALS_20261013.md',
  'core-completion-3rd-20261012/cms-lifecycle-lane/PHIL_ATTENTION_WORKFLOW_APPROVALS_20261013.md',
  'core-completion-3rd-20261012/cms-lifecycle-lane/PHIL_GATE_HOLD_APPROVAL_20261013.md',
  'core-completion-3rd-20261012/cms-authority-compatibility-lane/APPROVED_ADMIN_SECRET_EXCEPTION_20261013.md',
  'core-completion-3rd-20261012/support-recovery-lane/ORIGINAL_SUPPORT_ACCESS_EXCHANGE.md',
  'core-completion-3rd-20261012/support-recovery-lane/ORIGINAL_PARTNER_EXCHANGE.md',
  'core-completion-3rd-20261012/SUPPORT_BEHAVIOR_PROPOSAL.md',
];
const decisions = decisionFiles.map((path) => {
  const bytes = readFileSync(resolve(root, '../../../planning', path));
  return { path: '../../../planning/' + path, bytes: bytes.length, sha256: hash(bytes), role: path.includes('SUPPORT_BEHAVIOR_PROPOSAL') ? 'recorded latest Phil support correction; exact implementation details unresolved' : 'recovered human functional approval/context, subject to latest supersession; not implementation/review evidence' };
});
semantics.presentation_moves.push(
  'An explicit native-admin URL-only request after verified publication may create a separate audited publish_revision cycle for unchanged source/policy, retaining the prior verified work unchanged. No worker-created cycle, terminal reset, fake source/policy revision or new work action. URL finalize settles only the URL transaction; dynamic/static publication settlement remains separate.',
);
semantics.native_administration.push(
  'Notify native administrators of actual attention; manual checked corrective action is required there. Individual and selected bulk retry are supported, each selected item checked and reported separately. Pending/retry_wait issues are displayed but do not acquire an unapproved manual-resume barrier. Exact same selected metadata restoration leaves actual attention awaiting admin review, never automatic retry; waiting work retains cycle/count/retry time through current safety checks.',
  'Actual global disable cancels according to the transition table and retains private same-intent hold/failure/cycle/count/native proof. Gate restoration cannot recreate that same failed action/source/policy automatically. A genuinely different current-authorized intent may supersede the hold; exact same-intent recovery requires separately defined reconciled admin action, not an invented endpoint.',
  'Narrow native-admin secret issuance exception: direct explicit authenticated administrator create/rotate response only; transient native admin page memory/display and Copy secret on explicit administrator click for protected server setup. No browser credential requests, lease/provider access, later secret reads, public output/logs/URLs/metadata/exceptions/support. Secret response no-store, no browser persistence/cache. No extra timeout or automatic clipboard-clearing policy.',
);
semantics.authentication[3] =
  'Discourse service origin is HTTPS; no redirects/cross-origin service responses. Credentials never enter public/browser adapter JavaScript, content, URLs, metadata, logs, exceptions or support. Only the separately stated explicit native-admin issuance/rotation memory/display/copy exception applies; it does not authorize browser adapter requests or subsequent secret reads.';
semantics.support = [
  'Initial commercial/paid in-plugin request starts a process for DiscussionBridge as initial support giver to receive appropriate separately granted access. Future trusted partner selection is later. This function is distinct from rejected invented Operator Service/entitlement/remote-control machinery.',
  'Local opt-in and explicit request are separate steps. Bundle download alone is insufficient and never authorizes automatic sharing. No ordinary-support-link substitute, auto access/payment-controlled role, signed entitlement or publishing/catalog/network grant is inferred.',
  'Exact native permission matrix/account provisioning/request destination/data consent/delivery/acknowledgement/duration/revocation/audit/payment/grace remain unresolved. Historical assistant mechanisms and address alternatives are not selected by this candidate.',
];
semantics.content_preservation = [
  "Phil's current direction: source content should be maintained as much as possible; omitting a video may destroy the content. Arbitrary media omission is not approved.",
  "Phil's latest agreed approves the preservation recommendation: preserve video through a supported native player/embed; identify unsupported limitations and make fallback explicit. Link/caption is not automatically equivalent to video experience. Renderer opt-out preserves underlying source where possible.",
  'Exact complete-source safety/preparation, provider/URI/native integration, nonblank and relative-link/canonical recipe remain discussion_required_not_approved. Opinionated rich-content default/opt-out interface is not selected. No blanket strip/media-attention recipe or new rich flag is inferred.',
];
const nativeInterfaces = [
  { id: 'NATIVE-01', method: 'POST', path: '/admin/publishing/topics/{topic_id}/publish', authorization: 'native_session_csrf_xhr_staff_guardian_publisher_enabled', fields: { publication: ['content_connection_id','external_id','canonical_url','lane(optional)','presentation_mode(optional current authorized policy)'] }, rule: 'Current visible native source/current policy creates actual materialization through SourceLifecycle/MappingPrepare/intent in one native transaction with shared URL collision guards. No old native_materialization toggle, staff scope override or earlier-record attach/adopt. Native administration, not Content Connection wire.' },
  { id: 'NATIVE-02', method: 'PUT', path: '/admin/publishing/publications/{resource_id}/presentation', authorization: 'native_session_csrf_xhr_staff_guardian_publisher_enabled', fields: { publication: ['canonical_url'] }, rule: 'Exact owned resource presentation correction; current native/CAS/URL safety checks, never arbitrary rebind or credential expansion.' },
  { id: 'NATIVE-03', method: 'GET', path: '/admin/publishing/topics/{topic_id}/status', authorization: 'native_session_csrf_xhr_staff_guardian_publisher_enabled', rule: 'Truthful current publication status for current visible topic; no connection secret or lease token.' },
  { id: 'NATIVE-04', method: 'GET', path: '/admin/publishing', authorization: 'native_admin', rule: 'Current publishing overview, not public feed.' },
  { id: 'NATIVE-05', method: 'GET/PUT', path: '/admin/content-connections/{connection_id}/cms-configuration', authorization: 'native_admin', rule: 'Native policy/configuration; Content Connection callers have read-only V4 connection/policy routes.' },
  { id: 'NATIVE-06', method: 'GET', path: '/admin/content-connections/{connection_id}/cms-delivery', authorization: 'native_admin', rule: 'Current native delivery/status/issue presentation.' },
  { id: 'NATIVE-07', method: 'GET', path: '/admin/content-connections/{connection_id}/cms-preview', authorization: 'native_admin', rule: 'Read-only current-scope preview; no work/enablement/create.' },
  { id: 'NATIVE-08', method: 'GET', path: '/admin/content-connections/{connection_id}/cms-catalog', authorization: 'native_admin', rule: 'Descriptive current native catalog configuration, not policy authority.' },
];
const historical = [
  ['src/cms-schema.json', baselineBytes], ['amendments/to-v2-delivery-20261014/AMENDMENT.json', amendmentBytes],
  ['approved-packet/ADAPTER_PROTOCOL_V2_WIRE_SPECIFICATION_20261009.md', wireBytes],
  ['amendments/to-v2-delivery-20261014/generated/cms-runtime.mjs', runtimeBytes],
  ['amendments/to-v2-delivery-20261014/generated/CmsCodec.php', phpBytes],
].map(([path, bytes]) => ({ path: '../../adapter-contract/' + path, bytes: bytes.length, sha256: hash(bytes), role: 'read-only historical derivation evidence, not active compatibility' }));
const source = {
  candidate_id: 'discussionbridge-v4-core-20261014-r1', implementation_version: '0.4.0-alpha.1', wire_version: 'v4',
  status: 'implementation_candidate_not_exact_approved_not_frozen', release_version: null,
  authority: {
    v4: "Phil: 'or move to v4 in case v3 info surfaces later that way we are on clean work'; 'I vote move to v4'. Root commissioned one clean coherent V4 candidate.",
    scope: 'Current approved core/native semantics + approved envelope-only/owned canonical Read More; no earlier dev/deployment compatibility; future baseline upgrades retained.',
    exact_candidate_approval: false,
    content_preservation: "Root relays Phil: 'The source content should be maintained as much as possible'; 'ommitting a video might destroy the content as you suggest'; latest 'agreed' approves native player/embed preservation, explicit unsupported limitation/fallback, no link/caption equivalence and source-preserving renderer opt-out. Exact sanitizer/URI/nonblank/rich-default interface not selected.",
  },
  historical_derivation: historical, approved_functional_decisions: decisions, native_interfaces: nativeInterfaces,
  excluded: ['earlier development/deployment compatibility','old negotiation/selectors/defaults','legacy initialization/record conversion','unmarked To excerpts','dual active profile/codec support','historical aliases','Operator Service','Network','Workspace','Federation','unfrozen URL transport amendment'],
  unresolved: [
    { id: 'SOURCE_HTML', status: 'discussion_required_not_approved', boundary: 'Exact complete-source preparation/safety recipe; no sanitizer policy inferred from marker/Read More approval.' },
    { id: 'NATIVE_SOURCE_MOVE_PROOF', status: 'component_definition_required_not_approved', boundary: 'Actual native source-public ownership/extraction/hash/nonce profile and expected-edition move integration; declared fields do not implement it.' },
    { id: 'NATIVE_ADMIN_RETRY', status: 'concrete_reconciliation_mechanism_not_approved', boundary: 'Current native-reconciled state before explicit audited retry; no generic attestation invented.' },
    { id: 'APPLIED_PRESENTATION_REBIND', status: 'unprescribed_branch_attention', boundary: 'Applied newURL/replacement generation while receiver remains oldURL has no fabricated oldURL receipt or inferred rebind; attention/both reservations.' },
    { id: 'SUPPORT_ACCESS', status: 'confirmed_function_exact_mechanism_unresolved', boundary: 'Initial paid in-plugin DiscussionBridge support/access process retained; exact consent/delivery/native permissions/account grant/revocation/expiry/commercial mechanism unapproved. No Operator control or ordinary-link substitute.' },
  ],
  grammar: 'DB-TYPES-1', types: currentTypes, routes, transport: structuredClone(baseline.transport),
  bounds: structuredClone(baseline.bounds), errors, work_transitions: structuredClone(baseline.work_transitions),
  generated_excerpt: generatedExcerpt, semantics,
  limitation: 'Typed/value-local validation does not establish receiver/native authority/locks/ownership/public proof/qualification/formal review/exact approval/freeze/release/deployment.',
};
const write = (path, bytes) => { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), bytes); };
write('normative/CONTRACT.json', JSON.stringify(source, null, 2) + '\n');
write('derivation/HISTORICAL_ROUTE_MAP.json', JSON.stringify({ role: 'derivation trace only; old routes are not accepted', routes: routeMap }, null, 2) + '\n');
const once = (text, before, after) => {
  if (text.split(before).length !== 2) throw new Error('Derivation anchor mismatch: ' + before.slice(0,60));
  return text.replace(before, () => after);
};
const removeLine = (text, pattern) => {
  const matches = text.match(pattern);
  if (!matches || matches.length !== 1) throw new Error('Derivation removal mismatch');
  return text.replace(pattern, '');
};
let runtime = runtimeBytes.toString('utf8');
runtime = runtime.replace(/^\/\/ GENERATED[^\n]*\n/, '// GENERATED V4 candidate; no earlier-version compatibility.\n');
runtime = once(runtime, "export const implementationVersion = '0.3.0-alpha.1';", "export const implementationVersion = '%IMPLEMENTATION_VERSION%';\nexport const candidateId = '%CANDIDATE_ID%';\nexport const wireVersion = 'v4';");
runtime = runtime.replace(/export const specIdentity = Object\.freeze\(\{[\s\S]*?\}\);/, 'export const specIdentity = Object.freeze(%NORMATIVE_IDENTITY%);');
runtime = once(runtime, 'ffcbc21c6d36aac3edd061f2f2b528c83b6e79f25f84d4fcb9ab39f233a8ca37', '%SCHEMA_SHA256%');
runtime = once(runtime, '  generatedExcerpt: extracted.amendment,\n  candidateProfile: extracted.candidate_profile,', '  generatedExcerpt: extracted.generated_excerpt,');
runtime = removeLine(runtime, /^export const candidateProfile = [^\n]*\n/m);
runtime = removeLine(runtime, /^export const amendmentIdentity = [^\n]*\n/m);
runtime = removeLine(runtime, /    if \(value\.representation\.kind === 'bounded_excerpt'[^\n]*\n/);
runtime = removeLine(runtime, /    if \(value\.existing_record_adoption === 'disabled'[^\n]*\n/);
runtime = runtime.replaceAll("'V2-02'", "'V4-02'").replaceAll('excerptProfile', 'excerptRules');
runtime = runtime.replace('// Implementation source for AMENDMENT.json; the generator appends this to the\n// preserved runtime and invokes checkGeneratedExcerpt from its ToRecord check.', '// Value-local generated-excerpt implementation; current V4 source owns the rules.');
write('implementation/cms-runtime.mjs.in', runtime);
let php = phpBytes.toString('utf8');
php = once(php, '// GENERATED explicit amendment candidate; preserved baseline is separate.', '// GENERATED V4 candidate; no earlier-version compatibility.');
php = once(php, 'namespace DiscussionBridge\\CmsV2\\GeneratedExcerpt20261014;', 'namespace DiscussionBridge\\CmsV4;');
php = once(php, "    public const IMPLEMENTATION_VERSION = '0.3.0-alpha.1';\n    public const CANDIDATE_PROFILE = 'cms-v2-generated-excerpt-20261014-r1';", "    public const IMPLEMENTATION_VERSION = '%IMPLEMENTATION_VERSION%';\n    public const CANDIDATE_ID = '%CANDIDATE_ID%';\n    public const WIRE_VERSION = 'v4';");
php = once(php, 'ffcbc21c6d36aac3edd061f2f2b528c83b6e79f25f84d4fcb9ab39f233a8ca37', '%SCHEMA_SHA256%');
php = removeLine(php, /            if \(\$value->representation->kind === 'bounded_excerpt'[\s\S]*?            \}\n/);
php = once(php, "            if ($value->existing_record_adoption === 'disabled' && count($value->adoptable_resource_ids) > 0) {\n                $this->fail($path . '.adoptable_resource_ids');\n            }\n", '');
php = php.replaceAll("['amendment']", "['generated_excerpt']").replaceAll("'V2-02'", "'V4-02'");
write('implementation/CmsCodec.php.in', php);
const fixtures = JSON.parse(readFileSync(resolve(evidence, 'fixtures/cms-publication/derived-positive-examples.json'), 'utf8')).fixtures;
const positive = fixtures.filter((item) => currentTypes[item.type] && item.type !== 'MappingAdopt').map((item) => {
  const value = structuredClone(item.value);
  if (item.type === 'Policy') { delete value.existing_record_adoption; delete value.adoptable_resource_ids; }
  if (item.type === 'Connection') { delete value.policy.existing_record_adoption; delete value.policy.adoptable_resource_ids; }
  return { id: item.id, type: item.type, value };
}).filter((item) => !(item.type === 'ToResolve' && item.value.bridge_record.representation.kind === 'bounded_excerpt'));
write('fixtures/positive-examples.json', JSON.stringify({ status: 'V4 derived author fixtures, not frozen/qualified', fixtures: positive }, null, 2) + '\n');
write('fixtures/numeric-lexemes.json', readFileSync(resolve(evidence, 'fixtures/core-publication/cms/numeric-lexemes.json')));
console.log(JSON.stringify({ status: 'V4_initial_source_derived', routes: routes.length, types: Object.keys(currentTypes).length, examples: positive.length, candidate: source.candidate_id }, null, 2));
