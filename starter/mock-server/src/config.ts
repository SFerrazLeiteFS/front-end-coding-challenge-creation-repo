/**
 * All mock server options. Every option can be set via an environment
 * variable (name in brackets) when starting the server. Options marked
 * "runtime" can also be changed while running via `POST /__mock/config`
 * with a JSON body using the same names, e.g. `{ "MOCK_LATENCY_MS": "0-100" }`.
 */
export interface MockConfig {
  /** Port of the HTTP server. [MOCK_PORT] */
  port: number;
  /** Seed for the generated data set and all randomised behaviour. [MOCK_SEED] */
  seed: number;
  /** Realistic network conditions and parallel activity. Set to off for stable, immediate responses. [MOCK_CHAOS=on|off, runtime] */
  chaos: boolean;
  /** Number of generated tasks. [MOCK_TASK_COUNT] */
  taskCount: number;
  /** Response delay range per operation in ms. [MOCK_LATENCY_MS=min-max, runtime] */
  latencyMs: [min: number, max: number];
  /** Share of requests answered with HTTP 503. [MOCK_UNAVAILABLE_RATE, runtime] */
  unavailableRate: number;
  /** Share of operations failing with an internal error. [MOCK_INTERNAL_RATE, runtime] */
  internalRate: number;
  /** Share of `assignee` fields resolved with an error. [MOCK_PARTIAL_RATE, runtime] */
  partialRate: number;
  /** Share of completions answered with HTTP 503 after being saved. [MOCK_LOST_RESPONSE_RATE, runtime] */
  lostResponseRate: number;
  /** Interval in ms in which a colleague works on a task. [MOCK_FOREIGN_EDIT_INTERVAL_MS] */
  foreignEditIntervalMs: number;
  /** Browser origin allowed to call the server. [MOCK_CORS_ORIGIN] */
  corsOrigin: string;
}

export const defaultConfig: MockConfig = {
  port: 4000,
  seed: 1,
  chaos: true,
  taskCount: 250,
  latencyMs: [300, 1500],
  unavailableRate: 0.05,
  internalRate: 0.02,
  partialRate: 0.03,
  lostResponseRate: 0.02,
  foreignEditIntervalMs: 8000,
  corsOrigin: 'http://localhost:3000',
};

export const MAX_TASK_COUNT = 10_000;

type Parser<T> = (name: string, value: unknown) => T;

function number(name: string, value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'boolean' || value === '' || Number.isNaN(parsed)) {
    throw new Error(`${name} must be a number, got "${value}"`);
  }
  return parsed;
}

function integer(name: string, value: unknown) {
  const parsed = number(name, value);
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be a whole number, got ${parsed}`);
  return parsed;
}

const rate: Parser<number> = (name, value) => {
  const parsed = number(name, value);
  if (parsed < 0 || parsed > 1) throw new Error(`${name} must be between 0 and 1, got ${parsed}`);
  return parsed;
};

const onOff: Parser<boolean> = (name, value) => {
  const text = String(value).toLowerCase();
  if (text !== 'on' && text !== 'off') throw new Error(`${name} must be "on" or "off", got "${value}"`);
  return text === 'on';
};

const range: Parser<[number, number]> = (name, value) => {
  const match = /^(\d+)(?:-(\d+))?$/.exec(String(value));
  if (!match) throw new Error(`${name} must look like "300-1500" or "500", got "${value}"`);
  const min = Number(match[1]);
  const max = Number(match[2] ?? match[1]);
  if (max < min) throw new Error(`${name} max must not be below min, got "${value}"`);
  return [min, max];
};

const taskCount: Parser<number> = (name, value) => {
  const parsed = integer(name, value);
  if (parsed < 1 || parsed > MAX_TASK_COUNT) throw new Error(`${name} must be between 1 and ${MAX_TASK_COUNT}, got ${parsed}`);
  return parsed;
};

interface Setting<K extends keyof MockConfig> {
  key: K;
  parse: Parser<MockConfig[K]>;
  format: (value: MockConfig[K]) => string | number;
  runtime: boolean;
}

const setting = <K extends keyof MockConfig>(
  key: K,
  parse: Parser<MockConfig[K]>,
  runtime = false,
  format: (value: MockConfig[K]) => string | number = (value) => value as string | number,
): Setting<K> => ({ key, parse, format, runtime });

/** Environment variable name → option. */
const settings: Record<string, Setting<keyof MockConfig>> = {
  MOCK_PORT: setting('port', integer),
  MOCK_SEED: setting('seed', integer),
  MOCK_CHAOS: setting('chaos', onOff, true, (on) => (on ? 'on' : 'off')),
  MOCK_TASK_COUNT: setting('taskCount', taskCount),
  MOCK_LATENCY_MS: setting('latencyMs', range, true, ([min, max]) => `${min}-${max}`),
  MOCK_UNAVAILABLE_RATE: setting('unavailableRate', rate, true),
  MOCK_INTERNAL_RATE: setting('internalRate', rate, true),
  MOCK_PARTIAL_RATE: setting('partialRate', rate, true),
  MOCK_LOST_RESPONSE_RATE: setting('lostResponseRate', rate, true),
  MOCK_FOREIGN_EDIT_INTERVAL_MS: setting('foreignEditIntervalMs', integer),
  MOCK_CORS_ORIGIN: setting('corsOrigin', (_, value) => String(value)),
} as Record<string, Setting<keyof MockConfig>>;

export function configFromEnv(env: Record<string, string | undefined> = process.env): MockConfig {
  const config: MockConfig = { ...defaultConfig, latencyMs: [...defaultConfig.latencyMs] };
  for (const [name, { key, parse }] of Object.entries(settings)) {
    const value = env[name];
    if (value !== undefined && value !== '') Object.assign(config, { [key]: parse(name, value) });
  }
  return config;
}

/** Parses a runtime change, e.g. `{ "MOCK_UNAVAILABLE_RATE": 0.5 }`. Throws for unknown or start-only options. */
export function runtimeChanges(body: Record<string, unknown>): Partial<MockConfig> {
  const changes: Partial<MockConfig> = {};
  for (const [name, value] of Object.entries(body)) {
    const option = settings[name];
    if (!option) throw new Error(`Unknown option ${name}`);
    if (!option.runtime) throw new Error(`${name} can only be set when starting the server`);
    Object.assign(changes, { [option.key]: option.parse(name, value) });
  }
  return changes;
}

/** The options under their environment variable names. */
export function describeConfig(config: MockConfig) {
  return Object.fromEntries(
    Object.entries(settings).map(([name, option]) => [name, option.format(config[option.key] as never)]),
  );
}
