import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCms, validateCmsRoute, validateCmsResponse, parseCmsQuery } from '../src/cms-contract.mjs';
import { runPhpFixture } from './php-runtime.mjs';

const page = {
  connection_id: 'dbc_' + 'a'.repeat(24), after_policy_revision: 'r1', through_policy_revision: 'r3',
  items: [
    { previous_policy_revision: 'r1', policy_revision: 'r2', author_ids: [], taxonomy_ids: [] },
    { previous_policy_revision: 'r2', policy_revision: 'r3', author_ids: ['author'], taxonomy_ids: ['tag'] },
  ], next_policy_revision: null,
};
const variants = [
  [page, true],
  [{ ...page, items: [page.items[0]], next_policy_revision: 'r2' }, true],
  [{ ...page, after_policy_revision: 'r3', items: [] }, true],
  [{ ...page, items: [] }, false],
  [{ ...page, items: [page.items[1]] }, false],
  [{ ...page, items: [page.items[0]], next_policy_revision: null }, false],
  [{ ...page, next_policy_revision: 'r3' }, false],
  [{ ...page, actor_user_id: 'secret' }, false],
  [{ ...page, items: [{ ...page.items[0], author_ids: ['a', 'a'] }, page.items[1]] }, false],
  [{ ...page, items: Array(21).fill(page.items[0]) }, false],
  [{ ...page, items: [page.items[0], { ...page.items[1], policy_revision: 'r1' }], next_policy_revision: 'r1' }, false],
];

test('policy history is a closed read-only route with bounded exact query', () => {
  const query = { after_policy_revision: 'r1', through_policy_revision: 'r3' };
  validateCmsRoute('V4-37', { query, method: 'GET' });
  validateCmsResponse('V4-37', page, 200);
  assert.throws(() => validateCmsRoute('V4-37', { query, method: 'POST' }));
  assert.throws(() => validateCms('PolicyHistoryQuery', { ...query, connection_id: page.connection_id }));
  assert.throws(() => parseCmsQuery('PolicyHistoryQuery', 'after_policy_revision=a&after_policy_revision=b&through_policy_revision=c'));
});

test('policy history preserves clear/reselect and rejects broken/looped/truncated chains in JS and PHP', () => {
  const cases = variants.map(([value]) => ({ value }));
  const php = runPhpFixture('policy-history-fixture.php', cases);
  for (let i = 0; i < variants.length; i++) {
    const [value, expected] = variants[i];
    let accepted = true;
    try { validateCms('PolicyHistoryPage', value); } catch { accepted = false; }
    assert.equal(accepted, expected, `JS case ${i}`);
    assert.equal(php[i], expected, `PHP case ${i}`);
  }
});
