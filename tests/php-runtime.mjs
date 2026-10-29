import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// CI selects a PHP version per job; local runs may name an installed executable.
// Missing PHP is a failed check, never a silent skip or a private-path fallback.
export function runPhpFixture(name, input) {
  const executable = process.env.DISCUSSIONBRIDGE_PHP_BINARY ?? 'php';
  const result = spawnSync(executable, ['-n', fileURLToPath(new URL(name, import.meta.url))], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 20000,
    maxBuffer: 8 * 1024 * 1024,
  });
  assert.equal(result.error, undefined,
    `PHP fixture could not run: ${result.error?.message}. Put PHP on PATH or set DISCUSSIONBRIDGE_PHP_BINARY.`);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
