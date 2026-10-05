import type { MockConfig } from './config.ts';
import { createRandom } from './random.ts';

export const behaviors = ['unavailable', 'internal', 'partial', 'lost-response', 'slow', 'conflict', 'validation'] as const;
export type Behavior = (typeof behaviors)[number];

export interface Trigger {
  behavior: Behavior;
  /** Operation name or root field the trigger waits for. Any request if not set. */
  operation?: string;
  /** Delay for `slow`. */
  ms?: number;
}

/** What should happen to one request. Resolvers read and update it. */
export interface RequestConditions {
  delayMs: number;
  unavailable: boolean;
  internal: boolean;
  /** Every `assignee` of this request fails. */
  failAssignees: boolean;
  conflict: boolean;
  validation: boolean;
  /** A completion in this request is saved, but answered with HTTP 503. */
  loseResponse: boolean;
  /** Set once a completion was saved, so the response can be replaced. */
  responseLost: boolean;
  /** Rolls the dice for one `assignee` field. */
  assigneeFails(): boolean;
}

/**
 * Decides, per request, whether it is delayed or fails. Random decisions only
 * happen while `config.chaos` is on; triggers always apply.
 */
export function createConditions(config: MockConfig) {
  const random = createRandom(config.seed + 1);
  let triggers: Trigger[] = [];

  const roll = (rate: number) => config.chaos && random.chance(rate);

  function takeTrigger(names: string[]) {
    const index = triggers.findIndex((trigger) => !trigger.operation || names.includes(trigger.operation));
    return index === -1 ? undefined : triggers.splice(index, 1)[0];
  }

  return {
    addTrigger(trigger: Trigger) {
      triggers.push(trigger);
    },
    clearTriggers() {
      triggers = [];
    },
    /** `names`: operation name and root fields of the request. */
    forRequest(names: string[], { isCompletion }: { isCompletion: boolean }): RequestConditions {
      const trigger = takeTrigger(names);
      const is = (behavior: Behavior) => trigger?.behavior === behavior;
      const [min, max] = config.latencyMs;

      return {
        delayMs: is('slow') ? trigger!.ms! : config.chaos ? random.int(min, max) : 0,
        unavailable: is('unavailable') || roll(config.unavailableRate),
        internal: is('internal') || roll(config.internalRate),
        failAssignees: is('partial'),
        conflict: is('conflict'),
        validation: is('validation'),
        loseResponse: is('lost-response') || (isCompletion && roll(config.lostResponseRate)),
        responseLost: false,
        assigneeFails() {
          return this.failAssignees || roll(config.partialRate);
        },
      };
    },
  };
}

export type Conditions = ReturnType<typeof createConditions>;
