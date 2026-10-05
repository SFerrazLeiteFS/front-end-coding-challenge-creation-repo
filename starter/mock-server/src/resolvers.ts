import type { Task } from './model.ts';
import type { MockContext } from './server.ts';

type NoArgs = Record<string, never>;

/** Objects for interfaces and unions carry their concrete type name. */
const resolveByTypename = { __resolveType: (value: { __typename: string }) => value.__typename };

export const resolvers = {
  Query: {
    viewer: (_: unknown, __: NoArgs, { viewer }: MockContext) => viewer,
    processes: (_: unknown, __: NoArgs, { store }: MockContext) => store.data.processes,
    task: (_: unknown, { id }: { id: string }, { store }: MockContext) => store.data.tasks.get(id) ?? null,
  },
  Task: {
    process: (task: Task, __: NoArgs, { store }: MockContext) =>
      store.data.processes.find((process) => process.id === task.processId),
    form: (task: Task, __: NoArgs, { store }: MockContext) => ({ fields: store.data.forms.get(task.processId) }),
  },
  FormField: resolveByTypename,
  FieldValue: resolveByTypename,
};
