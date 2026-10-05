import type { Clock } from './clock.ts';
import type { MockConfig } from './config.ts';
import { createOpenTask } from './data/generate.ts';
import type { Events } from './events.ts';
import type { Priority, Task } from './model.ts';
import { createRandom, type Random } from './random.ts';
import type { Store } from './store.ts';
import { DAY, iso } from './time.ts';

type Action = 'update' | 'complete' | 'create' | 'cancel' | 'remove';

const actions: [Action, number][] = [
  ['update', 60],
  ['complete', 20],
  ['create', 10],
  ['cancel', 5],
  ['remove', 5],
];
const priorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

interface ColleagueDeps {
  config: MockConfig;
  clock: Clock;
  store: Store;
  events: Events;
}

/**
 * A simulated colleague working in the same inbox: in every interval one action
 * on a random open or in-progress task. Rests while `config.chaos` is off.
 */
export function startColleague({ config, clock, store, events }: ColleagueDeps) {
  let random: Random = createRandom(config.seed + 2);
  let timer: unknown;

  function update(task: Task) {
    const change = random.pick(['priority', 'dueAt', 'value'] as const);
    const number = task.values.find((value) => value.__typename === 'NumberValue');
    if (change === 'priority' || (change === 'value' && !number)) {
      task.priority = random.pick(priorities.filter((priority) => priority !== task.priority));
    } else if (change === 'dueAt') {
      const base = task.dueAt ? Date.parse(task.dueAt) : clock.now();
      task.dueAt = iso(base + random.pick([-2, -1, 1, 2, 3]) * DAY);
    } else if (number?.__typename === 'NumberValue') {
      number.number = Math.round(number.number * random.pick([0.5, 0.9, 1.1, 2]) * 100) / 100;
    }
  }

  function act() {
    const action = random.weighted(actions);
    const { data } = store;
    if (action === 'create') {
      const task = createOpenTask(random, data, clock.now());
      data.tasks.set(task.id, task);
      events.publish('CREATED', task);
      return;
    }

    const open = [...data.tasks.values()].filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS');
    if (open.length === 0) return;
    const task = random.pick(open);

    if (action === 'remove') {
      data.tasks.delete(task.id);
      events.publish('REMOVED', task);
      return;
    }
    task.version += 1;
    if (action === 'update') update(task);
    if (action === 'cancel') task.status = 'CANCELLED';
    if (action === 'complete') {
      task.status = 'COMPLETED';
      task.completedBy = random.pick(data.team);
      task.completedAt = iso(clock.now());
    }
    events.publish(action === 'complete' ? 'COMPLETED' : 'UPDATED', task);
  }

  function schedule() {
    timer = clock.setTimeout(() => {
      if (config.chaos) act();
      schedule();
    }, config.foreignEditIntervalMs);
  }
  schedule();

  return {
    /** Starts over: random sequence from the seed, a full interval until the next action. */
    reset() {
      random = createRandom(config.seed + 2);
      clock.clearTimeout(timer);
      schedule();
    },
    stop() {
      clock.clearTimeout(timer);
    },
  };
}

export type Colleague = ReturnType<typeof startColleague>;
