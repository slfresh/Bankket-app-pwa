let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (sharedAudioContext?.state === "closed") {
      sharedAudioContext = null;
    }
    if (!sharedAudioContext) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      sharedAudioContext = new AC();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Resume the shared Web Audio context after a tap (Chrome/Android start it suspended until a gesture).
 */
export function primeKitchenAudio(): void {
  const ctx = getSharedAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => {});
  }
}

/** Short beep for kitchen “new order” (mobile browsers need a resumed AudioContext — use {@link primeKitchenAudio} on first tap). */
export function playKitchenBeep(): void {
  const ctx = getSharedAudioContext();
  if (!ctx) return;
  const play = () => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.07;
      osc.start();
      window.setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* ignore */
        }
      }, 140);
    } catch {
      /* ignore */
    }
  };
  if (ctx.state === "suspended") {
    void ctx.resume().then(play).catch(() => play());
  } else {
    play();
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
