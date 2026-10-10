export interface ReminderSyncValues {
  title: string;
  dueDate: string | null;
  completed: boolean;
  notes: string;
}

export type SyncWinner = 'ptt' | 'apple' | 'none';

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
}

function sameValues(left: ReminderSyncValues, right: ReminderSyncValues): boolean {
  return left.title === right.title
    && normalizeDate(left.dueDate) === normalizeDate(right.dueDate)
    && left.completed === right.completed
    && left.notes === right.notes;
}

export function getSyncWinner(
  snapshot: ReminderSyncValues,
  ptt: ReminderSyncValues,
  apple: ReminderSyncValues,
): SyncWinner {
  const pttChanged = !sameValues(snapshot, ptt);
  const appleChanged = !sameValues(snapshot, apple);

  if (pttChanged) return 'ptt';
  if (appleChanged) return 'apple';
  return 'none';
}