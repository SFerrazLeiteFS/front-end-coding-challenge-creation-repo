/** Small seeded random number generator (mulberry32), so the same seed always gives the same sequence. */
export interface Random {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Picks by weight: `[[value, weight], ...]`. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
  /** Distinct random subset of the given size. */
  sample<T>(items: readonly T[], count: number): T[];
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const random: Random = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: (items) => items[Math.floor(next() * items.length)]!,
    weighted(items) {
      const total = items.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      for (const [value, weight] of items) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return items[items.length - 1]![0];
    },
    sample(items, count) {
      const pool = [...items];
      const result = [];
      while (result.length < count && pool.length > 0) {
        result.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
      }
      return result;
    },
  };
  return random;
}
