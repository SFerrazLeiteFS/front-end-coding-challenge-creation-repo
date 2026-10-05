import { describe, expect, it } from 'vitest';
import { MOCK_URL, setup } from './helpers.ts';

const TASK = /* GraphQL */ `
  query Task($id: ID!) {
    task(id: $id) {
      id
      version
      title
      status
      priority
      createdAt
      dueAt
      completedAt
      completedBy { id displayName }
      assignee { id displayName }
      process { id name }
      form {
        fields {
          __typename
          key
          label
          required
          helpText
          ... on TextField { multiline maxLength pattern }
          ... on NumberField { min max step unit }
          ... on DateField { dateMin: min dateMax: max }
          ... on SelectField { multiple options { value label } }
          ... on DecisionField { allowed commentRequiredFor commentFieldKey }
        }
      }
      values {
        __typename
        ... on TextValue { key text }
        ... on NumberValue { key number }
        ... on DateValue { key date }
        ... on SelectValue { key selected }
        ... on BooleanValue { key bool }
        ... on DecisionValue { key decision }
      }
    }
  }
`;

const PROCESSES = /* GraphQL */ `
  query Processes {
    processes { id name }
  }
`;

const taskId = (n: number) => `task-${String(n).padStart(4, '0')}`;

async function loadAllTasks(gql: ReturnType<typeof setup>['gql'], count: number) {
  const tasks = [];
  for (let n = 1; n <= count; n++) {
    const { body } = await gql(TASK, { id: taskId(n) });
    expect(body.errors).toBeUndefined();
    tasks.push(body.data.task);
  }
  return tasks;
}

describe('processes', () => {
  it('lists all six processes', async () => {
    const { gql } = setup();

    const { body } = await gql(PROCESSES);

    expect(body.errors).toBeUndefined();
    expect(body.data.processes).toHaveLength(6);
    for (const process of body.data.processes) {
      expect(process).toEqual({ id: expect.any(String), name: expect.any(String) });
    }
  });
});

