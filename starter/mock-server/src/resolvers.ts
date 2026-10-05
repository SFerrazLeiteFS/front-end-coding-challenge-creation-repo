import { completeTask, type CompleteTaskInput } from './complete-task.ts';
import type { Task } from './model.ts';
import { listTasks, type TaskListArgs } from './task-list.ts';
import type { MockContext } from './server.ts';

type NoArgs = Record<string, never>;

/** Objects for interfaces and unions carry their concrete type name. */
const resolveByTypename = { __resolveType: (value: { __typename: string }) => value.__typename };

export const resolvers = {
  Query: {
    viewer: (_: unknown, __: NoArgs, { viewer }: MockContext) => viewer,
    processes: (_: unknown, __: NoArgs, { store }: MockContext) => store.data.processes,
    tasks: (_: unknown, args: TaskListArgs, { store, clock }: MockContext) =>
      listTasks(store.data.tasks.values(), args, clock),
    task: (_: unknown, { id }: { id: string }, { store }: MockContext) => store.data.tasks.get(id) ?? null,
  },
  Mutation: {
    completeTask: (_: unknown, { input }: { input: CompleteTaskInput }, context: MockContext) =>
      completeTask(input, context),
  },
  Task: {
    process: (task: Task, __: NoArgs, { store }: MockContext) =>
      store.data.processes.find((process) => process.id === task.processId),
    form: (task: Task, __: NoArgs, { store }: MockContext) => ({ fields: store.data.forms.get(task.processId) }),
  },
  FormField: resolveByTypename,
  FieldValue: resolveByTypename,
};
