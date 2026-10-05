import { ConfigError, describeConfig, runtimeChanges, type MockConfig } from './config.ts';
import { behaviors, type Conditions, type Trigger } from './conditions.ts';
import type { Events } from './events.ts';
import type { Store } from './store.ts';

interface ControlDeps {
  config: MockConfig;
  store: Store;
  events: Events;
  conditions: Conditions;
  /** Data, random sequences, triggers and the colleague back to the start. */
  resetAll: () => void;
}

class BadRequest extends Error {}

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
export async function handleControl(request: Request, path: string, { config, store, events, conditions, resetAll }: ControlDeps) {
  const conflict = /^\/__mock\/conflict\/([^/]+)$/.exec(path);
  if (conflict && request.method === 'POST') {
    const task = store.data.tasks.get(decodeURIComponent(conflict[1]!));
    if (!task) return Response.json({ message: `Unknown task ${conflict[1]}` }, { status: 404 });
    task.version += 1;
    events.publish('UPDATED', task);
    return Response.json({ ok: true, task: { id: task.id, version: task.version } });
  }

  const routes: Record<string, (body: Record<string, unknown>) => unknown> = {
    'POST /__mock/reset': () => {
      resetAll();
      return { ok: true };
    },
    'POST /__mock/config': (body) => {
      Object.assign(config, runtimeChanges(body));
      return describeConfig(config);
    },
    'POST /__mock/next': (body) => {
      const trigger = parseTrigger(body);
      conditions.addTrigger(trigger);
      return { ok: true, next: trigger };
    },
  };

  const route = routes[`${request.method} ${path}`];
  if (!route) return Response.json({ message: `Unknown control endpoint ${request.method} ${path}` }, { status: 404 });
  try {
    return Response.json(route(await readJson(request)));
  } catch (error) {
    if (error instanceof BadRequest || error instanceof ConfigError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
