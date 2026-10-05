export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const iso = (ms: number) => new Date(ms).toISOString();
export const startOfDay = (ms: number) => ms - (ms % DAY);
