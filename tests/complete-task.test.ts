import { describe, expect, it } from 'vitest';
import { MOCK_URL, setup } from './helpers.ts';

type Gql = ReturnType<typeof setup>['gql'];

const FIND = /* GraphQL */ `
  query Find($filter: TaskFilter) {
    tasks(first: 1, filter: $filter) {
      nodes {
        id
        version
        status
        form {
          fields {
            __typename
            key
            required
            ... on TextField { maxLength pattern }
            ... on NumberField { min max step }
            ... on DateField { dateMin: min dateMax: max }
            ... on SelectField { multiple options { value } }
            ... on DecisionField { allowed commentRequiredFor commentFieldKey }
          }
        }
      }
    }
  }
`;

const TASK = /* GraphQL */ `
  query Task($id: ID!) {
    task(id: $id) {
      id
      version
      status
      completedAt
      completedBy { id displayName }
      values {
        __typename
        ... on TextValue { key text }
        ... on DecisionValue { key decision }
      }
    }
  }
`;

const COMPLETE = /* GraphQL */ `
  mutation Complete($input: CompleteTaskInput!) {
    completeTask(input: $input) {
      task {
        id
        version
        status
        completedAt
        completedBy { id displayName }
      }
    }
  }
`;

async function findTask(gql: Gql, processId: string, status = 'OPEN') {
  const { body } = await gql(FIND, { filter: { processId, status: [status] } });
  const task = body.data.tasks.nodes[0];
  expect(task, `no ${status} task in ${processId}`).toBeDefined();
  return task as { id: string; version: number; status: string; form: { fields: any[] } };
}

/** A value for every field of the form that passes all of its rules. */
function validValues(fields: any[], decision?: string) {
  return fields.map((field) => {
    switch (field.__typename) {
      case 'TextField':
        return { key: field.key, text: field.pattern === 'INV-[0-9]{6}' ? 'INV-123456' : 'Looks good' };
      case 'NumberField':
        return { key: field.key, number: field.min ?? 1 };
      case 'DateField':
        return { key: field.key, date: field.dateMin ?? '2026-06-01T09:00:00Z' };
      case 'SelectField':
        return { key: field.key, selected: [field.options[0].value] };
      case 'BooleanField':
        return { key: field.key, bool: true };
      case 'DecisionField':
        return { key: field.key, decision: decision ?? field.allowed[0] };
    }
  });
}

const replace = (values: any[], key: string, value: Record<string, unknown>) =>
  values.map((entry) => (entry.key === key ? { key, ...value } : entry));
const without = (values: any[], ...keys: string[]) => values.filter((entry) => !keys.includes(entry.key));

async function complete(gql: Gql, taskId: string, expectedVersion: number, values: unknown[], token?: string) {
  const { body } = await gql(COMPLETE, { input: { taskId, expectedVersion, values } }, token ? { token } : {});
  return body as any;
}

async function expectFieldErrors(body: any, keys: string[]) {
  expect(body.data).toBeNull();
  expect(body.errors).toHaveLength(1);
  expect(body.errors[0].extensions.code).toBe('VALIDATION_FAILED');
  const fieldErrors = body.errors[0].extensions.fieldErrors as { key: string; message: string }[];
  expect(fieldErrors.map((error) => error.key).sort()).toEqual([...keys].sort());
  for (const error of fieldErrors) expect(error.message).toEqual(expect.any(String));
}

