import { graphql } from "@/gql";

export const ViewerQuery = graphql(`
  query Viewer {
    viewer {
      id
      displayName
    }
  }
`);
