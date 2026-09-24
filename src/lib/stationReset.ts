export const STATION_RESET_COUNTDOWN_SECONDS = 12;

export interface StationResetGuard {
  tryStart: () => boolean;
  release: () => void;
}

/** Starts the visible countdown and returns an idempotent timer cleanup. */
export function startStationResetCountdown(
  onTick: (remaining: number) => void,
  onElapsed: () => void,
  seconds = STATION_RESET_COUNTDOWN_SECONDS,
): () => void {
  let remaining = seconds;
  let cleaned = false;
  onTick(remaining);

  const interval = setInterval(() => {
    remaining = Math.max(remaining - 1, 0);
    onTick(remaining);
  }, 1000);
  const timeout = setTimeout(() => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(interval);
    onTick(0);
    onElapsed();
  }, seconds * 1000);

  return () => {
    if (cleaned) return;
    cleaned = true;
    clearInterval(interval);
    clearTimeout(timeout);
  };
}

/** Guards the CTA and countdown callbacks, which can fire in the same tick. */
export function createStationResetGuard(): StationResetGuard {
  let running = false;

  return {
    tryStart() {
      if (running) return false;
      running = true;
      return true;
    },
    release() {
      running = false;
    },
  };
}