describe('completing a task', () => {
  it('completes an open task for the viewer and bumps the version', async () => {
    const { gql, clock } = setup();
    const task = await findTask(gql, 'process-invoice');

    const body = await complete(gql, task.id, task.version, validValues(task.form.fields, 'APPROVE'), 'sam.lee');

    expect(body.errors).toBeUndefined();
    expect(body.data.completeTask.task).toEqual({
      id: task.id,
      version: task.version + 1,
      status: 'COMPLETED',
      completedAt: new Date(clock.now()).toISOString(),
      completedBy: { id: 'user-sam.lee', displayName: 'Sam Lee' },
    });
    const stored = (await gql(TASK, { id: task.id })).body.data.task;
    expect(stored).toMatchObject({ status: 'COMPLETED', version: task.version + 1 });
    expect(stored.values).toContainEqual({ __typename: 'DecisionValue', key: 'decision', decision: 'APPROVE' });
  });

  it('completes a task that is in progress', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-purchase', 'IN_PROGRESS');

    const body = await complete(gql, task.id, task.version, validValues(task.form.fields));

    expect(body.errors).toBeUndefined();
    expect(body.data.completeTask.task.status).toBe('COMPLETED');
  });

  it('accepts a form without optional fields', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-onboarding');
    const required = task.form.fields.filter((field) => field.required);

    const body = await complete(gql, task.id, task.version, validValues(required));

    expect(body.errors).toBeUndefined();
  });

  it('rejects a stale version with CONFLICT and leaves the task unchanged', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');

    const body = await complete(gql, task.id, task.version - 1, validValues(task.form.fields));

    expect(body.data).toBeNull();
    expect(body.errors[0].extensions).toEqual({ code: 'CONFLICT', currentVersion: task.version });
    expect((await gql(TASK, { id: task.id })).body.data.task).toMatchObject({ status: 'OPEN', version: task.version });
  });

  it.each(['COMPLETED', 'CANCELLED'])('rejects a %s task with FAILED_PRECONDITION', async (status) => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice', status);

    const body = await complete(gql, task.id, task.version, validValues(task.form.fields));

    expect(body.errors[0].extensions).toEqual({ code: 'FAILED_PRECONDITION', currentStatus: status });
  });

  it('reports a finished task before a stale version', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice', 'COMPLETED');

    const body = await complete(gql, task.id, task.version - 1, validValues(task.form.fields));

    expect(body.errors[0].extensions.code).toBe('FAILED_PRECONDITION');
  });

  it('answers a repeated completion with FAILED_PRECONDITION and shows who completed it', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-leave');
    const values = validValues(task.form.fields, 'APPROVE');
    await complete(gql, task.id, task.version, values);

    const retry = await complete(gql, task.id, task.version, values);

    expect(retry.errors[0].extensions).toEqual({ code: 'FAILED_PRECONDITION', currentStatus: 'COMPLETED' });
    expect((await gql(TASK, { id: task.id })).body.data.task.completedBy.id).toBe('user-demo.user');
  });

  it('rejects an unknown task with NOT_FOUND', async () => {
    const { gql } = setup();

    const body = await complete(gql, 'task-9999', 1, []);

    expect(body.data).toBeNull();
    expect(body.errors[0].extensions).toEqual({ code: 'NOT_FOUND' });
  });

  it('is undone by a reset', async () => {
    const { server, gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    await complete(gql, task.id, task.version, validValues(task.form.fields));

    await server.fetch(new Request(new URL('/__mock/reset', MOCK_URL), { method: 'POST' }));

    expect((await gql(TASK, { id: task.id })).body.data.task).toMatchObject({ status: 'OPEN', version: task.version });
  });
});

