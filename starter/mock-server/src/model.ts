/** In-memory shapes of the mock's data. They mirror the GraphQL schema. */

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type Decision = 'APPROVE' | 'REJECT' | 'RETURN';

export interface User {
  id: string;
  displayName: string;
}

export interface Process {
  id: string;
  name: string;
}

interface FieldBase {
  key: string;
  label: string;
  required: boolean;
  helpText: string | null;
}

export type FormField =
  | (FieldBase & { __typename: 'TextField'; multiline: boolean; maxLength: number | null; pattern: string | null })
  | (FieldBase & { __typename: 'NumberField'; min: number | null; max: number | null; step: number | null; unit: string | null })
  | (FieldBase & { __typename: 'DateField'; min: string | null; max: string | null })
  | (FieldBase & { __typename: 'SelectField'; options: { value: string; label: string }[]; multiple: boolean })
  | (FieldBase & { __typename: 'BooleanField' })
  | (FieldBase & { __typename: 'DecisionField'; allowed: Decision[]; commentRequiredFor: Decision[]; commentFieldKey: string });

export type FieldValue =
  | { __typename: 'TextValue'; key: string; text: string }
  | { __typename: 'NumberValue'; key: string; number: number }
  | { __typename: 'DateValue'; key: string; date: string }
  | { __typename: 'SelectValue'; key: string; selected: string[] }
  | { __typename: 'BooleanValue'; key: string; bool: boolean }
  | { __typename: 'DecisionValue'; key: string; decision: Decision };

export interface Task {
  id: string;
  version: number;
  title: string;
  processId: string;
  status: TaskStatus;
  priority: Priority;
  assignee: User | null;
  createdAt: string;
  dueAt: string | null;
  completedBy: User | null;
  completedAt: string | null;
  values: FieldValue[];
}
