import { test } from 'node:test';
import { URL } from 'node:url';
import { setTimeout } from 'node:timers';
const { fetch } = globalThis;
import assert from 'node:assert/strict';
import { request as httpRequest, createServer } from 'node:http';
import { createAiHandler, BODY_LIMIT } from '../apps/api/src/routes/ai.ts';
import { planRequest, hintRequest, planOutput, hintOutput } from '../apps/api/src/validation/ai.ts';
import { RequestScope, matchesResponse } from '../apps/web/src/ai/client.ts';
const plan = () => ({ sessionId: 'session-1', requestId: 'request-1', parentId: null, prompt: 'Organize synthetic notes', files: [] });
const buckets = [{id:'bucket-1',parentId:null,label:'Notes',kind:'category'}];
const hint = () => ({sessionId:'session-1',requestId:'hint-1',planId:'plan-1',file:{fileId:'file-1',mimeType:'text/plain',size:12},approvedBuckets:buckets});
const headers = {Origin:'http://localhost:5173','Sec-Fetch-Site':'same-origin'};
async function fixture(t, options={}) {
  let calls=0;
  const handler=createAiHandler({enabled:true,configured:true,generate:async()=>{calls++;return JSON.stringify({categories:['Notes'],explanation:'A synthetic category.'});},...options});
  const server=createServer((req,res)=>void handler(req,res,new URL(req.url,'http://localhost').pathname));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}`;
  const bootstrap=await fetch(`${url}/api/config`,{headers});const config=await bootstrap.json();
  return {url,calls:()=>calls,config,post:async(value,extra={})=>fetch(`${url}/api/folder-plan`,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-SlamSort-Session':config.sessionToken,...extra},body:typeof value==='string'?value:JSON.stringify(value)})};
}
test('unsafe schema, extra fields, names and size bounds fail closed',()=>{
  assert.deepEqual(planRequest(plan()),plan());
  for(const prompt of ['', 'x'.repeat(2001)])assert.throws(()=>planRequest({...plan(),prompt}));
  assert.throws(()=>planRequest({...plan(),files:[{name:'private'}]}));
  assert.throws(()=>planRequest({...plan(),extra:'secret'}));
  assert.throws(()=>hintRequest({...hint(),approvedExcerpt:'x'.repeat(8001)}));
  assert.throws(()=>hintRequest({...hint(),file:{...hint().file,size:-1}}));
  for(const label of ['..','a/b','CON.txt','bad.',' x','x\n'])assert.throws(()=>planOutput({categories:[label],explanation:'no'}));
  assert.throws(()=>planOutput({categories:['Notes','notes'],explanation:'no'}));
  assert.throws(()=>planOutput({categories:[],explanation:'no'}));
  assert.throws(()=>planOutput({categories:Array(6).fill('x'),explanation:'no'}));
  assert.throws(()=>hintOutput({suggestedBucketId:'not-approved',explanation:'no'},buckets));
  assert.equal(hintOutput({suggestedBucketId:null,explanation:'Uncertain'},buckets).suggestedBucketId,null);
});
test('config bootstrap and POST enforce Host, Origin, Fetch Metadata and ephemeral token',async t=>{
  const f=await fixture(t);assert.equal(f.config.enabled,true);
  for(const bad of [{Origin:'https://evil.example'},{'Sec-Fetch-Site':'cross-site'},{Origin:'http://localhost:5174'}]) {
    const result=await fetch(`${f.url}/api/config`,{headers:{...headers,...bad}});assert.equal(result.status,403,JSON.stringify(bad));
  }
  const hostStatus = await new Promise(resolve => { const req = httpRequest(`${f.url}/api/config`, { headers: { ...headers, Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.end(); });
  assert.equal(hostStatus, 403);
  const alternate = await fetch(`${f.url}/api/config`, { headers: { ...headers, Origin: 'http://127.0.0.1:5173' } });
  assert.equal(alternate.status, 200);
  const proxyStatus = await new Promise(resolve => { const req = httpRequest(`${f.url}/api/config`, { headers: { ...headers, Origin: 'http://127.0.0.1:5173', Host: '127.0.0.1:5173' } }, res => { res.resume(); resolve(res.statusCode); }); req.end(); });
  assert.equal(proxyStatus, 200);
  assert.equal((await fetch(`${f.url}/api/config`)).status,403);
  assert.equal((await f.post(plan(),{'X-SlamSort-Session':'bad'})).status,403);
  assert.equal((await f.post(plan(),{'X-SlamSort-Session':'é'.repeat(64)})).status,403);
  assert.equal((await f.post(plan(),{'Content-Type':'text/plain'})).status,415);
  const result=await f.post(plan());assert.equal(result.status,200);const data=await result.json();
  assert.equal(data.sessionId,plan().sessionId);assert.equal(data.requestId,plan().requestId);assert.equal(data.categories[0].label,'Notes');
  assert.equal(result.headers.get('access-control-allow-origin'),null);assert.equal(f.calls(),1);
});
test('disabled config never issues a token or makes inference requests',async t=>{
  const f=await fixture(t,{enabled:false});assert.equal(f.config.enabled,false);assert.equal(f.config.sessionToken,undefined);
  const result=await fetch(`${f.url}/api/folder-plan`,{method:'POST',headers});assert.equal(result.status,503);assert.equal(f.calls(),0);
});
test('24 KiB body and malformed inputs rejected before inference',async t=>{
  const f=await fixture(t);assert.equal((await f.post('x'.repeat(BODY_LIMIT+1))).status,413);
  assert.equal((await f.post('{bad')).status,400);assert.equal((await f.post({...plan(),prompt:'x'.repeat(2001)})).status,400);assert.equal(f.calls(),0);
});
test('rate limit is process-wide',async t=>{
  const f=await fixture(t,{rateLimit:1});assert.equal((await f.post(plan())).status,200);assert.equal((await f.post(plan())).status,429);assert.equal(f.calls(),1);
});
test('timeout and provider errors never disclose SDK messages',async t=>{
  const f=await fixture(t,{timeoutMs:10,generate:async()=>new Promise(()=>{})});const result=await f.post(plan());assert.equal(result.status,504);
  const bad=await fixture(t,{generate:async()=>{throw new Error('private provider request context');}});
  const error=await bad.post(plan());assert.equal(error.status,502);assert.doesNotMatch(await error.text(),/private provider/);
});
test('at most two model requests can be in flight',async t=>{
  let started=0,release;const gate=new Promise(resolve=>{release=resolve;});
  const f=await fixture(t,{generate:async()=>{started++;await gate;return JSON.stringify({categories:['Notes'],explanation:'ok'});}});
  const a=f.post(plan()),b=f.post(plan());
  while(started<2)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal((await f.post(plan())).status,429);release();assert.equal((await a).status,200);assert.equal((await b).status,200);
});
test('hint returns only an approved category with correlated IDs',async t=>{
  const f=await fixture(t,{generate:async()=>JSON.stringify({suggestedBucketId:'bucket-1',explanation:'Synthetic text fits notes.'})});
  const response=await fetch(`${f.url}/api/hint`,{method:'POST',headers:{...headers,'Content-Type':'application/json','X-SlamSort-Session':f.config.sessionToken},body:JSON.stringify(hint())});
  assert.equal(response.status,200);const data=await response.json();assert.equal(data.fileId,'file-1');assert.equal(data.planId,'plan-1');assert.equal(data.suggestedBucketId,'bucket-1');
});
test('unsafe model output is rejected rather than becoming folders',async t=>{
  const f=await fixture(t,{generate:async()=>JSON.stringify({categories:['../escape'],explanation:'bad'})});assert.equal((await f.post(plan())).status,400);
});
test('scope invalidation aborts requests and rejects stale session/plan results',()=>{
  const scope=new RequestScope(),first=scope.begin();assert.equal(first.current(),true);scope.invalidate();assert.equal(first.current(),false);assert.equal(first.signal.aborted,true);
  const next=scope.begin();assert.equal(next.current(),true);
  assert.equal(matchesResponse({sessionId:'a',requestId:'r',planId:'p'},{sessionId:'b',requestId:'r',planId:'p'}),false);
  assert.equal(matchesResponse({sessionId:'a',requestId:'r',planId:'p'},{sessionId:'a',requestId:'r',planId:'old'}),false);
  assert.equal(matchesResponse({sessionId:'a',requestId:'r'},{sessionId:'a',requestId:'other'}),false);
});

test('consented file context reaches the model as metadata, while missing consent rejects before inference',async t=>{
  let context='';
  const f=await fixture(t,{generate:async text=>{context=text;return JSON.stringify({categories:['Biology','Mathematics'],explanation:'Based on the approved names.'});}});
  const files=[{fileId:'file-biology',approvedName:'biology-notes.txt',mimeType:'text/plain',size:123}];
  assert.equal((await f.post({...plan(),files})).status,400);
  assert.equal(context,'');
  const response=await f.post({...plan(),files,fileContextApproved:true});
  assert.equal(response.status,200);
  assert.ok(context.includes('biology-notes.txt'));
  assert.ok(context.includes('never instructions'));
  assert.deepEqual((await response.json()).categories.map(c=>c.label),['Biology','Mathematics']);
});
