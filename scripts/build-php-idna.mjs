import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit maintainer dependency refresh. Normal generation/package checks do
// not download, install, scope or execute build tools.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const php = process.env.DISCUSSIONBRIDGE_PHP_BUILD_BINARY;
const composer = process.env.DISCUSSIONBRIDGE_COMPOSER_PHAR;
if (!php || !composer) throw new Error('Set explicit PHP build binary and Composer PHAR paths');
const prefix = 'DiscussionBridge\\CmsV4\\IdnaVendor';
const expected = {
  'rowbot/idna': ['0.3.0', '504900acc8e465a17668a61ae30391d1aebbb4f2'],
  'rowbot/punycode': ['1.0.4', 'ec116e99cb089a25d45147813d61bfa2deb29328'],
  'symfony/polyfill-iconv': ['v1.43.0', '254724d95fe01b679cd97d88786e9623ee00bfb7'],
  'symfony/polyfill-intl-normalizer': ['v1.43.0', 'ebd57ccc7edb93d632e184efbe7693d2517bab3b'],
  'symfony/polyfill-mbstring': ['v1.43.3', '122889ed24dc000165bcbfd77ec412f15cbdfc6a'],
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const input = join(root, 'php-dependencies');
const lock = json(join(input, 'composer.lock'));
if (lock.packages.length !== Object.keys(expected).length || lock['packages-dev'].length !== 0) throw new Error('Unexpected runtime dependency closure');
for (const item of lock.packages) {
  const pin = expected[item.name];
  if (!pin || item.version !== pin[0] || item.source.reference !== pin[1] || JSON.stringify(item.license) !== '["MIT"]') throw new Error('Unapproved dependency identity');
}
const tools = join(root, 'tools/php-idna');
const toolLock = json(join(tools, 'composer.lock'));
const scoper = toolLock.packages.find(item => item.name === 'humbug/php-scoper');
if (scoper?.version !== '0.18.20' || scoper.source.reference !== 'f1991b803eb84b534b8b2aa1b477c170d1b611e1') throw new Error('Unapproved namespace tool');
function run(args, cwd) {
  const result = spawnSync(php, args, { cwd, stdio: 'inherit', env: { ...process.env, COMPOSER_ALLOW_SUPERUSER: '0' } });
  if (result.error || result.status !== 0) throw new Error('Dependency build command failed', { cause: result.error });
}
function members(directory, at = directory) {
  const output = [];
  for (const name of readdirSync(at).sort()) {
    const absolute = join(at, name);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Dependency symlink is not a package member');
    if (stat.isDirectory()) output.push(...members(directory, absolute));
    else if (stat.isFile()) output.push(relative(directory, absolute).split(sep).join('/'));
    else throw new Error('Unexpected dependency file type');
  }
  return output.sort();
}
const upstream = [];
for (const name of Object.keys(expected).sort()) {
  const directory = join(input, 'vendor', name);
  if (!existsSync(join(directory, 'LICENSE'))) throw new Error('Missing upstream license');
  for (const path of members(directory)) {
    const bytes = readFileSync(join(directory, path));
    upstream.push({ path: `vendor/${name}/${path}`, bytes: bytes.length, sha256: hash(bytes) });
  }
}
const stagingBase = join(root, '.php-idna-build');
mkdirSync(stagingBase, { recursive: true });
if (lstatSync(stagingBase).isSymbolicLink()) throw new Error('Unexpected build boundary');
const staging = mkdtempSync(join(stagingBase, 'compile-'));
const scoped = join(staging, 'scoped');
if (hash(readFileSync(join(input, 'vendor/rowbot/idna/src/LabelValidator.php'))) !== '7b34a298511b45a1217c272595abd349164fce77464973e5ea35725cdf2e6ee0') throw new Error('Unexpected upstream ContextJ source');
run([join(tools, 'vendor/bin/php-scoper'), 'add-prefix', `--config=${join(tools, 'scoper.inc.php')}`, `--output-dir=${scoped}`, '--no-interaction'], input);

// Regenerate only the private normalizer's data using the unchanged upstream
// compiler and pinned Unicode17 inputs. No ambient intl/normalizer is used.
const nfcInputs = json(join(root, 'tools/unicode17/INPUTS.json'));
if (nfcInputs.format !== 1 || nfcInputs.unicode_version !== '17.0.0' || nfcInputs.members.length !== 6) throw new Error('Unexpected NFC data provenance');
for (const item of nfcInputs.members) {
  if (!/^(fixtures\/unicode17\/[A-Za-z]+\.txt|tools\/unicode17\/(Compiler\.php|LICENSE))$/.test(item.path)) throw new Error('Unsafe NFC build input');
  const bytes = readFileSync(join(root, item.path));
  if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error('NFC upstream input mismatch');
}
const compiler = join(staging, 'normalizer-compiler');
const dataInput = join(compiler, 'unicode/data');
const dataOutput = join(compiler, 'output');
mkdirSync(dataInput, { recursive: true });
mkdirSync(dataOutput);
cpSync(join(root, 'tools/unicode17/Compiler.php'), join(compiler, 'Compiler.php'));
for (const name of ['UnicodeData', 'CompositionExclusions', 'CaseFolding', 'SpecialCasing']) {
  cpSync(join(root, 'fixtures/unicode17', name + '.txt'), join(dataInput, name + '.txt'));
}
run(['-n', '-r', 'require $argv[1]; Symfony\\Polyfill\\Internal\\Compiler::unicodeMaps($argv[2]);', join(compiler, 'Compiler.php'), dataOutput + '/'], root);
for (const name of ['canonicalComposition', 'canonicalDecomposition', 'combiningClass', 'compatibilityDecomposition', 'rawCanonicalDecomposition', 'rawCompatibilityDecomposition']) {
  cpSync(join(dataOutput, name + '.php'), join(scoped, 'vendor/symfony/polyfill-intl-normalizer/Resources/unidata', name + '.php'));
}
cpSync(join(root, 'fixtures/unicode17/LICENSE.txt'), join(scoped, 'vendor/symfony/polyfill-intl-normalizer/UNICODE-LICENSE.txt'));

// Bootstrap only the two private explicit-UTF8 bridges. Do not install global
// Symfony extension polyfills in the host process. Classes/data/licenses remain
// ordinary complete private package members.
const installedPath = join(scoped, 'vendor/composer/installed.json');
const installed = json(installedPath);
for (const item of installed.packages) {
  if (item.autoload?.files) delete item.autoload.files;
}
writeFileSync(installedPath, JSON.stringify(installed, null, 2) + '\n');
const projectPath = join(scoped, 'composer.json');
const project = json(projectPath);
project.autoload = { ...(project.autoload ?? {}), files: ['bridge.php'] };
writeFileSync(projectPath, JSON.stringify(project, null, 2) + '\n');
const bridgePath = join(root, 'implementation/php-idna-bridge.php.in');
writeFileSync(join(scoped, 'bridge.php'), readFileSync(bridgePath));
run([composer, 'dump-autoload', '--working-dir=' + scoped, '--no-dev', '--classmap-authoritative', '--no-plugins', '--no-scripts', '--no-interaction'], root);

// Composer unconditionally adds its global InstalledVersions map entry even
// though PHP-Scoper made that class private. Correct both generated maps, then
// bootstrap only this authoritative private class set. Registering Composer's
// global ClassLoader also leaks the private installed.php packages into the
// host's InstalledVersions census, even when a host autoloader masks the class
// collision. Keep the upstream generated metadata/license as provenance, but
// never execute that global engine/bootstrap for this private runtime.
for (const name of ['autoload_classmap.php', 'autoload_static.php']) {
  const file = join(scoped, 'vendor/composer', name);
  const before = readFileSync(file, 'utf8');
  const oldName = "'Composer\\\\InstalledVersions'";
  if (before.split(oldName).length !== 2) throw new Error('Unexpected Composer helper map');
  writeFileSync(file, before.replace(oldName, `'${prefix.replaceAll('\\', '\\\\')}\\\\Composer\\\\InstalledVersions'`));
}
const autoloadPath = join(root, 'implementation/php-idna-autoload.php.in');
const autoloadTemplate = readFileSync(autoloadPath, 'utf8');
if (autoloadTemplate.split('%PRIVATE_RUNTIME_ID%').length !== 2) throw new Error('Unexpected private bootstrap template');
const bootstrapIdentity = hash(Buffer.from(JSON.stringify({
  namespace: prefix, template_sha256: hash(Buffer.from(autoloadTemplate)),
  members: members(scoped).filter(path => path !== 'vendor/autoload.php').map(path => {
    const bytes = readFileSync(join(scoped, path));
    return { path, bytes: bytes.length, sha256: hash(bytes) };
  }),
})));
writeFileSync(join(scoped, 'vendor/autoload.php'), autoloadTemplate.replace('%PRIVATE_RUNTIME_ID%', bootstrapIdentity));
run(['-n', '-r', '$map=require $argv[1]; foreach ($map as $class=>$file) { if (!str_starts_with($class,$argv[2]."\\\\") || !is_file($file)) throw new RuntimeException("Invalid private class map"); } echo "Private authoritative class map: ".count($map).PHP_EOL;', join(scoped, 'vendor/composer/autoload_classmap.php'), prefix], root);

const runtimeMembers = members(scoped).map(path => {
  const bytes = readFileSync(join(scoped, path));
  return { path, bytes: bytes.length, sha256: hash(bytes) };
});
const provenance = {
  format: 1,
  component: 'discussionbridge-v4-private-idna',
  namespace: prefix,
  bootstrap_identity: bootstrapIdentity,
  php_minimum: '8.1',
  additional_mandatory_extensions: [],
  runtime_packages: lock.packages.map(({ name, version, source, license }) => ({ name, version, source, license })),
  build_only_tool: { name: scoper.name, version: scoper.version, source: scoper.source },
  inputs: ['php-dependencies/composer.json', 'php-dependencies/composer.lock', 'tools/php-idna/composer.json', 'tools/php-idna/composer.lock', 'tools/php-idna/scoper.inc.php', 'implementation/php-idna-bridge.php.in', 'implementation/php-idna-autoload.php.in', 'scripts/build-php-idna.mjs',
    'tools/unicode17/INPUTS.json', ...nfcInputs.members.map(item => item.path), 'fixtures/unicode17/LICENSE.txt', 'implementation/php-contextj.php.in'].map(path => {
    const bytes = readFileSync(join(root, path));
    return { path, bytes: bytes.length, sha256: hash(bytes) };
  }),
  transformations: ['fixed private namespace; PHP-8.1 parser/printer target', 'bind Rowbot Normalizer and two UTF8 functions privately; suppress ambient Normalizer alias', 'replace exactly one source-hashed ContextJ method with current-occurrence UTF8 byte-offset validation, including virama advancement', 'disable package-global polyfill bootstrap; add two explicit-UTF8 private bridges', 'regenerate six private NFC/data maps with unchanged pinned Symfony compiler and official Unicode17 inputs; preserve both licenses', 'regenerate authoritative class map from scoped package metadata; bind private Composer helper consistently', 'use closed private bootstrap without registering global Composer engine or package metadata'],
  upstream_members: upstream,
  members: runtimeMembers,
};
const output = join(root, 'src/php/idna');
if (existsSync(output)) {
  const priorPath = join(output, 'DEPENDENCIES.json');
  if (!existsSync(priorPath)) throw new Error('Preserve pre-existing unowned dependency directory');
  const prior = json(priorPath);
  if (prior.component !== provenance.component || prior.namespace !== prefix) throw new Error('Unexpected dependency owner');
  for (const item of prior.members) {
    if (!/^[A-Za-z0-9_.\/-]+$/.test(item.path) || item.path.split('/').includes('..') || item.path.startsWith('/')) throw new Error('Unsafe existing dependency member');
    if (hash(readFileSync(join(output, item.path))) !== item.sha256) throw new Error('Preserve edited generated dependency member');
  }
  const expectedPaths = new Set([...runtimeMembers.map(item => item.path), 'DEPENDENCIES.json']);
  if (members(output).some(path => !expectedPaths.has(path))) throw new Error('Stale/unknown generated dependency members require explicit disposition');
}
mkdirSync(output, { recursive: true });
for (const item of runtimeMembers) {
  const target = join(output, item.path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(scoped, item.path), target, { errorOnExist: false });
}
writeFileSync(join(output, 'DEPENDENCIES.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({ output, staging, runtime_packages: lock.packages.length, members: runtimeMembers.length, provenance_sha256: hash(readFileSync(join(output, 'DEPENDENCIES.json'))), limits: 'Generated dependency bytes only; codec/runtime/consumer qualification remains required' }));
