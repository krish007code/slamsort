import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossing, hoopsFor, keyboardVelocity, step, position, ORIGIN, pullVelocity, MAX_SPEED, FLOOR } from '../apps/web/src/game/physics.ts';
test('only a downward crossing fully inside the rim scores', () => {
  const h = {x: 100, y: 100};
  assert.equal(crossing({x:100,y:90}, {x:100,y:110}, h), true);
  assert.equal(crossing({x:100,y:110}, {x:100,y:90}, h), false);
  assert.equal(crossing({x:132,y:90}, {x:132,y:110}, h), false);
  assert.equal(crossing({x:100,y:90}, {x:100,y:90}, h), false);
});
test('pull is backwards and strength clamps', () => {
  const v = pullVelocity({x:-10000,y:10000}); assert.ok(Math.abs(Math.hypot(v.x,v.y)-MAX_SPEED)<1e-8);
  assert.ok(v.x>0 && v.y<0);
});
test('all 1–5 hoops reachable by an assisted shot without an earlier hoop intercept', () => {
  for (let count=1;count<=5;count++) {
    const hoops = hoopsFor(Array.from({length:count},(_,i)=>`Bin ${i}`));
    for (const h of hoops) {
      const v = keyboardVelocity(h); assert.ok(Math.hypot(v.x,v.y)<=MAX_SPEED);
      let ball = {...ORIGIN,vx:v.x,vy:v.y}, basket;
      for (let t=0;t<3.8;t+=1/240) { const r=step(ball,1/240,hoops); ball=r.ball; if(r.basket!==undefined) {basket=r.basket; break;} }
      assert.equal(basket,h.id,`count=${count} hoop=${h.id}`);
    }
  }
});
test('dotted trajectory and simulated free flight agree', () => {
  const v={x:500,y:-700}; let ball={...ORIGIN,vx:v.x,vy:v.y};
  for(let i=0;i<180;i++) ball=step(ball,1/240,[]).ball;
  const expected=position(v,.75); assert.ok(Math.hypot(ball.x-expected.x,ball.y-expected.y)<1e-8);
});
test('floor, walls and rims bounce instead of scoring side impacts', () => {
  assert.ok(step({x:20,y:450,vx:-1000,vy:0},.02,[]).ball.vx>0);
  assert.ok(step({x:200,y:FLOOR-13,vx:100,vy:100},.02,[]).ball.vy<0);
  const h={id:'0',label:'Bin',x:500,y:300};
  const r=step({x:450,y:297,vx:300,vy:0},.01,[h]); assert.equal(r.basket,undefined);assert.equal(r.bounce,true);
});
