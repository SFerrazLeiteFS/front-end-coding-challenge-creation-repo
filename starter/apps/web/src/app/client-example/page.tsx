import Link from "next/link";
import { Suspense } from "react";
import { Viewer } from "./Viewer";

export default function ClientExamplePage() {
  return (
    <main>
      <h1>Client Component example</h1>
      <Suspense fallback={<p>Loading…</p>}>
        <Viewer />
      </Suspense>
      <Link href="/">Server Component example</Link>
    </main>
  );
}
