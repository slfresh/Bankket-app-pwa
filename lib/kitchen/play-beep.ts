/** Short beep for kitchen “new order” (requires user gesture on some browsers for first play). */
export function playKitchenBeep(): void {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.07;
    osc.start();
    setTimeout(() => {
      try {
        osc.stop();
        void ctx.close();
      } catch {
        /* ignore */
      }
    }, 140);
  } catch {
    /* ignore */
  }
}

export const KITCHEN_SOUND_MUTE_KEY = "banquet_kitchen_sound_muted";

export function isKitchenSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KITCHEN_SOUND_MUTE_KEY) === "1";
}

export function setKitchenSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KITCHEN_SOUND_MUTE_KEY, muted ? "1" : "0");
}
