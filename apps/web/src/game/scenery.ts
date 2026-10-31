import Phaser from 'phaser';
import { FLOOR, HEIGHT, WIDTH } from './physics';

// Illustrated timber/steel warehouse, drawn locally rather than lifted game assets.
export function drawWarehouse(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  g.fillStyle(0x282036).fillRect(0, 0, WIDTH, HEIGHT);
  const colors = [0x52324a, 0x3d2c42, 0x493044, 0x35283e];
  for (let row = 0; row < 12; row++) for (let col = -1; col < 10; col++) {
    const x = col * 143 + (row % 2) * 65, y = row * 66;
    g.fillStyle(colors[(row * 3 + col + 20) % 4]!).fillRect(x + 5, y + 5, 131, 55);
    g.lineStyle(2, 0x211a30).strokeRect(x + 5, y + 5, 131, 55);
    g.lineStyle(2, 0x68404f, .35).lineBetween(x + 22, y + 18, x + 75, y + 15);
  }
  // Dark diagonal braces and broad crossbars give the court its layered depth.
  g.lineStyle(24, 0x171b2c, .8);
  for (let x = -300; x < WIDTH; x += 480) g.lineBetween(x, 640, x + 560, 160);
  for (let y = 120; y < HEIGHT; y += 180) {
    g.fillStyle(0x201d2e).fillRect(0, y, WIDTH, 23);
    g.fillStyle(0x5b3c56, .6).fillRect(0, y - 5, WIDTH, 6);
  }
  for (const x of [82, 420, 752, 1128]) {
    g.fillStyle(0x211b2d).fillRect(x - 10, 0, 43, HEIGHT);
    g.fillStyle(0x51334e).fillRect(x, 0, 23, HEIGHT);
    g.lineStyle(2, 0x75516b).lineBetween(x + 3, 0, x + 3, HEIGHT);
    for (let y = 18; y < HEIGHT; y += 52) {
      g.fillStyle(0x2c2034).fillCircle(x + 16, y, 3);
      g.fillStyle(0x79536d, .55).fillRect(x + 7, y + 17, 2, 8);
    }
  }
  // Deterministic scratches, paint chips and ink splashes avoid a flat grid look.
  for (let i = 0; i < 180; i++) {
    const x = (i * 137 + 61) % WIDTH, y = (i * 83 + 17) % HEIGHT;
    g.lineStyle(1 + i % 2, i % 3 ? 0x201d2b : 0x705063, .6).lineBetween(x, y, x + 3 + i % 9, y - i % 5);
  }
  for (const [x, y] of [[105, 72], [439, 191], [795, 594], [1150, 451]]) {
    g.fillStyle(0x1c1927).fillCircle(x!, y!, 18);
    for (let i = 0; i < 8; i++) g.fillCircle(x! + Math.cos(i * 2.3) * 22, y! + Math.sin(i * 2.3) * 25, 3 + i % 3);
  }
  const graffiti = (text: string, x: number, y: number, angle: number, size: number) => scene.add.text(x, y, text, { fontFamily: 'cursive', fontSize: `${size}px`, fontStyle: 'bold italic', color: '#171621' }).setRotation(angle).setAlpha(.8);
  graffiti('SWISH', 490, 188, -.13, 58); graffiti('YOUR SHOT', 865, 110, .08, 29); graffiti('SLAM', 120, 335, -.16, 50);
  g.fillStyle(0x201b2d).fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
  g.lineStyle(3, 0x715064).lineBetween(0, FLOOR, WIDTH, FLOOR);
  return g;
}

export function timber(g: Phaser.GameObjects.Graphics, x: number, y: number, length: number, angle = 0, thickness = 15) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy * thickness / 2, ny = dx * thickness / 2;
  const points = [new Phaser.Math.Vector2(x + nx, y + ny), new Phaser.Math.Vector2(x + dx * length + nx, y + dy * length + ny), new Phaser.Math.Vector2(x + dx * length - nx, y + dy * length - ny), new Phaser.Math.Vector2(x - nx, y - ny)];
  g.fillStyle(0x98623e).fillPoints(points, true); g.lineStyle(2, 0x352326).strokePoints(points, true);
  g.lineStyle(2, 0xc68d54, .7).lineBetween(x + nx * .65, y + ny * .65, x + dx * length + nx * .65, y + dy * length + ny * .65);
  for (let i = 10; i < length; i += 31) g.fillStyle(0x49302c, .8).fillCircle(x + dx * i, y + dy * i, 1.8);
}
