import { describe, expect, it } from 'vitest';
import { MOCK_URL, setup } from './helpers.ts';

const EVENTS = /* GraphQL */ `
  subscription Events($filter: TaskFilter) {
    taskEvents(filter: $filter) {
      kind
      task { id title version status priority dueAt completedBy { id } process { id } }
    }
  }
`;
const TASK = 'query Task($id: ID!) { task(id: $id) { id version status } }';
const OPEN_TASKS = /* GraphQL */ `
  query Open($filter: TaskFilter) {
    tasks(first: 100, filter: $filter) { nodes { id version status } }
  }
`;
const COMPLETE = /* GraphQL */ `
  mutation Complete($input: CompleteTaskInput!) {
    completeTask(input: $input) { task { id version } }
  }
`;
const invoiceValues = [
  { key: 'invoiceNumber', text: 'INV-123456' },
  { key: 'amount', number: 100 },
  { key: 'costCenter', selected: ['it'] },
  { key: 'decision', decision: 'APPROVE' },
];

const INTERVAL = 8000;
const MINUTE = 60_000;

/** Realistic conditions on, but no delays or failures, so only the colleague is active. */
const calm = {
  chaos: true,
  latencyMs: [0, 0] as [number, number],
  unavailableRate: 0,
  internalRate: 0,
  partialRate: 0,
  lostResponseRate: 0,
};

type Mock = ReturnType<typeof setup>;
type TaskEvent = { kind: string; task: any };

const nextTick = () => new Promise((resolve) => setImmediate(resolve));

/** Opens an SSE subscription and collects its events. */
async function subscribe(mock: Mock, variables: Record<string, unknown> = {}) {
  const response = await mock.server.fetch(
    new Request(MOCK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream', authorization: 'Bearer demo.user' },
      body: JSON.stringify({ query: EVENTS, variables }),
    }),
  );
  expect(response.headers.get('content-type')).toContain('text/event-stream');

  const events: TaskEvent[] = [];
  let closed = false;
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const reading = (async () => {
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const message = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = message
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('');
        if (message.startsWith('event: next') && data) events.push(JSON.parse(data).data.taskEvents);
      }
    }
    closed = true;
  })();
  await nextTick();

  return {
    events,
    get closed() {
      return closed;
    },
    /** Lets queued events arrive: waits until nothing new came in for a few ticks. */
    settle: async () => {
      let quiet = 0;
      let seen = events.length;
      for (let i = 0; i < 2000 && quiet < 5; i++) {
        await nextTick();
        quiet = events.length === seen ? quiet + 1 : 0;
        seen = events.length;
      }
    },
    close: async () => {
      await reader.cancel();
      await reading;
    },
  };
}

/** Every open or in-progress task, across pages. */
async function allOpenTasks(mock: Mock) {
  const tasks: { id: string; version: number; status: string }[] = [];
  let after: string | null = null;
  for (;;) {
    const { body }: { body: any } = await mock.gql(
      'query Page($after: String) { tasks(first: 100, after: $after, filter: { status: [OPEN, IN_PROGRESS] }) { nodes { id version status } pageInfo { hasNextPage endCursor } } }',
      { after },
    );
    tasks.push(...body.data.tasks.nodes);
    if (!body.data.tasks.pageInfo.hasNextPage) return tasks;
    after = body.data.tasks.pageInfo.endCursor;
  }
}

async function openTasks(mock: Mock, filter: Record<string, unknown> = {}) {
  const { body } = await mock.gql(OPEN_TASKS, { filter: { status: ['OPEN', 'IN_PROGRESS'], ...filter } });
  return body.data.tasks.nodes as { id: string; version: number; status: string }[];
}

