import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateCms } from '../src/cms-runtime.mjs';
import { runPhpFixture } from './php-runtime.mjs';

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
