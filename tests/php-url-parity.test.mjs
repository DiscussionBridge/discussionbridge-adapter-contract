import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { cmsSchema, cmsUrlAuthority, semanticIdentity, validateCms } from '../src/cms-runtime.mjs';
import { runPhpFixture } from './php-runtime.mjs';

test('private IDNA validates Unicode and ACE hosts without rewriting original URL bytes', () => {
  const cases = JSON.parse(readFileSync(new URL('../fixtures/url-idna-hosts.json', import.meta.url), 'utf8'));
  const urls = [...cases.valid, ...cases.invalid];
  const results = runPhpFixture('php-urls.php', urls);
  for (const [index, url] of urls.entries()) {
    const valid = index < cases.valid.length;
    // Phil approved the fixed UTS46 policy. Native host parsers may accept
    // malformed ACE/Bidi inputs and are no longer the IDNA acceptance oracle.
    if (valid) {
      assert.equal(validateCms('Url', url), url);
      assert.deepEqual(results[index], { accepted: true, value: url }, url);
    } else {
      assert.throws(() => validateCms('Url', url), error => error.code === 'invalid_field');
      assert.deepEqual(results[index], { accepted: false, code: 'invalid_field' }, url);
    }
  }
});

test('one fixed domain policy and authority facts agree across JavaScript and PHP', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/url-domain-policy.json', import.meta.url), 'utf8'));
  assert.equal(fixture.policy_id, cmsSchema.types.Url.domain_policy.id);
  assert.equal(fixture.unicode_version, cmsSchema.types.Url.domain_policy.unicode_version);
  assert.equal(new Set(fixture.cases.map(item => item.id)).size, fixture.cases.length);
  const results = runPhpFixture('php-url-authority.php', fixture.cases);
  const admitted = new Map();
  for (const [index, item] of fixture.cases.entries()) {
    if (item.accepted) {
      assert.equal(validateCms('Url', item.url), item.url, item.id);
      const facts = cmsUrlAuthority(item.url);
      assert.deepEqual(facts, item.facts, item.id);
      assert.ok(Object.isFrozen(facts));
      assert.deepEqual(results[index], { id: item.id, accepted: true, value: item.url, facts: item.facts }, item.id);
      admitted.set(item.id, item);
    } else {
      assert.throws(() => cmsUrlAuthority(item.url), error => error.code === 'invalid_field', item.id);
      assert.deepEqual(results[index], { id: item.id, accepted: false, code: 'invalid_field' }, item.id);
    }
  }
  for (const pair of fixture.comparisonPairs) {
    const left = admitted.get(pair.left), right = admitted.get(pair.right);
    assert.ok(left && right, pair.id);
    assert.equal(left.facts.asciiHost === right.facts.asciiHost, pair.asciiHostEqual, pair.id);
    assert.equal(left.facts.effectivePort === right.facts.effectivePort, pair.effectivePortEqual, pair.id);
    assert.equal(left.url === right.url, pair.originalBytesEqual, pair.id);
    assert.equal(semanticIdentity({ canonical_url: left.url }) === semanticIdentity({ canonical_url: right.url }), pair.originalBytesEqual, pair.id);
  }
});

test('forbidden raw backslashes have the same typed refusal in JavaScript and PHP', () => {
  const urls = ['https://example.test\\path', 'https://example.test/a\\..\\b', 'https://example.test/?q=\\value'];
  const results = runPhpFixture('php-urls.php', urls);
  for (const [index, url] of urls.entries()) {
    assert.throws(() => validateCms('Url', url), error => error.code === 'invalid_field');
    assert.deepEqual(results[index], { accepted: false, code: 'invalid_field' });
  }
});

test('numeric URL hosts match JavaScript acceptance without changing input bytes', () => {
  const cases = JSON.parse(readFileSync(new URL('../fixtures/url-numeric-hosts.json', import.meta.url), 'utf8'));
  const urls = [...cases.valid, ...cases.invalid, `https://${'9'.repeat(1800)}/`];
  const results = runPhpFixture('php-urls.php', urls);
  assert.equal(results.length, urls.length);
  for (const [index, url] of urls.entries()) {
    const valid = index < cases.valid.length;
    assert.equal(URL.canParse(url), valid, `native JavaScript URL oracle: ${url}`);
    if (valid) {
      assert.equal(validateCms('Url', url), url);
      assert.deepEqual(results[index], { accepted: true, value: url });
    } else {
      assert.throws(() => validateCms('Url', url));
      assert.deepEqual(results[index], { accepted: false, code: 'invalid_field' });
    }
  }
});

test('numeric radix and part-size boundaries match the native JavaScript URL parser', () => {
  const hosts = new Set();
  const radixForms = (number) => [String(number), `0${number.toString(8)}`, `0x${number.toString(16)}`];
  for (const number of [0, 1, 7, 8, 9, 127, 255, 256, 65535, 65536, 16777215, 16777216, 4294967295, 4294967296]) {
    for (const value of radixForms(number)) {
      for (const prefix of ['', '1.', '1.2.', '1.2.3.']) {
        hosts.add(`${prefix}${value}`);
        hosts.add(`${prefix}${value}.`);
      }
    }
  }
  for (const host of ['1..2', '09', '00x1', '1.2.3.4.5', 'example.123', '0xgg', '1e4', '127.1..']) hosts.add(host);
  const urls = [...hosts].map((host) => `https://${host}/original?x=1`);
  const results = runPhpFixture('php-urls.php', urls);
  assert.equal(results.length, urls.length);
  for (const [index, url] of urls.entries()) {
    const expected = URL.canParse(url);
    assert.equal(results[index].accepted, expected, url);
    if (expected) {
      assert.equal(validateCms('Url', url), url);
      assert.equal(results[index].value, url);
    } else {
      assert.throws(() => validateCms('Url', url));
      assert.equal(results[index].code, 'invalid_field', url);
    }
  }
});
