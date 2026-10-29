import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safePath = path => typeof path === 'string' && /^[A-Za-z0-9_.\/-]+$/.test(path)
  && !path.startsWith('/') && !path.split('/').some(part => part === '' || part === '.' || part === '..');

// Offline verification only: normal generation/builds never run Composer or
// fetch dependencies. The committed bundle is part of the exact PHP artifact.
export function verifyPhpIdnaBundle(root) {
  const path = 'src/php/idna/DEPENDENCIES.json';
  const bytes = readFileSync(join(root, path));
  const manifest = JSON.parse(bytes);
  if (manifest.format !== 1 || manifest.component !== 'discussionbridge-v4-private-idna'
      || manifest.namespace !== 'DiscussionBridge\\CmsV4\\IdnaVendor' || manifest.php_minimum !== '8.1'
      || manifest.additional_mandatory_extensions.length !== 0) throw new Error('Unexpected PHP IDNA bundle');
  function verify(base, items) {
    const seen = new Set();
    for (const item of items) {
      if (!safePath(item.path) || seen.has(item.path)) throw new Error('Unsafe/duplicate PHP IDNA member');
      seen.add(item.path);
      const absolute = join(base, item.path);
      if (!lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) throw new Error('Invalid PHP IDNA member');
      const content = readFileSync(absolute);
      if (content.length !== item.bytes || hash(content) !== item.sha256) throw new Error('PHP IDNA member mismatch: ' + item.path);
    }
    return seen;
  }
  verify(root, manifest.inputs);
  const base = join(root, 'src/php/idna');
  const expected = verify(base, manifest.members);
  expected.add('DEPENDENCIES.json');
  function walk(at, prefix = '') {
    for (const name of readdirSync(at)) {
      const member = prefix + name;
      const absolute = join(at, name);
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) throw new Error('PHP IDNA symlink');
      if (stat.isDirectory()) walk(absolute, member + '/');
      else if (!stat.isFile() || !expected.has(member)) throw new Error('Unmanifested PHP IDNA member: ' + member);
    }
  }
  walk(base);
  return { path, bytes: bytes.length, sha256: hash(bytes), namespace: manifest.namespace,
    members: manifest.members.map(item => ({ ...item, path: 'src/php/idna/' + item.path })) };
}

export function verifyJsIdnaBundle(root) {
  const path = 'src/js-idna/DEPENDENCIES.json';
  const bytes = readFileSync(join(root, path));
  const manifest = JSON.parse(bytes);
  if (manifest.format !== 1 || manifest.component !== 'discussionbridge-v4-private-js-idna'
      || manifest.namespace !== 'DiscussionBridgeIdnaPrivate' || manifest.unicode_version !== '17.0.0') throw new Error('Unexpected JS IDNA bundle');
  const expected = new Set(['DEPENDENCIES.json']);
  for (const [base, items] of [[root, manifest.inputs], [join(root, 'src/js-idna'), manifest.members]]) {
    const seen = new Set();
    for (const item of items) {
      if (!safePath(item.path) || seen.has(item.path)) throw new Error('Unsafe/duplicate JS IDNA member');
      seen.add(item.path);
      const absolute = join(base, item.path), stat = lstatSync(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Invalid JS IDNA member');
      const content = readFileSync(absolute);
      if (content.length !== item.bytes || hash(content) !== item.sha256) throw new Error('JS IDNA member mismatch: ' + item.path);
      if (base !== root) expected.add(item.path);
    }
  }
  const base = join(root, 'src/js-idna');
  if (readdirSync(base).some(item => !expected.has(item))) throw new Error('Unmanifested JS IDNA member');
  return { path, bytes: bytes.length, sha256: hash(bytes), namespace: manifest.namespace,
    unicode_version: manifest.unicode_version, runtime: readFileSync(join(base, 'runtime.js'), 'utf8') };
}
