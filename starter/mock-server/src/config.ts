/**
 * All mock server options. Every option can be set via an environment
 * variable (name in brackets) when starting the server.
 */
export interface MockConfig {
  /** Port of the HTTP server. [MOCK_PORT] */
  port: number;
  /** Seed for the generated data set and all randomised behaviour. [MOCK_SEED] */
  seed: number;
  /** Realistic network conditions and parallel activity. Set to off for stable, immediate responses. [MOCK_CHAOS=on|off] */
  chaos: boolean;
  /** Number of generated tasks. [MOCK_TASK_COUNT] */
  taskCount: number;
  /** Response delay range per operation in ms. [MOCK_LATENCY_MS=min-max] */
  latencyMs: [min: number, max: number];
  /** Share of requests answered with HTTP 503. [MOCK_UNAVAILABLE_RATE] */
  unavailableRate: number;
  /** Share of operations failing with an internal error. [MOCK_INTERNAL_RATE] */
  internalRate: number;
  /** Share of `assignee` fields resolved with an error. [MOCK_PARTIAL_RATE] */
  partialRate: number;
  /** Share of completions answered with HTTP 503 after being saved. [MOCK_LOST_RESPONSE_RATE] */
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

export function configFromEnv(env: Record<string, string | undefined> = process.env): MockConfig {
  const number = (name: string, fallback: number) => {
    const value = env[name];
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    if (Number.isNaN(parsed)) throw new Error(`${name} must be a number, got "${value}"`);
    return parsed;
  };
  const integer = (name: string, fallback: number) => {
    const value = number(name, fallback);
    if (!Number.isInteger(value)) throw new Error(`${name} must be a whole number, got ${value}`);
    return value;
  };
  const onOff = (name: string, fallback: boolean) => {
    const value = env[name]?.toLowerCase();
    if (value === undefined || value === '') return fallback;
    if (value !== 'on' && value !== 'off') throw new Error(`${name} must be "on" or "off", got "${env[name]}"`);
    return value === 'on';
  };
  const rate = (name: string, fallback: number) => {
    const value = number(name, fallback);
    if (value < 0 || value > 1) throw new Error(`${name} must be between 0 and 1, got ${value}`);
    return value;
  };
  const range = (name: string, fallback: [number, number]): [number, number] => {
    const value = env[name];
    if (!value) return fallback;
    const match = /^(\d+)(?:-(\d+))?$/.exec(value);
    if (!match) throw new Error(`${name} must look like "300-1500" or "500", got "${value}"`);
    const min = Number(match[1]);
    const max = Number(match[2] ?? match[1]);
    if (max < min) throw new Error(`${name} max must not be below min, got "${value}"`);
    return [min, max];
  };

  const taskCount = integer('MOCK_TASK_COUNT', defaultConfig.taskCount);
  if (taskCount < 1 || taskCount > MAX_TASK_COUNT) {
    throw new Error(`MOCK_TASK_COUNT must be between 1 and ${MAX_TASK_COUNT}, got ${taskCount}`);
  }

  return {
    port: integer('MOCK_PORT', defaultConfig.port),
    seed: integer('MOCK_SEED', defaultConfig.seed),
    chaos: onOff('MOCK_CHAOS', defaultConfig.chaos),
    taskCount,
    latencyMs: range('MOCK_LATENCY_MS', defaultConfig.latencyMs),
    unavailableRate: rate('MOCK_UNAVAILABLE_RATE', defaultConfig.unavailableRate),
    internalRate: rate('MOCK_INTERNAL_RATE', defaultConfig.internalRate),
    partialRate: rate('MOCK_PARTIAL_RATE', defaultConfig.partialRate),
    lostResponseRate: rate('MOCK_LOST_RESPONSE_RATE', defaultConfig.lostResponseRate),
    foreignEditIntervalMs: integer('MOCK_FOREIGN_EDIT_INTERVAL_MS', defaultConfig.foreignEditIntervalMs),
    corsOrigin: env.MOCK_CORS_ORIGIN ?? defaultConfig.corsOrigin,
  };
}
