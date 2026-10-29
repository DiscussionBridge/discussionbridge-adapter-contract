import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Maintainer-only exact upstream data import, not an authored replacement test.
// Normal CI/package checks use these committed bytes offline.
const source = process.argv[2];
if (!source) throw new Error('Provide the explicit Unicode17 cache directory');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'fixtures/unicode17');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const expected = {
  'IdnaTestV2.txt': 'beb5d0be20e896189b03209a82fdc34f06351502bbd4b8e2523583fc2954d9cf',
  'NormalizationTest.txt': '5019ffd530751a741900c849c0e010332f142a3612234639bd200b82138a87db',
};
const upstream = {
  'IdnaTestV2.txt': 'https://www.unicode.org/Public/idna/17.0.0/IdnaTestV2.txt',
  'NormalizationTest.txt': 'https://www.unicode.org/Public/17.0.0/ucd/NormalizationTest.txt',
  'LICENSE.txt': 'https://www.unicode.org/license.txt',
};
const members = [];
const inputs = {};
for (const name of [...Object.keys(expected), 'LICENSE.txt']) {
  const bytes = readFileSync(join(source, name));
  if (expected[name] && hash(bytes) !== expected[name]) throw new Error('Unexpected official Unicode test bytes: ' + name);
  if (name === 'LICENSE.txt' && (!bytes.toString().startsWith('UNICODE LICENSE V3\n')
      || !bytes.toString().includes('Copyright © 1991-2026 Unicode, Inc.'))) throw new Error('Unexpected Unicode license');
  const target = join(output, name);
  if (existsSync(target) && !readFileSync(target).equals(bytes)) throw new Error('Preserve differing test data: ' + name);
  inputs[name] = bytes;
  members.push({ path: name, bytes: bytes.length, sha256: hash(bytes), upstream: upstream[name] });
}
mkdirSync(output, { recursive: true });
for (const [name, bytes] of Object.entries(inputs)) writeFileSync(join(output, name), bytes);
writeFileSync(join(output, 'PROVENANCE.json'), JSON.stringify({ format: 1, unicode_version: '17.0.0',
  license: 'Unicode-3.0', members, scope: 'Exact upstream test corpora, not wire/publication limits or runtime data' }, null, 2) + '\n');
console.log(JSON.stringify({ output, members }));
