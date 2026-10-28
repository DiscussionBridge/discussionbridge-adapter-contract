import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import {
  applyCmsDefaults, CmsValidationError, cmsRetryDelay, cmsSchema, cmsSchemaIdentity,
  cmsWorkTransition, generatedReadMore, implementationVersion, nativeOwnershipReceiptSha256,
  parseCmsJson, parseCmsQuery, parseCmsRequest, semanticIdentity,
  specIdentity, validateCms, validateCmsResponse, validateCmsRoute,
} from '../src/cms-contract.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const examples = (await json('fixtures/positive-examples.json')).fixtures;
const cases = await json('fixtures/rejection-cases.json');
const fixtures = await json('fixtures/positive-examples.json');
const numericLexemes = await json('fixtures/numeric-lexemes.json');
const example = (id) => structuredClone(examples.find((item) => item.id === id).value);
const rejects = (callback, code = 'invalid_field') => assert.throws(callback, (error) => error instanceof CmsValidationError && error.code === code);


for (const item of examples) {
  test(`derived V4 positive: ${item.id}`, () => {
    assert.equal(validateCms(item.type, item.value), item.value);
    const fixture = fixtures.fixtures.find((entry) => entry.id === item.id);
    assert.deepEqual(fixture.value, item.value);
  });
}
for (const item of cases.type_cases.filter((entry) => entry.profile === 'v4' && cmsSchema.types[entry.type])) {
  test(`derived V4 negative: ${item.id}`, () => rejects(() => validateCms(item.type, item.input), item.expected.code));
}
for (const item of cases.raw_json_cases.filter((entry) => entry.profile === 'v4')) {
  test(`derived V4 raw JSON negative: ${item.id}`, () => rejects(() => parseCmsJson(item.raw), item.expected.code));
}

test('decoded UTF8 byte bounds preserve identities and reject malformed Unicode', () => {
  validateCms('OpaqueId', 'é'.repeat(127));
  rejects(() => validateCms('OpaqueId', 'é'.repeat(128)));
  rejects(() => validateCms('OpaqueId', '\ud800'));
  rejects(() => validateCms('OpaqueId', ' \t '));
  rejects(() => validateCms('OpaqueId', 'identity\u0085'));
  assert.notEqual(semanticIdentity('é'), semanticIdentity('e\u0301'));
});

test('effective forum name is required plain UTF8 with a 200-byte limit', () => {
  const connection = example('connection');
  for (const name of ['Source Forum', 'é'.repeat(100), '😀'.repeat(50), '  Source Forum  ', '<Source & Forum>']) {
    connection.forum_name = name;
    assert.equal(validateCms('Connection', connection), connection);
    assert.equal(connection.forum_name, name);
  }

  for (const name of [null, '', '   ', 'Forum\nName', 'Forum\u007f', 'Forum\u0085', 'é'.repeat(101), `${'é'.repeat(100)} `, '😀'.repeat(51), '\ud800']) {
    connection.forum_name = name;
    assert.throws(() => validateCms('Connection', connection),
      (error) => error instanceof CmsValidationError && error.code === 'invalid_field' && error.path === '$.forum_name');
  }
  delete connection.forum_name;
  assert.throws(() => validateCms('Connection', connection),
    (error) => error instanceof CmsValidationError && error.code === 'invalid_field' && error.path === '$.forum_name');
});

test('millisecond UTC calendar and signed64 decimal identities are exact', () => {
  validateCms('Instant', '2024-02-29T12:34:56.789Z');
  for (const value of ['2023-02-29T12:34:56.789Z', '2024-02-29T12:34:60.000Z', '2024-02-29T24:00:00.000Z', '2024-02-29T12:34:56Z', '2024-02-29T12:34:56.789+00:00']) rejects(() => validateCms('Instant', value));
  validateCms('CoreId', '9223372036854775807');
  for (const value of ['9223372036854775808', '01', '0', 9223372036854775807, '+1']) rejects(() => validateCms('CoreId', value));
  for (const value of [-0, 1.5, Infinity, NaN, '1', true, 9007199254740992]) rejects(() => validateCms('UInt', value));
});

