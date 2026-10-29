import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function unicodeFixture(name) {
  const manifest = JSON.parse(readFileSync(new URL('../fixtures/unicode17/PROVENANCE.json', import.meta.url)));
  assert.equal(manifest.unicode_version, '17.0.0');
  const member = manifest.members.find(item => item.path === name);
  assert.ok(member, name);
  const bytes = readFileSync(new URL('../fixtures/unicode17/' + name, import.meta.url));
  assert.equal(bytes.length, member.bytes, name);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), member.sha256, name);
  return bytes.toString('utf8');
}
const decode = value => value === '""' ? '' : value.replace(/\\u([0-9a-f]{4})|\\x\{([0-9a-f]+)\}/gi,
  (_, short, long) => String.fromCodePoint(parseInt(short ?? long, 16)));

// Exact official column inheritance, not native URL/ICU-derived expectations.
export function idnaCases() {
  const ignored = new Set(['A4_1', 'A4_2', 'V2', 'V3', 'U1']);
  const cases = [];
  for (const [line, raw] of unicodeFixture('IdnaTestV2.txt').split(/\r?\n/).entries()) {
    const body = raw.split('#')[0].trim();
    if (!body) continue;
    const cols = body.split(';').map(value => value.trim());
    const source = decode(cols[0]);
    const unicode = cols[1] ? decode(cols[1]) : source;
    const ascii = cols[3] ? decode(cols[3]) : unicode;
    const status = cols[4] || cols[2] || '[]';
    const errors = status.replace(/[\[\]]/g, '').split(',').map(value => value.trim()).filter(value => value && !ignored.has(value));
    const points = Array.from(source, char => char.codePointAt(0));
    const illFormed = points.some(cp => cp >= 0xd800 && cp <= 0xdfff);
    if (illFormed) assert.ok(errors.length, 'Ill-formed input must not be admitted: ' + (line + 1));
    cases.push({ id: line + 1, source, points, ascii, invalid: errors.length > 0, illFormed });
  }
  assert.equal(cases.length, 6391);
  return cases;
}
export function nfcCases() {
  const cases = [];
  for (const [line, raw] of unicodeFixture('NormalizationTest.txt').split(/\r?\n/).entries()) {
    const body = raw.split('#')[0].trim();
    if (!body || body.startsWith('@')) continue;
    const cols = body.split(';').slice(0, 5).map(value => String.fromCodePoint(...value.trim().split(/\s+/).map(cp => parseInt(cp, 16))));
    assert.equal(cols.length, 5);
    cases.push({ id: line + 1, cols });
  }
  assert.equal(cases.length, 20034);
  return cases;
}
