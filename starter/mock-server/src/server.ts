import { readFileSync } from 'node:fs';
import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import { viewerFromAuthorization, type Viewer } from './auth.ts';
import { systemClock, type Clock } from './clock.ts';
import { defaultConfig, type MockConfig } from './config.ts';
import { controlPlugin } from './control.ts';
import { resolvers } from './resolvers.ts';
import { createStore, type Store } from './store.ts';

export interface MockContext {
  viewer: Viewer;
  config: MockConfig;
  clock: Clock;
  store: Store;
}

export interface MockServerOptions {
  config?: Partial<MockConfig>;
  clock?: Clock;
}

const typeDefs = readFileSync(new URL('../../schema/schema.graphql', import.meta.url), 'utf8');

function authPlugin(): Plugin {
  return {
    onRequest({ request, endResponse, fetchAPI }) {
      if (request.method === 'OPTIONS') return;
      // Let the browser open the GraphiQL page; its requests carry the header.
      if (request.method === 'GET' && request.headers.get('accept')?.includes('text/html')) return;
      if (viewerFromAuthorization(request.headers.get('authorization'))) return;
      endResponse(
        fetchAPI.Response.json(
          { message: 'Missing or empty bearer token in the authorization header.' },
          { status: 401 },
        ),
      );
    },
  };
}

/** Errors about the request itself (e.g. a variable of the wrong type) get the code BAD_REQUEST. */
function requestErrorCodePlugin(): Plugin {
  return {
    onResultProcess({ result }) {
      for (const single of Array.isArray(result) ? result : [result]) {
        if (!single || typeof single !== 'object' || !('errors' in single) || !Array.isArray(single.errors)) continue;
        for (const error of single.errors) {
          if (!error.extensions?.code) {
            Object.defineProperty(error, 'extensions', { value: { ...error.extensions, code: 'BAD_REQUEST' }, enumerable: true });
          }
        }
      }
    },
  };
}

export function createMockServer(options: MockServerOptions = {}) {
  const config: MockConfig = { ...defaultConfig, ...options.config };
  const clock = options.clock ?? systemClock;
  const store = createStore(config, clock);

  const yoga = createYoga<{}, MockContext>({
    schema: createSchema<MockContext>({ typeDefs, resolvers }),
    context: ({ request }) => ({
      viewer: viewerFromAuthorization(request.headers.get('authorization'))!,
      config,
      clock,
      store,
    }),
    plugins: [controlPlugin(store), authPlugin(), requestErrorCodePlugin()],
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['authorization', 'content-type', 'accept'],
    },
    graphiql: {
      title: 'Approval Inbox mock server',
      headers: JSON.stringify({ authorization: 'Bearer demo.user' }),
    },
    logging: 'warn',
  });

  return {
    config,
    /** Fetch-style handler: Request in, Response out. */
    fetch: (request: Request) => yoga.fetch(request),
    /** Node.js request listener for `http.createServer`. */
    requestListener: yoga,
  };
}

export type MockServer = ReturnType<typeof createMockServer>;
