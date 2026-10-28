import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as amended from '../src/cms-runtime.mjs';
const current=amended;

const hash = (value) => createHash('sha256').update(value).digest('hex');
const raw = (file) => readFileSync(new URL('../' + file, import.meta.url));
const source = JSON.parse(readFileSync(new URL('../normative/CONTRACT.json', import.meta.url)));
const fixtures = JSON.parse(raw('fixtures/positive-examples.json')).fixtures;
const example = fixtures.find((item) => item.type === 'ToResolve').value;
const copy = (value) => structuredClone(value);
const fullRecord = (html) => ({ ...copy(example.bridge_record), content_html: html,
  source_content_bytes: Buffer.byteLength(html), source_content_sha256: hash(html), representation: { kind: 'full' } });
const wrap = (record) => ({ mutation_id: example.mutation_id, bridge_record: record });
const rejects = (fn, code = 'invalid_field') => assert.throws(fn,
  (error) => error instanceof amended.CmsValidationError && error.code === code);
const authored = '<p><a href="https://publisher.example/roadmap/">Read More</a></p>';
const complete = authored + '<p>' + '"'.repeat(40000) + '</p>';
const input = fullRecord(complete);
const excerpt = () => amended.createGeneratedExcerpt(input, complete, authored);

test('single V4 grammar has no old route/init/unmarked/adoption/profile surface',()=>{
  assert.equal(amended.wireVersion,'v4'); assert.equal(amended.implementationVersion,'0.4.0-alpha.1');
  assert.equal(amended.candidateId,source.candidate_id);
  assert.equal(amended.cmsSchema.routes.length,36);
  assert.equal(Object.keys(amended.cmsSchema.types).length,169);
  assert.deepEqual(Object.keys(amended.cmsSchema.types.ToRepresentation.variants),['full','generated_excerpt']);
  assert.equal(amended.cmsSchema.types.MappingAdopt,undefined);assert.equal(amended.cmsSchema.types.ToExcerpt,undefined);
  assert.equal(amended.cmsSchema.types.Policy.fields.existing_record_adoption,undefined);
  assert.throws(()=>amended.validateCmsRoute('V2-02'),/Unavailable CMS route/);
  rejects(()=>amended.validateCms('ErrorCode','network_not_enrolled'));
  rejects(()=>amended.validateCms('WithdrawInput',{mutation_id:example.mutation_id,expected_source_revision:null}));
  const policy=copy(fixtures.find((item)=>item.type==='Policy').value);policy.existing_record_adoption='disabled';
  rejects(()=>amended.validateCms('Policy',policy),'unknown_field');
  assert.equal(amended.cmsSchema.transport.request_json_maximum_bytes,65536);
  assert.equal(amended.cmsSchema.types.ContentHtml.utf8_maximum_bytes,49152);
});

test('all current V4 author-positive shapes validate',()=>{assert.equal(fixtures.length,58);for(const item of fixtures)amended.validateCms(item.type,item.value);});

test('actual safe 40000-quote article exceeds JSON envelope, truthful candidate fits both caps', () => {
  assert.ok(input.source_content_bytes <= 49152);
  current.validateCms('ToRecord', input);
  assert.ok(Buffer.byteLength(JSON.stringify(wrap(input))) > 65536);
  assert.throws(() => current.parseCmsJson(JSON.stringify(wrap(input))),
    (error) => error.code === 'body_too_large');
  const record = excerpt();
  amended.parseCmsRequest('V4-02', { rawBody: amended.semanticIdentity(wrap(record)),
    mediaType: 'application/json', method: 'POST' });
  assert.equal(record.source_content_bytes, input.source_content_bytes);
  assert.equal(record.source_content_sha256, input.source_content_sha256);
  assert.equal(record.representation.article_content_bytes, Buffer.byteLength(authored));
  assert.equal(record.representation.article_content_sha256, hash(authored));
  assert.equal(record.representation.selection_source_revision, input.source_revision);
  assert.equal(record.representation.selection_full_request_bytes, Buffer.byteLength(JSON.stringify(wrap(input))));
  assert.ok(Buffer.byteLength(record.content_html) <= 49152);
  assert.ok(Buffer.byteLength(amended.semanticIdentity(wrap(record))) <= 65536);
});

