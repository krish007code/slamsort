import { test } from 'node:test';
import { File } from 'node:buffer';
const { DOMException } = globalThis;
import assert from 'node:assert/strict';
import { FileEngine, fingerprint, compare, inspectEntry, validName } from '../apps/web/src/files/engine.ts';
class Handle {
  kind='file'; data; name; failWrite=false; beforeClose;
  constructor(name, data='hello', modified=123) {this.name=name; this.data=new File([data],name,{lastModified:modified});}
  async getFile(){return this.data;}
  async isSameEntry(h){return h===this;}
  async createWritable(){let next;return {write:async data=>{if(this.failWrite)throw new Error('disk full');next=data;},close:async()=>{this.data=new File([next],this.name,{lastModified:456});this.beforeClose?.();},abort:async()=>{}};}
}
class Dir {
  kind='directory'; name; entries=new Map(); permission='granted'; removed=[]; onCreate; beforeRemove;
  constructor(name='root'){this.name=name;}
  async *values(){yield* this.entries.values();}
  async isSameEntry(h){return h===this;}
  async queryPermission(){return this.permission;}
  async getFileHandle(name,o={}){
    let h=this.entries.get(name);if(!h&&o.create){h=new Handle(name,'');this.entries.set(name,h);this.onCreate?.(h);}
    if(!h)throw new DOMException('missing','NotFoundError');if(h.kind!=='file')throw new DOMException('directory','TypeMismatchError');return h;
  }
  async getDirectoryHandle(name,o={}){let h=this.entries.get(name);if(!h&&o.create){h=new Dir(name);this.entries.set(name,h);}if(!h)throw new DOMException('missing','NotFoundError');if(h.kind!=='directory')throw new DOMException('file','TypeMismatchError');return h;}
  async removeEntry(name){this.beforeRemove?.();this.removed.push(name);this.entries.delete(name);}
}
class MemoryJournal {
  entries=new Map(); failStatus; afterPut;
  async all(){return [...this.entries.values()];}
  async put(e){if(this.failStatus===e.status)throw new Error('journal unavailable');this.entries.set(e.id,{...e});await this.afterPut?.(e);}
}
function fixture(){const root=new Dir(),target=new Dir('Documents'),j=new MemoryJournal();root.entries.set('note.txt',new Handle('note.txt'));root.entries.set('Documents',target);return {root,target,j,engine:new FileEngine(j,()=>true)};}
test('validates folder names',()=>{for(const n of ['..','a/b','NUL','CON.txt','bad.','x\n',''])assert.equal(validName(n),false,n);assert.equal(validName('Project notes'),true);});
test('copy close full verify recheck remove complete, preserving name collisions',async()=>{
  const {root,target,j,engine}=fixture();target.entries.set('note.txt',new Handle('note.txt','existing'));
  const e=await engine.move(root,'note.txt',root,'Documents');
  assert.equal(e.status,'complete');assert.equal(e.targetName,'note (1).txt');assert.equal(root.entries.has('note.txt'),false);
  assert.equal(await (await target.getFileHandle('note.txt')).data.text(),'existing');
  assert.equal(await (await target.getFileHandle('note (1).txt')).data.text(),'hello');assert.equal((await j.all())[0].status,'complete');
});
test('no mutation if intent journal fails or exclusive lock missing',async()=>{
  const {root,j,engine}=fixture();j.failStatus='intent';await assert.rejects(engine.move(root,'note.txt',root,'New'),/journal/);assert.equal(root.entries.has('New'),false);assert.ok(root.entries.has('note.txt'));
  await assert.rejects(new FileEngine(j,()=>false).move(root,'note.txt',root,'New'),/lock/);
});
test('write failure keeps source and recovery blocks subsequent mutations',async()=>{
  const {root,target,j,engine}=fixture();target.onCreate=h=>{h.failWrite=true;};
  await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/disk full/);assert.ok(root.entries.has('note.txt'));assert.equal((await j.all())[0].status,'recovery');
  await assert.rejects(engine.move(root,'note.txt',root,'Other'),/interrupted/);assert.equal(root.entries.has('Other'),false);
});
test('journal failure after copy never removes source',async()=>{
  for(const stage of ['copied','verified','removing']){const {root,j,engine}=fixture();j.failStatus=stage;await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/journal/);assert.ok(root.entries.has('note.txt'));assert.equal(root.removed.length,0);}
});
test('source change during copy retains both copies',async()=>{
  const {root,target,engine}=fixture();target.onCreate=h=>{h.beforeClose=()=>{root.entries.get('note.txt').data=new File(['changed'],'note.txt',{lastModified:999});};};
  await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/Source changed/);assert.ok(root.entries.has('note.txt'));assert.ok(target.entries.has('note.txt'));
});
test('corrupt destination fails full-content verification',async()=>{
  const {root,target,engine}=fixture();target.onCreate=h=>{h.beforeClose=()=>{h.data=new File(['wrong'],'note.txt');};};
  await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/verification/);assert.ok(root.entries.has('note.txt'));
});
test('permission loss and same directory fail without removal',async()=>{
  const {root,engine}=fixture();root.permission='denied';await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/permission/);
  root.permission='granted';await assert.rejects(engine.move(root,'note.txt',root),/same folder/);assert.equal(root.removed.length,0);
});
test('undo preserves a changed original through collision-safe naming',async()=>{
  const {root,target,engine}=fixture();const e=await engine.move(root,'note.txt',root,'Documents');root.entries.set('note.txt',new Handle('note.txt','new original'));
  const undo=await engine.undo(e);assert.equal(undo.targetName,'note (1).txt');assert.equal(await root.entries.get('note.txt').data.text(),'new original');assert.equal(await root.entries.get('note (1).txt').data.text(),'hello');assert.equal(target.entries.has('note.txt'),false);
});
test('undo refuses modified organized files and leaves both directories intact',async()=>{
  const {root,target,engine}=fixture();const e=await engine.move(root,'note.txt',root,'Documents');target.entries.get('note.txt').data=new File(['modified'],'note.txt');
  await assert.rejects(engine.undo(e),/has changed/);assert.ok(target.entries.has('note.txt'));assert.equal(root.entries.has('note.txt'),false);
});
test('interruption after removal keeps verified destination and recovery never deletes',async()=>{
  const {root,target,j,engine}=fixture();j.failStatus='complete';await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/journal/);
  assert.equal(root.entries.has('note.txt'),false);assert.equal(await target.entries.get('note.txt').data.text(),'hello');
  const state=await inspectEntry((await j.all())[0]);assert.match(state,/Source: absent/);assert.match(state,/Destination: matches/);assert.equal(target.removed.length,0);
});
test('serializes operations even while initial journal reads are pending',async()=>{
  const {root,j,engine}=fixture();let release;const gate=new Promise(r=>{release=r;});const original=j.all.bind(j);j.all=async()=>{await gate;return original();};
  const first=engine.move(root,'note.txt',root,'Documents');await assert.rejects(engine.move(root,'note.txt',root,'Other'),/active/);release();await first;
});
test('bounded comparison checks bytes beyond the first chunk',async()=>{
  const bytes=new Uint8Array(1024*1024+3).fill(42), changed=bytes.slice();changed[changed.length-1]=1;
  const a=new File([bytes],'a'),b=new File([changed],'b');assert.equal(await compare(a,b),false);assert.notDeepEqual((await fingerprint(a)).hashes,(await fingerprint(b)).hashes);
});
test('undo also refuses same-content files whose modification timestamp changed',async()=>{
  const {root,target,engine}=fixture();const e=await engine.move(root,'note.txt',root,'Documents');target.entries.get('note.txt').data=new File(['hello'],'note.txt',{lastModified:999});
  await assert.rejects(engine.undo(e),/has changed/);assert.ok(target.entries.has('note.txt'));
});
test('destination replacement after verification leaves source untouched',async()=>{
  const {root,target,j,engine}=fixture();j.afterPut=e=>{if(e.status==='verified')target.entries.set('note.txt',new Handle('note.txt','hello',456));};
  await assert.rejects(engine.move(root,'note.txt',root,'Documents'),/Destination changed/);assert.ok(root.entries.has('note.txt'));
});
test('directory name collisions receive a different file name',async()=>{
  const {root,target,engine}=fixture();target.entries.set('note.txt',new Dir('note.txt'));
  const e=await engine.move(root,'note.txt',root,'Documents');assert.equal(e.targetName,'note (1).txt');assert.equal(target.entries.get('note.txt').kind,'directory');
});
