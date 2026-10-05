import type { Clock } from './clock.ts';
import type { MockConfig } from './config.ts';
import { createOpenTask } from './data/generate.ts';
import type { Events, TaskEventKind } from './events.ts';
import type { Priority, Task } from './model.ts';
import { createRandom, type Random } from './random.ts';
import type { Store } from './store.ts';
import { DAY, iso } from './time.ts';

const allPriorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

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

  /** Changes the priority, the due date or a prefilled number or date. */
  function update(task: Task) {
    const values = task.values.filter((value) => value.__typename === 'NumberValue' || value.__typename === 'DateValue');
    const change = random.pick(['priority', 'dueAt', 'value'] as const);
    if (change === 'dueAt') {
      const base = task.dueAt ? Date.parse(task.dueAt) : clock.now();
      task.dueAt = iso(base + random.pick([-2, -1, 1, 2, 3]) * DAY);
    } else if (change === 'value' && values.length) {
      const value = random.pick(values);
      if (value.__typename === 'NumberValue') value.number = Math.round(value.number * random.pick([0.5, 0.9, 1.1, 2]));
      if (value.__typename === 'DateValue') value.date = iso(Date.parse(value.date) + random.pick([1, 2, 7]) * DAY);
    } else {
      task.priority = random.pick(allPriorities.filter((priority) => priority !== task.priority));
    }
  }

  /** Changes to an existing task and the event they cause. */
  const changes: Record<'update' | 'complete' | 'cancel', { apply: (task: Task) => void; kind: TaskEventKind }> = {
    update: { apply: update, kind: 'UPDATED' },
    complete: {
      apply: (task) => {
        task.status = 'COMPLETED';
        task.completedBy = random.pick(store.data.team);
        task.completedAt = iso(clock.now());
      },
      kind: 'COMPLETED',
    },
    cancel: { apply: (task) => (task.status = 'CANCELLED'), kind: 'UPDATED' },
  };

  function act() {
    const action = random.weighted([
      ['update', 60],
      ['complete', 20],
      ['create', 10],
      ['cancel', 5],
      ['remove', 5],
    ] as const);
    const { data } = store;
    if (action === 'create') {
      const task = createOpenTask(random, data, clock.now());
      data.tasks.set(task.id, task);
      events.publish('CREATED', task, null);
      return;
    }

    const open = [...data.tasks.values()].filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS');
    if (open.length === 0) return;
    const task = random.pick(open);
    const before = structuredClone(task);

    if (action === 'remove') {
      data.tasks.delete(task.id);
      events.publish('REMOVED', task, before);
      return;
    }
    task.version += 1;
    changes[action].apply(task);
    events.publish(changes[action].kind, task, before);
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
