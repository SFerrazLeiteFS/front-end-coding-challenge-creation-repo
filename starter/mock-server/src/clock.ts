/** Source of time for everything time-based in the mock (cursor age, intervals, stream lifetime). */
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

export interface ManualClock extends Clock {
  /** Moves time forward and runs every timer that falls due, in order. */
  advance(ms: number): void;
}

/** A clock that only moves when told to. Useful for testing time-based behaviour. */
export function createManualClock(start = Date.UTC(2026, 0, 1)): ManualClock {
  let now = start;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();

  return {
    now: () => now,
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(0, ms), callback });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let dueId: number | undefined;
        let due: { at: number; callback: () => void } | undefined;
        for (const [id, timer] of timers) {
          if (timer.at <= target && (!due || timer.at < due.at)) {
            dueId = id;
            due = timer;
          }
        }
        if (!due || dueId === undefined) break;
        timers.delete(dueId);
        now = due.at;
        due.callback();
      }
      now = target;
    },
  };
}
