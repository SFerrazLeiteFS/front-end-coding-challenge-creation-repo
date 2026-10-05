import type { Decision, FieldValue, FormField, Process } from '../model.ts';
import type { Random } from '../random.ts';
import { DAY, iso } from '../time.ts';
import { team } from './team.ts';

const round2 = (value: number) => Math.round(value * 100) / 100;

type Options<T> = Omit<T, '__typename' | 'key' | 'label' | 'required' | 'helpText'> & {
  required?: boolean;
  helpText?: string;
};
type Field<T extends FormField['__typename']> = Extract<FormField, { __typename: T }>;

const base = (key: string, label: string, required = false, helpText?: string) => ({
  key,
  label,
  required,
  helpText: helpText ?? null,
});

const textField = (key: string, label: string, options: Partial<Options<Field<'TextField'>>> = {}): FormField => ({
  __typename: 'TextField',
  ...base(key, label, options.required, options.helpText),
  multiline: options.multiline ?? false,
  maxLength: options.maxLength ?? null,
  pattern: options.pattern ?? null,
});
const numberField = (key: string, label: string, options: Partial<Options<Field<'NumberField'>>> = {}): FormField => ({
  __typename: 'NumberField',
  ...base(key, label, options.required, options.helpText),
  min: options.min ?? null,
  max: options.max ?? null,
  step: options.step ?? null,
  unit: options.unit ?? null,
});
const dateField = (key: string, label: string, options: Partial<Options<Field<'DateField'>>> = {}): FormField => ({
  __typename: 'DateField',
  ...base(key, label, options.required, options.helpText),
  min: options.min ?? null,
  max: options.max ?? null,
});
const selectField = (
  key: string,
  label: string,
  choices: string[],
  options: Partial<Options<Field<'SelectField'>>> = {},
): FormField => ({
  __typename: 'SelectField',
  ...base(key, label, options.required, options.helpText),
  options: choices.map((choice) => ({ value: choice.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: choice })),
  multiple: options.multiple ?? false,
});
const booleanField = (key: string, label: string, options: Partial<Options<Field<'BooleanField'>>> = {}): FormField => ({
  __typename: 'BooleanField',
  ...base(key, label, options.required, options.helpText),
});
const decisionField = (allowed: Decision[], commentRequiredFor: Decision[]): FormField => ({
  __typename: 'DecisionField',
  ...base('decision', 'Decision', true),
  allowed,
  commentRequiredFor,
  commentFieldKey: 'comment',
});
const commentField = (helpText: string) =>
  textField('comment', 'Comment', { multiline: true, maxLength: 1000, helpText });

/** Values of `count` random options of the select field `key`, in option order. */
const pickOptions = (random: Random, form: FormField[], key: string, count = 1) => {
  const field = form.find((f) => f.key === key);
  if (field?.__typename !== 'SelectField') throw new Error(`${key} is not a select field`);
  const picked = new Set(random.sample(field.options, count));
  return field.options.filter((option) => picked.has(option)).map((option) => option.value);
};

const textValue = (key: string, value: string): FieldValue => ({ __typename: 'TextValue', key, text: value });
const numberValue = (key: string, value: number): FieldValue => ({ __typename: 'NumberValue', key, number: value });
const dateValue = (key: string, ms: number): FieldValue => ({ __typename: 'DateValue', key, date: iso(ms) });
const selectValue = (key: string, values: string[]): FieldValue => ({ __typename: 'SelectValue', key, selected: values });

export interface SampleTask {
  title: string;
  values: FieldValue[];
}

export interface ProcessDefinition {
  process: Process;
  /** Relative frequency of tasks from this process. */
  weight: number;
  /** The process's form. Date limits are relative to `today` (start of the day the data set was generated). */
  form(today: number): FormField[];
  /** Title and prefilled values for a new task. */
  sampleTask(random: Random, today: number, form: FormField[]): SampleTask;
}