describe('task detail', () => {
  it('returns null without errors for an unknown ID', async () => {
    const { gql } = setup();

    const { body } = await gql(TASK, { id: 'task-9999' });

    expect(body).toEqual({ data: { task: null } });
  });

  it('respects the configured task count', async () => {
    const { gql } = setup({ taskCount: 10 });

    expect((await gql(TASK, { id: taskId(10) })).body.data.task).not.toBeNull();
    expect((await gql(TASK, { id: taskId(11) })).body.data.task).toBeNull();
  });

  it('has one form variant per process, covering every field type', async () => {
    const { gql } = setup();
    const tasks = await loadAllTasks(gql, 250);

    const formsByProcess = new Map<string, string>();
    for (const task of tasks) {
      const form = JSON.stringify(task.form);
      const known = formsByProcess.get(task.process.id);
      if (known) expect(form).toBe(known);
      formsByProcess.set(task.process.id, form);
    }
    expect(formsByProcess.size).toBe(6);

    const fieldTypes = new Set(tasks.flatMap((task) => task.form.fields.map((field: any) => field.__typename)));
    expect([...fieldTypes].sort()).toEqual(
      ['BooleanField', 'DateField', 'DecisionField', 'NumberField', 'SelectField', 'TextField'],
    );

    const selectKinds = new Set(
      tasks.flatMap((task) => task.form.fields.filter((f: any) => f.__typename === 'SelectField').map((f: any) => f.multiple)),
    );
    expect(selectKinds).toEqual(new Set([true, false]));

    const processesWithCommentOnReject = new Set(
      tasks
        .filter((task) =>
          task.form.fields.some(
            (f: any) =>
              f.__typename === 'DecisionField' &&
              f.commentRequiredFor.includes('REJECT') &&
              task.form.fields.some((c: any) => c.key === f.commentFieldKey && c.__typename === 'TextField'),
          ),
        )
        .map((task) => task.process.id),
    );
    expect(processesWithCommentOnReject.size).toBeGreaterThanOrEqual(2);
  });

  it('prefills only valid values for existing fields', async () => {
    const { gql } = setup();
    const tasks = await loadAllTasks(gql, 250);
    const valueTypeFor: Record<string, string> = {
      TextField: 'TextValue',
      NumberField: 'NumberValue',
      DateField: 'DateValue',
      SelectField: 'SelectValue',
      BooleanField: 'BooleanValue',
      DecisionField: 'DecisionValue',
    };

    let prefilled = 0;
    for (const task of tasks) {
      const fields = new Map(task.form.fields.map((field: any) => [field.key, field]));
      const keys = task.values.map((value: any) => value.key);
      expect(new Set(keys).size).toBe(keys.length);

      for (const value of task.values) {
        const field: any = fields.get(value.key);
        expect(field, `${task.id}: value for unknown field ${value.key}`).toBeDefined();
        expect(value.__typename).toBe(valueTypeFor[field.__typename]);
        prefilled++;

        if (value.__typename === 'TextValue') {
          if (field.maxLength) expect(value.text.length).toBeLessThanOrEqual(field.maxLength);
          if (field.pattern) expect(value.text).toMatch(new RegExp(`^(?:${field.pattern})$`));
        }
        if (value.__typename === 'NumberValue') {
          if (field.min !== null) expect(value.number).toBeGreaterThanOrEqual(field.min);
          if (field.max !== null) expect(value.number).toBeLessThanOrEqual(field.max);
        }
        if (value.__typename === 'DateValue') {
          expect(Number.isNaN(Date.parse(value.date))).toBe(false);
          if (field.dateMin) expect(Date.parse(value.date)).toBeGreaterThanOrEqual(Date.parse(field.dateMin));
          if (field.dateMax) expect(Date.parse(value.date)).toBeLessThanOrEqual(Date.parse(field.dateMax));
        }
        if (value.__typename === 'SelectValue') {
          const options = field.options.map((option: any) => option.value);
          for (const selected of value.selected) expect(options).toContain(selected);
          if (!field.multiple) expect(value.selected).toHaveLength(1);
        }
        if (value.__typename === 'DecisionValue') expect(field.allowed).toContain(value.decision);
      }
    }
    expect(prefilled).toBeGreaterThan(0);
  });

  it('mixes statuses and records who completed a task', async () => {
    const { gql } = setup();
    const tasks = await loadAllTasks(gql, 250);

    expect(new Set(tasks.map((task) => task.status))).toEqual(new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']));
    for (const task of tasks) {
      if (task.status === 'COMPLETED') {
        expect(task.completedBy).toEqual({ id: expect.any(String), displayName: expect.any(String) });
        expect(Date.parse(task.completedAt)).toBeGreaterThanOrEqual(Date.parse(task.createdAt));
      } else {
        expect(task.completedBy).toBeNull();
        expect(task.completedAt).toBeNull();
      }
      expect(task.version).toBeGreaterThanOrEqual(1);
    }
  });

  it('assigns tasks to a small fixed team or to nobody', async () => {
    const { gql } = setup();
    const tasks = await loadAllTasks(gql, 250);

    const assignees = new Set(tasks.map((task) => task.assignee?.id ?? null));
    expect(assignees.has(null)).toBe(true);
    expect(assignees.size - 1).toBeGreaterThanOrEqual(4);
    expect(assignees.size - 1).toBeLessThanOrEqual(6);
  });
});

describe('determinism', () => {
  it('produces identical data for the same seed and different data for another seed', async () => {
    const first = await loadAllTasks(setup({ seed: 7 }).gql, 20);
    const again = await loadAllTasks(setup({ seed: 7 }).gql, 20);
    const other = await loadAllTasks(setup({ seed: 8 }).gql, 20);

    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('resets to the seeded data set', async () => {
    const { server, gql } = setup({ seed: 7 });
    const before = await loadAllTasks(gql, 5);

    const response = await server.fetch(new Request(new URL('/__mock/reset', MOCK_URL), { method: 'POST' }));

    expect(response.status).toBe(200);
    expect(await loadAllTasks(gql, 5)).toEqual(before);
  });
});