test('URL validation refuses hidden authority and path normalization traps', () => {
  validateCms('Url', 'https://EXAMPLE.test:443/Content%2FOne/?x=1&x=2');
  for (const value of ['http://example.test/', 'https://user@example.test/', 'https://example.test/#', 'https://example.test/a/../b', 'https://example.test/a/%2e%2e/b', 'https://example.test/%GG', 'https://example.test/ white']) rejects(() => validateCms('Url', value));
  const connection = example('connection');
  connection.destination_origin = 'https://publisher.example/path/';
  rejects(() => validateCms('Connection', connection));
});

test('raw backslash URLs cannot hide dot segments or change browser path identity', () => {
  for (const url of [
    String.raw`https://example.test/a\..\b`,
    String.raw`https://example.test/a\../b`,
    String.raw`https://example.test/a/..\b`,
    String.raw`https://example.test/a\%2e%2e\b`,
    String.raw`https://example.test/a/%2e%2e\b`,
    String.raw`https://example.test/a\%2E./b`,
    String.raw`https://example.test\path`,
    String.raw`https://example.test/path?query=\value`,
  ]) {
    rejects(() => validateCms('Url', url));
    rejects(() => generatedReadMore(url));
  }
  for (const url of [
    'https://EXAMPLE.test:443/Content%2FOne/?x=1&x=2',
    'https://example.test/a%5Cb/?q=%5c',
    'https://example.test/a%5C..%5Cb/',
    'https://example.test/%255Cpath/',
  ]) assert.equal(validateCms('Url', url), url);
});

test('nullable required fields, optional omission and defaults remain distinct', () => {
  const input = example('to_resolve');
  assert.equal(input.bridge_record.source_created_at, '2026-10-01T12:00:00.000Z');
  delete input.bridge_record.source_created_at;
  rejects(() => validateCms('ToResolve', input));
  input.bridge_record.source_created_at = null;
  validateCms('ToResolve', input);
  input.bridge_record.adapter_id = null;
  rejects(() => validateCms('ToResolve', input));
  assert.deepEqual(applyCmsDefaults('ContentQuery', {}), { offset: 0 });
  rejects(() => applyCmsDefaults('ContentQuery', { offset: null }));
});

test('tagged unions reject absent and cross-branch fields without secret text in errors', () => {
  const token = example('renew').authority.lease_token;
  rejects(() => validateCms('Ack', { ...example('sync_ack'), stage: 'verified' }), 'invalid_field');
  const ack = example('sync_ack');
  ack.deployment_id = 'build-id';
  rejects(() => validateCms('Ack', ack), 'unknown_field');
  const renew = example('renew');
  renew.authority.lease_token = `${token} extra-secret`;
  assert.throws(() => validateCms('Renew', renew), (error) => !String(error).includes(token) && !String(error).includes('extra-secret'));
});

test('canonical base64 and unpadded32 byte secret tokens reject padding-bit aliases', () => {
  const token = Buffer.alloc(32, 0xff).toString('base64url');
  validateCms('LeaseToken', token);
  rejects(() => validateCms('LeaseToken', `${token.slice(0, -1)}_`));
  validateCms('Base64', 'YQ==');
  for (const value of ['YQ', 'YR==', 'YQ==\n', 'YQ===']) rejects(() => validateCms('Base64', value));
  validateCms('Base64', '');
});

test('chunk boundaries describe exact bytes and can split UTF8 without becoming excerpts', () => {
  const chunk = example('content_chunk');
  Object.assign(chunk, { content_bytes: 4, offset: 0, next_offset: 2, content_base64: Buffer.from([0xf0, 0x9f]).toString('base64') });
  validateCms('ContentChunk', chunk);
  chunk.next_offset = null;
  rejects(() => validateCms('ContentChunk', chunk));
  Object.assign(chunk, { offset: 4, next_offset: null, content_base64: '' });
  validateCms('ContentChunk', chunk);
  chunk.offset = 5;
  rejects(() => validateCms('ContentChunk', chunk));
});

test('source author IDs and known chronology cannot become ambiguous', () => {
  const source = example('initial_feed').items[0].source;
  validateCms('Source', source);
  source.source_updated_at = '2020-01-01T00:00:00.000Z';
  rejects(() => validateCms('Source', source));
  source.source_updated_at = null;
  validateCms('Source', source);
  const authors = [{ id: 'one', name: 'First' }, { id: 'one', name: 'Second' }];
  rejects(() => validateCms('SourceAuthors', authors));
  const input = example('to_resolve');
  input.bridge_record.primary_source_author_id = 'absent';
  rejects(() => validateCms('ToResolve', input));
});

