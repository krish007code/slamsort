import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareFile,bufferTarget} from '../apps/web/src/files/preparation.ts';
const {File,DOMException}=globalThis;
test('starting buffer handles zero, fewer than four, and large queues',()=>{
  assert.equal(bufferTarget(0),0);assert.equal(bufferTarget(2),2);assert.equal(bufferTarget(4),4);assert.equal(bufferTarget(5000),4);
});
test('preparation opens the real handle and bounds the text snippet locally',async()=>{
  const file=new File(['a'.repeat(6000)],'notes.txt',{type:'text/plain'});
  let reads=0;
  const prepared=await prepareFile({getFile:async()=>{reads++;return file;}});
  assert.equal(reads,1);assert.equal(prepared.file,file);assert.equal(prepared.snippet.length,1800);
});
test('unsupported preview formats become metadata-ready without reading full file contents',async()=>{
  const file=new File(['binary-content'],'archive.zip');
  file.arrayBuffer=()=>{throw new Error('Should not load the binary file');};
  const prepared=await prepareFile({getFile:async()=>file});
  assert.equal(prepared.file,file);assert.equal(prepared.snippet,'');
});
test('permission or missing-file failures do not produce a ready item',async()=>{
  await assert.rejects(()=>prepareFile({getFile:async()=>{throw new DOMException('Denied','NotAllowedError');}}),{name:'NotAllowedError'});
});
