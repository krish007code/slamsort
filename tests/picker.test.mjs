import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pickFolder} from '../apps/web/src/files/picker.ts';
const {DOMException} = globalThis;
test('folder picker preserves native receiver and is invoked synchronously on click',async()=>{
  let called=false;
  const directory={kind:'directory',name:'Disposable'};
  const browser={isSecureContext:true,showDirectoryPicker(options){
    assert.equal(this,browser);assert.deepEqual(options,{mode:'readwrite'});
    called=true;return Promise.resolve(directory);
  }};
  const promise=pickFolder(browser);assert.equal(called,true);assert.equal(await promise,directory);
});
test('unsupported or insecure browser cannot silently pretend folder access succeeded',()=>{
  assert.throws(()=>pickFolder({isSecureContext:true}),{name:'NotSupportedError'});
  let called=false;
  assert.throws(()=>pickFolder({isSecureContext:false,showDirectoryPicker(){called=true;}}),{name:'NotSupportedError'});
  assert.equal(called,false);
});
test('picker cancellation is propagated without retrying or reading any files',async()=>{
  let calls=0;
  await assert.rejects(()=>pickFolder({isSecureContext:true,showDirectoryPicker(){calls++;return Promise.reject(new DOMException('Cancelled','AbortError'));}}),{name:'AbortError'});
  assert.equal(calls,1);
});
