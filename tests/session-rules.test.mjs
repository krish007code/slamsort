import { test } from 'node:test';
import assert from 'node:assert/strict';
import { journalState } from '../apps/web/src/storage/journalState.ts';
import { approvalBlocker, roundDuration, validBins } from '../apps/web/src/app/roundRules.ts';

const ready = {
  busy: false, itemCount: 4, working: false, local: true,
  journalReady: true, held: true, pendingCount: 0,
};

test('approval requires files, completed planning, durable storage, lock and no recovery', () => {
  assert.equal(approvalBlocker(ready), '');
  for (const blocked of [
    { busy: true }, { itemCount: 0 }, { working: true },
    { journalReady: false }, { held: false }, { pendingCount: 1 },
  ]) {
    assert.notEqual(approvalBlocker({ ...ready, ...blocked }), '');
  }
  assert.equal(approvalBlocker({ ...ready, local: false, journalReady: false, held: false, pendingCount: 1 }), '');
});

test('category validation rejects invalid paths, platform-reserved names and case collisions', () => {
  for (const labels of [[], ['A', 'B', 'C', 'D', 'E', 'F'], ['../Private'], ['CON'], ['Work', 'work'], [' Photos'], ['Photos.']]) {
    assert.equal(validBins(labels), false, JSON.stringify(labels));
  }
  assert.equal(validBins(['Academics', 'Skills', 'Projects', 'Personal']), true);
});

test('timer rejects non-finite values and clamps duration to supported limits', () => {
  for (const value of [NaN, Infinity, -Infinity, 0]) assert.equal(roundDuration(value), 120);
  assert.equal(roundDuration(-1), 15);
  assert.equal(roundDuration(9000), 3600);
  assert.equal(roundDuration(45), 45);
});

test('journal selects latest reversible move without mutating stored order', () => {
  const entries = [
    { id: 'older', at: 1, status: 'complete' },
    { id: 'latest', at: 3, status: 'complete' },
    { id: 'middle', at: 2, status: 'complete' },
  ];
  const before = structuredClone(entries);
  assert.equal(journalState(entries).undoable.id, 'latest');
  assert.deepEqual(entries, before);
});

test('completed undo link prevents a second undo even when bookkeeping failed', () => {
  const entries = [
    { id: 'move', at: 1, status: 'complete' },
    { id: 'undo', at: 2, status: 'complete', undoOf: 'move' },
    { id: 'flagged', at: 3, status: 'complete', undone: true },
    { id: 'retained', at: 4, status: 'retained' },
  ];
  assert.equal(journalState(entries).undoable, undefined);
  assert.deepEqual(journalState(entries).pending, []);
});

test('incomplete and failed undos remain recovery blockers, not completed undo links', () => {
  const move = { id: 'move', at: 1, status: 'complete' };
  const pending = ['intent', 'copied', 'verified', 'removing', 'recovery']
    .map((status, at) => ({ id: status, at, status, undoOf: 'move' }));
  const state = journalState([move, ...pending]);
  assert.deepEqual(state.pending, pending);
  assert.equal(state.undoable, move);
  assert.notEqual(approvalBlocker({ ...ready, pendingCount: state.pending.length }), '');
});
