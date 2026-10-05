export const graphqlUrl =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000/graphql";

export const authHeaders = {
  authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN ?? ""}`,
};
