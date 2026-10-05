import { Repeater } from 'graphql-yoga';
import type { Clock } from './clock.ts';
import type { MockConfig } from './config.ts';
import type { Events, TaskEvent } from './events.ts';
import { createRandom, type Random } from './random.ts';
import { matches, normalizeFilter, type TaskFilter } from './task-list.ts';
import { MINUTE } from './time.ts';

const MIN_LIFETIME = 2 * MINUTE;
const MAX_LIFETIME = 5 * MINUTE;

/** `taskEvents` streams. While `config.chaos` is on, each stream ends after a random lifetime. */
export function createStreams({ config, clock, events }: { config: MockConfig; clock: Clock; events: Events }) {
  let random: Random = createRandom(config.seed + 3);

  return {
    reset() {
      random = createRandom(config.seed + 3);
    },
    taskEvents(filter: TaskFilter | null | undefined) {
      const normalized = normalizeFilter(filter);
      const lifetime = config.chaos ? random.int(MIN_LIFETIME, MAX_LIFETIME) : null;

      // Listen right away, so nothing is missed between the request and the first read.
      const queue: TaskEvent[] = [];
      let wake: (() => void) | undefined;
      const unlisten = events.listen((event) => {
        if (!matches(event.task, normalized)) return;
        queue.push(event);
        wake?.();
      });

      return new Repeater<TaskEvent>(async (push, stop) => {
        let stopped = false;
        const timer = lifetime === null ? undefined : clock.setTimeout(() => config.chaos && stop(), lifetime);
        stop.then(() => {
          stopped = true;
          unlisten();
          if (timer !== undefined) clock.clearTimeout(timer);
          wake?.();
        });
        while (!stopped) {
          while (queue.length && !stopped) await push(queue.shift()!);
          if (!stopped) await new Promise<void>((resolve) => (wake = resolve));
        }
      });
    },
  };
}

export type Streams = ReturnType<typeof createStreams>;
