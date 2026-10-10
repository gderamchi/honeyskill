import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// The bundle has adjacent data; the source entry lives three directories deeper.
export const assetRoot = existsSync(resolve(dirname(fileURLToPath(import.meta.url)), 'research'))
  ? dirname(fileURLToPath(import.meta.url))
  : resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
