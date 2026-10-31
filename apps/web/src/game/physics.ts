export const GRAVITY = 900;
export const ORIGIN = { x: 200, y: 438 };
export const RADIUS = 12;
export const MAX_SPEED = 1080;
export interface Point { x: number; y: number }
export interface Hoop extends Point { id: string; label: string }
export interface Ball extends Point { vx: number; vy: number }
export function hoopsFor(labels: string[]): Hoop[] {
  return labels.map((label, i) => ({ id: String(i), label, x: 530 + i * (550 / Math.max(1, labels.length - 1)), y: 345 - i * (150 / Math.max(1, labels.length - 1)) }));
}
export function pullVelocity(pointer: Point): Point {
  const x = (ORIGIN.x - pointer.x) * 5.5, y = (ORIGIN.y - pointer.y) * 5.5;
  const scale = Math.min(1, MAX_SPEED / (Math.hypot(x, y) || 1));
  return { x: x * scale, y: y * scale };
}
export function position(v: Point, t: number): Point {
  return { x: ORIGIN.x + v.x * t, y: ORIGIN.y + v.y * t + GRAVITY * t * t / 2 };
}
export function keyboardVelocity(h: Hoop): Point {
  const t = 1.35;
  return { x: (h.x - ORIGIN.x) / t, y: (h.y - ORIGIN.y - GRAVITY * t * t / 2) / t };
}
export function crossing(a: Point, b: Point, h: Hoop): boolean {
  if (b.y <= a.y || a.y > h.y || b.y < h.y) return false;
  const x = a.x + (b.x - a.x) * (h.y - a.y) / (b.y - a.y);
  return Math.abs(x - h.x) < 43 - RADIUS;
}
export function step(ball: Ball, dt: number, hoops: Hoop[]): { ball: Ball; basket?: string; bounce: boolean } {
  const next = { x: ball.x + ball.vx * dt, y: ball.y + ball.vy * dt + GRAVITY * dt * dt / 2, vx: ball.vx, vy: ball.vy + GRAVITY * dt };
  const hit = hoops.find(h => crossing(ball, next, h));
  if (hit) return { ball: next, basket: hit.id, bounce: false };
  let bounce = false;
  if (next.x < RADIUS || next.x > 1200 - RADIUS) { next.x = Math.max(RADIUS, Math.min(1200 - RADIUS, next.x)); next.vx *= -0.67; bounce = true; }
  if (next.y > 502 - RADIUS) { next.y = 502 - RADIUS; next.vy = -Math.abs(next.vy) * 0.55; next.vx *= 0.78; bounce = true; }
  for (const h of hoops) for (const x of [h.x - 43, h.x + 43]) {
    const dx = next.x - x, dy = next.y - h.y, d = Math.hypot(dx, dy);
    if (d < RADIUS + 4 && d > 0) {
      const nx = dx / d, ny = dy / d, dot = next.vx * nx + next.vy * ny;
      next.x = x + nx * (RADIUS + 4); next.y = h.y + ny * (RADIUS + 4);
      if (dot < 0) { next.vx -= 1.65 * dot * nx; next.vy -= 1.65 * dot * ny; bounce = true; }
    }
  }
  return { ball: next, bounce };
}
