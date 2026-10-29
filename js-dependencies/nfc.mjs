// Published standalone normalization engine/data, not ENS name validation.
// This file is embedded privately at build time; no host prototype is patched.
import { nfc } from './node_modules/@adraffy/ens-normalize/dist/nf.min.js';

export function normalizeNfc(value) {
  return String.fromCodePoint(...nfc(Array.from(value, char => char.codePointAt(0))));
}
