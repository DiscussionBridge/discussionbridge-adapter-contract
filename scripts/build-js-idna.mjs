import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit maintainer refresh. Normal generation verifies committed bytes
// offline and never installs or executes these development dependencies.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const expected = {
  '@adraffy/ens-normalize': ['1.11.1', 'sha512-nhCBV3quEgesuf7c7KYfperqSS14T8bYuvJ8PcLJp6znkZpFc0AuW4qBtr8eKVyPPe/8RSr7sglCWPU5eaxwKQ=='],
  tr46: ['6.0.0', 'sha512-bLVMLPtstlZ4iMQHpFHTR7GAGj2jxi8Dg0s2h2MafAE4uSWF98FC/3MomU51iQAMf8/qDUbKWf5GxuvvVcXEhw=='],
  punycode: ['2.3.1', 'sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg=='],
};
const lock = json(join(root, 'js-dependencies/package-lock.json'));
if (Object.keys(lock.packages).length !== 4) throw new Error('Unexpected JS runtime dependency closure');
const toolLock = json(join(root, 'tools/js-idna/package-lock.json'));
if (toolLock.packages['node_modules/esbuild']?.version !== '0.28.1') throw new Error('Unexpected JS IDNA build tool');
function members(directory, at = directory) {
  const paths = [];
  for (const name of readdirSync(at).sort()) {
    const absolute = join(at, name), stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Unexpected IDNA dependency symlink');
    if (stat.isDirectory()) paths.push(...members(directory, absolute));
    else if (stat.isFile()) paths.push(relative(directory, absolute).split(sep).join('/'));
    else throw new Error('Unexpected IDNA dependency member');
  }
  return paths.sort();
}
const packages = [], upstream = [], notices = [];
for (const [name, [version, integrity]] of Object.entries(expected)) {
  const pinned = lock.packages['node_modules/' + name];
  const base = join(root, 'js-dependencies/node_modules', name);
  const metadata = json(join(base, 'package.json'));
  if (pinned?.version !== version || pinned.integrity !== integrity || metadata.name !== name
      || metadata.version !== version || metadata.license !== 'MIT') throw new Error('JS IDNA dependency identity mismatch');
  if (name === 'tr46' && metadata.unicodeVersion !== '17.0.0') throw new Error('JS IDNA Unicode version mismatch');
  const licenseName = readdirSync(base).find(path => /^license(?:[-.].*)?$/i.test(path));
  if (!licenseName) throw new Error('Missing upstream IDNA license');
  const license = readFileSync(join(base, licenseName), 'utf8');
  if (license.includes('*/') || !license.includes('Permission is hereby granted')) throw new Error('Unexpected upstream license');
  notices.push(`${name} ${version}\n${license.trim()}\n`);
  packages.push({ name, version, integrity, resolved: pinned.resolved, license: 'MIT' });
  for (const path of members(base)) {
    const bytes = readFileSync(join(base, path));
    upstream.push({ path: `node_modules/${name}/${path}`, bytes: bytes.length, sha256: hash(bytes) });
  }
}
const require = createRequire(join(root, 'tools/js-idna/package.json'));
const esbuild = require('esbuild');
if (esbuild.version !== '0.28.1') throw new Error('JS IDNA tool version mismatch');
const result = await esbuild.build({
  absWorkingDir: root, entryPoints: ['js-dependencies/entry.mjs'],
  bundle: true, write: false, format: 'iife', globalName: 'DiscussionBridgeIdnaPrivate',
  platform: 'neutral', mainFields: ['main'], target: ['es2022'], legalComments: 'inline', charset: 'ascii',
  minify: false, sourcemap: false, metafile: true, logLevel: 'silent',
  plugins: [{ name: 'private-unicode17-nfc', setup(build) {
    build.onResolve({ filter: /^discussionbridge-private-nfc$/ }, () => ({ path: join(root, 'js-dependencies/nfc.mjs') }));
    build.onLoad({ filter: /[\\/]tr46[\\/]index\.js$/ }, args => {
      const bytes = readFileSync(args.path);
      if (hash(bytes) !== 'dd2eae4174a287b5a081feba8c41dd85d713d8b5185b5e98313c7ffe83834646') throw new Error('Unexpected tr46 source for private NFC binding');
      let contents = bytes.toString('utf8');
      for (const name of ['label', 'string']) {
        const original = name + '.normalize("NFC")';
        if (contents.split(original).length !== 2) throw new Error('Unexpected tr46 NFC binding count');
        contents = contents.replace(original, 'normalizeNfc(' + name + ')');
      }
      const start = contents.indexOf('  if (checkJoiners) {');
      const end = contents.indexOf('\n\n  // "9. If CheckBidi', start);
      if (start < 0 || end <= start || contents.indexOf('  if (checkJoiners) {', start + 1) !== -1) throw new Error('Unexpected tr46 ContextJ boundary');
      contents = contents.slice(0, start) + readFileSync(join(root, 'implementation/js-contextj.js.in'), 'utf8').trimEnd() + contents.slice(end);
      return { contents: 'const { normalizeNfc } = require("discussionbridge-private-nfc");\n' + contents, loader: 'js' };
    });
  } }],
});
if (result.outputFiles.length !== 1) throw new Error('Unexpected JS IDNA output count');
if (Object.values(result.metafile.outputs).some(item => item.imports.length)) throw new Error('External JS IDNA runtime import');
if (/\.normalize\s*\(/.test(result.outputFiles[0].text)) throw new Error('Ambient native normalization survived the bundle');
if (Object.keys(result.metafile.inputs).some(path => /ens-normalize[\\/]dist[\\/]index/.test(path))) throw new Error('ENS name policy is not an IDNA dependency');
const notice = notices.join('\n');
const outputs = {
  'runtime.js': Buffer.from(`/*\nPrivate pinned IDNA dependencies. Complete upstream MIT notices:\n${notice}*/\n${result.outputFiles[0].text}`),
  'LICENSES.txt': Buffer.from(notice),
};
const manifest = {
  format: 1, component: 'discussionbridge-v4-private-js-idna', namespace: 'DiscussionBridgeIdnaPrivate',
  unicode_version: '17.0.0', runtime_packages: packages,
  build_only_tool: { name: 'esbuild', version: esbuild.version, integrity: toolLock.packages['node_modules/esbuild'].integrity },
  inputs: ['js-dependencies/package.json', 'js-dependencies/package-lock.json', 'js-dependencies/entry.mjs', 'js-dependencies/nfc.mjs',
    'tools/js-idna/package.json', 'tools/js-idna/package-lock.json', 'scripts/build-js-idna.mjs', 'implementation/js-contextj.js.in'].map(path => {
    const bytes = readFileSync(join(root, path)); return { path, bytes: bytes.length, sha256: hash(bytes) };
  }),
  transformations: ['private self-contained IIFE; ES2022 target; no external require/import/runtime dependency',
    'bind exactly two source-hashed tr46 NFC calls to published standalone Unicode17 nf.min.js; no ENS name policy or global prototype patch',
    'replace exactly one source-hashed ContextJ block with occurrence-anchored validation; advance after every joiner, including virama success',
    'complete MIT notices embedded for unchanged portable-runtime byte copies; original upstream file hashes retained'],
  upstream_members: upstream,
  members: Object.entries(outputs).map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
};
const output = join(root, 'src/js-idna');
if (existsSync(output)) {
  const prior = json(join(output, 'DEPENDENCIES.json'));
  if (prior.component !== manifest.component || prior.namespace !== manifest.namespace) throw new Error('Preserve unowned JS bundle');
  for (const item of prior.members) {
    if (!Object.hasOwn(outputs, item.path) || hash(readFileSync(join(output, item.path))) !== item.sha256) throw new Error('Preserve edited JS dependency member');
  }
  if (members(output).some(path => !Object.hasOwn(outputs, path) && path !== 'DEPENDENCIES.json')) throw new Error('Unknown JS bundle member');
}
mkdirSync(output, { recursive: true });
for (const [path, bytes] of Object.entries(outputs)) writeFileSync(join(output, path), bytes);
writeFileSync(join(output, 'DEPENDENCIES.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, unicode_version: manifest.unicode_version, runtime_packages: packages,
  members: manifest.members, provenance_sha256: hash(readFileSync(join(output, 'DEPENDENCIES.json'))) }));
