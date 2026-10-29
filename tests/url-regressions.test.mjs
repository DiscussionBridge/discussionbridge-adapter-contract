import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cmsUrlAuthority, parseCmsJson, semanticIdentity, validateCms, validateCmsResponse } from '../src/cms-runtime.mjs';
import { runPhpFixture } from './php-runtime.mjs';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/url-contextj.json', import.meta.url)));
const connection = JSON.parse(readFileSync(new URL('../fixtures/positive-examples.json', import.meta.url))).fixtures.find(item => item.id === 'connection').value;
const contexts = fixture.cases.flatMap(item => [
  { id: item.id + '/unicode', url: 'https://' + item.label + '.example/Original%2F?q=%2F', accepted: item.accepted, asciiHost: item.asciiHost },
  { id: item.id + '/ace', url: 'https://' + item.asciiHost + '/Original%2F?q=%2F', accepted: item.accepted, asciiHost: item.asciiHost },
]);
function phpBatches(name, items) {
  const results = [];
  for (let i = 0; i < items.length; i += 256) results.push(...runPhpFixture(name, items.slice(i, i + 256)));
  return results;
}
function checkConnections(items) {
  const php = phpBatches('php-connection-origins.php', items);
  for (const [index, item] of items.entries()) {
    const value = structuredClone(connection);
    value.destination_origin = item.url;
    const before = semanticIdentity(value);
    const actions = { typed: () => validateCms('Connection', value),
      route: () => validateCmsResponse('V4-01', value, 200),
      'decoded-route': () => validateCmsResponse('V4-01', parseCmsJson(JSON.stringify(value)), 200) };
    assert.equal(php[index].id, item.id);
    for (const [mode, action] of Object.entries(actions)) {
      if (item.accepted) {
        assert.equal(action().destination_origin, item.url, item.id + '/' + mode);
        assert.deepEqual(php[index][mode], { accepted: true, origin: item.url }, item.id + '/' + mode);
      } else {
        assert.throws(action, error => error.code === 'invalid_field', item.id + '/' + mode);
        assert.equal(php[index][mode].accepted, false, item.id + '/' + mode);
        assert.equal(php[index][mode].code, 'invalid_field', item.id + '/' + mode);
      }
    }
    assert.equal(semanticIdentity(value), before, item.id + '/input-mutated');
  }
}
test('R1-A fixtures cover independently specified pair/triple ContextJ permutations, not implementation agreement', () => {
  assert.equal(fixture.unicode_version, '17.0.0');
  assert.equal(fixture.contexts.length, 10);
  assert.equal(fixture.cases.length, 1116);
  assert.equal(contexts.length, 2232);
  assert.equal(new Set(contexts.map(item => item.id)).size, 2232);
  const rules = new Map(fixture.contexts.map(item => [item.id, item]));
  let combinations = 0;
  for (const item of fixture.cases) {
    assert.deepEqual(item.points, Array.from(item.label, char => char.codePointAt(0)), item.id);
    const parts = item.id.split('/');
    if (parts.every(part => rules.has(part))) {
      assert.equal(item.label, parts.map(part => rules.get(part).label).join('-'), item.id);
      assert.equal(item.accepted, parts.every(part => rules.get(part).accepted), item.id);
      ++combinations;
    }
  }
  assert.equal(combinations, 1110);
  const known = new Map(fixture.cases.map(item => [item.id, item]));
  assert.equal(known.get('R1-A-later-valid').asciiHost, 'xn--ggboa426xba.example');
  assert.equal(known.get('R1-A-virama-reuse').asciiHost, 'xn--ggbnab631bi66bca.example');
  assert.equal(known.get('R1-A-later-valid').accepted, false);
  assert.equal(known.get('R1-A-virama-reuse').accepted, false);
});
test('R1-A every current joiner is checked in Unicode and ACE typed URL values, preserving original bytes', () => {
  const php = phpBatches('php-url-authority.php', contexts);
  for (const [index, item] of contexts.entries()) {
    if (item.accepted) {
      assert.equal(validateCms('Url', item.url), item.url, item.id);
      assert.equal(cmsUrlAuthority(item.url).asciiHost, item.asciiHost, item.id);
      assert.equal(php[index].accepted, true, item.id);
      assert.equal(php[index].value, item.url, item.id);
      assert.equal(php[index].facts.asciiHost, item.asciiHost, item.id);
    } else {
      assert.throws(() => validateCms('Url', item.url), error => error.code === 'invalid_field', item.id);
      assert.deepEqual(php[index], { id: item.id, accepted: false, code: 'invalid_field' }, item.id);
    }
  }
});
test('R1-A per-occurrence joiner rules survive Connection and actual V4-01 response/JSON validation', () => {
  checkConnections(contexts.map(item => ({ ...item, url: item.url.replace('/Original%2F?q=%2F', '/') })));
});
test('R1-B slashless/slash-only Connection origins retain exact bytes through typed/V4-01/JSON paths', () => {
  const bases = ['https://publisher.example', 'HTTPS://Publisher.Example:00443', 'https://é.example',
    'https://xn--9ca.example', 'https://[::1]', 'https://[2001:DB8::1]:443', 'https://127.1:0',
    'https://publisher.example:65535', 'https://publisher.example:'];
  const items = bases.flatMap((base, i) => ['', '/'].map(suffix => ({ id: 'valid-' + i + suffix, url: base + suffix, accepted: true })));
  for (const [i, url] of ['https://publisher.example/article', 'https://publisher.example//',
    'https://publisher.example?', 'https://publisher.example/?q=x', 'https://publisher.example#',
    'https://publisher.example:65536', 'https://publisher.example:+443', 'https://user@publisher.example/'].entries()) {
    items.push({ id: 'invalid-' + i, url, accepted: false });
  }
  checkConnections(items);
});
