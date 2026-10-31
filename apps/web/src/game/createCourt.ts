import Phaser from 'phaser';
import { shotSound } from './sound';
import { ORIGIN, MAX_SPEED, pullVelocity, position, step, keyboardVelocity, hoopsFor } from './physics';
import type { Ball, Point, Hoop } from './physics';
export interface CourtState {
  labels: string[]; fileKey: string; filename: string; enabled: boolean; paused: boolean; sound: boolean;
  fire: number; destination: number; onReady: (ready: boolean) => void; onShot: () => void; onSettle: (basket?: string) => void;
}
export function createCourt(parent: HTMLElement, read: () => CourtState): () => void {
  class CourtScene extends Phaser.Scene {
    private dynamic!: Phaser.GameObjects.Graphics;
    private labels: Phaser.GameObjects.Text[] = [];
    private hoops: Hoop[] = [];
    private ball: Ball | undefined;
    private aim: Point | undefined;
    private dragging = false;
    private age = 0;
    private readyAt = 0;
    private ready: boolean | undefined;
    private key = '';
    private plan = '';
    private fire = 0;
    private fileLabel!: Phaser.GameObjects.Text;
    private message!: Phaser.GameObjects.Text;
    constructor() { super('court'); }
    create() {
      const g = this.add.graphics();
      g.fillGradientStyle(0x43304f, 0x302840, 0x241f33, 0x33233b).fillRect(0, 0, 1200, 560);
      // Deterministic original masonry and structural steel, with warm floorboards.
      for (let row = 0; row < 9; row++) for (let col = -1; col < 13; col++) {
        const x = col * 108 + (row % 2) * 54, y = row * 58;
        g.fillStyle([0x55394e, 0x493347, 0x3c3045][(row + col + 15) % 3] ?? 0x493347, .45).fillRoundedRect(x + 3, y + 3, 101, 51, 3);
      }
      for (const x of [70, 390, 710, 1150]) {
        g.fillStyle(0x231f31).fillRect(x - 8, 0, 32, 502);
        g.fillStyle(0x59405e).fillRect(x, 0, 12, 502);
        for (let y = 20; y < 500; y += 55) g.fillStyle(0x99819a, .3).fillCircle(x + 6, y, 2);
      }
      g.fillStyle(0x181d2b).fillRect(0, 30, 1200, 12);
      g.lineStyle(3, 0x84614a).lineBetween(390, 50, 640, 150).lineBetween(710, 50, 980, 120);
      g.fillStyle(0x866048).fillRect(0, 502, 1200, 58);
      g.fillStyle(0xc39764).fillRect(0, 502, 1200, 6);
      g.lineStyle(1, 0x4f3c36);
      for (let x = 0; x < 1200; x += 85) g.lineBetween(x, 509, x - 28, 560);
      g.lineStyle(2, 0xd8bb8a, .4).strokeEllipse(220, 536, 240, 28).lineBetween(440, 510, 440, 560);
      this.add.text(126, 106, 'MAKE\nSPACE.', { fontFamily: 'sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#9b7397' }).setAlpha(.5).setRotation(-.06);
      this.add.text(128, 218, 'THE LOCAL LEAGUE / EST. 2026', { fontFamily: 'monospace', fontSize: '11px', color: '#a58d99' }).setAlpha(.55);
      g.fillStyle(0x174f55).fillRoundedRect(143, 467, 112, 35, 9);
      g.lineStyle(4, 0x64cbbb).strokeCircle(200, 475, 23);
      g.fillStyle(0x307f7f).fillRoundedRect(178, 443, 44, 35, 8);
      g.fillStyle(0x91dfcc).fillRect(181, 452, 38, 5);
      this.add.text(157, 483, 'SLAMSORT', { fontFamily: 'monospace', fontSize: '11px', color: '#c9ebd8' });
      this.dynamic = this.add.graphics();
      this.message = this.add.text(32, 30, '', { fontFamily: 'monospace', fontSize: '14px', color: '#f5d69f' });
      this.fileLabel = this.add.text(200, 387, '', { fontFamily: 'monospace', fontSize: '11px', color: '#efe4ce', backgroundColor: '#211d30', padding: { x: 8, y: 5 } }).setOrigin(.5);
      this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (read().enabled && !read().paused && !this.ball && this.time.now > this.readyAt && Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) < 65) { this.dragging = true; this.aim = { x: p.x, y: p.y }; }
      });
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (this.dragging) this.aim = { x: p.x, y: p.y }; });
      this.input.on('pointerup', () => {
        if (this.dragging && this.aim) this.launch(pullVelocity(this.aim));
        this.dragging = false; this.aim = undefined;
      });
    }
    cancel = () => { this.dragging = false; this.aim = undefined; };
    externalMove = (e: PointerEvent) => {
      if (!this.dragging) return;
      const rect = game.canvas.getBoundingClientRect();
      this.aim = { x: (e.clientX - rect.left) * 1200 / rect.width, y: (e.clientY - rect.top) * 560 / rect.height };
    };
    externalRelease = () => { if (this.dragging && this.aim) this.launch(pullVelocity(this.aim)); this.cancel(); };
    private launch(v: Point) {
      if (read().fileKey !== this.key || !read().enabled || read().paused || this.ball || this.time.now < this.readyAt || Math.hypot(v.x, v.y) < 40) return;
      this.ball = { ...ORIGIN, vx: v.x, vy: v.y }; this.age = 0; this.cancel(); read().onShot();
    }
    update(_time: number, delta: number) {
      const state = read();
      if (state.fileKey !== this.key) { this.key = state.fileKey; this.readyAt = this.time.now + 1850; this.ball = undefined; this.cancel(); }
      if (this.plan !== JSON.stringify(state.labels)) {
        this.plan = JSON.stringify(state.labels); this.labels.forEach(t => t.destroy()); this.labels = [];
        this.hoops = hoopsFor(state.labels);
        for (const h of this.hoops) this.labels.push(this.add.text(h.x, h.y - 74, `${Number(h.id) + 1}  ${h.label}`, { fontFamily: 'sans-serif', fontSize: '17px', color: '#f6dfaf', backgroundColor: '#211d30', padding: { x: 12, y: 9 } }).setOrigin(.5));
      }
      if (state.paused || !state.enabled) this.cancel();
      if (state.fire !== this.fire) { this.fire = state.fire; const h = this.hoops[state.destination]; if (h) this.launch(keyboardVelocity(h)); }
      if (this.ball && !state.paused) {
        // Fixed small steps keep rim collisions and downward crossings stable across frame rates.
        let remaining = Math.min(delta / 1000, .05);
        while (remaining > 0 && this.ball) {
          const dt = Math.min(1 / 240, remaining); remaining -= dt; this.age += dt;
          const result = step(this.ball, dt, this.hoops); this.ball = result.ball;
          if (result.basket !== undefined || this.age > 3.8 || this.ball.y > 800) {
            const basket = result.basket; this.ball = undefined; this.readyAt = this.time.now + 400; if (state.sound) shotSound(basket !== undefined); state.onSettle(basket);
          }
        }
      }
      const ready = !this.ball && this.time.now >= this.readyAt;
      if (ready !== this.ready) { this.ready = ready; state.onReady(ready); }
      const g = this.dynamic; g.clear();
      for (const h of this.hoops) {
        g.fillStyle(0x956947).fillRect(h.x - 65, h.y + 65, 130, 12);
        g.lineStyle(2, 0x568a87).lineBetween(h.x + 57, h.y + 77, h.x + 57, 502);
        g.fillStyle(0x2d7378).fillRoundedRect(h.x + 46, h.y - 45, 12, 66, 3);
        g.lineStyle(2, 0xb1d8c5, .7);
        for (let i = 0; i < 6; i++) {
          const x = h.x - 40 + i * 16;
          g.lineBetween(x, h.y + 5, h.x + (x - h.x) * .55 + 9, h.y + 57);
          g.lineBetween(x, h.y + 5, h.x + (x - h.x) * .55 - 9, h.y + 57);
        }
        g.lineStyle(6, 0xf3bd65).lineBetween(h.x - 43, h.y, h.x + 43, h.y);
        g.fillStyle(0xfce0a2).fillCircle(h.x - 43, h.y, 4).fillCircle(h.x + 43, h.y, 4);
      }
      const v = this.aim ? pullVelocity(this.aim) : undefined;
      if (v) {
        for (let t = .08; t < 2.3; t += .075) { const p = position(v, t); if (p.y > 490 || p.x < 0 || p.x > 1200) break; g.fillStyle(0x79dfc8, Math.max(.15, 1 - t / 2.4)).fillCircle(p.x, p.y, 3); }
        g.lineStyle(4, 0xf3bd65).lineBetween(ORIGIN.x, ORIGIN.y, ORIGIN.x + v.x / 10, ORIGIN.y + v.y / 10);
        const angle = Math.atan2(v.y, v.x), x = ORIGIN.x + v.x / 10, y = ORIGIN.y + v.y / 10;
        g.lineBetween(x, y, x - 14 * Math.cos(angle - .5), y - 14 * Math.sin(angle - .5)).lineBetween(x, y, x - 14 * Math.cos(angle + .5), y - 14 * Math.sin(angle + .5));
      }
      const p = this.ball ?? ORIGIN;
      const crumple = Math.max(0, Math.min(1, (this.readyAt - this.time.now) / 850));
      if (!this.ball && crumple > .25) {
        const size = 12 + crumple * 22; g.fillStyle(0xf1e7cd).fillRoundedRect(p.x - size / 2, p.y - size / 2, size, size * 1.15, 3);
        g.lineStyle(1, 0xb8a891).lineBetween(p.x - size / 3, p.y - 4, p.x + size / 3, p.y - 4).lineBetween(p.x - size / 3, p.y + 3, p.x + size / 4, p.y + 3);
      } else {
        g.fillStyle(0x100f20, .35).fillEllipse(p.x + 4, 498, 30, 6);
        const outline = [{x:-12,y:-3},{x:-8,y:-10},{x:0,y:-12},{x:8,y:-9},{x:12,y:-2},{x:10,y:7},{x:3,y:12},{x:-6,y:10},{x:-12,y:4}].map(q => new Phaser.Math.Vector2(p.x+q.x,p.y+q.y));
        g.fillStyle(0xeee5cf).fillPoints(outline, true);
        g.lineStyle(1, 0xa39889).strokePoints(outline, true);
        g.fillStyle(0xc5bcaa).fillTriangle(p.x-8,p.y-5,p.x+2,p.y-8,p.x-2,p.y+3);
        g.lineStyle(1, 0xaaa18f).lineBetween(p.x-2,p.y+3,p.x+7,p.y-5).lineBetween(p.x-2,p.y+3,p.x+5,p.y+8).lineBetween(p.x-8,p.y+5,p.x-2,p.y+3);
        g.lineStyle(1, 0xffffff, .7).lineBetween(p.x+1,p.y-9,p.x+8,p.y-6).lineBetween(p.x-8,p.y+6,p.x-2,p.y+9);
      }
      this.fileLabel.setText(state.filename.length > 29 ? `${state.filename.slice(0, 26)}…` : state.filename).setVisible(!this.ball && !!state.filename);
      this.message.setText(state.paused ? 'PAUSED · your files can wait' : this.ball ? 'IN FLIGHT' : v ? `POWER ${Math.round(Math.hypot(v.x, v.y) / MAX_SPEED * 100)}% · release to shoot` : 'DRAG BACK FROM THE PAPER BALL ↙  RELEASE TO SHOOT ↗');
    }
  }
  const scene = new CourtScene();
  const game = new Phaser.Game({ type: Phaser.AUTO, parent, width: 1200, height: 560, backgroundColor: '#2d2540', scene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, input: { windowEvents: true }, audio: { noAudio: true }, banner: false });
  const cancel = () => scene.cancel();
  window.addEventListener('pointercancel', cancel, true); window.addEventListener('blur', cancel);
  window.addEventListener('pointermove', scene.externalMove); window.addEventListener('pointerup', scene.externalRelease);
  return () => { window.removeEventListener('pointercancel', cancel, true); window.removeEventListener('blur', cancel); window.removeEventListener('pointermove', scene.externalMove); window.removeEventListener('pointerup', scene.externalRelease); game.destroy(true); };
}
