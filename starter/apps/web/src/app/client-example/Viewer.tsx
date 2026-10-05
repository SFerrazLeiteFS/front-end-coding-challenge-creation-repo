"use client";

import { useQuery } from "@urql/next";
import { SignedInAs } from "@/components/SignedInAs";
import { ViewerQuery } from "@/graphql/viewer";

/** Client Component: the query runs during SSR and again in the browser after client-side navigation. */
export function Viewer() {
  const [result] = useQuery({ query: ViewerQuery });

  return result.data ? (
    <SignedInAs name={result.data.viewer.displayName} />
  ) : null;
}
