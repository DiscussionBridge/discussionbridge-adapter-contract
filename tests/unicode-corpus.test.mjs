import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import { idnaCases, nfcCases, unicodeFixture } from './unicode-fixtures.mjs';

const options = { checkHyphens: false, checkBidi: true, checkJoiners: true,
  useSTD3ASCIIRules: false, transitionalProcessing: false, verifyDNSLength: false, ignoreInvalidPunycode: false };
function privateRuntime() {
  const source = readFileSync(new URL('../src/js-idna/runtime.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.normalize\s*\(/);
  // A separate realm simulates older/hostile ICU without mutating this process.
  return vm.runInNewContext('String.prototype.normalize = function(){throw Error("ambient NFC called")};\n' + source + '\nDiscussionBridgeIdnaPrivate;', {}, { timeout: 10000 });
}
test('private Unicode17 NFC matches every column of the complete official normalization corpus without native ICU', () => {
  const runtime = privateRuntime();
  assert.equal(runtime.unicodeVersion, '17.0.0');
  let checks = 0;
  for (const item of nfcCases()) {
    for (const [column, value] of item.cols.entries()) {
      assert.equal(runtime.normalizeNfc(value), item.cols[column < 3 ? 1 : 3], `line ${item.id}, column ${column + 1}`);
      ++checks;
    }
  }
  assert.equal(checks, 100170);
});
test('complete official ToASCII17 corpus agrees under the pinned policy in JS/PHP, including explicit UTF8 ingress cases', () => {
  const runtime = privateRuntime();
  const cases = idnaCases();
  for (const item of cases) {
    const actual = runtime.toAscii(item.source, options);
    if (item.invalid) assert.equal(actual, null, `JS IDNA line ${item.id}`);
    else assert.equal(actual, item.ascii, `JS IDNA line ${item.id}`);
  }
  unicodeFixture('NormalizationTest.txt');
  const php = process.env.DISCUSSIONBRIDGE_PHP_BINARY ?? 'php';
  const started = performance.now();
  const result = spawnSync(php, ['-n', fileURLToPath(new URL('./php-unicode-corpus.php', import.meta.url))], {
    input: JSON.stringify(cases.map(({ id, points, illFormed }) => ({ id, points, illFormed }))),
    encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, `Full6391 IDNA +200340 NFC/status checks: ${result.error?.message}`);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, '');
  const output = JSON.parse(result.stdout);
  assert.equal(output.idna.length, 6391);
  assert.equal(output.utf8_ingress_cases, cases.filter(item => item.illFormed).length);
  for (const [index, item] of cases.entries()) {
    const actual = output.idna[index];
    assert.equal(actual.id, item.id);
    assert.equal(actual.boundary, item.illFormed ? 'utf8' : 'idna');
    assert.equal(actual.invalid, item.invalid, `PHP IDNA line ${item.id}`);
    if (!item.invalid) assert.equal(actual.ascii, item.ascii, `PHP IDNA line ${item.id}`);
  }
  assert.equal(output.nfc_rows, 20034);
  assert.equal(output.nfc_checks, 100170);
  assert.equal(output.status_checks, 100170);
  assert.deepEqual(output.failures, []);
  console.log(JSON.stringify({ unicode: '17.0.0', idna: 6391, php_idna: 6391 - output.utf8_ingress_cases,
    php_utf8_ingress: output.utf8_ingress_cases, nfc: output.nfc_checks, nfc_status: output.status_checks,
    php_milliseconds: Math.round(performance.now() - started) }));
});
