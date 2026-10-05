import type { Viewer } from './auth.ts';
import type { Clock } from './clock.ts';
import { mockError } from './errors.ts';
import type { Store } from './store.ts';
import { iso } from './time.ts';
import { toFieldValues, validateValues, type FieldValueInput } from './validation.ts';

export interface CompleteTaskInput {
  taskId: string;
  expectedVersion: number;
  values: FieldValueInput[];
}

export function completeTask(input: CompleteTaskInput, { store, viewer, clock }: { store: Store; viewer: Viewer; clock: Clock }) {
  const task = store.data.tasks.get(input.taskId);
  if (!task) throw mockError('NOT_FOUND', `Task ${input.taskId} does not exist.`);
  if (task.status !== 'OPEN' && task.status !== 'IN_PROGRESS') {
    throw mockError('FAILED_PRECONDITION', `Task ${task.id} is ${task.status} and can no longer be completed.`, {
      currentStatus: task.status,
    });
  }
  if (task.version !== input.expectedVersion) {
    throw mockError('CONFLICT', `Task ${task.id} has changed since version ${input.expectedVersion}.`, {
      currentVersion: task.version,
    });
  }

  const fields = store.data.forms.get(task.processId)!;
  const fieldErrors = validateValues(fields, input.values);
  if (fieldErrors.length) throw mockError('VALIDATION_FAILED', 'Some values are not valid.', { fieldErrors });

  Object.assign(task, {
    status: 'COMPLETED',
    version: task.version + 1,
    completedBy: { id: viewer.id, displayName: viewer.displayName },
    completedAt: iso(clock.now()),
    values: toFieldValues(fields, input.values),
  });
  return { task };
}
