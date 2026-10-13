import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async (name) => JSON.parse(await readFile(new URL(`../${name}`, import.meta.url), 'utf8'));
const base = await readJson('contract.json');
const current = await readJson('CURRENT_CORE_CONTRACT.json');
const extension = await readJson(current.extension);
const source = await readJson('fixtures/core-publication/source-edition-input.json');
const edition = (input) => createHash('sha256').update(JSON.stringify(extension.from_discourse.active_source.edition_array.map((field) => input[field] ?? null)), 'utf8').digest('hex');

test('current candidate preserves the v1 base and explicitly binds the approved CMS authority', () => {
  assert.equal(base.version, '0.2.0-alpha.20');
  assert.equal(current.version, '0.3.0-alpha.1');
  assert.equal(current.version, extension.version);
  assert.equal(current.status, 'build_candidate');
  assert.equal(current.historical_release_is_current_implementation_authority, true);
  assert.equal(current.cms_candidate, 'cms-publication-candidate.json');
  assert.equal(extension.compatibility.negotiation_value, current.version);
  assert.equal(extension.authentication.connection_header, base.authentication.connection_header);
  assert.equal(extension.authentication.secret_header, base.authentication.secret_header);
  assert.equal(extension.authentication.new_identity_headers, false);
  assert.equal(extension.to_discourse.request_json_maximum_bytes, base.resolve.maximum_json_bytes);
  assert.equal(extension.to_discourse.content_html_maximum_bytes, base.resolve.field_rules.content_html_maximum_bytes);
});

test('canonical native source edition has a fixed cross-language UTF8 golden identity', () => {
  assert.equal(extension.from_discourse.active_source.edition_array.length, 17);
  assert.equal(edition(source), 'a93a2f632dfcab5dbcd0613db969c8295ae25cae61fa91aa382eca432b010d30');
  assert.equal(edition({ ...source, topic_updated_at: '2026-10-12T12:00:00.000000Z', last_reply_id: 101 }), edition(source));
  for (const field of ['title', 'raw', 'cooked', 'post_updated_at', 'effective_author_name', 'forum_name']) {
    assert.notEqual(edition({ ...source, [field]: `${source[field]} edited` }), edition(source), `${field} must invalidate the source edition`);
  }
});

test('legacy resolve fixtures retain exact identity outcomes and do not require publication updates', async () => {
  const request = await readJson('fixtures/to-discourse-request.json');
  const record = request.bridge_record;
  assert.equal(record.published, true);
  assert.equal(record.direction, 'to_discourse');
  assert.equal(Object.hasOwn(record, 'source_publication'), false);
  for (const [file, outcome] of [['created-response.json', 'created'], ['resolved-response.json', 'resolved'], ['reconciliation-required-response.json', 'reconciliation_required']]) {
    const response = await readJson(`fixtures/${file}`);
    assert.equal(response.outcome, outcome);
    assert.equal(response.core_fallback, false);
  }
});

test('content transfer bounds do not become publication caps or outbound limit changes', () => {
  const from = extension.from_discourse;
  assert.equal(from.content_transport.maximum_raw_chunk_bytes, 32768);
  assert.equal(from.content_transport.maximum_json_response_bytes, 65536);
  assert.equal(from.metadata_response_maximum_bytes, 2097152);
  assert.equal(from.content_transport.source_change_restart_maximum_attempts, 3);
  assert.equal(from.active_source.content.chunk_bytes, 32768);
  assert.deepEqual(from.presentation_binding.presentation_mode, ['simple', 'full', 'interactive', null]);
  assert.equal(extension.to_discourse.content_html_maximum_bytes, 49152);
});
