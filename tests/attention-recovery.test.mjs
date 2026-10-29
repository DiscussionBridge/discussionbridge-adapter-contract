import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runPhpFixture } from './php-runtime.mjs';
import {
  assertAttentionRecoveryCapability, validateAttentionFeedPage, validateAttentionRecoveryLease,
  validateCms, validateCmsResponse, parseCmsQuery, semanticIdentity, cmsSchema,
} from '../src/cms-contract.mjs';

const cases = JSON.parse(readFileSync(new URL('../fixtures/attention-recovery-regressions.json', import.meta.url), 'utf8'));
const run = c => {
  switch (c.action) {
    case 'validate': return validateCms(c.type, c.value);
    case 'feed': return validateAttentionFeedPage(c.type, c.value, c.after);
    case 'capability': return assertAttentionRecoveryCapability(c.value, c.profile);
    case 'lease': return validateAttentionRecoveryLease(c.recovery, c.value);
    case 'query': return parseCmsQuery('AttentionFeedQuery', c.raw);
    case 'response': return validateCmsResponse(c.route, c.value, c.status);
    case 'identity': return semanticIdentity(c.value);
    default: throw Error('Unknown test action');
  }
};
const results = cases.map(c => {
  try { return { id: c.id, accepted: true, identity: semanticIdentity(run(c)) }; }
  catch (e) { if (!e.code) throw e; return { id: c.id, accepted: false, code: e.code, path: e.path }; }
});
for (let i = 0; i < cases.length; i++) {
  test(`attention r6: ${cases[i].id}`, () => {
    assert.equal(results[i].accepted, cases[i].accept);
    if (cases[i].code) assert.equal(results[i].code, cases[i].code);
  });
}

test('additive extension retains closed existing routes and exact native-admin bound', () => {
  assert.equal(cmsSchema.routes.length, 36);
  for (const name of ['Connection', 'Work', 'Claim']) assert.equal(cmsSchema.types[name].unknown_fields, 'reject');
  assert.deepEqual(Object.keys(cmsSchema.types.Claim.fields), ['mutation_id', 'mapping_id']);
  assert.equal(cmsSchema.types.AttentionCheckSelections.maximum_items, 25);
  assert.equal(cmsSchema.types.AttentionRetrySelections.maximum_items, 25);
});

test('exact report identity ignores key order but retains context and mutation identity', () => {
  const first = cases.find(c => c.id === 'report-unknown-truthful').value;
  const reordered = Object.fromEntries(Object.entries(first).reverse());
  reordered.observation = Object.fromEntries(Object.entries(first.observation).reverse());
  assert.equal(semanticIdentity(first), semanticIdentity(reordered));
  const changed = structuredClone(first); changed.context_sha256 = 'b'.repeat(64);
  assert.notEqual(semanticIdentity(first), semanticIdentity(changed));
  changed.context_sha256 = first.context_sha256;
  changed.mutation_id = '11111111-1111-4111-8111-000000009999';
  assert.notEqual(semanticIdentity(first), semanticIdentity(changed));
});

test('configured PHP runtime has exact attention codec parity', () => {
  assert.deepEqual(runPhpFixture('./php-attention.php', cases), results);
});