describe('simulated colleague', () => {
  it('works on one task per interval', async () => {
    const mock = setup({ ...calm });
    const stream = await subscribe(mock);

    mock.clock.advance(INTERVAL - 1);
    await stream.settle();
    expect(stream.events).toHaveLength(0);

    mock.clock.advance(1);
    await stream.settle();
    expect(stream.events).toHaveLength(1);

    mock.clock.advance(4 * INTERVAL);
    await stream.settle();
    expect(stream.events).toHaveLength(5);
    await stream.close();
  });

  it('uses the configured interval', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 1000 });
    const stream = await subscribe(mock);

    mock.clock.advance(3000);
    await stream.settle();

    expect(stream.events).toHaveLength(3);
    await stream.close();
  });

  it('updates, completes, creates, cancels and removes in the agreed mix', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 100 });
    const stream = await subscribe(mock);

    mock.clock.advance(400 * 100);
    await stream.settle();

    const share = (predicate: (event: TaskEvent) => boolean) => stream.events.filter(predicate).length / stream.events.length;
    expect(stream.events).toHaveLength(400);
    expect(share((e) => e.kind === 'UPDATED' && e.task.status !== 'CANCELLED')).toBeCloseTo(0.6, 1);
    expect(share((e) => e.kind === 'COMPLETED')).toBeCloseTo(0.2, 1);
    expect(share((e) => e.kind === 'CREATED')).toBeCloseTo(0.1, 1);
    expect(share((e) => e.kind === 'UPDATED' && e.task.status === 'CANCELLED')).toBeCloseTo(0.05, 1);
    expect(share((e) => e.kind === 'REMOVED')).toBeCloseTo(0.05, 1);
    await stream.close();
  });

  it('only touches open or in-progress tasks and bumps their version', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 1000 });
    const stream = await subscribe(mock);

    for (let i = 0; i < 60; i++) {
      const allOpen = new Map(
        (await allOpenTasks(mock)).map((task) => [task.id, task]),
      );
      const count = stream.events.length;
      mock.clock.advance(1000);
      await stream.settle();
      const event = stream.events[count]!;
      if (event.kind === 'CREATED') {
        expect(event.task).toMatchObject({ status: 'OPEN', version: 1 });
        continue;
      }
      const previous = allOpen.get(event.task.id);
      expect(previous, `${event.kind} on a task that was not open`).toBeDefined();
      if (event.kind !== 'REMOVED') expect(event.task.version).toBe(previous!.version + 1);
    }
    await stream.close();
  });

  it('applies each action to the stored data', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 100 });
    const stream = await subscribe(mock);

    mock.clock.advance(200 * 100);
    await stream.settle();
    await stream.close();

    const last = new Map<string, TaskEvent>();
    for (const event of stream.events) last.set(event.task.id, event);
    for (const [id, event] of last) {
      const { body } = await mock.gql(TASK, { id });
      if (event.kind === 'REMOVED') {
        expect(body.data.task).toBeNull();
      } else {
        expect(body.data.task).toEqual({ id, version: event.task.version, status: event.task.status });
      }
    }
    const completed = stream.events.filter((event) => event.kind === 'COMPLETED');
    expect(completed.every((event) => event.task.completedBy && event.task.completedBy.id !== 'user-demo.user')).toBe(true);
    const created = stream.events.filter((event) => event.kind === 'CREATED');
    expect(created.length).toBeGreaterThan(0);
    expect(new Set(created.map((event) => event.task.id)).size).toBe(created.length);
  });

  it('removes tasks for good', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 100 });
    const stream = await subscribe(mock);

    mock.clock.advance(100 * 100);
    await stream.settle();
    await stream.close();

    const removed = stream.events.find((event) => event.kind === 'REMOVED')!;
    expect(removed).toBeDefined();
    expect(removed.task).toMatchObject({ id: expect.any(String), version: expect.any(Number) });
    const { body } = await mock.gql(COMPLETE, {
      input: { taskId: removed.task.id, expectedVersion: removed.task.version, values: [] },
    });
    expect(body.errors![0]!.extensions).toEqual({ code: 'NOT_FOUND' });
    const listed = (await mock.gql('query Search($filter: TaskFilter) { tasks(first: 100, filter: $filter) { nodes { id } } }', {
      filter: { search: removed.task.title },
    })).body.data.tasks.nodes;
    expect(listed.map((task: any) => task.id)).not.toContain(removed.task.id);
  });

  it('rests while realistic conditions are off and starts when they are switched on', async () => {
    const mock = setup({ ...calm, chaos: false });
    const stream = await subscribe(mock);

    mock.clock.advance(10 * INTERVAL);
    await stream.settle();
    expect(stream.events).toHaveLength(0);

    await mock.control('config', { MOCK_CHAOS: 'on' });
    mock.clock.advance(INTERVAL);
    await stream.settle();
    expect(stream.events).toHaveLength(1);
    await stream.close();
  });

  it('starts over with the same actions after a reset', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 1000 });
    const first = await subscribe(mock);
    mock.clock.advance(20 * 1000);
    await first.settle();
    await first.close();

    await mock.control('reset');
    const again = await subscribe(mock);
    mock.clock.advance(20 * 1000);
    await again.settle();
    await again.close();

    const summary = (events: TaskEvent[]) => events.map((event) => `${event.kind} ${event.task.id}`);
    expect(summary(again.events)).toEqual(summary(first.events));
  });
});

