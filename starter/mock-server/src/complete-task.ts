import { mockError } from './errors.ts';
import type { MockContext } from './server.ts';
import { iso } from './time.ts';
import { toFieldValues, validateValues, type FieldValueInput } from './validation.ts';

export interface CompleteTaskInput {
  taskId: string;
  expectedVersion: number;
  values: FieldValueInput[];
}

/** Completes a task for the viewer. Values not sent are not kept, including prefilled ones. */
export function completeTask(
  input: CompleteTaskInput,
  { store, viewer, clock, conditions, events }: Pick<MockContext, 'store' | 'viewer' | 'clock' | 'conditions' | 'events'>,
) {
  const task = store.data.tasks.get(input.taskId);
  if (!task) throw mockError('NOT_FOUND', `Task ${input.taskId} does not exist.`);
  if (task.status !== 'OPEN' && task.status !== 'IN_PROGRESS') {
    throw mockError('FAILED_PRECONDITION', `Task ${task.id} is ${task.status} and can no longer be completed.`, {
      currentStatus: task.status,
    });
  }
  if (conditions.conflict) task.version += 1;
  if (task.version !== input.expectedVersion) {
    throw mockError('CONFLICT', `Task ${task.id} has changed since version ${input.expectedVersion}.`, {
      currentVersion: task.version,
    });
  }

  const fields = store.data.forms.get(task.processId)!;
  if (conditions.validation) {
    throw mockError('VALIDATION_FAILED', 'Some values are not valid.', {
      fieldErrors: [{ key: fields[0]!.key, message: 'Rejected by the server.' }],
    });
  }
  const fieldErrors = validateValues(fields, input.values);
  if (fieldErrors.length) throw mockError('VALIDATION_FAILED', 'Some values are not valid.', { fieldErrors });

  const before = structuredClone(task);
  Object.assign(task, {
    status: 'COMPLETED',
    version: task.version + 1,
    completedBy: { id: viewer.id, displayName: viewer.displayName },
    completedAt: iso(clock.now()),
    values: toFieldValues(fields, input.values),
  });
  events.publish('COMPLETED', task, before);
  if (conditions.loseResponse) conditions.answerUnavailable = true;
  return { task };
}
