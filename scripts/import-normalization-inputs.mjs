import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit maintainer-only import. Ordinary generation/build/test is offline.
// Import exact upstream bytes; do not author a replacement NFC algorithm.
if (process.argv[2] !== '--download') throw new Error('Explicit --download required');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const unicode = 'https://www.unicode.org/Public/17.0.0/ucd/';
const symfony = 'https://raw.githubusercontent.com/symfony/polyfill/d82f395870f574cf102b8abd72cda1bc15d9fd12/';
const pins = [
  ['fixtures/unicode17/UnicodeData.txt', unicode + 'UnicodeData.txt', '2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c'],
  ['fixtures/unicode17/CompositionExclusions.txt', unicode + 'CompositionExclusions.txt', '2f239196ef3b5b61db5cc476e9bd80f534d15aa1b74e1be1dea5d042a344c85f'],
  ['fixtures/unicode17/CaseFolding.txt', unicode + 'CaseFolding.txt', 'ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183'],
  ['fixtures/unicode17/SpecialCasing.txt', unicode + 'SpecialCasing.txt', 'efc25faf19de21b92c1194c111c932e03d2a5eaf18194e33f1156e96de4c9588'],
  ['tools/unicode17/Compiler.php', symfony + 'tests/Compiler.php', '0ee54eab38c94cf1040e5e856f30e4034f6ed795e3ddaaa893979802d6298e51'],
  ['tools/unicode17/LICENSE', symfony + 'LICENSE', 'eaa5d6e59ff1d5322ae36d3ab9124460df72d2d0c8af60a99222e8a90dcbdf31'],
];
const members = [], imports = [];
for (const [path, upstream, sha256] of pins) {
  const target = join(root, path);
  let bytes;
  if (existsSync(target)) bytes = readFileSync(target);
  else {
    const response = await fetch(upstream);
    if (!response.ok) throw new Error('Upstream import failed: ' + response.status);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (hash(bytes) !== sha256) throw new Error('Preserve unexpected upstream bytes: ' + path);
  imports.push([target, bytes]);
  members.push({ path, bytes: bytes.length, sha256, upstream });
}
for (const [target, bytes] of imports) {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, bytes);
}
const provenance = { format: 1, unicode_version: '17.0.0',
  compiler: 'Symfony polyfill v1.43.0 / d82f395870f574cf102b8abd72cda1bc15d9fd12 / Compiler::unicodeMaps',
  licenses: ['MIT: tools/unicode17/LICENSE', 'Unicode-3.0: fixtures/unicode17/LICENSE.txt'], members };
writeFileSync(join(root, 'tools/unicode17/INPUTS.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify(provenance));
