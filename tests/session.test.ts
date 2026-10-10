import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startProtectedSession } from '../apps/cli/src/session.js';

test('on refuses noninteractive and JSON callers before writing project state', async () => {
  const root = await mkdtemp(join(tmpdir(), 'skillgate-session-no-tty-'));
  for (const options of [{}, { json: true }]) {
    await assert.rejects(startProtectedSession(root, resolve('dist/cli.js'), options), error => {
      assert.equal((error as { code?: string }).code, 'TTY_REQUIRED');
      assert.equal((error as { exitCode?: number }).exitCode, 2);
      return true;
    });
  }
  await assert.rejects(access(join(root, '.skillgate')));
});
