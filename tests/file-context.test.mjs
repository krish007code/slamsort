import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileContext, shareableName } from '../apps/web/src/files/aiContext.ts';
import { planRequest } from '../apps/api/src/validation/ai.ts';
const plan = {sessionId:'session-test',requestId:'request-test',parentId:'parent-test',parentLabel:'Academics',prompt:'Make useful subcategories',files:[]};
const summary = {fileId:'file-test',approvedName:'biology-notes.txt',mimeType:'text/plain',size:123};
test('folder planning accepts bounded metadata only with an explicit consent flag',()=>{
  assert.throws(()=>planRequest({...plan,files:[summary]}));
  assert.throws(()=>planRequest({...plan,fileContextApproved:false,files:[summary]}));
  assert.deepEqual(planRequest({...plan,fileContextApproved:true,files:[summary]}).files,[summary]);
  assert.throws(()=>planRequest({...plan,fileContextApproved:'yes',files:[summary]}));
});
test('folder metadata cannot carry file bytes, snippets, paths, duplicate IDs or too many files',()=>{
  for (const extra of [{content:'private bytes'},{excerpt:'private bytes'},{relativePath:'/private/location'}])
    assert.throws(()=>planRequest({...plan,fileContextApproved:true,files:[{...summary,...extra}]}));
  assert.throws(()=>planRequest({...plan,fileContextApproved:true,files:[summary,summary]}));
  assert.throws(()=>planRequest({...plan,fileContextApproved:true,files:Array.from({length:13},(_,i)=>({...summary,fileId:`file-${i}`}))}));
});
test('hidden, credential and path-like names are excluded in both client and API',()=>{
  for(const name of ['.env','.env.production','credentials.json','service-account.json','private-key.pem','keys.p12','id_rsa','access-token.txt','passwords.json','folder/file.txt','folder\\file.txt']) {
    assert.equal(shareableName(name),false,name);
    assert.throws(()=>planRequest({...plan,fileContextApproved:true,files:[{...summary,approvedName:name}]}));
  }
});
test('context collection filters sensitive handles before opening and reads metadata without contents',async()=>{
  let opened=0;
  const items=[{name:'.env',handle:{getFile(){throw new Error('Sensitive handle opened');}}},...Array.from({length:20},(_,i)=>({name:`biology-${i}.txt`,handle:{async getFile(){opened++;return {size:123,type:'text/plain',text(){throw new Error('Contents read');},arrayBuffer(){throw new Error('Contents read');}};}}}))];
  const result=await fileContext(items);
  assert.equal(opened,12);assert.equal(result.length,12);
  assert.equal(result[0].approvedName,'biology-0.txt');assert.equal(result[0].size,123);
  assert.equal(new Set(result.map(f=>f.fileId)).size,12);
});
