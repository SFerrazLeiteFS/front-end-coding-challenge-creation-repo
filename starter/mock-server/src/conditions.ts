import type { MockConfig } from './config.ts';
import { createRandom, type Random } from './random.ts';

export const behaviors = ['unavailable', 'internal', 'partial', 'lost-response', 'slow', 'conflict', 'validation'] as const;
export type Behavior = (typeof behaviors)[number];

/** Behaviours that only make sense for `completeTask`; such a trigger waits for a completion. */
const completionBehaviors: readonly Behavior[] = ['lost-response', 'conflict', 'validation'];

export interface Trigger {
  behavior: Behavior;
  /** Operation name or root field the trigger waits for. Any request if not set. */
  operation?: string;
  /** Delay for `slow`. */
  ms?: number;
}

/** What happens to one request. The HTTP handler and the resolvers read it. */
export interface RequestConditions {
  delayMs: number;
  unavailable: boolean;
  internal: boolean;
  /** Whether an `assignee` field of this request fails. Asked once per field. */
  assigneeFails: () => boolean;
  /** A completion bumps the version first, as if someone else had just changed the task. */
  conflict: boolean;
  /** A completion is rejected with a validation error. */
  validation: boolean;
  /** A saved completion is answered with HTTP 503. */
  loseResponse: boolean;
  /** Set by a saved completion when `loseResponse` is on; the HTTP handler then answers 503. */
  answerUnavailable: boolean;
}

export const noConditions = (): RequestConditions => ({
  delayMs: 0,
  unavailable: false,
  internal: false,
  assigneeFails: () => false,
  conflict: false,
  validation: false,
  loseResponse: false,
  answerUnavailable: false,
});

/**
 * Decides, per request, whether it is delayed or fails. Random decisions only
 * happen while `config.chaos` is on; triggers always apply.
 */
export function createConditions(config: MockConfig) {
  let random: Random = createRandom(config.seed + 1);
  let triggers: Trigger[] = [];

  const roll = (rate: number) => config.chaos && random.chance(rate);

  function takeTrigger(names: string[], isCompletion: boolean) {
    const index = triggers.findIndex(
      (trigger) =>
        (!trigger.operation || names.includes(trigger.operation)) &&
        (isCompletion || !completionBehaviors.includes(trigger.behavior)),
    );
    return index === -1 ? undefined : triggers.splice(index, 1)[0];
  }

  return {
    addTrigger(trigger: Trigger) {
      triggers.push(trigger);
    },
    /** Back to the state after start: no pending triggers, random sequence from the seed again. */
    reset() {
      triggers = [];
      random = createRandom(config.seed + 1);
    },
    /** `names`: operation name and root fields of the request. */
    forRequest(names: string[], { isCompletion }: { isCompletion: boolean }): RequestConditions {
      const trigger = takeTrigger(names, isCompletion);
      const is = (behavior: Behavior) => trigger?.behavior === behavior;
      const [min, max] = config.latencyMs;
      const allAssigneesFail = is('partial');

      return {
        delayMs: is('slow') ? trigger!.ms! : config.chaos ? random.int(min, max) : 0,
        unavailable: is('unavailable') || roll(config.unavailableRate),
        internal: is('internal') || roll(config.internalRate),
        assigneeFails: () => allAssigneesFail || roll(config.partialRate),
        conflict: is('conflict'),
        validation: is('validation'),
        loseResponse: is('lost-response') || (isCompletion && roll(config.lostResponseRate)),
        answerUnavailable: false,
      };
    },
  };
}

export type Conditions = ReturnType<typeof createConditions>;
