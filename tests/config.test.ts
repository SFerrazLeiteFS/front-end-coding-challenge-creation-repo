import { describe, expect, it } from 'vitest';
import { configFromEnv, defaultConfig } from '../starter/mock-server/src/index.ts';

describe('configuration from environment', () => {
  it('uses the defaults when nothing is set', () => {
    expect(configFromEnv({})).toEqual(defaultConfig);
  });

  it('reads every option', () => {
    const config = configFromEnv({
      MOCK_PORT: '4100',
      MOCK_SEED: '42',
      MOCK_CHAOS: 'off',
      MOCK_TASK_COUNT: '10000',
      MOCK_LATENCY_MS: '0-50',
      MOCK_UNAVAILABLE_RATE: '0',
      MOCK_INTERNAL_RATE: '1',
      MOCK_PARTIAL_RATE: '0.5',
      MOCK_LOST_RESPONSE_RATE: '0.25',
      MOCK_FOREIGN_EDIT_INTERVAL_MS: '1000',
      MOCK_CORS_ORIGIN: 'http://localhost:3100',
    });

    expect(config).toEqual({
      port: 4100,
      seed: 42,
      chaos: false,
      taskCount: 10000,
      latencyMs: [0, 50],
      unavailableRate: 0,
      internalRate: 1,
      partialRate: 0.5,
      lostResponseRate: 0.25,
      foreignEditIntervalMs: 1000,
      corsOrigin: 'http://localhost:3100',
    });
  });

  it('accepts a single latency value', () => {
    expect(configFromEnv({ MOCK_LATENCY_MS: '500' }).latencyMs).toEqual([500, 500]);
  });

  it.each([
    ['MOCK_SEED', 'abc'],
    ['MOCK_UNAVAILABLE_RATE', '1.5'],
    ['MOCK_LATENCY_MS', '900-100'],
    ['MOCK_LATENCY_MS', 'fast'],
    ['MOCK_TASK_COUNT', '10001'],
    ['MOCK_TASK_COUNT', '0'],
  ])('rejects %s=%s with a clear message', (name, value) => {
    expect(() => configFromEnv({ [name]: value })).toThrow(name);
  });
});
