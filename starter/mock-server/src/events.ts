import type { Task } from './model.ts';

export type TaskEventKind = 'CREATED' | 'UPDATED' | 'COMPLETED' | 'REMOVED';

export interface TaskEvent {
  kind: TaskEventKind;
  /** The task as it was right after the change (for REMOVED: its last state). */
  task: Task;
  /** The task right before the change; null for CREATED. Not part of the payload. */
  before: Task | null;
}

/** Task changes, delivered to every listener in order. */
export function createEvents() {
  const listeners = new Set<(event: TaskEvent) => void>();
  return {
    /** `before` must be a copy taken before the change. */
    publish(kind: TaskEventKind, task: Task, before: Task | null) {
      const event = { kind, task: structuredClone(task), before };
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
