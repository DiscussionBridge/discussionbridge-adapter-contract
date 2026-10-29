import tr46 from 'tr46';

// Private build entry only. The shared codec selects the fixed schema options;
// this library is never a configurable wire or presentation-mode authority.
export const unicodeVersion = '17.0.0';
export const toAscii = tr46.toASCII;
export { normalizeNfc } from './nfc.mjs';
