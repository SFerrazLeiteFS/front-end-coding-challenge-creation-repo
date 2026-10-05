import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GraphQLProvider } from "@/lib/urql-provider";

export const metadata: Metadata = {
  title: "Approval Inbox",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GraphQLProvider>{children}</GraphQLProvider>
      </body>
    </html>
  );
}
