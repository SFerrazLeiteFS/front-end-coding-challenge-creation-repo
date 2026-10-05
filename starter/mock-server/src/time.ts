export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const iso = (ms: number) => new Date(ms).toISOString();
export const startOfDay = (ms: number) => ms - (ms % DAY);

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Milliseconds for an ISO 8601 date-time with time zone (e.g. `2026-03-10T17:00:00Z`), or null if it isn't one. */
export function parseDateTime(value: string): number | null {
  const match = DATE_TIME.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '00'] = match.map(Number) as number[];
  const ms = Date.parse(value);
  const calendar = new Date(Date.UTC(year!, month! - 1, day!));
  const validDate = calendar.getUTCMonth() === month! - 1 && calendar.getUTCDate() === day!;
  if (Number.isNaN(ms) || !validDate || hour! > 23 || minute! > 59 || Number(second) > 59) return null;
  return ms;
}