const companies = [
  'Northwind Supplies',
  'Blue Harbor Logistics',
  'Fernwood Office',
  'Kestrel Systems',
  'Larkspur Catering',
  'Meridian Print',
  'Oakline Facility Services',
  'Quarry Lane Software',
];
const firstNames = ['Alex', 'Jamie', 'Morgan', 'Riley', 'Taylor', 'Casey', 'Jordan', 'Robin', 'Avery', 'Quinn'];
const lastNames = ['Berger', 'Novak', 'Fischer', 'Weiss', 'Horvat', 'Kim', 'Moreau', 'Silva', 'Lindqvist', 'Okafor'];
const person = (random: Random) => `${random.pick(firstNames)} ${random.pick(lastNames)}`;


export const processDefinitions: ProcessDefinition[] = [
  {
    process: { id: 'process-invoice', name: 'Invoice approval' },
    weight: 3,
    form: () => [
      textField('invoiceNumber', 'Invoice number', { required: true, pattern: 'INV-[0-9]{6}', helpText: 'Format: INV-123456' }),
      numberField('amount', 'Amount', { required: true, min: 0, step: 0.01, unit: 'EUR' }),
      selectField('costCenter', 'Cost center', ['Operations', 'Marketing', 'IT', 'Facilities', 'Human Resources'], {
        required: true,
      }),
      decisionField(['APPROVE', 'REJECT', 'RETURN'], ['REJECT', 'RETURN']),
      commentField('Required when rejecting or returning the invoice.'),
    ],
    sampleTask(random, _today, form) {
      const invoiceNumber = `INV-${String(random.int(0, 999_999)).padStart(6, '0')}`;
      const company = random.pick(companies);
      return {
        title: `Invoice ${invoiceNumber} from ${company}`,
        values: [
          textValue('invoiceNumber', invoiceNumber),
          numberValue('amount', round2(random.int(4_000, 2_500_000) / 100)),
          selectValue('costCenter', pickOptions(random, form, 'costCenter')),
        ],
      };
    },
  },
  {
    process: { id: 'process-leave', name: 'Leave request' },
    weight: 2,
    form: (today) => [
      selectField('leaveType', 'Type of leave', ['Vacation', 'Special leave', 'Unpaid leave'], { required: true }),
      dateField('firstDay', 'First day', { required: true, min: iso(today) }),
      dateField('lastDay', 'Last day', { required: true, min: iso(today) }),
      numberField('days', 'Working days', { required: true, min: 0.5, max: 30, step: 0.5, unit: 'days' }),
      decisionField(['APPROVE', 'REJECT'], ['REJECT']),
      commentField('Required when rejecting the request.'),
    ],
    sampleTask(random, today, form) {
      const employee = person(random);
      const firstDay = today + random.int(3, 60) * DAY;
      const days = random.int(1, 15);
      return {
        title: `Leave request: ${employee}, ${days} ${days === 1 ? 'day' : 'days'}`,
        values: [
          selectValue('leaveType', random.chance(0.8) ? ['vacation'] : pickOptions(random, form, 'leaveType')),
          dateValue('firstDay', firstDay),
          dateValue('lastDay', firstDay + (days - 1) * DAY),
          numberValue('days', days),
        ],
      };
    },
  },
  {
    process: { id: 'process-contract', name: 'Contract review' },
    weight: 1,
    form: () => [
      textField('contractTitle', 'Contract', { required: true, maxLength: 120 }),
      textField('counterparty', 'Counterparty', { required: true, maxLength: 80 }),
      numberField('annualValue', 'Annual value', { min: 0, step: 1, unit: 'EUR' }),
      dateField('renewalDate', 'Renewal date'),
      selectField('reviewedClauses', 'Reviewed clauses', ['Liability', 'Termination', 'Data protection', 'Payment terms', 'Confidentiality'], {
        required: true,
        multiple: true,
      }),
      booleanField('readFully', 'I have read the full contract', { required: true }),
      decisionField(['APPROVE', 'REJECT', 'RETURN'], ['REJECT', 'RETURN']),
      commentField('Required when rejecting or sending the contract back.'),
    ],
    sampleTask(random, today, form) {
      const counterparty = random.pick(companies);
      const kind = random.pick(['Service agreement', 'Framework contract', 'Maintenance contract', 'License agreement']);
      return {
        title: `Contract review: ${kind} with ${counterparty}`,
        values: [
          textValue('contractTitle', `${kind} ${new Date(today).getUTCFullYear()}`),
          textValue('counterparty', counterparty),
          numberValue('annualValue', random.int(5, 400) * 1000),
          dateValue('renewalDate', today + random.int(90, 720) * DAY),
        ],
      };
    },
  },
  {
    process: { id: 'process-purchase', name: 'Purchase order' },
    weight: 2,
    form: (today) => [
      selectField('supplier', 'Supplier', companies, { required: true }),
      textField('items', 'Items', { required: true, multiline: true, maxLength: 500 }),
      numberField('quantity', 'Quantity', { required: true, min: 1, max: 1000, step: 1 }),
      numberField('unitPrice', 'Unit price', { required: true, min: 0.01, step: 0.01, unit: 'EUR' }),
      dateField('deliveryDate', 'Requested delivery', { min: iso(today) }),
      booleanField('urgent', 'Urgent delivery'),
      decisionField(['APPROVE', 'REJECT'], ['REJECT']),
      commentField('Required when rejecting the order.'),
    ],
    sampleTask(random, today, form) {
      const item = random.pick(['Laptops', 'Office chairs', 'Monitors', 'Printer toner', 'Standing desks', 'Headsets']);
      const quantity = random.int(1, 40);
      return {
        title: `Purchase order: ${quantity} × ${item}`,
        values: [
          selectValue('supplier', pickOptions(random, form, 'supplier')),
          textValue('items', `${quantity} × ${item}`),
          numberValue('quantity', quantity),
          numberValue('unitPrice', round2(random.int(500, 250_000) / 100)),
          dateValue('deliveryDate', today + random.int(7, 45) * DAY),
          { __typename: 'BooleanValue', key: 'urgent', bool: random.chance(0.2) },
        ],
      };
    },
  },
  {
    process: { id: 'process-expenses', name: 'Expense report' },
    weight: 2,
    form: () => [
      textField('purpose', 'Purpose', { required: true, maxLength: 200 }),
      numberField('total', 'Total', { required: true, min: 0, max: 10_000, step: 0.01, unit: 'EUR' }),
      selectField('categories', 'Categories', ['Travel', 'Accommodation', 'Meals', 'Training', 'Other'], {
        required: true,
        multiple: true,
      }),
      booleanField('receiptsComplete', 'All receipts are attached', { required: true }),
      numberField('approvedTotal', 'Approved total', {
        min: 0,
        max: 10_000,
        step: 0.01,
        unit: 'EUR',
        helpText: 'Leave empty to approve the full amount.',
      }),
      textField('note', 'Note to the employee', { multiline: true, maxLength: 500 }),
    ],
    sampleTask(random, _today, form) {
      const employee = person(random);
      const purpose = random.pick(['Customer visit', 'Trade fair', 'Team offsite', 'Conference', 'Training course']);
      return {
        title: `Expense report: ${employee}, ${purpose.toLowerCase()}`,
        values: [
          textValue('purpose', `${purpose} in ${random.pick(['Vienna', 'Graz', 'Munich', 'Zurich', 'Berlin', 'Prague'])}`),
          numberValue('total', round2(random.int(1_500, 450_000) / 100)),
          selectValue('categories', pickOptions(random, form, 'categories', random.int(1, 3))),
        ],
      };
    },
  },
  {
    process: { id: 'process-onboarding', name: 'Employee onboarding' },
    weight: 1,
    form: (today) => [
      textField('employee', 'New employee', { required: true, maxLength: 80 }),
      dateField('startDate', 'Start date', { required: true, min: iso(today) }),
      selectField('equipment', 'Equipment', ['Laptop', 'Phone', 'Monitor', 'Headset', 'Access card'], { multiple: true }),
      selectField('buddy', 'Onboarding buddy', team.map((member) => member.displayName)),
      booleanField('accountsCreated', 'Accounts are set up', { required: true }),
      textField('notes', 'Notes', { multiline: true, maxLength: 1000 }),
    ],
    sampleTask(random, today, form) {
      const employee = person(random);
      return {
        title: `Onboarding: ${employee}`,
        values: [
          textValue('employee', employee),
          dateValue('startDate', today + random.int(5, 40) * DAY),
          selectValue('equipment', pickOptions(random, form, 'equipment', random.int(1, 3))),
        ],
      };
    },
  },
];
