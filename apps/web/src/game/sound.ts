let context: AudioContext | undefined;
// Called by the toggle's click gesture so browsers can unlock synthesized audio.
export function unlockSound() {
  context ??= new AudioContext();
  void context.resume().catch(() => {});
}
export function shotSound(win: boolean) {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator(), gain = context.createGain();
  oscillator.connect(gain); gain.connect(context.destination);
  oscillator.frequency.setValueAtTime(win ? 660 : 150, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(win ? 990 : 70, context.currentTime + .15);
  gain.gain.setValueAtTime(.07, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .22);
  oscillator.start(); oscillator.stop(context.currentTime + .23);
}
