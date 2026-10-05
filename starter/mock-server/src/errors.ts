import { createGraphQLError } from 'graphql-yoga';

export type ErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FAILED_PRECONDITION'
  | 'VALIDATION_FAILED'
  | 'BAD_CURSOR'
  | 'INTERNAL';

/** A GraphQL error with `extensions.code` and optional extra data. */
export function mockError(code: ErrorCode, message: string, extensions: Record<string, unknown> = {}) {
  return createGraphQLError(message, { extensions: { code, ...extensions } });
}
