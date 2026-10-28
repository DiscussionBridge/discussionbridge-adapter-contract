import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { specIdentity } from './cms-runtime.mjs';
export * from './cms-runtime.mjs';
const bytes = readFileSync(new URL('../'+specIdentity.path,import.meta.url));
if(bytes.length!==specIdentity.bytes||createHash('sha256').update(bytes).digest('hex')!==specIdentity.sha256)throw new Error('V4 normative candidate identity mismatch');
