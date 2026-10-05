import { cacheExchange, createClient, fetchExchange } from "@urql/core";
import { registerUrql } from "@urql/next/rsc";
import { authHeaders, graphqlUrl } from "./graphql-endpoint";

/** urql client for Server Components, one per request. */
export const { getClient } = registerUrql(() =>
  createClient({
    url: graphqlUrl,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: { headers: authHeaders },
  }),
);