test('work action revision, lease generation and retry ceiling remain exact', () => {
  const lease = example('lease');
  validateCms('Lease', lease);
  lease.work.attempt = 4;
  rejects(() => validateCms('Lease', lease));
  lease.work.attempt = 1;
  lease.work.source_revision = null;
  rejects(() => validateCms('Lease', lease));
  lease.work.action = 'withdraw';
  validateCms('Lease', lease);
  lease.lease_generation++;
  rejects(() => validateCms('Lease', lease));
  assert.equal(cmsRetryDelay('rate_limited', 1), 30);
  assert.equal(cmsRetryDelay('transport_timeout', 2), 120);
  assert.equal(cmsRetryDelay('native_service_unavailable', 1, 60), 60);
  assert.equal(cmsRetryDelay('rate_limited', 3, 3600), null);
  assert.equal(cmsRetryDelay('public_verification_failed', 1), null);
  rejects(() => cmsRetryDelay('rate_limited', 1, 3601));
  rejects(() => cmsRetryDelay('public_verification_failed', 1, 30));
});

test('public verification hashes and withdrawal statuses cannot be substituted', () => {
  const verification = example('verify_ack').verification;
  verification.representation.source_content_sha256 = '0'.repeat(64);
  rejects(() => validateCms('PublishedVerification', verification));
  const absence = example('dynamic_withdraw_verified').verification;
  for (const status of [200, 301, 401, 403, 500]) {
    absence.http_status = status;
    rejects(() => validateCms('AbsentVerification', absence));
  }
  absence.http_status = 410;
  validateCms('AbsentVerification', absence);
});

test('policy selection and feed checkpoints cannot silently widen or rewind', () => {
  const policy = example('policy');
  policy.exclude_topic_ids = [policy.category_ids[0]];
  policy.include_topic_ids = [policy.category_ids[0]];
  rejects(() => validateCms('Policy', policy));
  const feed = example('initial_feed');
  feed.next_cursor = 'more';
  feed.checkpoint_cursor = 'checkpoint';
  rejects(() => validateCms('SourceFeed', feed));
  rejects(() => validateCms('SourceFeedQuery', { stream: 'changes' }));
});

test('every declared work transition is accessible and terminal work has no reset', () => {
  for (const transition of cmsSchema.workTransitions) assert.equal(cmsWorkTransition(transition.from, transition.event), transition.to);
  for (const state of ['verified', 'cancelled', 'superseded']) rejects(() => cmsWorkTransition(state, 'explicit_authorized_retry_new_cycle'), 'invalid_transition');
  rejects(() => cmsWorkTransition('leased', 'static_finalize'), 'invalid_transition');
  assert.equal(cmsWorkTransition('synchronized', 'static_abort'), 'attention');
});

test('strict JSON rejects duplicate decoded keys at depth, invalidUTF8,BOM and trailing data', () => {
  for (const raw of ['{"one":{"x":1,"\\u0078":2}}', '{"one":1}true', '{"one":01}', '{"one":1,}', '{"one":"\\ud800"}', '[1,2]']) rejects(() => parseCmsJson(raw), 'invalid_json');
  rejects(() => parseCmsJson(Buffer.from([0x7b, 0xff, 0x7d])), 'invalid_json');
  rejects(() => parseCmsJson(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), 'invalid_json');
  const parsed = parseCmsJson('{"a":1.0,"__proto__":{"owned":false},"b":[true,null,"é"]}');
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(parsed.a, 1);
  assert.equal(Object.hasOwn(parsed, '__proto__'), true);
  assert.equal(semanticIdentity(parseCmsJson('{"a":1,"b":2}')), semanticIdentity(parseCmsJson('{"b":2,"a":1e0}')));
  assert.notEqual(semanticIdentity({ a: null }), semanticIdentity({}));
  rejects(() => parseCmsJson(`{"body":"${'a'.repeat(65536)}"}`), 'body_too_large');
});

