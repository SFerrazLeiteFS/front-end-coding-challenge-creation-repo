import { createManualClock, createMockServer, type MockConfig } from '../starter/mock-server/src/index.ts';

export const MOCK_URL = 'http://localhost:4000/graphql';

export function setup(config: Partial<MockConfig> = {}) {
  const clock = createManualClock();
  const server = createMockServer({ config: { chaos: false, ...config }, clock });

  async function gql<T = any>(
    query: string,
    variables: Record<string, unknown> = {},
    { token = 'demo-user' }: { token?: string | null } = {},
  ) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token !== null) headers.authorization = `Bearer ${token}`;
    const response = await server.fetch(
      new Request(MOCK_URL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) }),
    );
    const body = (await response.json()) as { data?: T; errors?: Array<{ message: string; path?: string[]; extensions?: Record<string, unknown> }> };
    return { response, body };
  }

  return { server, clock, gql };
}