describe('task events', () => {
  it('reports own completions', async () => {
    const mock = setup();
    const stream = await subscribe(mock);
    const [task] = await openTasks(mock, { processId: 'process-invoice' });

    await mock.gql(COMPLETE, { input: { taskId: task!.id, expectedVersion: task!.version, values: invoiceValues } });
    await stream.settle();

    expect(stream.events).toEqual([
      {
        kind: 'COMPLETED',
        task: expect.objectContaining({ id: task!.id, status: 'COMPLETED', completedBy: { id: 'user-demo.user' } }),
      },
    ]);
    await stream.close();
  });

  it('sends the state at the time of the event', async () => {
    const mock = setup();
    const stream = await subscribe(mock);
    const [task] = await openTasks(mock, { processId: 'process-invoice' });

    await mock.control(`bump-version/${task!.id}`);
    await mock.gql(COMPLETE, { input: { taskId: task!.id, expectedVersion: task!.version + 1, values: invoiceValues } });
    await stream.settle();

    expect(stream.events.map((event) => [event.kind, event.task.status, event.task.version])).toEqual([
      ['UPDATED', task!.status, task!.version + 1],
      ['COMPLETED', 'COMPLETED', task!.version + 2],
    ]);
    await stream.close();
  });

  it('also reports a task leaving the filter', async () => {
    const mock = setup();
    const stream = await subscribe(mock, { filter: { status: ['OPEN', 'IN_PROGRESS'] } });
    const [task] = await openTasks(mock, { processId: 'process-invoice' });

    await mock.gql(COMPLETE, { input: { taskId: task!.id, expectedVersion: task!.version, values: invoiceValues } });
    await stream.settle();

    expect(stream.events.map((event) => [event.kind, event.task.id])).toEqual([['COMPLETED', task!.id]]);
    await stream.close();
  });

  it('only sends events for tasks matching the filter', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 100 });
    const stream = await subscribe(mock, { filter: { processId: 'process-invoice' } });

    mock.clock.advance(100 * 100);
    await stream.settle();

    expect(stream.events.length).toBeGreaterThan(0);
    expect(stream.events.every((event) => event.task.process.id === 'process-invoice')).toBe(true);
    await stream.close();
  });
});

describe('version bump endpoint', () => {
  it('bumps the version so a completion with the old one conflicts', async () => {
    const mock = setup();
    const [task] = await openTasks(mock, { processId: 'process-invoice' });

    const { response, body } = await mock.control(`bump-version/${task!.id}`);

    expect(response.status).toBe(200);
    expect(body.task).toEqual({ id: task!.id, version: task!.version + 1 });
    const completion = await mock.gql(COMPLETE, {
      input: { taskId: task!.id, expectedVersion: task!.version, values: invoiceValues },
    });
    expect(completion.body.errors![0]!.extensions).toEqual({ code: 'CONFLICT', currentVersion: task!.version + 1 });
  });

  it('answers 404 for an unknown task', async () => {
    const mock = setup();

    expect((await mock.control(`bump-version/task-9999`)).response.status).toBe(404);
  });
});

describe('stream lifetime', () => {
  it('closes a stream after two to five minutes while realistic conditions are on', async () => {
    const mock = setup({ ...calm, foreignEditIntervalMs: 60 * MINUTE });
    const stream = await subscribe(mock);

    mock.clock.advance(2 * MINUTE - 1);
    await stream.settle();
    expect(stream.closed).toBe(false);

    mock.clock.advance(3 * MINUTE + 1);
    await stream.settle();
    expect(stream.closed).toBe(true);
  });

  it('closes a stream opened while conditions were off once they are switched on', async () => {
    const mock = setup({ ...calm, chaos: false, foreignEditIntervalMs: 60 * MINUTE });
    const stream = await subscribe(mock);
    mock.clock.advance(30 * MINUTE);
    await stream.settle();
    expect(stream.closed).toBe(false);

    await mock.control('config', { MOCK_CHAOS: 'on' });
    mock.clock.advance(5 * MINUTE);
    await stream.settle();

    expect(stream.closed).toBe(true);
  });

  it('ends open streams on reset', async () => {
    const mock = setup();
    const stream = await subscribe(mock);

    await mock.control('reset');
    await stream.settle();

    expect(stream.closed).toBe(true);
  });

  it('is not hit by whole-operation errors', async () => {
    const mock = setup({ ...calm, internalRate: 1, foreignEditIntervalMs: 1000 });
    const stream = await subscribe(mock);

    mock.clock.advance(1000);
    await stream.settle();

    expect(stream.events).toHaveLength(1);
    await stream.close();
  });

  it('keeps a stream open while realistic conditions are off', async () => {
    const mock = setup({ chaos: false });
    const stream = await subscribe(mock);

    mock.clock.advance(60 * MINUTE);
    await stream.settle();

    expect(stream.closed).toBe(false);
    await stream.close();
  });
});
