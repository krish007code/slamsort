import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openJournal } from '../apps/web/src/storage/journal.ts';

// Model transaction events directly, including failures after a successful request.
function databaseFixture(t) {
  let closed = false;
  let transaction;
  const read = { result: [{ id: 'persisted' }] };
  const db = {
    close() { closed = true; },
    transaction() {
      transaction = { objectStore: () => ({ getAll: () => read }) };
      return transaction;
    },
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete globalThis.indexedDB;
  });
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
    open() {
      const request = { result: db };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  } });
  return { db, read, get transaction() { return transaction; }, get closed() { return closed; } };
}

test('journal read waits for transaction commit instead of request success', async t => {
  const fixture = databaseFixture(t);
  const journal = await openJournal();
  let completed = false;
  const result = journal.all().then(value => { completed = true; return value; });
  await Promise.resolve();
  assert.equal(completed, false);
  fixture.transaction.oncomplete();
  assert.deepEqual(await result, fixture.read.result);
});

test('journal read rejects aborted transactions without leaving the caller waiting', async t => {
  const fixture = databaseFixture(t);
  const journal = await openJournal();
  const result = journal.all();
  fixture.transaction.onabort();
  await assert.rejects(result, /Journal read aborted/);
});

test('journal closes its database on version changes and explicit session cleanup', async t => {
  const fixture = databaseFixture(t);
  const journal = await openJournal();
  fixture.db.onversionchange();
  assert.equal(fixture.closed, true);
  journal.close();
});