test('deterministic full-form measurement retains semantic fields and ignores diagnostic padding', () => {
  const padded = { ...copy(input), adapter_id: 'x'.repeat(100), adapter_version: 'v'.repeat(100), correlation_id: 'c'.repeat(200) };
  assert.equal(amended.measureToFullEnvelope(padded, complete), amended.measureToFullEnvelope(input, complete));
  const semantic = { ...copy(input), lane: 'a'.repeat(64), source_authors: [{ id: 'author:a', name: 'α "β"' }],
    primary_source_author_id: 'author:a' };
  const projection = wrap(semantic);
  assert.equal(amended.measureToFullEnvelope(semantic, complete), Buffer.byteLength(JSON.stringify(projection)));
  rejects(() => amended.createGeneratedExcerpt(fullRecord('<p>small</p>'), '<p>small</p>', '<p>small</p>'));
});

test('source above HTML bound remains eligible without changing full hash/count without old unmarked type', () => {
  const html = '<p>' + 'a'.repeat(50000) + '</p>';
  const record = amended.createGeneratedExcerpt(fullRecord(html), html, '<p>excerpt</p>');
  assert.ok(record.representation.selection_full_request_bytes <= 65536);
  assert.equal(record.source_content_bytes, 50007);
  assert.equal(record.source_content_sha256, hash(html));
  const legacy = { ...copy(record), content_html: '<p><a href="' + record.canonical_url + '">Read More</a></p>',
    representation: { kind: 'bounded_excerpt', read_more_url: record.canonical_url } };
  rejects(() => amended.validateCms('ToRecord', legacy));
  rejects(() => amended.projectGeneratedReadMoreMove(legacy, 'https://publisher.example/new/', 'r2', null));
});

test('exact article boundary, hash, current URL and reserved marker reject ambiguity', () => {
  for (const change of [
    (r) => r.representation.article_content_bytes--,
    (r) => r.representation.article_content_sha256 = '0'.repeat(64),
    (r) => r.representation.read_more_url = 'https://publisher.example/other/',
    (r) => r.content_html += '<p>extra</p>',
    (r) => r.representation.unknown = true,
    (r) => r.representation.article_content_bytes = null,
    (r) => r.representation.selection_full_request_bytes = 65536,
  ]) {
    const record = excerpt();
    change(record);
    assert.throws(() => amended.validateCms('ToRecord', record));
  }
  rejects(() => amended.createGeneratedExcerpt(input, complete, '<p>DATA-DISCUSSIONBRIDGE-GENERATED=authored</p>'));
  rejects(() => amended.createGeneratedExcerpt(input, complete, ''));
  const unicode = amended.createGeneratedExcerpt(input, complete, '<p>😀 α</p>');
  unicode.representation.article_content_bytes = 4; // Cuts inside emoji.
  unicode.representation.article_content_sha256 = hash(Buffer.from(unicode.content_html).subarray(0, 4));
  rejects(() => amended.validateCms('ToRecord', unicode));
  const impossible = excerpt();
  impossible.representation.selection_full_request_bytes = 9007199254740991;
  amended.validateCms('ToRecord', impossible); // Shapes cannot prove source report.
  rejects(() => amended.validateGeneratedSelection(impossible));
});

test('new selection cannot carry historical provenance; exact stored move snapshot remains deliverable', () => {
  const original = excerpt();
  const serialized = amended.semanticIdentity(original);
  const moved = amended.projectGeneratedReadMoreMove(original, 'https://publisher.example/new/?a=1&b="x"',
    'native-source-r2', '2026-10-14T12:00:00.000Z');
  assert.equal(amended.semanticIdentity(original), serialized);
  assert.equal(moved.expected_source_revision, original.source_revision);
  assert.equal(moved.representation.selection_source_revision, original.source_revision);
  assert.equal(moved.representation.selection_full_request_bytes, original.representation.selection_full_request_bytes);
  assert.equal(moved.content_html.slice(0, authored.length), authored); // Authored old link untouched.
  assert.equal(moved.content_html, authored + amended.generatedReadMore(moved.canonical_url));
  for (const key of ['title', 'source_content_bytes', 'source_content_sha256', 'external_id', 'source_created_at']) {
    assert.equal(moved[key], original[key]);
  }
  amended.validateCms('ToRecord', moved); // Stored post-move value.
  amended.validateCms('ToResolve', wrap(moved)); // Portable shapes lack stored context.
  rejects(() => amended.validateGeneratedSelection(moved));
  amended.validateGeneratedSelection(moved, moved); // Trusted exact current stored value.
  const changed = copy(moved); changed.title += 'changed';
  rejects(() => amended.validateGeneratedSelection(changed, moved), 'identity_conflict');
  rejects(() => amended.projectGeneratedReadMoreMove(original, original.canonical_url, 'r2', null));
  rejects(() => amended.projectGeneratedReadMoreMove(original, 'https://publisher.example/new/', original.source_revision, null));
});

