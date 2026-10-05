"use client";

import {
  cacheExchange,
  createClient,
  fetchExchange,
  ssrExchange,
  UrqlProvider,
} from "@urql/next";
import { useMemo, type ReactNode } from "react";
import { authHeaders, graphqlUrl } from "./graphql-endpoint";

/** urql client for Client Components. Results fetched during SSR are reused in the browser. */
export function GraphQLProvider({ children }: { children: ReactNode }) {
  const [client, ssr] = useMemo(() => {
    const ssr = ssrExchange({ isClient: typeof window !== "undefined" });
    const client = createClient({
      url: graphqlUrl,
      exchanges: [cacheExchange, ssr, fetchExchange],
      fetchOptions: { headers: authHeaders },
      suspense: true,
    });
    return [client, ssr] as const;
  }, []);

  return (
    <UrqlProvider client={client} ssr={ssr}>
      {children}
    </UrqlProvider>
  );
}
