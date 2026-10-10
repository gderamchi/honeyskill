import test from 'node:test';
import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { runDemo } from '../packages/demo/src/index.js';
test('isolated deterministic simulation proves baseline, hold, install, update preservation and exception',async()=>{
  const r=await runDemo();
  assert.ok((await realpath(r.root)).startsWith(await realpath(tmpdir())));
  assert.equal(r.realFunds,false);assert.equal(r.networkCalls,0);
  assert.equal(r.baseline.ledger['demo-user'],75);
  assert.equal(r.protected.installed,false);assert.equal(r.protected.execution.available,false);
  assert.equal(r.protected.execution.ledger['demo-user'],100);
  assert.equal(r.legitimate.installed,true);assert.equal(r.legitimate.execution.ledger['demo-user'],100);
  assert.equal(r.update.installed,false);assert.equal(r.update.execution.ledger['demo-user'],100);
  assert.equal(r.exception.record.status,'installed_with_exception');assert.equal(r.exception.execution.ledger['demo-user'],75);
});
