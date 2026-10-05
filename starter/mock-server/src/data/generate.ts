import type { FormField, Priority, Process, Task, TaskStatus, User } from '../model.ts';
import { createRandom } from '../random.ts';
import { DAY, HOUR, iso, startOfDay } from '../time.ts';
import { processDefinitions } from './processes.ts';
import { team } from './team.ts';

export interface DataSet {
  processes: Process[];
  forms: Map<string, FormField[]>;
  team: User[];
  tasks: Map<string, Task>;
}

export const taskId = (n: number) => `task-${String(n).padStart(4, '0')}`;

/**
 * Builds the full data set from the seed. Dates are relative to the start of the current day (UTC),
 * so the same seed gives the same data all day long.
 */
export function generateDataSet({ seed, taskCount, now }: { seed: number; taskCount: number; now: number }): DataSet {
  const random = createRandom(seed);
  const today = startOfDay(now);
  const forms = new Map(processDefinitions.map((definition) => [definition.process.id, definition.form(today)]));
  const tasks = new Map<string, Task>();

  for (let n = 1; n <= taskCount; n++) {
    const definition = random.weighted(processDefinitions.map((d) => [d, d.weight] as const));
    const form = forms.get(definition.process.id)!;
    const { title, values } = definition.sampleTask(random, today, form);

    const createdAt = today - random.int(1, 30 * 24) * HOUR;
    const status = random.weighted<TaskStatus>([
      ['OPEN', 50],
      ['IN_PROGRESS', 15],
      ['COMPLETED', 25],
      ['CANCELLED', 10],
    ]);
    const priority = random.weighted<Priority>([
      ['LOW', 20],
      ['NORMAL', 50],
      ['HIGH', 22],
      ['URGENT', 8],
    ]);
    const assignee = random.chance(0.75) ? random.pick(team) : null;
    const dueAt = random.chance(0.85) ? iso(startOfDay(createdAt) + random.int(2, 45) * DAY + 17 * HOUR) : null;
    const completed = status === 'COMPLETED';

    tasks.set(taskId(n), {
      id: taskId(n),
      version: completed || status === 'CANCELLED' ? random.int(2, 4) : random.int(1, 3),
      title,
      processId: definition.process.id,
      status,
      priority,
      assignee,
      createdAt: iso(createdAt),
      dueAt,
      completedBy: completed ? random.pick(team) : null,
      completedAt: completed ? iso(createdAt + random.int(1, (today - createdAt) / HOUR) * HOUR) : null,
      values,
    });
  }

  return { processes: processDefinitions.map((d) => d.process), forms, team, tasks };
}
