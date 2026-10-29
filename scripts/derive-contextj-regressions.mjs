import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Explicit fixture derivation. Expected admission follows RFC5892 A.1/A.2
// occurrence properties, not either IDNA implementation or a native URL parser.
// Pinned Punycode is used only to encode the same literal label into ACE.
const require = createRequire(new URL('../js-dependencies/package.json', import.meta.url));
const punycode = require('punycode/');
assert.equal(require('punycode/package.json').version, '2.3.1');
const contexts = [
  { id: 'joining', label: 'ب\u200Cب', accepted: true, property: 'D ZWNJ D' },
  { id: 'transparent', label: 'ب\u064E\u200C\u0650ب', accepted: true, property: 'D T ZWNJ T D' },
  { id: 'virama-zwnj', label: 'ب\u094D\u200Cب', accepted: true, property: 'immediately preceding CCC9' },
  { id: 'virama-zwj', label: 'ب\u094D\u200Dب', accepted: true, property: 'ZWJ immediately preceding CCC9' },
  { id: 'supplementary-transparent', label: 'ب\u{10EFD}\u200Cب', accepted: true, property: 'D T supplementary ZWNJ D' },
  { id: 'invalid-left', label: 'ء\u200Cب', accepted: false, property: 'U ZWNJ D, no virama' },
  { id: 'invalid-right', label: 'ب\u200Cء', accepted: false, property: 'D ZWNJ U, no virama' },
  { id: 'invalid-zwj', label: 'ب\u200Dب', accepted: false, property: 'ZWJ without immediately preceding CCC9' },
  { id: 'invalid-barrier', label: 'ب\u064E-\u200C\u0650ب', accepted: false, property: 'nontransparent barrier before ZWNJ' },
  { id: 'invalid-supplementary', label: 'ب\u{10EFD}ء\u200Cب', accepted: false, property: 'T supplementary then U ZWNJ D' },
];
const cases = [];
const add = (id, label, accepted) => cases.push({ id, label, points: Array.from(label, char => char.codePointAt(0)),
  accepted, asciiHost: 'xn--' + punycode.encode(label) + '.example' });
for (const item of contexts) add(item.id, item.label, item.accepted);
for (const a of contexts) for (const b of contexts) {
  add(a.id + '/' + b.id, a.label + '-' + b.label, a.accepted && b.accepted);
  for (const c of contexts) add(a.id + '/' + b.id + '/' + c.id,
    a.label + '-' + b.label + '-' + c.label, a.accepted && b.accepted && c.accepted);
}
add('R1-A-later-valid', 'ء\u200Cب\u200Cب', false);
add('R1-A-virama-reuse', 'ب\u094D\u200Cبء\u200Cب', false);
add('overlapping-valid-runs', 'ب\u200Cب\u200Cب\u200Cب', true);
add('virama-then-valid-overlap', 'ب\u094D\u200Cب\u200Cب', true);
add('zwj-virama-then-invalid', 'ب\u094D\u200Dبء\u200Cب', false);
add('joiner-at-start', '\u200Cب', false);
assert.equal(cases.length, 1116);
assert.equal(new Set(cases.map(item => item.id)).size, cases.length);
const fixture = { format: 1, unicode_version: '17.0.0',
  authority: 'RFC5892 Appendix A.1/A.2 per-occurrence properties; CONTRACT-URL-POLICY-20261029-R1-A',
  reference: 'https://www.rfc-editor.org/rfc/rfc5892.html#appendix-A.1',
  scope: 'Every pair/triple of fixed valid/invalid contexts, first/middle/last, transparent/barrier, supplementary UTF16/UTF8 positions, virama and overlapping controls; Unicode and literal ACE use the same expected admission.',
  contexts, cases };
const bytes = Buffer.from(JSON.stringify(fixture, null, 2) + '\n');
const output = new URL('../fixtures/url-contextj.json', import.meta.url);
if (process.argv.includes('--check')) assert.ok(readFileSync(output).equals(bytes), 'Stale ContextJ regression fixture');
else writeFileSync(output, bytes);
console.log(JSON.stringify({ fixture: fileURLToPath(output), cases: cases.length, url_forms: cases.length * 2, bytes: bytes.length }));
