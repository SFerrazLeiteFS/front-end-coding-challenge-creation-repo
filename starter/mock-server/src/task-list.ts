import type { Clock } from './clock.ts';
import { mockError } from './errors.ts';
import type { Priority, Task, TaskStatus } from './model.ts';

export type TaskSort = 'DUE_ASC' | 'DUE_DESC' | 'CREATED_DESC' | 'PRIORITY_DESC';

export interface TaskFilter {
  status?: TaskStatus[] | null;
  priority?: Priority[] | null;
  processId?: string | null;
  search?: string | null;
  dueBefore?: string | null;
}

export interface TaskListArgs {
  first?: number | null;
  after?: string | null;
  filter?: TaskFilter | null;
  sort?: TaskSort | null;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const CURSOR_LIFETIME_MS = 10 * 60 * 1000;

const priorityRank: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

/** Position of a task in a sort order. Compared element by element; the task ID breaks ties. */
type SortKey = (number | string)[];

const sortKeys: Record<TaskSort, (task: Task) => SortKey> = {
  DUE_ASC: (task) => (task.dueAt ? [0, Date.parse(task.dueAt), task.id] : [1, 0, task.id]),
  DUE_DESC: (task) => (task.dueAt ? [0, -Date.parse(task.dueAt), task.id] : [1, 0, task.id]),
  CREATED_DESC: (task) => [-Date.parse(task.createdAt), task.id],
  PRIORITY_DESC: (task) => [-priorityRank[task.priority], task.id],
};

function compareKeys(a: SortKey, b: SortKey) {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return -1;
    if (a[i]! > b[i]!) return 1;
  }
  return 0;
}

/** Same filter and sort, written in any order, give the same string. */
function normalize(filter: TaskFilter | null | undefined, sort: TaskSort) {
  const list = (values?: string[] | null) => (values?.length ? [...new Set(values)].sort() : null);
  return JSON.stringify({
    status: list(filter?.status),
    priority: list(filter?.priority),
    processId: filter?.processId ?? null,
    search: filter?.search?.trim().toLowerCase() || null,
    dueBefore: filter?.dueBefore ? Date.parse(filter.dueBefore) : null,
    sort,
  });
}

/** FNV-1a, as hex. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

interface CursorData {
  key: SortKey;
  query: string;
  issuedAt: number;
}

const encodeCursor = (data: CursorData) => Buffer.from(JSON.stringify(data)).toString('base64');

function decodeCursor(cursor: string): CursorData {
  try {
    const data = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    if (Array.isArray(data.key) && typeof data.query === 'string' && typeof data.issuedAt === 'number') return data;
  } catch {
    // fall through
  }
  throw mockError('BAD_CURSOR', 'The cursor is not valid.');
}

function matches(task: Task, filter: TaskFilter | null | undefined, dueBefore: number | null) {
  if (!filter) return true;
  if (filter.status?.length && !filter.status.includes(task.status)) return false;
  if (filter.priority?.length && !filter.priority.includes(task.priority)) return false;
  if (filter.processId && task.processId !== filter.processId) return false;
  const search = filter.search?.trim().toLowerCase();
  if (search && !task.title.toLowerCase().includes(search)) return false;
  if (dueBefore !== null && (task.dueAt === null || Date.parse(task.dueAt) >= dueBefore)) return false;
  return true;
}

export function listTasks(tasks: Iterable<Task>, args: TaskListArgs, clock: Clock) {
  const sort = args.sort ?? 'DUE_ASC';
  const first = args.first ?? DEFAULT_PAGE_SIZE;
  if (first < 1) {
    throw mockError('VALIDATION_FAILED', '`first` must be at least 1.', {
      fieldErrors: [{ key: 'first', message: 'Must be at least 1.' }],
    });
  }
  const pageSize = Math.min(first, MAX_PAGE_SIZE);

  let dueBefore: number | null = null;
  if (args.filter?.dueBefore) {
    dueBefore = Date.parse(args.filter.dueBefore);
    if (Number.isNaN(dueBefore)) {
      throw mockError('VALIDATION_FAILED', '`filter.dueBefore` is not a valid date-time.', {
        fieldErrors: [{ key: 'dueBefore', message: 'Not a valid date-time.' }],
      });
    }
  }

  const query = hash(normalize(args.filter, sort));
  let afterKey: SortKey | null = null;
  if (args.after) {
    const cursor = decodeCursor(args.after);
    if (cursor.query !== query) throw mockError('BAD_CURSOR', 'The cursor belongs to a different filter or sort.');
    if (clock.now() - cursor.issuedAt > CURSOR_LIFETIME_MS) throw mockError('BAD_CURSOR', 'The cursor has expired.');
    afterKey = cursor.key;
  }

  const keyOf = sortKeys[sort];
  const sorted = [...tasks]
    .filter((task) => matches(task, args.filter, dueBefore))
    .map((task) => ({ task, key: keyOf(task) }))
    .filter(({ key }) => afterKey === null || compareKeys(key, afterKey) > 0)
    .sort((a, b) => compareKeys(a.key, b.key));

  const issuedAt = clock.now();
  const edges = sorted.slice(0, pageSize).map(({ task, key }) => ({
    cursor: encodeCursor({ key, query, issuedAt }),
    node: task,
  }));

  return {
    edges,
    nodes: edges.map((edge) => edge.node),
    pageInfo: { hasNextPage: sorted.length > pageSize, endCursor: edges.at(-1)?.cursor ?? null },
  };
}
