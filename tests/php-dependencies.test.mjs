import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { verifyPhpIdnaBundle } from '../scripts/php-idna-bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const php = process.env.DISCUSSIONBRIDGE_PHP_BINARY ?? 'php';
const disabled = 'iconv,iconv_strlen,iconv_strpos,iconv_strrpos,iconv_substr,iconv_mime_encode,iconv_mime_decode,iconv_mime_decode_headers,mb_ord,mb_str_split,mb_internal_encoding,idn_to_ascii,idn_to_utf8';
function run(file, ...args) {
  const result = spawnSync(php, ['-n', '-d', 'disable_functions=' + disabled, file, ...args], {
    encoding: 'utf8', timeout: 20000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}

test('committed dependency runtime is complete and privately isolated without optional extensions', () => {
  const bundle = verifyPhpIdnaBundle(root);
  assert.equal(bundle.namespace, 'DiscussionBridge\\CmsV4\\IdnaVendor');
  const result = run(join(root, 'tests/php-idna-isolation.php'));
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = JSON.parse(result.stdout);
  assert.ok(output.checks > 40);
  assert.deepEqual(output.optional_functions, []);
});

test('ordinary copied PHP runtime needs its exact complete bundle and refuses changed members', () => {
  const directory = mkdtempSync(join(tmpdir(), 'discussionbridge-idna-'));
  try {
    const codec = join(directory, 'CmsCodec.php');
    const schema = join(directory, 'cms-schema.json');
    cpSync(join(root, 'src/php/CmsCodec.php'), codec);
    cpSync(join(root, 'src/cms-schema.json'), schema);
    const execute = () => run(join(root, 'tests/php-idna-portable.php'), codec, schema);
    let result = execute();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CMS private IDNA identity mismatch/);
    cpSync(join(root, 'src/php/idna'), join(directory, 'idna'), { recursive: true });
    result = execute();
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stdout.trim(), 'portable-idna-ok');
    const license = join(directory, 'idna/vendor/rowbot/idna/LICENSE');
    writeFileSync(license, Buffer.concat([readFileSync(license), Buffer.from('\n')]));
    result = execute();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CMS private IDNA member mismatch/);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('discussionbridge-idna-'));
    rmSync(directory, { recursive: true });
  }
});
