import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

test('actual private bootstrap coexists with absent, earlier, later and cold host Composer without changing its package census', () => {
  // Exact unmodified Composer 2.8.1 class bodies, copied from the ordinary
  // locked-runtime Composer output; the accompanying upstream license ships.
  // This is a real class engine/API with synthetic host data, not a class stub.
  for (const [name, expected] of Object.entries({
    'InstalledVersions.php': '21f4ba19e7859cb3f85b8b1680c970ee25d972546c1606dcae0e7e5f43f626f0',
    'ClassLoader.php': 'd4b2313e562edf942838ec316d983c1a3459ca67da3e5658e861200b0b3693c2',
    LICENSE: 'c8cce4b6b9729f264ffdf9296d505d63432497feeed1f586d1902b942197e024',
  })) assert.equal(createHash('sha256').update(readFileSync(join(root, 'tests/fixtures/composer', name))).digest('hex'), expected);
  const directory = mkdtempSync(join(tmpdir(), 'discussionbridge-composer-'));
  try {
    cpSync(join(root, 'src/php/idna'), join(directory, 'idna'), { recursive: true });
    for (const mode of ['absent', 'host-before', 'host-after', 'cold-host', 'two-copies']) {
      const result = run(join(root, 'tests/php-composer-coexistence.php'), mode, join(directory, 'idna'));
      assert.equal(result.status, 0, mode + ': ' + (result.stderr || result.stdout));
      const value = JSON.parse(result.stdout);
      assert.equal(value.result, 'isolated');
      assert.ok(value.checks >= 10);
    }
    const changed = join(directory, 'changed-idna');
    cpSync(join(root, 'src/php/idna'), changed, { recursive: true });
    const file = join(changed, 'vendor/autoload.php');
    const original = readFileSync(file, 'utf8');
    const invalid = original.replace(/(\$runtimeIdentity = ')[a-f0-9]{64}(';)/, '$1' + '0'.repeat(64) + '$2');
    assert.notEqual(invalid, original);
    writeFileSync(file, invalid);
    const refused = run(join(root, 'tests/php-composer-coexistence.php'), 'conflicting-copy', changed);
    assert.equal(refused.status, 0, refused.stderr || refused.stdout);
    assert.ok(JSON.parse(refused.stdout).checks >= 10);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('discussionbridge-composer-'));
    rmSync(directory, { recursive: true });
  }
});
