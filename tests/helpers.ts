import { createManualClock, createMockServer, type MockConfig } from '../starter/mock-server/src/index.ts';

export const MOCK_URL = 'http://localhost:4000/graphql';

type GraphQLBody<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: (string | number)[]; extensions?: Record<string, any> }>;
};

export function setup(config: Partial<MockConfig> = {}, { now }: { now?: number } = {}) {
  const clock = createManualClock(now);
  const logs: string[] = [];
  const server = createMockServer({ config: { chaos: false, ...config }, clock, log: (line) => logs.push(line) });

  /** Sends a GraphQL request and returns the raw response. */
  function send(
    query: string,
    variables: Record<string, unknown> = {},
    { token = 'demo.user', signal }: { token?: string | null; signal?: AbortSignal } = {},
  ) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token !== null) headers.authorization = `Bearer ${token}`;
    return server.fetch(new Request(MOCK_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }), signal }));
  }

  /** Sends a GraphQL request and parses the JSON body. */
  async function gql<T = any>(
    query: string,
    variables: Record<string, unknown> = {},
    options: { token?: string | null } = {},
  ) {
    const response = await send(query, variables, options);
    const body = (await response.json()) as GraphQLBody<T> & Record<string, any>;
    return { response, body };
  }

  /** POST to a control endpoint under /__mock/. */
  async function control(path: string, body?: unknown) {
    const response = await server.fetch(
      new Request(new URL(`/__mock/${path}`, MOCK_URL), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    return { response, body: (await response.json()) as any };
  }

  return { server, clock, logs, send, gql, control };
}
