import { Repeater } from 'graphql-yoga';
import type { Clock } from './clock.ts';
import type { MockConfig } from './config.ts';
import type { Events, TaskEvent } from './events.ts';
import { createRandom, type Random } from './random.ts';
import { matches, normalizeFilter, type TaskFilter } from './task-list.ts';
import { MINUTE } from './time.ts';

const MIN_LIFETIME = 2 * MINUTE;
const MAX_LIFETIME = 5 * MINUTE;

interface StreamDeps {
  config: MockConfig;
  clock: Clock;
  events: Events;
}

/**
 * `taskEvents` streams. A stream gets an event when the task matches the filter
 * before or after the change. While `config.chaos` is on, a stream ends after
 * a random lifetime of two to five minutes.
 */
export function createStreams({ config, clock, events }: StreamDeps) {
  let random: Random = createRandom(config.seed + 3);
  const open = new Set<() => void>();

  return {
    /** Ends all open streams and restarts the random sequence. */
    reset() {
      for (const stop of [...open]) stop();
      random = createRandom(config.seed + 3);
    },
    taskEvents(filter: TaskFilter | null | undefined) {
      const normalized = normalizeFilter(filter);
      const lifetime = random.int(MIN_LIFETIME, MAX_LIFETIME);

      // Listen right away, so nothing is missed between the request and the first read.
      const queue: TaskEvent[] = [];
      let wake: (() => void) | undefined;
      const unlisten = events.listen((event) => {
        const relevant = matches(event.task, normalized) || (event.before !== null && matches(event.before, normalized));
        if (!relevant) return;
        queue.push(event);
        wake?.();
      });

      return new Repeater<TaskEvent>(async (push, stop) => {
        let stopped = false;
        let timer: unknown;
        const endWhenDue = () => {
          timer = clock.setTimeout(() => (config.chaos ? stop() : endWhenDue()), lifetime);
        };
        endWhenDue();
        open.add(stop);
        stop.then(() => {
          stopped = true;
          open.delete(stop);
          unlisten();
          clock.clearTimeout(timer);
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
