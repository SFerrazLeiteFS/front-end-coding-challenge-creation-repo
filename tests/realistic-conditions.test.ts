import { describe, expect, it } from 'vitest';
import { setup } from './helpers.ts';

const VIEWER = 'query Viewer { viewer { id } }';
const ASSIGNEES = 'query Assignees { tasks(first: 50) { nodes { id assignee { id } } } }';
const OPEN_INVOICE = /* GraphQL */ `
  query OpenInvoice {
    tasks(first: 1, filter: { processId: "process-invoice", status: [OPEN] }) {
      nodes { id version }
    }
  }
`;
const TASK = 'query Task($id: ID!) { task(id: $id) { id version status completedBy { id } } }';
const COMPLETE = /* GraphQL */ `
  mutation CompleteInvoice($input: CompleteTaskInput!) {
    completeTask(input: $input) { task { id version status } }
  }
`;

/** Values that pass validation for every invoice task. */
const invoiceValues = [
  { key: 'invoiceNumber', text: 'INV-123456' },
  { key: 'amount', number: 100 },
  { key: 'costCenter', selected: ['it'] },
  { key: 'decision', decision: 'APPROVE' },
];

type Mock = ReturnType<typeof setup>;
type TaskRef = { id: string; version: number };

async function openInvoice(mock: Mock): Promise<TaskRef> {
  return (await mock.gql(OPEN_INVOICE)).body.data.tasks.nodes[0];
}
const completeInput = (task: TaskRef) => ({ input: { taskId: task.id, expectedVersion: task.version, values: invoiceValues } });

/** Realistic conditions on, but no delay and nothing failing unless a test says so. */
const calm = {
  chaos: true,
  latencyMs: [0, 0] as [number, number],
  unavailableRate: 0,
  internalRate: 0,
  partialRate: 0,
  lostResponseRate: 0,
};

