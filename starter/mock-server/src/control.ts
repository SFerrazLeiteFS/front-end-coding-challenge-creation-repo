import type { Plugin } from 'graphql-yoga';
import type { Store } from './store.ts';

/** Endpoints under /__mock/ to control the mock while developing. */
export function controlPlugin(store: Store): Plugin {
  const routes: Record<string, () => unknown> = {
    'POST /__mock/reset': () => {
      store.reset();
      return { ok: true };
    },
  };

  return {
    onRequest({ request, url, endResponse, fetchAPI }) {
      if (!url.pathname.startsWith('/__mock/')) return;
      const route = routes[`${request.method} ${url.pathname}`];
      endResponse(
        route
          ? fetchAPI.Response.json(route())
          : fetchAPI.Response.json({ message: `Unknown control endpoint ${request.method} ${url.pathname}` }, { status: 404 }),
      );
    },
  };
}
