import { describeConfig, runtimeChanges, type MockConfig } from './config.ts';
import { behaviors, type Conditions, type Trigger } from './conditions.ts';
import type { Store } from './store.ts';

interface ControlDeps {
  config: MockConfig;
  store: Store;
  conditions: Conditions;
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
export async function handleControl(request: Request, path: string, { config, store, conditions }: ControlDeps) {
  const routes: Record<string, (body: Record<string, unknown>) => unknown> = {
    'POST /__mock/reset': () => {
      store.reset();
      conditions.clearTriggers();
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
    if (error instanceof BadRequest || error instanceof Error) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    throw error;
  }
}
