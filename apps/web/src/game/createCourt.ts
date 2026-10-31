import Phaser from 'phaser';
import { CatchWindow } from './catchWindow';
import { shotSound } from './sound';
import { drawWarehouse, timber } from './scenery';
import { DUPLICATES_HOOP, dropTarget, ORIGIN, WIDTH, HEIGHT, FLOOR, MAX_SPEED, pullVelocity, position, step, keyboardVelocity, hoopsFor } from './physics';
import type { Ball, Point, Hoop } from './physics';
export interface CourtState {
  labels: string[]; fileKey: string; filename: string; enabled: boolean; paused: boolean; sound: boolean;
  fire: number; reset: number; destination: number; onReady: (ready: boolean) => void; onShot: () => void; onSettle: (basket?: string) => void;
}
export function createCourt(parent: HTMLElement, read: () => CourtState): () => void {
  class CourtScene extends Phaser.Scene {
    private dynamic!: Phaser.GameObjects.Graphics;
    private labels: Phaser.GameObjects.Text[] = [];
    private hoops: Hoop[] = [];
    private ball: Ball | undefined;
    private catchWindow = new CatchWindow();
    private aim: Point | undefined;
    private dragging = false;
    private age = 0;
    private readyAt = 0;
    private ready: boolean | undefined;
    private key = '';
    private plan = '';
    private fire = 0;
    private reset = 0;
    private loadedAt = 0;
    private fileType!: Phaser.GameObjects.Text;
    private fileLabel!: Phaser.GameObjects.Text;
    private message!: Phaser.GameObjects.Text;
    constructor() { super('court'); }
    create() {
      const g = drawWarehouse(this);
      // Files enter from the left, pass through the crumpler, and load the cannon.
      timber(g, 32, 633, 230, 0, 18);
      g.fillStyle(0x17272c).fillRoundedRect(34, 598, 214, 24, 9);
      g.lineStyle(3, 0x70817a).strokeRoundedRect(34, 598, 214, 24, 9);
      for (let x = 44; x < 244; x += 23) g.fillStyle(0x324b4c).fillCircle(x, 610, 7);
      timber(g, 56, 635, 41, Math.PI / 2, 10); timber(g, 227, 635, 41, Math.PI / 2, 10);
      g.fillStyle(0x205459).fillRoundedRect(229, 538, 50, 79, 5);
      g.lineStyle(3, 0x74a99b).strokeRoundedRect(229, 538, 50, 79, 5);
      g.fillStyle(0x112d35).fillRect(235, 562, 38, 24);
      g.fillStyle(0xc48a43).fillCircle(254, 550, 4);
      timber(g, 276, 586, 52, -.38, 10);
      this.add.text(42, 647, 'FILE FEED', {fontFamily:'monospace',fontSize:'11px',color:'#c4a97c'});
      this.add.text(226, 522, 'CRUMPLER', {fontFamily:'monospace',fontSize:'10px',color:'#91b4a3'});
      g.fillStyle(0x16262f).fillRoundedRect(281, 639, 100, 16, 5);
      g.fillStyle(0x29626b).fillEllipse(331, 636, 86, 39);
      g.lineStyle(4, 0x81b7a3).strokeEllipse(331, 636, 86, 39);
      g.fillStyle(0x253c45).fillRect(296, 645, 12, 12).fillRect(353, 645, 12, 12);
      this.dynamic = this.add.graphics();
      this.message = this.add.text(32, 30, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f5d69f' });
      this.fileLabel = this.add.text(ORIGIN.x, ORIGIN.y - 72, '', { fontFamily: 'monospace', fontSize: '11px', color: '#efe4ce', backgroundColor: '#211d30', padding: { x: 8, y: 5 } }).setOrigin(.5);
      this.fileType = this.add.text(80, 568, '', {fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#325b68'}).setOrigin(.5);
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (this.catchWindow.active && this.ball && !read().paused && Math.hypot(p.x-this.ball.x,p.y-this.ball.y)<48) { this.catchWindow.grab(); return; }
        if (read().enabled && !read().paused && !this.ball && this.time.now > this.readyAt && Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) < 65) { this.dragging = true; this.aim = { x: p.x, y: p.y }; }
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.movePointer({x:p.x,y:p.y}));
      this.input.on('pointerup', this.externalRelease);
    }
    cancel = () => { this.dragging = false; this.aim = undefined; };
    private movePointer(point: Point) {
      if (read().paused) return;
      if (this.catchWindow.dragging && this.ball) this.ball = {...point,vx:0,vy:0};
      else if (this.dragging) this.aim = point;
    }
    externalMove = (e: PointerEvent) => {
      if (!this.dragging && !this.catchWindow.dragging) return;
      const rect = game.canvas.getBoundingClientRect();
      this.movePointer({ x: (e.clientX - rect.left) * WIDTH / rect.width, y: (e.clientY - rect.top) * HEIGHT / rect.height });
    };
    externalRelease = () => {
      if (this.catchWindow.dragging && this.ball) {
        const target = dropTarget(this.ball, this.hoops);
        this.catchWindow.drop(target?.id);
        if (!target) { this.ball = undefined; this.readyAt = this.time.now + 300; read().onSettle(undefined); }
        else this.ball = {x:target.x,y:target.y+18,vx:0,vy:0};
      } else if (this.dragging && this.aim) this.launch(pullVelocity(this.aim));
      this.cancel();
    };
    cancelInteraction = () => {
      this.cancel();
      if (this.catchWindow.dragging) { this.catchWindow.clear(); this.ball=undefined; read().onSettle(undefined); }
    };
    private launch(v: Point) {
      if (read().fileKey !== this.key || !read().enabled || read().paused || this.ball || this.time.now < this.readyAt || Math.hypot(v.x, v.y) < 40) return;
      this.ball = { ...ORIGIN, vx: v.x, vy: v.y }; this.age = 0; this.cancel(); read().onShot();
    }
    update(_time: number, delta: number) {
      const state = read();
      if (state.fileKey !== this.key) { this.key = state.fileKey; this.loadedAt = this.time.now; this.readyAt = this.time.now + 1700; this.ball = undefined; this.catchWindow.clear(); this.cancel(); }
      if (state.reset !== this.reset) {
        this.reset = state.reset; this.ball = undefined; this.catchWindow.clear(); this.cancel();
        this.loadedAt = this.time.now; this.readyAt = this.time.now + 650;
      }
      if (this.plan !== JSON.stringify(state.labels)) {
        this.plan = JSON.stringify(state.labels); this.labels.forEach(t => t.destroy()); this.labels = [];
        this.hoops = [...hoopsFor(state.labels), DUPLICATES_HOOP];
        for (const h of this.hoops) this.labels.push(this.add.text(h.x, h.y - 93, `${h.id === 'duplicates' ? '' : Number(h.id) + 1 + '  '}${h.label.length > 18 ? h.label.slice(0, 16) + '…' : h.label}`, { fontFamily: 'sans-serif', fontSize: '17px', color: '#f6dfaf', backgroundColor: '#211d30', padding: { x: 12, y: 9 } }).setOrigin(.5));
      }
      if (state.paused || !state.enabled) this.cancel();
      if (state.fire !== this.fire) { this.fire = state.fire; const h = state.destination === -1 ? DUPLICATES_HOOP : this.hoops[state.destination]; if (h) this.launch(keyboardVelocity(h)); }
      if (this.catchWindow.active && !state.paused) {
        const target = this.catchWindow.tick(Math.min(delta, 100));
        if (target !== undefined) {
          this.ball = undefined; this.readyAt = this.time.now + 400;
          if (state.sound) shotSound(true);
          state.onSettle(target);
        }
      }
      if (this.ball && !this.catchWindow.active && !state.paused) {
        // Fixed small steps keep rim collisions and downward crossings stable across frame rates.
        let remaining = Math.min(delta / 1000, .05);
        while (remaining > 0 && this.ball) {
          const dt = Math.min(1 / 240, remaining); remaining -= dt; this.age += dt;
          const result = step(this.ball, dt, this.hoops); this.ball = result.ball;
          if (result.basket !== undefined) {
            const hoop = this.hoops.find(h => h.id === result.basket)!;
            this.catchWindow.begin(result.basket);
            this.ball = {x:hoop.x,y:hoop.y+18,vx:0,vy:0};
            break;
          }
          if (this.age > 3.8 || this.ball.y > HEIGHT+100) {
            this.ball=undefined; this.readyAt=this.time.now+400;
            if (state.sound) shotSound(false); state.onSettle(undefined);
          }
        }
      }
      const ready = !this.ball && this.time.now >= this.readyAt;
      if (ready !== this.ready) { this.ready = ready; state.onReady(ready); }
      const g = this.dynamic; g.clear();
      // Timber backboards and angled guide rails echo the reference's basketball contraptions.
      for (const h of this.hoops) {
        if (h.id === 'duplicates') {
          // The can is a retained-files destination, never a permanent-delete action.
          g.fillStyle(0x283943).fillRoundedRect(h.x-29,h.y+3,58,61,5);
          g.lineStyle(3,0x8eaaa0).strokeRoundedRect(h.x-29,h.y+3,58,61,5);
          g.lineStyle(5,0xb3b5a1).lineBetween(h.x-34,h.y,h.x+34,h.y);
          for (const offset of [-15,0,15]) g.lineStyle(2,0x6e8780).lineBetween(h.x+offset,h.y+14,h.x+offset,h.y+51);
          continue;
        }
        timber(g, h.x + 53, h.y - 61, 136, Math.PI / 2, 15);
        timber(g, h.x - 66, h.y + 82, 132, 0, 13);
        timber(g, h.x + 53, h.y - 61, 72, -2.55, 14);
        
        g.lineStyle(2, 0x568a87).lineBetween(h.x + 57, h.y + 89, h.x + 57, FLOOR);
        
        g.lineStyle(2, 0xb1d8c5, .7);
        for (let i = 0; i < 6; i++) {
          const x = h.x - 40 + i * 16;
          g.lineBetween(x, h.y + 5, h.x + (x - h.x) * .55 + 9, h.y + 57);
          g.lineBetween(x, h.y + 5, h.x + (x - h.x) * .55 - 9, h.y + 57);
        }
        g.lineStyle(7, 0x36aa95).lineBetween(h.x - 43, h.y, h.x + 43, h.y);
        g.fillStyle(0xfce0a2).fillCircle(h.x - 43, h.y, 4).fillCircle(h.x + 43, h.y, 4);
      }
      if (this.catchWindow.active && this.ball) {
        const target = this.catchWindow.dragging ? dropTarget(this.ball,this.hoops) : this.hoops.find(h=>h.id===this.catchWindow.target);
        if (target) g.lineStyle(3,0xf3d68e,.85).strokeRoundedRect(target.x-55,target.y-15,110,85,8);
        g.lineStyle(3,0xf6d386).strokeCircle(this.ball.x,this.ball.y,23);
        g.fillStyle(0xf6d386,.7).fillRect(this.ball.x-23,this.ball.y-34,46*Math.max(0,this.catchWindow.remaining/1000),4);
      }
      const v = this.aim ? pullVelocity(this.aim) : undefined;
      if (v) {
        for (let t = .08; t < 2.3; t += .075) { const p = position(v, t); if (p.y > FLOOR - 12 || p.x < 0 || p.x > WIDTH) break; g.fillStyle(0x79dfc8, Math.max(.15, 1 - t / 2.4)).fillCircle(p.x, p.y, 3); }
        g.lineStyle(4, 0xf3bd65).lineBetween(ORIGIN.x, ORIGIN.y, ORIGIN.x + v.x / 10, ORIGIN.y + v.y / 10);
        const angle = Math.atan2(v.y, v.x), x = ORIGIN.x + v.x / 10, y = ORIGIN.y + v.y / 10;
        g.lineBetween(x, y, x - 14 * Math.cos(angle - .5), y - 14 * Math.sin(angle - .5)).lineBetween(x, y, x - 14 * Math.cos(angle + .5), y - 14 * Math.sin(angle + .5));
      }
      const theta = v ? Math.atan2(v.y, v.x) : -.98;
      const end = {x: ORIGIN.x, y: ORIGIN.y};
      const back = {x:end.x-Math.cos(theta)*69,y:end.y-Math.sin(theta)*69};
      g.lineStyle(39,0x142c38).lineBetween(back.x,back.y,end.x,end.y);
      g.lineStyle(29,0x266c79).lineBetween(back.x,back.y,end.x,end.y);
      g.lineStyle(4,0x82b3a3).lineBetween(back.x-8,back.y-7,end.x-8,end.y-7);
      g.fillStyle(0xa36e37).fillRoundedRect(back.x-7,back.y-8,14,21,2);
      g.fillStyle(0xdd8935).fillRect(back.x-3,back.y-3,6,10);
      const elapsed = this.time.now - this.loadedAt;
      const loading = !this.ball && elapsed < 1700 && this.readyAt > this.time.now;
      const feed = Math.min(1, elapsed / 900);
      const extension = state.filename.split('.').pop()?.slice(0,5).toUpperCase() ?? 'FILE';
      this.fileType.setText(extension).setVisible(loading && elapsed < 1050).setAlpha(1 - Math.max(0,(elapsed-900)/150));
      if (loading && elapsed < 1050) {
        const x = 65 + feed * 183, y = 566;
        this.fileType.setPosition(x,y+1);
        const squash = Math.max(0, Math.min(1, (elapsed - 900) / 150));
        const w = 46 - 26 * squash, h = 59 - 37 * squash;
        g.fillStyle(0xf3e7c8).fillRoundedRect(x-w/2,y-h/2,w,h,3 + squash * 6);
        g.fillStyle(0x79a69a).fillTriangle(x+8,y-31,x+23,y-16,x+8,y-16);
        g.lineStyle(2,0xb7a98d).lineBetween(x-14,y+12,x+14,y+12).lineBetween(x-14,y+19,x+7,y+19);
      }
      const transfer = Math.max(0, Math.min(1,(elapsed-1050)/650));
      const p = this.ball ?? (loading && elapsed >= 1050 ? {x:254+(ORIGIN.x-254)*transfer,y:576+(ORIGIN.y-576)*transfer-18*Math.sin(transfer*Math.PI)} : ORIGIN);
      if (!loading || elapsed >= 1050) {
        const outline = [{x:-12,y:-3},{x:-8,y:-10},{x:0,y:-12},{x:8,y:-9},{x:12,y:-2},{x:10,y:7},{x:3,y:12},{x:-6,y:10},{x:-12,y:4}].map(q => new Phaser.Math.Vector2(p.x+q.x,p.y+q.y));
        g.fillStyle(0xeee5cf).fillPoints(outline, true); g.lineStyle(1,0xa39889).strokePoints(outline,true);
        g.fillStyle(0xc5bcaa).fillTriangle(p.x-8,p.y-5,p.x+2,p.y-8,p.x-2,p.y+3);
        g.lineStyle(1,0xaaa18f).lineBetween(p.x-2,p.y+3,p.x+7,p.y-5).lineBetween(p.x-2,p.y+3,p.x+5,p.y+8).lineBetween(p.x-8,p.y+5,p.x-2,p.y+3);
      }
      this.fileLabel.setText(state.filename.length > 29 ? `${state.filename.slice(0, 26)}…` : state.filename).setVisible(!this.ball && !!state.filename);
      this.message.setText(state.paused ? 'PAUSED · your files can wait' : this.catchWindow.active ? (this.catchWindow.dragging ? 'DROP INTO A HOOP · OUTSIDE = RETRY' : '1 SECOND TO CORRECT · GRAB THE PAPER BALL') : this.ball ? 'IN FLIGHT' : v ? `POWER ${Math.round(Math.hypot(v.x, v.y) / MAX_SPEED * 100)}% · release to shoot` : 'DRAG BACK FROM THE PAPER BALL ↙  RELEASE TO SHOOT ↗');
    }
  }
  const scene = new CourtScene();
  const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: WIDTH, height: HEIGHT, backgroundColor: '#2d2540', scene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { windowEvents: true }, audio: { noAudio: true }, banner: false });
  const cancel = () => scene.cancelInteraction();
  window.addEventListener('pointercancel', cancel, true); window.addEventListener('blur', cancel);
  window.addEventListener('pointermove', scene.externalMove); window.addEventListener('pointerup', scene.externalRelease);
  return () => { window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('blur', cancel); window.removeEventListener('pointermove', scene.externalMove); window.removeEventListener('pointerup', scene.externalRelease); game.destroy(true); };
}
