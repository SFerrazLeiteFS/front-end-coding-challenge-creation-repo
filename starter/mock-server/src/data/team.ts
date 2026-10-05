import type { User } from '../model.ts';

/** The people working on tasks. Their IDs match the viewer for tokens like `alex.berger`. */
export const team: User[] = ['Alex Berger', 'Jamie Novak', 'Morgan Fischer', 'Riley Weiss', 'Taylor Kim'].map(
  (displayName) => ({ id: `user-${displayName.toLowerCase().replace(' ', '.')}`, displayName }),
);
