import type { Clock } from './clock.ts';
import { mockError } from './errors.ts';
import type { Priority, Task, TaskStatus } from './model.ts';
import { MINUTE, parseDateTime } from './time.ts';
import { messages } from './validation.ts';

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
const CURSOR_LIFETIME_MS = 10 * MINUTE;

const priorityRank: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

/** Position of a task in a sort order, compared element by element. The task ID always comes last and breaks ties. */
type SortKey = (number | string)[];

/** Tasks without a due date get the group 1 and so come after all tasks with one. */
const byDueDate = (direction: 1 | -1) => (task: Task): SortKey =>
  task.dueAt ? [0, direction * Date.parse(task.dueAt), task.id] : [1, 0, task.id];

const sortKeys: Record<TaskSort, (task: Task) => SortKey> = {
  DUE_ASC: byDueDate(1),
  DUE_DESC: byDueDate(-1),
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

/** The filter as it is applied: empty values removed, lists deduplicated and sorted, dates parsed. */
export interface NormalizedFilter {
  status: TaskStatus[] | null;
  priority: Priority[] | null;
  processId: string | null;
  search: string | null;
  dueBefore: number | null;
}

export function normalizeFilter(filter: TaskFilter | null | undefined): NormalizedFilter {
  const list = <T extends string>(values?: T[] | null) => (values?.length ? [...new Set(values)].sort() : null);
  let dueBefore: number | null = null;
  if (filter?.dueBefore) {
    dueBefore = parseDateTime(filter.dueBefore);
    if (dueBefore === null) {
      throw mockError('VALIDATION_FAILED', '`filter.dueBefore` is not a valid date-time.', {
        fieldErrors: [{ key: 'dueBefore', message: messages.dateTime }],
      });
    }
  }
  return {
    status: list(filter?.status),
    priority: list(filter?.priority),
    processId: filter?.processId || null,
    search: filter?.search ? filter.search.toLowerCase() : null,
    dueBefore,
  };
}

export function matches(task: Task, filter: NormalizedFilter) {
  if (filter.status && !filter.status.includes(task.status)) return false;
  if (filter.priority && !filter.priority.includes(task.priority)) return false;
  if (filter.processId && task.processId !== filter.processId) return false;
  if (filter.search && !task.title.toLowerCase().includes(filter.search)) return false;
  if (filter.dueBefore !== null && (task.dueAt === null || Date.parse(task.dueAt) >= filter.dueBefore)) return false;
  return true;
}

/** Short fingerprint (FNV-1a) of filter and sort. A cursor is only valid for the fingerprint it was issued for. */
function fingerprint(filter: NormalizedFilter, sort: TaskSort) {
  const text = JSON.stringify({ filter, sort });
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

interface Cursor {
  key: SortKey;
  fingerprint: string;
  issuedAt: number;
}

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64');

function decodeCursor(value: string, sort: TaskSort): Cursor {
  let cursor: Partial<Cursor> | undefined;
  try {
    cursor = JSON.parse(Buffer.from(value, 'base64').toString('utf8'));
  } catch {
    cursor = undefined;
  }
  const keyLength = sort.startsWith('DUE') ? 3 : 2;
  const validKey =
    Array.isArray(cursor?.key) &&
    cursor.key.length === keyLength &&
    cursor.key.every((part) => typeof part === 'number' || typeof part === 'string');
  if (!validKey || typeof cursor?.fingerprint !== 'string' || typeof cursor.issuedAt !== 'number') {
    throw mockError('BAD_CURSOR', 'The cursor is not valid.');
  }
  return cursor as Cursor;
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
  const filter = normalizeFilter(args.filter);
  const currentFingerprint = fingerprint(filter, sort);
  const now = clock.now();

  let afterKey: SortKey | null = null;
  if (args.after) {
    const cursor = decodeCursor(args.after, sort);
    if (cursor.fingerprint !== currentFingerprint) {
      throw mockError('BAD_CURSOR', 'The cursor belongs to a different filter or sort.');
    }
    const age = now - cursor.issuedAt;
    if (age < 0 || age > CURSOR_LIFETIME_MS) throw mockError('BAD_CURSOR', 'The cursor has expired.');
    afterKey = cursor.key;
  }

  const keyOf = sortKeys[sort];
  const remaining = [...tasks]
    .filter((task) => matches(task, filter))
    .map((task) => ({ task, key: keyOf(task) }))
    .filter(({ key }) => afterKey === null || compareKeys(key, afterKey) > 0)
    .sort((a, b) => compareKeys(a.key, b.key));

  const edges = remaining.slice(0, pageSize).map(({ task, key }) => ({
    cursor: encodeCursor({ key, fingerprint: currentFingerprint, issuedAt: now }),
    node: task,
  }));

  return {
    edges,
    nodes: edges.map((edge) => edge.node),
    pageInfo: { hasNextPage: remaining.length > pageSize, endCursor: edges.at(-1)?.cursor ?? null },
  };
}