describe('validation', () => {
  it('reports every missing required field at once and leaves the task unchanged', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');

    const body = await complete(gql, task.id, task.version, []);

    await expectFieldErrors(body, ['invoiceNumber', 'amount', 'costCenter', 'decision']);
    expect((await gql(TASK, { id: task.id })).body.data.task.version).toBe(task.version);
  });

  it.each([
    ['an empty text', { text: '' }],
    ['a text with only spaces', { text: '   ' }],
  ])('treats %s as missing', async (_, value) => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-contract');
    const values = replace(validValues(task.form.fields), 'counterparty', value);

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['counterparty']);
  });

  it('treats an empty selection as missing', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-contract');
    const values = replace(validValues(task.form.fields), 'reviewedClauses', { selected: [] });

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['reviewedClauses']);
  });

  it('requires a required checkbox to be checked', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-contract');
    const values = replace(validValues(task.form.fields), 'readFully', { bool: false });

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['readFully']);
  });

  it('accepts an unchecked optional checkbox', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-purchase');
    const values = replace(validValues(task.form.fields), 'urgent', { bool: false });

    expect((await complete(gql, task.id, task.version, values)).errors).toBeUndefined();
  });

  it.each([
    ['a pattern that only matches part of the value', 'invoiceNumber', { text: 'xINV-123456' }],
    ['a pattern mismatch', 'invoiceNumber', { text: 'INV-12' }],
    ['a number below min', 'amount', { number: -1 }],
    ['a number off the step', 'amount', { number: 10.005 }],
    ['an unknown option', 'costCenter', { selected: ['space-program'] }],
    ['two options for a single select', 'costCenter', { selected: ['it', 'marketing'] }],
  ])('rejects %s', async (_, key, value) => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = replace(validValues(task.form.fields), key, value);

    await expectFieldErrors(await complete(gql, task.id, task.version, values), [key]);
  });

  it('accepts a number on the step despite floating-point rounding', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = replace(validValues(task.form.fields), 'amount', { number: 533.54 });

    expect((await complete(gql, task.id, task.version, values)).errors).toBeUndefined();
  });

  it.each([
    ['a text over maxLength', 'contractTitle', { text: 'x'.repeat(121) }],
    ['a date that is not an ISO date-time', 'renewalDate', { date: '2026-02-30' }],
  ])('rejects %s', async (_, key, value) => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-contract');
    const values = replace(validValues(task.form.fields), key, value);

    await expectFieldErrors(await complete(gql, task.id, task.version, values), [key]);
  });

  it('rejects numbers above max and dates before min', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-leave');
    const firstDay = task.form.fields.find((field) => field.key === 'firstDay');
    const dayBefore = new Date(Date.parse(firstDay.dateMin) - 1).toISOString();
    let values = replace(validValues(task.form.fields, 'APPROVE'), 'days', { number: 30.5 });
    values = replace(values, 'firstDay', { date: dayBefore });

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['days', 'firstDay']);
  });

  it('accepts bounds inclusively', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-leave');
    const values = replace(validValues(task.form.fields, 'APPROVE'), 'days', { number: 30 });

    expect((await complete(gql, task.id, task.version, values)).errors).toBeUndefined();
  });

  it('rejects a decision the field does not allow', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-leave');
    const values = validValues(task.form.fields, 'RETURN');

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['decision']);
  });

  it('requires the comment when rejecting, reported on the comment field', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = without(validValues(task.form.fields, 'REJECT'), 'comment');

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['comment']);
  });

  it('completes a rejection with a comment', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = replace(validValues(task.form.fields, 'REJECT'), 'comment', { text: 'Wrong cost center.' });

    const body = await complete(gql, task.id, task.version, values);

    expect(body.errors).toBeUndefined();
    expect((await gql(TASK, { id: task.id })).body.data.task.values).toContainEqual({
      __typename: 'TextValue',
      key: 'comment',
      text: 'Wrong cost center.',
    });
  });

  it('does not require the comment when approving', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = without(validValues(task.form.fields, 'APPROVE'), 'comment');

    expect((await complete(gql, task.id, task.version, values)).errors).toBeUndefined();
  });

  it.each([
    ['an unknown key', (values: any[]) => [...values, { key: 'nope', text: 'x' }], 'nope'],
    ['a duplicate key', (values: any[]) => [...values, { key: 'amount', number: 2 }], 'amount'],
    ['no value field', (values: any[]) => replace(values, 'amount', {}), 'amount'],
    ['two value fields', (values: any[]) => replace(values, 'amount', { number: 1, text: '1' }), 'amount'],
    ['a value of the wrong type', (values: any[]) => replace(values, 'amount', { text: '12' }), 'amount'],
  ])('rejects %s', async (_, change, key) => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');

    const body = await complete(gql, task.id, task.version, change(validValues(task.form.fields)));

    await expectFieldErrors(body, [key]);
  });

  it('does not store an optional text of only spaces', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-invoice');
    const values = replace(validValues(task.form.fields, 'APPROVE'), 'comment', { text: '   ' });

    expect((await complete(gql, task.id, task.version, values)).errors).toBeUndefined();
    const stored = (await gql(TASK, { id: task.id })).body.data.task.values;
    expect(stored.find((value: any) => value.key === 'comment')).toBeUndefined();
  });

  it('rejects the same option twice in a multiple select', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-contract');
    const values = replace(validValues(task.form.fields), 'reviewedClauses', { selected: ['liability', 'liability'] });

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['reviewedClauses']);
  });

  it('reports only the decision when it is not allowed, even if it would need a comment', async () => {
    const { gql } = setup();
    const task = await findTask(gql, 'process-purchase');
    const values = without(validValues(task.form.fields, 'RETURN'), 'comment');

    await expectFieldErrors(await complete(gql, task.id, task.version, values), ['decision']);
  });
});

describe('request errors', () => {
  it('gives a variable of the wrong type the code BAD_REQUEST', async () => {
    const { gql } = setup();

    const { response, body } = await gql(COMPLETE, {
      input: { taskId: 'task-0001', expectedVersion: 1, values: [{ key: 'amount', text: 5 }] },
    });

    expect(response.status).toBe(400);
    expect(body.errors![0]!.extensions!.code).toBe('BAD_REQUEST');
  });

  it('keeps the codes for documents that do not parse or do not match the schema', async () => {
    const { gql } = setup();

    expect((await gql('{ viewer {')).body.errors![0]!.extensions!.code).toBe('GRAPHQL_PARSE_FAILED');
    expect((await gql('{ nope }')).body.errors![0]!.extensions!.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });
});