for (const item of numericLexemes.valid) {
  test(`raw CMS exact integer: ${item.id}`, () => {
    const parsed = parseCmsJson(`{"offset":${item.lexeme}}`);
    assert.equal(parsed.offset, item.value);
    validateCms('ContentQuery', parsed);
    assert.equal(semanticIdentity(parsed), semanticIdentity({ offset: item.value }));
    assert.deepEqual(applyCmsDefaults('ContentQuery', parsed), { offset: item.value });
  });
}
for (const item of numericLexemes.invalid) {
  test(`raw CMS exact integer rejects: ${item.id}`, () => {
    const raw = `{"offset":${item.lexeme}}`;
    if (Object.hasOwn(item, 'js_number')) assert.equal(JSON.parse(raw).offset, item.js_number);
    rejects(() => parseCmsJson(raw));
    const syntaxOnly = parseCmsJson(raw, { rejectInvalidNumbers: false });
    assert.throws(() => validateCms('ContentQuery', syntaxOnly), (error) => error instanceof CmsValidationError && error.code === 'invalid_field' && error.path === '$.offset');
    rejects(() => applyCmsDefaults('ContentQuery', syntaxOnly));
    rejects(() => semanticIdentity(syntaxOnly));
  });
}
for (const item of numericLexemes.syntax_errors) {
  test(`raw CMS syntax precedes numeric semantics: ${item.id}`, () => {
    rejects(() => parseCmsJson(item.raw), 'invalid_json');
    rejects(() => parseCmsJson(item.raw, { rejectInvalidNumbers: false }), 'invalid_json');
  });
}

test('CMS syntax-only ingress allows authentication before exact numeric checks', () => {
  const beforeAuthenticatedTypeCheck = (raw, authenticated) => {
    const parsed = parseCmsJson(raw, { rejectInvalidNumbers: false });
    if (!authenticated) throw new CmsValidationError('authentication_failed');
    return validateCms('ContentQuery', parsed);
  };
  rejects(() => beforeAuthenticatedTypeCheck('{"offset":1e-999}', false), 'authentication_failed');
  rejects(() => beforeAuthenticatedTypeCheck('{"offset":1e-999}', true));
  rejects(() => beforeAuthenticatedTypeCheck('{"offset":1e-999,}', false), 'invalid_json');
  const syntaxOnly = parseCmsJson('{"offset":1.0}', { rejectInvalidNumbers: false });
  // Validate the annotated original before cloning/extracting numeric leaves.
  validateCms('ContentQuery', syntaxOnly);
  validateCms('ContentQuery', structuredClone(syntaxOnly));
});

test('exact numeric provenance reaches numeric enum and nested array/tagged-union fields', () => {
  const absence = example('dynamic_withdraw_verified').verification;
  absence.http_status = 404;
  const rawAbsence = JSON.stringify(absence).replace('"http_status":404', '"http_status":404.00000000000000001');
  assert.equal(JSON.parse(rawAbsence).http_status, 404);
  rejects(() => parseCmsJson(rawAbsence));
  assert.throws(() => validateCms('AbsentVerification', parseCmsJson(rawAbsence, { rejectInvalidNumbers: false })), (error) => error instanceof CmsValidationError && error.path === '$.http_status');
  const feed = example('initial_feed');
  feed.items[0].source.content_bytes = 1;
  const rawFeed = JSON.stringify(feed).replace('"content_bytes":1', '"content_bytes":1.00000000000000001');
  assert.throws(() => validateCms('SourceFeed', parseCmsJson(rawFeed, { rejectInvalidNumbers: false })), (error) => error instanceof CmsValidationError && error.path === '$.items[0].source.content_bytes');
  const array = parseCmsJson('{"values":[1,1e-999]}', { rejectInvalidNumbers: false });
  rejects(() => semanticIdentity(array));
  const quoted = parseCmsJson('{"source_id":"1e-999","topic_id":"9223372036854775807"}');
  validateCms('OpaqueId', quoted.source_id); validateCms('CoreId', quoted.topic_id);
});

