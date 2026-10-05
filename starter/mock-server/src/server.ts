import { readFileSync } from 'node:fs';
import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import { viewerFromAuthorization, type Viewer } from './auth.ts';
import { systemClock, type Clock } from './clock.ts';
import { defaultConfig, type MockConfig } from './config.ts';

export interface MockContext {
  viewer: Viewer;
  config: MockConfig;
  clock: Clock;
}

export interface MockServerOptions {
  config?: Partial<MockConfig>;
  clock?: Clock;
}

const typeDefs = readFileSync(new URL('../../schema/schema.graphql', import.meta.url), 'utf8');

/** Objects for interfaces and unions carry their concrete type name. */
const resolveByTypename = { __resolveType: (value: { __typename: string }) => value.__typename };

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

export function createMockServer(options: MockServerOptions = {}) {
  const config: MockConfig = { ...defaultConfig, ...options.config };
  const clock = options.clock ?? systemClock;

  const yoga = createYoga<{}, MockContext>({
    schema: createSchema<MockContext>({
      typeDefs,
      resolvers: {
        Query: {
          viewer: (_parent, _args, context) => context.viewer,
        },
        FormField: resolveByTypename,
        FieldValue: resolveByTypename,
      },
    }),
    context: ({ request }) => ({
      viewer: viewerFromAuthorization(request.headers.get('authorization'))!,
      config,
      clock,
    }),
    plugins: [authPlugin()],
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['authorization', 'content-type', 'accept'],
    },
    graphiql: {
      title: 'Approval Inbox mock server',
      headers: JSON.stringify({ authorization: 'Bearer demo-user' }),
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
