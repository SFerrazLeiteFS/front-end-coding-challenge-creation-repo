import type { FieldValue, FormField } from './model.ts';
import { parseDateTime } from './time.ts';

/** One entry of `CompleteTaskInput.values`. Exactly one of the value fields must be set. */
export interface FieldValueInput {
  key: string;
  text?: string | null;
  number?: number | null;
  date?: string | null;
  selected?: string[] | null;
  bool?: boolean | null;
  decision?: string | null;
}

export interface FieldError {
  key: string;
  message: string;
}

type ValueKind = Exclude<keyof FieldValueInput, 'key'>;

const kindOf: Record<FormField['__typename'], ValueKind> = {
  TextField: 'text',
  NumberField: 'number',
  DateField: 'date',
  SelectField: 'selected',
  BooleanField: 'bool',
  DecisionField: 'decision',
};
const valueKinds = Object.values(kindOf);

/** Tolerance for floating-point rounding when checking `step`, e.g. 533.54 with step 0.01. */
const STEP_TOLERANCE = 1e-6;

function isMissing(field: FormField, input: FieldValueInput | undefined) {
  if (!input) return true;
  if (field.__typename === 'TextField') return !input.text?.trim();
  if (field.__typename === 'SelectField') return !input.selected?.length;
  return false;
}

/** First rule the value breaks, or null. Assumes the value has the field's kind. */
function checkValue(field: FormField, input: FieldValueInput): string | null {
  switch (field.__typename) {
    case 'TextField': {
      const text = input.text!;
      if (field.maxLength !== null && text.length > field.maxLength) return `At most ${field.maxLength} characters.`;
      if (field.pattern !== null && text !== '' && !new RegExp(`^(?:${field.pattern})$`).test(text)) {
        return `Does not match the expected format.`;
      }
      return null;
    }
    case 'NumberField': {
      const value = input.number!;
      if (field.min !== null && value < field.min) return `Must be at least ${field.min}.`;
      if (field.max !== null && value > field.max) return `Must be at most ${field.max}.`;
      if (field.step !== null) {
        const steps = (value - (field.min ?? 0)) / field.step;
        if (Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE) return `Must be in steps of ${field.step}.`;
      }
      return null;
    }
    case 'DateField': {
      const value = parseDateTime(input.date!);
      if (value === null) return 'Expected an ISO 8601 date-time, e.g. 2026-03-10T17:00:00Z.';
      if (field.min !== null && value < Date.parse(field.min)) return `Must not be before ${field.min}.`;
      if (field.max !== null && value > Date.parse(field.max)) return `Must not be after ${field.max}.`;
      return null;
    }
    case 'SelectField': {
      const selected = input.selected!;
      const options = new Set(field.options.map((option) => option.value));
      const unknown = selected.filter((value) => !options.has(value));
      if (unknown.length) return `Unknown option: ${unknown.join(', ')}.`;
      if (!field.multiple && selected.length > 1) return 'Choose only one option.';
      return null;
    }
    case 'BooleanField':
      return field.required && input.bool !== true ? 'Must be checked.' : null;
    case 'DecisionField':
      return field.allowed.includes(input.decision as never) ? null : `Must be one of ${field.allowed.join(', ')}.`;
  }
}

/** Checks submitted values against the form. Returns one error per field that breaks a rule, all at once. */
export function validateValues(fields: FormField[], inputs: FieldValueInput[]): FieldError[] {
  const errors = new Map<string, string>();
  const report = (key: string, message: string) => {
    if (!errors.has(key)) errors.set(key, message);
  };
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const inputsByKey = new Map<string, FieldValueInput>();

  for (const input of inputs) {
    const field = fieldsByKey.get(input.key);
    if (!field) {
      report(input.key, 'Unknown field.');
      continue;
    }
    if (inputsByKey.has(input.key)) {
      report(input.key, 'Only one value per field.');
      continue;
    }
    const setKinds = valueKinds.filter((kind) => input[kind] !== null && input[kind] !== undefined);
    if (setKinds.length !== 1) {
      report(input.key, 'Exactly one value must be set.');
      continue;
    }
    if (setKinds[0] !== kindOf[field.__typename]) {
      report(input.key, `Expected a ${kindOf[field.__typename]} value.`);
      continue;
    }
    if (field.__typename === 'DateField' && typeof input.date !== 'string') {
      report(input.key, 'Expected an ISO 8601 date-time, e.g. 2026-03-10T17:00:00Z.');
      continue;
    }
    inputsByKey.set(input.key, input);
  }

  for (const field of fields) {
    const input = inputsByKey.get(field.key);
    if (errors.has(field.key)) continue;
    if (field.required && isMissing(field, input)) {
      report(field.key, field.__typename === 'BooleanField' ? 'Must be checked.' : 'Required.');
      continue;
    }
    if (!input || isMissing(field, input)) continue;
    const problem = checkValue(field, input);
    if (problem) report(field.key, problem);
  }

  for (const field of fields) {
    if (field.__typename !== 'DecisionField') continue;
    const decision = inputsByKey.get(field.key)?.decision;
    if (!decision || !field.commentRequiredFor.includes(decision as never)) continue;
    const comment = fieldsByKey.get(field.commentFieldKey);
    if (comment && isMissing(comment, inputsByKey.get(field.commentFieldKey))) {
      report(field.commentFieldKey, `Required when the decision is ${decision}.`);
    }
  }

  return [...errors].map(([key, message]) => ({ key, message }));
}

/** Converts validated inputs into stored values. */
export function toFieldValues(fields: FormField[], inputs: FieldValueInput[]): FieldValue[] {
  return inputs.flatMap((input): FieldValue[] => {
    const field = fields.find((f) => f.key === input.key)!;
    switch (field.__typename) {
      case 'TextField':
        return input.text ? [{ __typename: 'TextValue', key: input.key, text: input.text }] : [];
      case 'NumberField':
        return [{ __typename: 'NumberValue', key: input.key, number: input.number! }];
      case 'DateField':
        return [{ __typename: 'DateValue', key: input.key, date: input.date! }];
      case 'SelectField':
        return [{ __typename: 'SelectValue', key: input.key, selected: input.selected! }];
      case 'BooleanField':
        return [{ __typename: 'BooleanValue', key: input.key, bool: input.bool! }];
      case 'DecisionField':
        return [{ __typename: 'DecisionValue', key: input.key, decision: input.decision as never }];
    }
  });
}
