import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextBranches } from '../apps/web/src/files/levels.ts';
import { scan } from '../apps/web/src/files/engine.ts';
const { DOMException } = globalThis;
function directory(name, count) {
  return { name, kind:'directory', async *values() { for(let i=0;i<count;i++) yield {kind:'file',name:`note-${i}.txt`}; } };
}
function root(children) {
  const opened=[];
  return { opened, async getDirectoryHandle(name) {
    opened.push(name);
    if (!(name in children)) throw new DOMException('Missing','NotFoundError');
    return children[name];
  }};
}
test('next levels keep logical paths separate and never traverse unrelated folders or duplicates',async()=>{
  const dir=root({Work:directory('Work',3),Photos:directory('Photos',2),Private:directory('Private',20),Duplicates:directory('Duplicates',3)});
  const jobs=await nextBranches(dir,['Work','Photos','Duplicates'],['Selected'],[],8,scan);
  assert.deepEqual(dir.opened,['Work','Photos']);
  assert.deepEqual(jobs.map(j=>j.path),[['Selected','Work'],['Selected','Photos']]);
  assert.deepEqual(jobs.map(j=>j.levelPath),[['Work'],['Photos']]);
  assert.deepEqual(jobs.map(j=>j.files.length),[3,2]);
});
test('singletons, empty groups, missing bins and unchanged groups terminate',async()=>{
  const dir=root({One:directory('One',1),Empty:directory('Empty',0),Same:directory('Same',4)});
  assert.deepEqual(await nextBranches(dir,['One','Empty','Missing','Same'],[],[],4,scan),[]);
});
test('branch ordering preserves breadth-first queue order at deeper levels',async()=>{
  const dir=root({Reference:directory('Reference',2)});
  const [job]=await nextBranches(dir,['Reference'],['Selected','Work'],['Work'],3,scan);
  assert.deepEqual(job.levelPath,['Work','Reference']);
  assert.deepEqual(job.path,['Selected','Work','Reference']);
});
test('permission failures stop progression instead of silently skipping unreadable files',async()=>{
  const dir={async getDirectoryHandle(){throw new DOMException('Denied','NotAllowedError');}};
  await assert.rejects(nextBranches(dir,['Work'],[],[],8,scan),{name:'NotAllowedError'});
});