test('same current edition retains original selection with different CAS/default/diagnostic spellings', () => {
  const original = excerpt();
  const same = { ...copy(original), expected_source_revision: original.source_revision, lane: '',
    visibility: 'unlisted', source_authors: [], adapter_id: 'different diagnostic' };
  assert.equal(amended.generatedSourceIdentity(same), amended.generatedSourceIdentity(original));
  amended.validateGeneratedSelection(same, original);
  assert.equal(same.representation.selection_full_request_bytes, original.representation.selection_full_request_bytes);
  const fresh = copy(original);
  fresh.source_revision = 'new-edition';
  fresh.expected_source_revision = original.source_revision;
  rejects(() => amended.validateGeneratedSelection(fresh, original));
});

test('maximum HTML candidate accepts exact bound; longer verified URL projection fails before any mutation', () => {
  const html = '<p>' + 'a'.repeat(60000) + '</p>';
  const source = fullRecord(html);
  const fragmentBytes = Buffer.byteLength(amended.generatedReadMore(source.canonical_url));
  const article = '<p>' + 'a'.repeat(49152 - fragmentBytes - 7) + '</p>';
  const record = amended.createGeneratedExcerpt(source, html, article);
  assert.equal(Buffer.byteLength(record.content_html), 49152);
  const before = amended.semanticIdentity(record);
  rejects(() => amended.projectGeneratedReadMoreMove(record, 'https://publisher.example/' + 'a'.repeat(1500), 'r2', null),
    'body_too_large');
  assert.equal(amended.semanticIdentity(record), before);
  assert.throws(() => amended.createGeneratedExcerpt(source, html, article + 'a'));
});

test('exact JSON delivery cap and one-byte excess are independently enforced', () => {
  const html = '<p>' + '"'.repeat(50000) + '</p>';
  const source = fullRecord(html);
  let lower = 1, upper = 40000, good;
  while (lower <= upper) {
    const n = Math.floor((lower + upper) / 2);
    try { good = amended.createGeneratedExcerpt(source, html, '<p>' + '"'.repeat(n) + '</p>'); lower = n + 1; }
    catch (error) { assert.equal(error.code, 'body_too_large'); upper = n - 1; }
  }
  const currentSize = Buffer.byteLength(amended.semanticIdentity(wrap(good)));
  const adjust = 65536 - currentSize;
  assert.ok(adjust === 0 || adjust === 1);
  const article = '<p>' + '"'.repeat(upper) + 'x'.repeat(adjust) + '</p>';
  const exact = amended.createGeneratedExcerpt(source, html, article);
  assert.equal(Buffer.byteLength(amended.semanticIdentity(wrap(exact))), 65536);
  rejects(() => amended.createGeneratedExcerpt(source, html, article + 'x'), 'body_too_large');
});

test('invalid full-source count/hash, UTF8, metadata and lexical numeric provenance are never laundered', () => {
  const bad = copy(input); bad.source_content_bytes++;
  rejects(() => amended.measureToFullEnvelope(bad, complete), 'content_hash_mismatch');
  rejects(() => amended.measureToFullEnvelope(input, complete + 'x'), 'content_hash_mismatch');
  rejects(() => amended.measureToFullEnvelope(input, '\ud800'));
  const extra = copy(input); extra.other = 'field';
  rejects(() => amended.measureToFullEnvelope(extra, complete), 'unknown_field');
  const lexeme = amended.parseCmsJson(JSON.stringify(input).replace(/"source_content_bytes":\d+/, '"source_content_bytes":1.00000000000000001'),
    { maximumBytes: 300000, rejectInvalidNumbers: false });
  rejects(() => amended.measureToFullEnvelope(lexeme, complete));
});

