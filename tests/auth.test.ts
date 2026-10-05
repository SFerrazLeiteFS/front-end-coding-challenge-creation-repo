import { describe, expect, it } from 'vitest';
import { MOCK_URL, setup } from './helpers.ts';

const VIEWER = /* GraphQL */ `
  query Viewer {
    viewer {
      id
      displayName
    }
  }
`;

describe('auth and viewer', () => {
  it('derives the viewer from the bearer token', async () => {
    const { gql } = setup();

    const { response, body } = await gql(VIEWER);

    expect(response.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data.viewer).toEqual({ id: 'user-demo-user', displayName: 'Demo User' });
  });

  it('gives different tokens different, stable viewers', async () => {
    const { gql } = setup();

    const alex = await gql(VIEWER, {}, { token: 'alex' });
    const alexAgain = await gql(VIEWER, {}, { token: 'alex' });
    const sam = await gql(VIEWER, {}, { token: 'sam.lee' });

    expect(alex.body.data.viewer).toEqual({ id: 'user-alex', displayName: 'Alex' });
    expect(alexAgain.body.data.viewer).toEqual(alex.body.data.viewer);
    expect(sam.body.data.viewer).toEqual({ id: 'user-sam.lee', displayName: 'Sam Lee' });
  });

  it.each([
    ['missing header', null],
    ['empty token', ''],
    ['whitespace token', '   '],
  ])('rejects a request with %s with HTTP 401 and a plain JSON body', async (_, token) => {
    const { gql } = setup();

    const { response, body } = await gql(VIEWER, {}, { token });

    expect(response.status).toBe(401);
    expect(body).toEqual({ message: expect.any(String) });
  });

  it('rejects a non-bearer authorization scheme', async () => {
    const { server } = setup();

    const response = await server.fetch(
      new Request(MOCK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Basic abc' },
        body: JSON.stringify({ query: VIEWER }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('answers CORS preflight from the web app origin without a token', async () => {
    const { server } = setup();

    const response = await server.fetch(
      new Request(MOCK_URL, {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:3000',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization,content-type',
        },
      }),
    );

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
  });

  it('sends CORS headers on a 401 so the browser can read it', async () => {
    const { server } = setup();

    const response = await server.fetch(
      new Request(MOCK_URL, {
        method: 'POST',
        headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
        body: JSON.stringify({ query: VIEWER }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });
});