test('route typed-field declaration ordering remains ahead of rounded numeric aliases', () => {
  const input = example('renew');
  input.authority.work_id = 'invalid-uuid';
  const raw = JSON.stringify(input).replace(/"lease_generation":\d+/, '"lease_generation":1.00000000000000001');
  assert.throws(() => parseCmsRequest('V4-15', { rawBody: raw, mediaType: 'application/json', path: { work_id: input.authority.work_id } }),
    (error) => error instanceof CmsValidationError && error.path === '$.authority.work_id');
  input.authority.work_id = example('renew').authority.work_id;
  const currentRaw = JSON.stringify(input).replace(/"lease_generation":\d+/, '"lease_generation":1.00000000000000001');
  assert.throws(() => parseCmsRequest('V4-15', { rawBody: currentRaw, mediaType: 'application/json', path: { work_id: input.authority.work_id } }),
    (error) => error instanceof CmsValidationError && error.path === '$.authority.lease_generation');
});

test('large lexical exponents and cancelling mantissas remain bounded without decimal allocation', { timeout: 10000 }, () => {
  const hugeExponent = '9'.repeat(32000);
  rejects(() => parseCmsJson(`{"offset":1e${hugeExponent}}`));
  rejects(() => parseCmsJson(`{"offset":1e-${hugeExponent}}`));
  assert.equal(parseCmsJson(`{"offset":0e${hugeExponent}}`).offset, 0);
  assert.equal(parseCmsJson(`{"offset":1e${'0'.repeat(32000)}}`).offset, 1);
  const cancelled = `1${'0'.repeat(16000)}e-16000`;
  assert.equal(parseCmsJson(`{"offset":${cancelled}}`).offset, 1);
  for (const spec of Object.values(cmsSchema.types)) {
    if (spec.kind === 'integer') assert.ok(spec.minimum >= 0 && spec.maximum <= Number.MAX_SAFE_INTEGER);
    if (spec.kind === 'enum') assert.ok(spec.values.filter((value) => typeof value === 'number').every((value) => Number.isSafeInteger(value) && value >= 0));
  }
});

test('query decoding is once, canonical and rejects duplicate/unknown/invalidUTF8', () => {
  assert.deepEqual({ ...parseCmsQuery('ContentQuery', 'offset=32') }, { offset: 32 });
  assert.deepEqual({ ...parseCmsQuery('ContentQuery', '') }, {});
  for (const raw of ['offset=01', 'offset=-0', 'offset=1e0', 'offset=1&offset=2', 'offset=%FF', 'offset=%', 'offset=9007199254740992']) rejects(() => parseCmsQuery('ContentQuery', raw));
  rejects(() => parseCmsQuery('ContentQuery', 'extra=1'), 'unknown_field');
  rejects(() => parseCmsQuery(null, 'extra=1'), 'unknown_field');
  rejects(() => parseCmsQuery('CursorQuery', 'cursor=%252f'));
});

test('request route rejects wrong path identity,method,GETbody,media and compression', () => {
  const input = example('renew');
  const workId = input.authority.work_id;
  validateCmsRoute('V4-15', { body: input, path: { work_id: workId } });
  rejects(() => validateCmsRoute('V4-15', { body: input, path: { work_id: '11111111-1111-4111-8111-999999999999' } }), 'identity_conflict');
  parseCmsRequest('V4-15', { rawBody: JSON.stringify(input), mediaType: 'application/json; charset=UTF-8', path: { work_id: workId } });
  rejects(() => parseCmsRequest('V4-15', { rawBody: JSON.stringify(input), mediaType: 'application/json; charset=ISO-8859-1' }), 'unsupported_media_type');
  rejects(() => parseCmsRequest('V4-15', { rawBody: JSON.stringify(input), mediaType: 'application/json', contentEncoding: 'gzip' }), 'unsupported_media_type');
  rejects(() => parseCmsRequest('V4-14', { rawBody: '{}', path: { work_id: workId } }));
  rejects(() => validateCmsRoute('V4-14', { method: 'POST', path: { work_id: workId } }));
});

test('bodyless204 claim,closedstatus and receiver-derived failure HTTP preserve truth', () => {
  validateCmsResponse('V4-13', undefined, 204);
  rejects(() => validateCmsResponse('V4-13', {}, 204));
  const status = example('work_status');
  status.lease_token = 'must-not-be-disclosed';
  rejects(() => validateCmsResponse('V4-14', status, 200), 'unknown_field');
  const error = example('error');
  validateCmsResponse('V4-14', error, 409);
  rejects(() => validateCmsResponse('V4-14', error, 503));
  error.retryable = true;
  rejects(() => validateCms('Error', error));
});

