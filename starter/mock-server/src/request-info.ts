import { Kind, parse, type OperationDefinitionNode } from 'graphql';

export interface RequestInfo {
  operationName: string | null;
  rootFields: string[];
}

/** Operation name and root fields of a GraphQL request, as far as they can be read. */
export async function readRequestInfo(request: Request): Promise<RequestInfo> {
  let query: unknown;
  let operationName: unknown;
  try {
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      query = params.get('query');
      operationName = params.get('operationName');
    } else {
      const body = await request.clone().json();
      query = body?.query;
      operationName = body?.operationName;
    }
  } catch {
    return { operationName: null, rootFields: [] };
  }
  if (typeof query !== 'string') return { operationName: null, rootFields: [] };

  try {
    const operations = parse(query).definitions.filter(
      (definition): definition is OperationDefinitionNode => definition.kind === Kind.OPERATION_DEFINITION,
    );
    const operation =
      operations.find((candidate) => candidate.name?.value === operationName) ?? operations[0];
    return {
      operationName: operation?.name?.value ?? (typeof operationName === 'string' ? operationName : null),
      rootFields: (operation?.selectionSet.selections ?? []).flatMap((selection) =>
        selection.kind === Kind.FIELD ? [selection.name.value] : [],
      ),
    };
  } catch {
    return { operationName: typeof operationName === 'string' ? operationName : null, rootFields: [] };
  }
}

export const describeRequest = ({ operationName, rootFields }: RequestInfo) =>
  operationName ?? (rootFields.join(', ') || 'unknown operation');