describe('with realistic conditions off', () => {
  it('answers immediately and without failures even with every rate at 1', async () => {
    const mock = setup({ chaos: false, latencyMs: [2000, 2000], unavailableRate: 1, internalRate: 1, partialRate: 1, lostResponseRate: 1 });
    const started = Date.now();

    for (let i = 0; i < 20; i++) {
      const { response, body } = await mock.gql(ASSIGNEES);
      expect(response.status).toBe(200);
      expect(body.errors).toBeUndefined();
    }
    const completion = await mock.gql(COMPLETE, completeInput(await openInvoice(mock)));
    expect(completion.body.errors).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe('rates', () => {
  it('answers with HTTP 503, no body and CORS headers', async () => {
    const mock = setup({ ...calm, unavailableRate: 1 });

    const response = await mock.server.fetch(
      new Request('http://localhost:4000/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer demo.user', origin: 'http://localhost:3000' },
        body: JSON.stringify({ query: VIEWER }),
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('fails a whole operation with INTERNAL without running it', async () => {
    const mock = setup({ ...calm, internalRate: 1 });
    const task = (await setup().gql(OPEN_INVOICE)).body.data.tasks.nodes[0];

    const { response, body } = await mock.gql(COMPLETE, completeInput(task));

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: null, errors: [{ message: expect.any(String), extensions: { code: 'INTERNAL' } }] });
    await mock.control('config', { MOCK_INTERNAL_RATE: 0 });
    expect((await mock.gql(TASK, { id: task.id })).body.data.task).toMatchObject({ status: 'OPEN', version: task.version });
  });

  it('keeps the other data when assignee lookups fail', async () => {
    const mock = setup({ ...calm, partialRate: 1 });

    const { body } = await mock.gql(ASSIGNEES);

    expect(body.data.tasks.nodes).toHaveLength(50);
    expect(body.data.tasks.nodes.every((node: any) => node.id && node.assignee === null)).toBe(true);
    expect(body.errors!.length).toBeGreaterThan(0);
    for (const error of body.errors!) {
      expect(error.extensions!.code).toBe('INTERNAL');
      expect(error.path).toEqual(['tasks', 'nodes', expect.any(Number), 'assignee']);
    }
  });

  it('saves a completion but answers HTTP 503 when the response gets lost', async () => {
    const mock = setup({ ...calm, lostResponseRate: 1 });
    const task = await openInvoice(mock);

    const response = await mock.send(COMPLETE, completeInput(task));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
    expect((await mock.gql(TASK, { id: task.id })).body.data.task).toMatchObject({
      status: 'COMPLETED',
      version: task.version + 1,
      completedBy: { id: 'user-demo.user' },
    });
    const retry = await mock.gql(COMPLETE, completeInput(task));
    expect(retry.body.errors![0]!.extensions).toEqual({ code: 'FAILED_PRECONDITION', currentStatus: 'COMPLETED' });
  });

  it('does not lose the response of a failed completion', async () => {
    const mock = setup({ ...calm, lostResponseRate: 1 });
    const task = await openInvoice(mock);

    const { response, body } = await mock.gql(COMPLETE, { input: { ...completeInput(task).input, values: [] } });

    expect(response.status).toBe(200);
    expect(body.errors![0]!.extensions!.code).toBe('VALIDATION_FAILED');
  });

  it('delays responses by the configured latency', async () => {
    const mock = setup({ ...calm, latencyMs: [60, 60] });
    const started = Date.now();

    await mock.gql(VIEWER);

    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
  });

  it('logs requests the client aborted while waiting', async () => {
    const mock = setup({ ...calm, latencyMs: [200, 200] });
    const controller = new AbortController();

    const pending = mock.send(VIEWER, {}, { signal: controller.signal }).catch(() => null);
    setTimeout(() => controller.abort(), 20);
    await pending;

    expect(mock.logs).toContain('request aborted: Viewer');
  });
});

describe('runtime configuration', () => {
  it('changes rates while running and returns the effective settings', async () => {
    const mock = setup({ ...calm });

    const { response, body } = await mock.control('config', { MOCK_UNAVAILABLE_RATE: 1, MOCK_LATENCY_MS: '0-10' });

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ MOCK_UNAVAILABLE_RATE: 1, MOCK_LATENCY_MS: '0-10', MOCK_CHAOS: 'on' });
    expect((await mock.send(VIEWER)).status).toBe(503);
  });

  it('switches realistic conditions on and off', async () => {
    const mock = setup({ ...calm, unavailableRate: 1, chaos: false });

    expect((await mock.send(VIEWER)).status).toBe(200);
    await mock.control('config', { MOCK_CHAOS: 'on' });
    expect((await mock.send(VIEWER)).status).toBe(503);
  });

  it.each([
    ['an invalid value', { MOCK_UNAVAILABLE_RATE: 2 }],
    ['a setting that only applies at start', { MOCK_PORT: 5000 }],
    ['an unknown setting', { MOCK_NOPE: 1 }],
  ])('rejects %s with 400', async (_, body) => {
    const mock = setup({ ...calm });

    const { response, body: answer } = await mock.control('config', body);

    expect(response.status).toBe(400);
    expect(answer.message).toEqual(expect.any(String));
  });
});

describe('next-request trigger', () => {
  it('applies a behaviour to exactly the next request', async () => {
    const mock = setup();

    expect((await mock.control('next', { behavior: 'unavailable' })).response.status).toBe(200);

    expect((await mock.send(VIEWER)).status).toBe(503);
    expect((await mock.send(VIEWER)).status).toBe(200);
  });

  it('waits for the named operation or root field', async () => {
    const mock = setup();
    const task = await openInvoice(mock);
    await mock.control('next', { behavior: 'internal', operation: 'completeTask' });

    expect((await mock.gql(VIEWER)).body.errors).toBeUndefined();
    const { body } = await mock.gql(COMPLETE, completeInput(task));

    expect(body.errors![0]!.extensions!.code).toBe('INTERNAL');
  });

  it('matches the operation name too', async () => {
    const mock = setup();
    await mock.control('next', { behavior: 'unavailable', operation: 'Assignees' });

    expect((await mock.send(VIEWER)).status).toBe(200);
    expect((await mock.send(ASSIGNEES)).status).toBe(503);
  });

  it('fails every assignee of the next request with partial', async () => {
    const mock = setup();
    await mock.control('next', { behavior: 'partial' });

    const { body } = await mock.gql(ASSIGNEES);

    expect(body.data.tasks.nodes).toHaveLength(50);
    expect(body.errors!.length).toBe(body.data.tasks.nodes.filter((n: any) => n.assignee === null).length);
    expect(body.errors!.length).toBeGreaterThan(0);
  });

  it('loses the response of the next completion', async () => {
    const mock = setup();
    const task = await openInvoice(mock);
    await mock.control('next', { behavior: 'lost-response', operation: 'completeTask' });

    expect((await mock.send(COMPLETE, completeInput(task))).status).toBe(503);
    expect((await mock.gql(TASK, { id: task.id })).body.data.task.status).toBe('COMPLETED');
  });

  it('delays the next request with slow', async () => {
    const mock = setup();
    await mock.control('next', { behavior: 'slow', ms: 80 });
    const started = Date.now();

    await mock.gql(VIEWER);

    expect(Date.now() - started).toBeGreaterThanOrEqual(75);
  });

  it('makes the next completion conflict because the task changed', async () => {
    const mock = setup();
    const task = await openInvoice(mock);
    await mock.control('next', { behavior: 'conflict', operation: 'completeTask' });

    const { body } = await mock.gql(COMPLETE, completeInput(task));

    expect(body.errors![0]!.extensions).toEqual({ code: 'CONFLICT', currentVersion: task.version + 1 });
    expect((await mock.gql(TASK, { id: task.id })).body.data.task).toMatchObject({ status: 'OPEN', version: task.version + 1 });
  });

  it('rejects the next completion with a validation error', async () => {
    const mock = setup();
    const task = await openInvoice(mock);
    await mock.control('next', { behavior: 'validation', operation: 'completeTask' });

    const { body } = await mock.gql(COMPLETE, completeInput(task));

    expect(body.errors![0]!.extensions).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [{ key: expect.any(String), message: expect.any(String) }],
    });
    expect((await mock.gql(TASK, { id: task.id })).body.data.task.status).toBe('OPEN');
  });

  it('works while realistic conditions are off', async () => {
    const mock = setup({ chaos: false });
    await mock.control('next', { behavior: 'unavailable' });

    expect((await mock.send(VIEWER)).status).toBe(503);
  });

  it.each([
    ['an unknown behaviour', { behavior: 'explode' }],
    ['slow without ms', { behavior: 'slow' }],
  ])('rejects %s with 400', async (_, body) => {
    const mock = setup();

    expect((await mock.control('next', body)).response.status).toBe(400);
  });

  it('keeps a completion-only behaviour for the next completion, even without an operation', async () => {
    const mock = setup();
    const task = await openInvoice(mock);
    await mock.control('next', { behavior: 'lost-response' });

    expect((await mock.send(VIEWER)).status).toBe(200);
    expect((await mock.send(COMPLETE, completeInput(task))).status).toBe(503);
  });

  it('does not spend a trigger on a request without token', async () => {
    const mock = setup();
    await mock.control('next', { behavior: 'unavailable' });

    expect((await mock.send(VIEWER, {}, { token: null })).status).toBe(401);
    expect((await mock.send(VIEWER)).status).toBe(503);
  });
});

describe('requests without token', () => {
  it('always get HTTP 401, whatever the rates', async () => {
    const mock = setup({ ...calm, unavailableRate: 1, internalRate: 1, latencyMs: [500, 500] });
    const started = Date.now();

    expect((await mock.send(VIEWER, {}, { token: null })).status).toBe(401);
    expect(Date.now() - started).toBeLessThan(200);
  });
});

describe('reset', () => {
  it('replays the same random sequence after a reset', async () => {
    const mock = setup({ ...calm, unavailableRate: 0.5 });
    const statuses = async () => {
      const result = [];
      for (let i = 0; i < 12; i++) result.push((await mock.send(VIEWER)).status);
      return result;
    };

    const first = await statuses();
    await mock.control('reset');
    const again = await statuses();

    expect(new Set(first)).toEqual(new Set([200, 503]));
    expect(again).toEqual(first);
  });

  it('drops pending triggers', async () => {
    const mock = setup();
    await mock.control('next', { behavior: 'unavailable' });

    await mock.control('reset');

    expect((await mock.send(VIEWER)).status).toBe(200);
  });
});