for (const [outcome, reason, expectedStatus] of [
  ['created', 'record_created', 201],
  ['resolved', 'already_resolved', 200],
  ['updated', 'source_revision_updated', 200],
  ['reconciliation_required', 'identity_conflict', 409],
]) {
  test(`To resolve ${outcome} accepts only its contract HTTP status`, () => {
    const response = { ...example('resolve_created'), outcome, reason };
    if (outcome === 'reconciliation_required') {
      for (const field of ['resource_id', 'topic_id', 'topic_url', 'source_revision', 'synchronized_at']) response[field] = null;
    }
    for (const status of [200, 201, 409]) {
      if (status === expectedStatus) assert.equal(validateCmsResponse('V4-02', response, status), response);
      else rejects(() => validateCmsResponse('V4-02', response, status));
    }
  });
}

test('To resolve conflicts reject disclosed protected fields at409', () => {
  const original = example('resolve_created');
  const conflict = { ...original, outcome: 'reconciliation_required', reason: 'identity_conflict' };
  const protectedFields = ['resource_id', 'topic_id', 'topic_url', 'source_revision', 'synchronized_at'];
  for (const field of protectedFields) conflict[field] = null;
  for (const field of protectedFields) {
    rejects(() => validateCmsResponse('V4-02', { ...conflict, [field]: original[field] }, 409));
  }
});

test('non-resolve routes retain every declared successful response status', () => {
  for (const route of cmsSchema.routes.filter((item) => item.id !== 'V4-02')) {
    const response = examples.find((item) => item.type === route.response).value;
    for (const status of route.success_http) {
      const value = status === 204 ? undefined : response;
      assert.equal(validateCmsResponse(route.id, value, status), value);
    }
  }
});

test('ownership fingerprint has cross-language field-order,length,null and generation vector', () => {
  const receipt = example('native_ownership_receipt');
  assert.equal(nativeOwnershipReceiptSha256(receipt), 'ef9ae2df5fa27e2ba912358f727d7031a34cbac6914cdb99b38b3a88754801e1');
  const reversed = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(nativeOwnershipReceiptSha256(reversed), nativeOwnershipReceiptSha256(receipt));
  receipt.last_lease_generation++;
  assert.notEqual(nativeOwnershipReceiptSha256(receipt), nativeOwnershipReceiptSha256(reversed));
  receipt.lease_token = 'forbidden-native-secret';
  rejects(() => nativeOwnershipReceiptSha256(receipt), 'unknown_field');
});

const preservationError = () => ({ outcome: 'rejected', code: 'content_preservation_unavailable',
  retryable: false, retry_after_seconds: null, correlation_id: null, core_fallback: false });

