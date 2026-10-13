import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { specIdentity } from './cms-runtime.mjs';
export * from './cms-runtime.mjs';

// Full source-checkout binding. Downstream packages use the byte-exact portable
// runtime plus extracted schema; this wrapper additionally checks frozen source.
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const wireBytes = readFileSync(new URL(`../${specIdentity.path}`, import.meta.url));
const semanticsBytes = readFileSync(new URL(`../${specIdentity.semanticsPath}`, import.meta.url));
if (wireBytes.length !== specIdentity.bytes || hash(wireBytes) !== specIdentity.sha256 ||
    semanticsBytes.length !== specIdentity.semanticsBytes || hash(semanticsBytes) !== specIdentity.semanticsSha256) {
  throw new Error('Immutable CMS specification identity mismatch');
}
