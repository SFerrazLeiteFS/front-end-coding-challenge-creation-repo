import Link from "next/link";
import { SignedInAs } from "@/components/SignedInAs";
import { ViewerQuery } from "@/graphql/viewer";
import { getClient } from "@/lib/rsc-client";

/** Server Component: the query runs on the Next.js server. */
export default async function HomePage() {
  const result = await getClient().query(ViewerQuery, {});

  return (
    <main>
      <h1>Approval Inbox</h1>
      {result.data ? (
        <SignedInAs name={result.data.viewer.displayName} />
      ) : (
        <p>{result.error?.message}</p>
      )}
      <Link href="/client-example">Client Component example</Link>
    </main>
  );
}