test('explicit To retry uses an existing fresh envelope without changing the source edition', () => {
  const refused = example('to_resolve');
  const next = structuredClone(refused);
  next.mutation_id = '22222222-2222-4222-8222-222222222222';
  validateCmsRoute('V4-02', { body: refused }); // Shape alone has no refusal history.
  validateCmsRoute('V4-02', { body: next });
  assert.notEqual(semanticIdentity(refused), semanticIdentity(next));
  assert.equal(semanticIdentity(refused.bridge_record), semanticIdentity(next.bridge_record));
  assert.equal(next.bridge_record.source_revision, refused.bridge_record.source_revision);
  rejects(() => validateCmsRoute('V4-02', { body: { ...next, retry_of_mutation_id: refused.mutation_id } }), 'unknown_field');
});
test('invalid_field stays permanent422 with no public failure receipt or retry metadata', () => {
  const error = { outcome: 'rejected', code: 'invalid_field', retryable: false,
    retry_after_seconds: null, correlation_id: null, core_fallback: false };
  validateCmsResponse('V4-02', error, 422);
  rejects(() => validateCmsResponse('V4-02', error, 400));
  rejects(() => validateCmsResponse('V4-02', { ...error, retryable: true }, 422));
  rejects(() => validateCmsResponse('V4-02', { ...error, retry_after_seconds: 30 }, 422));
  rejects(() => validateCmsResponse('V4-02', { ...error, rejected_mutation_id: '22222222-2222-4222-8222-222222222222' }, 422), 'unknown_field');
  assert.equal(cmsRetryDelay('invalid_field', 1), null);
});
for (const route of cmsSchema.routes) {
  test(`content preservation error has exact route applicability: ${route.id}`, () => {
    const error = preservationError();
    if (['V4-02', 'V4-29'].includes(route.id)) assert.equal(validateCmsResponse(route.id, error, 422), error);
    else rejects(() => validateCmsResponse(route.id, error, 422));
  });
}
test('content preservation error stays closed, permanent, status-bound and nonretryable', () => {
  const error = preservationError();
  assert.equal(validateCms('Error', error), error);
  for (const id of ['V4-02', 'V4-29']) {
    for (const status of [400, 409, 500, 503]) rejects(() => validateCmsResponse(id, error, status));
    rejects(() => validateCmsResponse(id, { ...error, retryable: true }, 422));
    rejects(() => validateCmsResponse(id, { ...error, retry_after_seconds: 30 }, 422));
    rejects(() => validateCmsResponse(id, { ...error, detail: 'unapproved field' }, 422), 'unknown_field');
  }
  for (const attempt of [1, 2, 3]) assert.equal(cmsRetryDelay(error.code, attempt), null);
  rejects(() => cmsRetryDelay(error.code, 1, 30));
});
test('To-only preservation code cannot become From Failure or Work attention through nested values', () => {
  const failure = example('failure'); failure.code = preservationError().code;
  rejects(() => validateCms('Failure', failure));
  rejects(() => validateCmsRoute('V4-17', { body: failure, path: { work_id: failure.authority.work_id } }));
  const lease = example('lease'); lease.work.last_failure_code = preservationError().code;
  rejects(() => validateCms('Work', lease.work));
  rejects(() => validateCms('Lease', lease));
  rejects(() => validateCmsResponse('V4-13', lease, 200));
});
test('existing error meanings retain status, Error/Failure and Work value acceptance', () => {
  for (const spec of cmsSchema.errors.filter((item) => item.code !== preservationError().code)) {
    const error = { ...preservationError(), code: spec.code, retryable: spec.retryable };
    for (const route of cmsSchema.routes) validateCmsResponse(route.id, error, spec.http);
    const failure = example('failure'); failure.code = spec.code; failure.retry_after_seconds = null;
    validateCms('Failure', failure);
    const work = example('lease').work; work.last_failure_code = spec.code;
    validateCms('Work', work);
  }
});

test('portable byte-exact runtime works without sibling checkout and rejects altered schema', async () => {
  const created = [];
  try {
    for (const tamper of [false, true]) {
      const directory = await mkdtemp(join(tmpdir(), 'discussionbridge-cms-runtime-'));
      created.push(directory);
      for (const name of ['cms-runtime.mjs', 'cms-schema.json']) await copyFile(new URL(`../src/${name}`, import.meta.url), join(directory, name));
      if (tamper) {
        const path = join(directory, 'cms-schema.json');
        await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('\n')]));
        await assert.rejects(import(pathToFileURL(join(directory, 'cms-runtime.mjs')).href), /CMS extracted grammar identity mismatch/);
      } else {
        const portable = await import(pathToFileURL(join(directory, 'cms-runtime.mjs')).href);
        assert.equal(portable.cmsSchemaIdentity.sha256, cmsSchemaIdentity.sha256);
        for (const item of examples) portable.validateCms(item.type, item.value);
        for (const item of numericLexemes.valid) portable.validateCms('ContentQuery', portable.parseCmsJson(`{"offset":${item.lexeme}}`));
        for (const item of numericLexemes.invalid) assert.throws(() => portable.parseCmsJson(`{"offset":${item.lexeme}}`), (error) => error instanceof portable.CmsValidationError && error.code === 'invalid_field');
        assert.equal(portable.nativeOwnershipReceiptSha256(example('native_ownership_receipt')), 'ef9ae2df5fa27e2ba912358f727d7031a34cbac6914cdb99b38b3a88754801e1');
      }
    }
  } finally {
    for (const directory of created) {
      const absolute = resolve(directory);
      assert.equal(dirname(absolute), resolve(tmpdir()));
      assert.ok(basename(absolute).startsWith('discussionbridge-cms-runtime-'));
      await rm(absolute, { recursive: true, force: true });
    }
  }
});
