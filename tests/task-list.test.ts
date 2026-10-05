import { describe, expect, it } from 'vitest';
import { setup } from './helpers.ts';

const TASKS = /* GraphQL */ `
  query Tasks($first: Int, $after: String, $filter: TaskFilter, $sort: TaskSort) {
    tasks(first: $first, after: $after, filter: $filter, sort: $sort) {
      edges {
        cursor
        node { id }
      }
      nodes { id title status priority createdAt dueAt process { id } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type Gql = ReturnType<typeof setup>['gql'];
type Node = { id: string; title: string; status: string; priority: string; createdAt: string; dueAt: string | null; process: { id: string } };

async function page(gql: Gql, variables: Record<string, unknown> = {}) {
  const { body } = await gql(TASKS, variables);
  return body as any;
}

async function allPages(gql: Gql, variables: Record<string, unknown> = {}) {
  const nodes: Node[] = [];
  let after: string | null = null;
  for (;;) {
    const body = await page(gql, { ...variables, first: 100, after });
    expect(body.errors).toBeUndefined();
    const { tasks } = body.data;
    nodes.push(...tasks.nodes);
    if (!tasks.pageInfo.hasNextPage) return nodes;
    after = tasks.pageInfo.endCursor;
  }
}

const ms = (iso: string | null) => (iso === null ? null : Date.parse(iso));
const rank = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 } as Record<string, number>;

/** Negative if a comes first. */
const orders: Record<string, (a: Node, b: Node) => number> = {
  DUE_ASC: (a, b) => nullsLast(ms(a.dueAt), ms(b.dueAt), (x, y) => x - y) || a.id.localeCompare(b.id),
  DUE_DESC: (a, b) => nullsLast(ms(a.dueAt), ms(b.dueAt), (x, y) => y - x) || a.id.localeCompare(b.id),
  CREATED_DESC: (a, b) => ms(b.createdAt)! - ms(a.createdAt)! || a.id.localeCompare(b.id),
  PRIORITY_DESC: (a, b) => rank[b.priority]! - rank[a.priority]! || a.id.localeCompare(b.id),
};
function nullsLast(a: number | null, b: number | null, compare: (a: number, b: number) => number) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

describe('task list', () => {
  it('returns the first 20 tasks by due date with edges, nodes and page info', async () => {
    const { gql } = setup();

    const body = await page(gql);

    expect(body.errors).toBeUndefined();
    const { edges, nodes, pageInfo } = body.data.tasks;
    expect(nodes).toHaveLength(20);
    expect(edges.map((edge: any) => edge.node.id)).toEqual(nodes.map((node: Node) => node.id));
    expect(pageInfo).toEqual({ hasNextPage: true, endCursor: edges.at(-1).cursor });
    expect([...nodes].sort(orders.DUE_ASC)).toEqual(nodes);
  });

  it('returns every status when no status filter is set', async () => {
    const { gql } = setup();

    const nodes = await allPages(gql);

    expect(new Set(nodes.map((node) => node.status))).toEqual(new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']));
  });

  it.each(Object.keys(orders))('pages through all tasks sorted by %s without duplicates or gaps', async (sort) => {
    const { gql } = setup();

    const nodes = await allPages(gql, { sort });

    expect(nodes).toHaveLength(250);
    expect(new Set(nodes.map((node) => node.id)).size).toBe(250);
    expect([...nodes].sort(orders[sort])).toEqual(nodes);
  });

  it('puts tasks without due date last in both due-date directions', async () => {
    const { gql } = setup();

    for (const sort of ['DUE_ASC', 'DUE_DESC']) {
      const nodes = await allPages(gql, { sort });
      const firstWithout = nodes.findIndex((node) => node.dueAt === null);
      expect(firstWithout).toBeGreaterThan(0);
      expect(nodes.slice(firstWithout).every((node) => node.dueAt === null)).toBe(true);
    }
  });

  it('matches small pages with one big page', async () => {
    const { gql } = setup();
    const big = (await page(gql, { first: 60, sort: 'PRIORITY_DESC' })).data.tasks.nodes;

    const small: Node[] = [];
    let after: string | null = null;
    for (let i = 0; i < 6; i++) {
      const { tasks }: any = (await page(gql, { first: 10, after, sort: 'PRIORITY_DESC' })).data;
      small.push(...tasks.nodes);
      after = tasks.pageInfo.endCursor;
    }

    expect(small).toEqual(big);
  });
});

describe('filters', () => {
  it('combines values within a field with OR', async () => {
    const { gql } = setup();

    const nodes = await allPages(gql, { filter: { status: ['OPEN', 'IN_PROGRESS'] } });

    expect(new Set(nodes.map((node) => node.status))).toEqual(new Set(['OPEN', 'IN_PROGRESS']));
  });

  it('combines fields with AND', async () => {
    const { gql } = setup();
    const all = await allPages(gql);

    const nodes = await allPages(gql, {
      filter: { status: ['OPEN'], priority: ['HIGH', 'URGENT'], processId: 'process-invoice' },
    });

    const expected = all.filter(
      (node) => node.status === 'OPEN' && ['HIGH', 'URGENT'].includes(node.priority) && node.process.id === 'process-invoice',
    );
    expect(nodes.map((node) => node.id).sort()).toEqual(expected.map((node) => node.id).sort());
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('searches titles case-insensitively', async () => {
    const { gql } = setup();
    const all = await allPages(gql);

    const nodes = await allPages(gql, { filter: { search: 'invoice inv-' } });
    const viaLowercase = all.filter((node) => node.title.toLowerCase().includes('invoice inv-'));

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.map((node) => node.id).sort()).toEqual(viaLowercase.map((node) => node.id).sort());
  });

  it('treats an empty search and empty lists as no filter', async () => {
    const { gql } = setup();

    const nodes = await allPages(gql, { filter: { search: '', status: [], priority: [] } });

    expect(nodes).toHaveLength(250);
  });

  it('keeps only tasks due before a date, excluding tasks without due date', async () => {
    const { gql } = setup();
    const all = await allPages(gql);
    const sorted = all.filter((node) => node.dueAt).sort(orders.DUE_ASC);
    const dueBefore = sorted[Math.floor(sorted.length / 2)]!.dueAt!;

    const nodes = await allPages(gql, { filter: { dueBefore } });

    const expected = all.filter((node) => node.dueAt !== null && Date.parse(node.dueAt) < Date.parse(dueBefore));
    expect(nodes.map((node) => node.id).sort()).toEqual(expected.map((node) => node.id).sort());
  });

  it('returns an empty page for an unknown process', async () => {
    const { gql } = setup();

    const body = await page(gql, { filter: { processId: 'process-unknown' } });

    expect(body.data.tasks).toEqual({ edges: [], nodes: [], pageInfo: { hasNextPage: false, endCursor: null } });
  });
});

describe('page size', () => {
  it('caps first at 100', async () => {
    const { gql } = setup();

    const body = await page(gql, { first: 500 });

    expect(body.data.tasks.nodes).toHaveLength(100);
  });

  it.each([0, -5])('rejects first = %s with VALIDATION_FAILED', async (first) => {
    const { gql } = setup();

    const body = await page(gql, { first });

    expect(body.data).toBeNull();
    expect(body.errors[0].extensions.code).toBe('VALIDATION_FAILED');
  });
});

describe('cursors', () => {
  async function firstCursor(gql: Gql, variables: Record<string, unknown> = {}) {
    return (await page(gql, { first: 5, ...variables })).data.tasks.pageInfo.endCursor as string;
  }

  it.each([
    ['a different filter', { filter: { status: ['OPEN'] } }],
    ['a different sort', { sort: 'CREATED_DESC' }],
  ])('rejects a cursor used with %s', async (_, variables) => {
    const { gql } = setup();
    const after = await firstCursor(gql);

    const body = await page(gql, { first: 5, after, ...variables });

    expect(body.data).toBeNull();
    expect(body.errors[0].extensions.code).toBe('BAD_CURSOR');
  });

  it('accepts a cursor with the same filter written in another order', async () => {
    const { gql } = setup();
    const after = await firstCursor(gql, { filter: { status: ['OPEN', 'IN_PROGRESS'] } });

    const body = await page(gql, { first: 5, after, filter: { status: ['IN_PROGRESS', 'OPEN'] } });

    expect(body.errors).toBeUndefined();
  });

  it.each(['garbage', btoa('{"not":"a cursor"}')])('rejects a malformed cursor %s', async (after) => {
    const { gql } = setup();

    const body = await page(gql, { first: 5, after });

    expect(body.errors[0].extensions.code).toBe('BAD_CURSOR');
  });

  it('expires a cursor after 10 minutes', async () => {
    const { gql, clock } = setup();
    const after = await firstCursor(gql);

    clock.advance(10 * 60 * 1000);
    expect((await page(gql, { first: 5, after })).errors).toBeUndefined();

    clock.advance(1);
    expect((await page(gql, { first: 5, after })).errors[0].extensions.code).toBe('BAD_CURSOR');
  });
});
