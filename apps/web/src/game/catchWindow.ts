/** A basket remains provisional for a second; only expiry produces a move intent. */
export class CatchWindow {
  target: string | undefined;
  remaining = 0;
  dragging = false;
  get active() { return this.target !== undefined; }
  begin(target: string) { this.target = target; this.remaining = 1000; this.dragging = false; }
  grab() { if (!this.active) return false; this.dragging = true; return true; }
  drop(target: string | undefined) {
    if (!this.dragging) return;
    this.dragging = false;
    if (target === undefined) { this.clear(); return; }
    this.target = target;
    this.remaining = Math.max(this.remaining, 180);
  }
  tick(milliseconds: number): string | undefined {
    if (!this.active || this.dragging) return;
    this.remaining -= milliseconds;
    if (this.remaining > 0) return;
    const result = this.target; this.clear(); return result;
  }
  clear() { this.target = undefined; this.remaining = 0; this.dragging = false; }
}
