function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is not set. See apps/web/.env.`);
  return value;
}

// Referenced literally so Next.js inlines them into the browser bundle.
export const graphqlUrl = required(
  "NEXT_PUBLIC_GRAPHQL_URL",
  process.env.NEXT_PUBLIC_GRAPHQL_URL,
);

export const authHeaders = {
  authorization: `Bearer ${required("NEXT_PUBLIC_API_TOKEN", process.env.NEXT_PUBLIC_API_TOKEN)}`,
};
