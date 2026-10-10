import { describe, expect, it } from 'vitest';
import { getSyncWinner, type ReminderSyncValues } from '@/lib/appleReminderSync';

const snapshot: ReminderSyncValues = {
  title: 'Prepare release notes',
  dueDate: '2026-10-12T09:00:00.000Z',
  completed: false,
  notes: 'Include mobile changes',
};

describe('Apple Reminders sync conflict selection', () => {
  it('takes the Apple change when only the reminder changed', () => {
    const apple = { ...snapshot, title: 'Prepare final release notes' };
    expect(getSyncWinner(snapshot, snapshot, apple)).toBe('apple');
  });

  it('takes the PTT change when both sides changed', () => {
    const ptt = { ...snapshot, title: 'PTT release notes' };
    const apple = { ...snapshot, title: 'Apple release notes' };
    expect(getSyncWinner(snapshot, ptt, apple)).toBe('ptt');
  });

  it('does not treat equivalent time-zone date strings as a change', () => {
    const apple = { ...snapshot, dueDate: '2026-10-12T11:00:00+02:00' };
    expect(getSyncWinner(snapshot, snapshot, apple)).toBe('none');
  });
});