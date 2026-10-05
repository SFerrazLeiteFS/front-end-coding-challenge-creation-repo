import { createServerAdapter } from '@whatwg-node/server';
import { viewerFromAuthorization } from './auth.ts';
import type { MockConfig } from './config.ts';
import type { Conditions, RequestConditions } from './conditions.ts';
import { handleControl } from './control.ts';
import { mockError } from './errors.ts';
import { describeRequest, readRequestInfo } from './request-info.ts';
import type { Store } from './store.ts';

export interface ServerContext {
  conditions?: RequestConditions;
}

interface HandlerDeps {
  yoga: { fetch(request: Request, context: ServerContext): Response | Promise<Response> };
  config: MockConfig;
  store: Store;
  conditions: Conditions;
  log: (line: string) => void;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });

/**
 * HTTP entry point. Control endpoints are answered here; GraphQL requests get
 * their conditions (delay, failures) before and after they reach graphql-yoga.
 */
export function createHttpHandler({ yoga, config, store, conditions, log }: HandlerDeps) {
  const corsHeaders = (request: Request): Record<string, string> =>
    request.headers.get('origin') === config.corsOrigin
      ? { 'access-control-allow-origin': config.corsOrigin, vary: 'Origin' }
      : {};
  const unavailable = (request: Request) => new Response(null, { status: 503, headers: corsHeaders(request) });

  return createServerAdapter(async (request: Request) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/__mock/')) return handleControl(request, url.pathname, { config, store, conditions });

    const isGraphiQL = request.method === 'GET' && request.headers.get('accept')?.includes('text/html');
    const unauthenticated = !viewerFromAuthorization(request.headers.get('authorization'));
    if (url.pathname !== '/graphql' || request.method === 'OPTIONS' || isGraphiQL || unauthenticated) {
      return yoga.fetch(request, {});
    }

    const info = await readRequestInfo(request);
    const names = [info.operationName, ...info.rootFields].filter((name): name is string => !!name);
    const current = conditions.forRequest(names, { isCompletion: info.rootFields.includes('completeTask') });

    let answered = false;
    request.signal.addEventListener('abort', () => {
      if (!answered) log(`request aborted: ${describeRequest(info)}`);
    }, { once: true });

    await wait(current.delayMs, request.signal);
    if (request.signal.aborted) return new Response(null, { status: 499 });

    try {
      if (current.unavailable) return unavailable(request);
      if (current.internal) {
        const error = mockError('INTERNAL', 'Internal error.');
        return Response.json(
          { data: null, errors: [{ message: error.message, extensions: error.extensions }] },
          { headers: corsHeaders(request) },
        );
      }
      const response = await yoga.fetch(request, { conditions: current });
      return current.answerUnavailable ? unavailable(request) : response;
    } finally {
      answered = true;
    }
  });
}
