import { ConfigError, describeConfig, runtimeChanges, type MockConfig } from './config.ts';
import { behaviors, type Trigger } from './conditions.ts';
import type { Events } from './events.ts';
import type { Store } from './store.ts';

export interface ControlDeps {
  config: MockConfig;
  store: Store;
  events: Events;
  /** Data, random sequences, triggers, colleague and open streams back to the start. */
  resetAll: () => void;
  addTrigger: (trigger: Trigger) => void;
}

class BadRequest extends Error {}
class NotFound extends Error {}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text) return {};
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    // reported below
  }
  throw new BadRequest('The body must be a JSON object.');
}

function parseTrigger(body: Record<string, unknown>): Trigger {
  const { behavior, operation, ms } = body;
  if (!behaviors.includes(behavior as never)) {
    throw new BadRequest(`behavior must be one of ${behaviors.join(', ')}`);
  }
  if (operation !== undefined && typeof operation !== 'string') throw new BadRequest('operation must be a string');
  if (behavior === 'slow' && (typeof ms !== 'number' || !Number.isInteger(ms) || ms < 0)) {
    throw new BadRequest('slow needs ms, a whole number of milliseconds');
  }
  return { behavior: behavior as Trigger['behavior'], operation, ms: ms as number | undefined };
}

/** Endpoints under /__mock/ to control the mock while developing. Useful for testing. */
export async function handleControl(request: Request, path: string, { config, store, events, resetAll, addTrigger }: ControlDeps) {

  const routes: Record<string, (body: Record<string, unknown>, param?: string) => unknown> = {
    'POST /__mock/reset': () => {
      resetAll();
      return { ok: true };
    },
    'POST /__mock/config': (body) => {
      Object.assign(config, runtimeChanges(body));
      return describeConfig(config);
    },
    'POST /__mock/bump-version/:taskId': (_, taskId) => {
      const task = store.data.tasks.get(taskId!);
      if (!task) throw new NotFound(`Unknown task ${taskId}`);
      const before = structuredClone(task);
      task.version += 1;
      events.publish('UPDATED', task, before);
      return { ok: true, task: { id: task.id, version: task.version } };
    },
    'POST /__mock/next': (body) => {
      const trigger = parseTrigger(body);
      addTrigger(trigger);
      return { ok: true, next: trigger };
    },
  };

  const [, name, param] = /^(\/__mock\/[^/]+)(?:\/([^/]+))?$/.exec(path) ?? [];
  const route = routes[`${request.method} ${name}`] ?? routes[`${request.method} ${name}/:taskId`];
  const takesParam = !routes[`${request.method} ${name}`];
  if (!route || takesParam !== (param !== undefined)) {
    return Response.json({ message: `Unknown control endpoint ${request.method} ${path}` }, { status: 404 });
  }
  try {
    return Response.json(route(await readJson(request), param && decodeURIComponent(param)));
  } catch (error) {
    if (error instanceof NotFound) return Response.json({ message: error.message }, { status: 404 });
    if (error instanceof BadRequest || error instanceof ConfigError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
