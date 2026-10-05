import type { Task } from './model.ts';

export type TaskEventKind = 'CREATED' | 'UPDATED' | 'COMPLETED' | 'REMOVED';

export interface TaskEvent {
  kind: TaskEventKind;
  /** The task as it was when the event happened. */
  task: Task;
}

/** Task changes, delivered to every listener in order. */
export function createEvents() {
  const listeners = new Set<(event: TaskEvent) => void>();
  return {
    publish(kind: TaskEventKind, task: Task) {
      const event = { kind, task: structuredClone(task) };
      for (const listener of listeners) listener(event);
    },
    /** Returns a function that removes the listener again. */
    listen(listener: (event: TaskEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type Events = ReturnType<typeof createEvents>;