test('strict candidate parsing retains duplicate-key, unknown-field, numeric and UTF8 rejection', () => {
  rejects(() => amended.parseCmsJson('{"a":1,"\\u0061":2}'), 'invalid_json');
  rejects(() => amended.parseCmsJson(Buffer.from([0xff])), 'invalid_json');
  const record = excerpt(); record.representation.article_content_bytes = 1.5;
  rejects(() => amended.validateCms('ToRecord', record));
});

test('PHP83/85 agree on exact produced trees, measurements, escaping and move projections', () => {
  const expected = { excerpt: excerpt(),
    moved: amended.projectGeneratedReadMoreMove(excerpt(), 'https://publisher.example/new/?a=1&b="x"', 'native-source-r2', '2026-10-14T12:00:00.000Z'),
    measurement: amended.measureToFullEnvelope(input, complete),
    link: amended.generatedReadMore('https://publisher.example/a?x="a"&y=\'b\''),
    identity: amended.generatedSourceIdentity(excerpt()) };
  const urls = [
    [String.raw`https://example.test/a\..\b`, false],
    [String.raw`https://example.test/a\../b`, false],
    [String.raw`https://example.test/a/..\b`, false],
    [String.raw`https://example.test/a\%2e%2e\b`, false],
    [String.raw`https://example.test/a/%2e%2e\b`, false],
    [String.raw`https://example.test/a\%2E./b`, false],
    [String.raw`https://example.test\path`, false],
    [String.raw`https://example.test/path?query=\value`, false],
    ['https://EXAMPLE.test:443/Content%2FOne/?x=1&x=2', true],
    ['https://example.test/a%5Cb/?q=%5c', true],
    ['https://example.test/a%5C..%5Cb/', true],
    ['https://example.test/%255Cpath/', true],
  ];
  const resolve = [];
  const expectedResolve = [];
  for (const [outcome, reason, expectedStatus] of [
    ['created', 'record_created', 201],
    ['resolved', 'already_resolved', 200],
    ['updated', 'source_revision_updated', 200],
    ['reconciliation_required', 'identity_conflict', 409],
  ]) {
    const response = { ...copy(fixtures.find((item) => item.type === 'ResolveResult').value), outcome, reason };
    if (outcome === 'reconciliation_required') {
      for (const field of ['resource_id', 'topic_id', 'topic_url', 'source_revision', 'synchronized_at']) response[field] = null;
    }
    for (const status of [200, 201, 409]) {
      resolve.push({ response, status });
      expectedResolve.push({ outcome, status, accepted: status === expectedStatus });
    }
  }
  const admitted = (call) => {
    try { call(); return true; }
    catch (error) { assert.ok(error instanceof amended.CmsValidationError); return false; }
  };
  const expectedUrls = urls.map(([url, accepted]) => ({ url, accepted, value: accepted ? url : null }));
  assert.deepEqual(urls.map(([url]) => {
    const accepted = admitted(() => amended.validateCms('Url', url));
    return { url, accepted, value: accepted ? url : null };
  }), expectedUrls);
  assert.deepEqual(resolve.map(({ response, status }) => ({ outcome: response.outcome, status,
    accepted: admitted(() => amended.validateCmsResponse('V4-02', response, status)) })), expectedResolve);
  for (const runtime of ['php-8.3.12', 'php-8.5.11']) {
    const binary = fileURLToPath(new URL('../../../.tools/' + runtime + '/php.exe', import.meta.url));
    const script = fileURLToPath(new URL('./php-generated.php', import.meta.url));
    const result = spawnSync(binary, ['-n', script], { input: JSON.stringify({ record: input, complete, article: authored,
      codec_regressions: { urls: urls.map(([url]) => url), resolve } }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const actual = JSON.parse(result.stdout);
    assert.deepEqual(actual.values, expected);
    assert.deepEqual(actual.codec_regressions.urls, expectedUrls);
    for (const method of ['validated', 'decoded']) {
      assert.deepEqual(actual.codec_regressions.resolve.map((item) => ({ outcome: item.outcome, status: item.status,
        accepted: item[method] })), expectedResolve);
    }
    assert.equal(actual.failed, 0);
    assert.ok(actual.passed >= 20);
  }
});
