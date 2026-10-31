import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatchWindow} from '../apps/web/src/game/catchWindow.ts';
import {dropTarget,DUPLICATES_HOOP,hoopsFor} from '../apps/web/src/game/physics.ts';
test('basket waits a full second and emits only one committed destination',()=>{
  const window=new CatchWindow();window.begin('0');
  assert.equal(window.tick(999),undefined);assert.equal(window.active,true);
  assert.equal(window.tick(1),'0');assert.equal(window.tick(1000),undefined);
});
test('holding ball freezes countdown, and drop can correct destination',()=>{
  const window=new CatchWindow();window.begin('0');window.tick(900);
  assert.equal(window.grab(),true);assert.equal(window.tick(20000),undefined);
  window.drop('1');assert.equal(window.tick(179),undefined);assert.equal(window.tick(1),'1');
});
test('drop outside or reshoot clears intent without committing any move',()=>{
  const window=new CatchWindow();window.begin('0');window.grab();window.drop(undefined);
  assert.equal(window.tick(2000),undefined);window.begin('1');window.clear();assert.equal(window.tick(2000),undefined);
});
test('drop targets include category mouths and retained duplicate can',()=>{
  const hoops=[...hoopsFor(['Notes','Work']),DUPLICATES_HOOP];
  assert.equal(dropTarget({x:87,y:500},hoops)?.id,'duplicates');
  assert.equal(dropTarget({x:620,y:480},hoops)?.id,'0');
  assert.equal(dropTarget({x:300,y:300},hoops),undefined);
});
