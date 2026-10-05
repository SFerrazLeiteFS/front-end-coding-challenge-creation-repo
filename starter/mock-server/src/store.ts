import type { Clock } from './clock.ts';
import type { MockConfig } from './config.ts';
import { generateDataSet, type DataSet } from './data/generate.ts';

/** Holds the current data. `reset` regenerates it from the seed. */
export function createStore(config: MockConfig, clock: Clock) {
  const generate = () => generateDataSet({ seed: config.seed, taskCount: config.taskCount, now: clock.now() });
  let data: DataSet = generate();

  return {
    get data() {
      return data;
    },
    reset() {
      data = generate();
    },
  };
}

export type Store = ReturnType<typeof createStore>;
