import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockServer, type MockConfig } from '../starter/mock-server/src/index.ts';

const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

async function listen(config: Partial<MockConfig>) {
  const logs: string[] = [];
  const mock = createMockServer({ config: { chaos: false, ...config }, log: (line) => logs.push(line) });
  const server = createServer(mock.requestListener);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, logs };
}

const post = (url: string, query: string, init: RequestInit = {}) =>
  fetch(`${url}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer demo.user' },
    body: JSON.stringify({ query }),
    ...init,
  });

describe('over a real HTTP connection', () => {
  it('answers a query', async () => {
    const { url } = await listen({});

    const response = await post(url, 'query Viewer { viewer { displayName } }');

    expect(await response.json()).toEqual({ data: { viewer: { displayName: 'Demo User' } } });
  });

  it('answers HTTP 503 with an empty body', async () => {
    const { url } = await listen({ chaos: true, latencyMs: [0, 0], unavailableRate: 1 });

    const response = await post(url, 'query Viewer { viewer { id } }');

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('');
  });

  it('notices when the client gives up waiting', async () => {
    const { url, logs } = await listen({ chaos: true, latencyMs: [300, 300], unavailableRate: 0, internalRate: 0, partialRate: 0, lostResponseRate: 0 });
    const controller = new AbortController();

    const pending = post(url, 'query Viewer { viewer { id } }', { signal: controller.signal }).catch(() => null);
    setTimeout(() => controller.abort(), 50);
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(logs).toContain('request aborted: Viewer');
  });

  it('serves the control endpoints', async () => {
    const { url } = await listen({});

    const response = await fetch(`${url}/__mock/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ behavior: 'unavailable' }),
    });

    expect(response.status).toBe(200);
    expect((await post(url, '{ viewer { id } }')).status).toBe(503);
  });
});
