import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorCalendar, type Reminder, type RemindersList } from '@ebarooni/capacitor-calendar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/hooks/useTaskStore';
import { getSyncWinner, type ReminderSyncValues } from '@/lib/appleReminderSync';

interface SyncSettings {
  reminders_list_id: string;
  reminders_list_title: string;
}

function toIsoDate(milliseconds: number | null): string | null {
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function taskValues(task: Task): ReminderSyncValues {
  return {
    title: task.title,
    dueDate: task.due_date,
    completed: task.status === 'completed',
    notes: task.notes ?? '',
  };
}

function reminderValues(reminder: Reminder): ReminderSyncValues {
  return {
    title: reminder.title ?? '',
    dueDate: toIsoDate(reminder.dueDate),
    completed: reminder.isCompleted,
    notes: reminder.notes ?? '',
  };
}

function snapshotValues(mapping: {
  last_synced_title: string | null;
  last_synced_due_date: string | null;
  last_synced_completed: boolean;
  last_synced_notes: string;
}): ReminderSyncValues {
  return {
    title: mapping.last_synced_title ?? '',
    dueDate: mapping.last_synced_due_date,
    completed: mapping.last_synced_completed,
    notes: mapping.last_synced_notes,
  };
}

function reminderPriority(priority: string): number {
  if (priority === 'urgent') return 1;
  if (priority === 'high') return 3;
  if (priority === 'low') return 8;
  return 5;
}

function taskPriority(priority: number | null): string {
  if (priority !== null && priority <= 2) return 'urgent';
  if (priority !== null && priority <= 4) return 'high';
  if (priority !== null && priority >= 7) return 'low';
  return 'medium';
}

function storedSnapshot(values: ReminderSyncValues) {
  return {
    last_synced_title: values.title,
    last_synced_due_date: values.dueDate,
    last_synced_completed: values.completed,
    last_synced_notes: values.notes,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useAppleRemindersSync(tasks: Task[], fetchTasks: () => Promise<void>, ready: boolean) {
  const { user } = useAuth();
  const supported = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [lists, setLists] = useState<RemindersList[]>([]);
  const [loading, setLoading] = useState(supported);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncLock = useRef(false);
  const tasksRef = useRef(tasks);
  const runSyncRef = useRef<(listId?: string, userId?: string) => Promise<boolean>>(async () => false);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!supported || !user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase.from('apple_reminder_sync_settings').select('reminders_list_id, reminders_list_title').eq('user_id', user.id).maybeSingle()
      .then(({ data, error: settingsError }) => {
        if (cancelled) return;
        if (settingsError) setError('Could not load your Apple Reminders connection.');
        setSettings(data);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [supported, user]);

  const loadLists = useCallback(async () => {
    if (!supported) return [];
    setError(null);
    const permission = await CapacitorCalendar.requestFullRemindersAccess();
    if (permission.result !== 'granted') throw new Error('Allow PTT to access Apple Reminders to continue.');
    const result = await CapacitorCalendar.getRemindersLists();
    setLists(result.result);
    return result.result;
  }, [supported]);

  const runSync = useCallback(async (overrideListId?: string, overrideUserId?: string) => {
    const userId = overrideUserId ?? user?.id;
    const listId = overrideListId ?? settings?.reminders_list_id;
    if (!supported || !userId || !listId || syncLock.current) return false;
    syncLock.current = true;
    setSyncing(true);
    setError(null);
    try {
      const permission = await CapacitorCalendar.requestFullRemindersAccess();
      if (permission.result !== 'granted') throw new Error('Allow PTT to access Apple Reminders to sync.');
      const [nativeResult, mappingsResult] = await Promise.all([
        CapacitorCalendar.getRemindersFromLists({ listIds: [listId] }),
        supabase.from('apple_reminder_task_sync').select('*').eq('user_id', userId).eq('reminders_list_id', listId).eq('ignored', false),
      ]);
      if (mappingsResult.error) throw mappingsResult.error;

      const nativeReminders = nativeResult.result;
      const reminderById = new Map(nativeReminders.map(reminder => [reminder.id, reminder]));
      const currentTasks = tasksRef.current;
      const taskById = new Map(currentTasks.map(task => [task.id, task]));
      const mappings = mappingsResult.data ?? [];
      const linkedTaskIds = new Set(mappings.map(mapping => mapping.task_id).filter((id): id is string => id !== null));
      const linkedReminderIds = new Set(mappings.map(mapping => mapping.reminder_id));

      for (const mapping of mappings) {
        const task = mapping.task_id ? taskById.get(mapping.task_id) : undefined;
        const reminder = reminderById.get(mapping.reminder_id);
        if (!reminder) {
          if (task) await supabase.from('tasks').delete().eq('id', task.id).eq('user_id', userId);
          await supabase.from('apple_reminder_task_sync').delete().eq('id', mapping.id).eq('user_id', userId);
          continue;
        }
        if (!task) {
          await CapacitorCalendar.deleteReminder({ id: reminder.id });
          await supabase.from('apple_reminder_task_sync').delete().eq('id', mapping.id).eq('user_id', userId);
          continue;
        }

        const currentTaskValues = taskValues(task);
        const currentReminderValues = reminderValues(reminder);
        const winner = getSyncWinner(snapshotValues(mapping), currentTaskValues, currentReminderValues);
        if (winner === 'ptt') {
          const dueMilliseconds = currentTaskValues.dueDate ? Date.parse(currentTaskValues.dueDate) : null;
          await CapacitorCalendar.modifyReminder({
            id: reminder.id,
            title: currentTaskValues.title,
            dueDate: dueMilliseconds,
            startDate: dueMilliseconds,
            isCompleted: currentTaskValues.completed,
            completionDate: currentTaskValues.completed ? undefined : null,
            notes: currentTaskValues.notes,
            priority: reminderPriority(task.priority),
          });
          await supabase.from('apple_reminder_task_sync').update(storedSnapshot(currentTaskValues)).eq('id', mapping.id).eq('user_id', userId);
        } else if (winner === 'apple') {
          const updates = {
            title: currentReminderValues.title,
            due_date: currentReminderValues.dueDate,
            status: currentReminderValues.completed ? 'completed' : task.status === 'completed' ? 'not_started' : task.status,
            completed_at: currentReminderValues.completed ? toIsoDate(reminder.completionDate) ?? new Date().toISOString() : null,
            notes: currentReminderValues.notes,
            priority: taskPriority(reminder.priority),
          };
          const { error: updateError } = await supabase.from('tasks').update(updates).eq('id', task.id).eq('user_id', userId);
          if (updateError) throw updateError;
          await supabase.from('apple_reminder_task_sync').update(storedSnapshot(currentReminderValues)).eq('id', mapping.id).eq('user_id', userId);
        }
      }

      const latestMappings = await supabase.from('apple_reminder_task_sync').select('reminder_id, task_id').eq('user_id', userId).eq('reminders_list_id', listId).eq('ignored', false);
      if (latestMappings.error) throw latestMappings.error;
      const knownReminderIds = new Set((latestMappings.data ?? []).map(mapping => mapping.reminder_id));
      const knownTaskIds = new Set((latestMappings.data ?? []).map(mapping => mapping.task_id).filter((id): id is string => id !== null));

      for (const task of tasksRef.current) {
        if (knownTaskIds.has(task.id)) continue;
        const values = taskValues(task);
        const dueMilliseconds = values.dueDate ? Date.parse(values.dueDate) : undefined;
        const created = await CapacitorCalendar.createReminder({
          title: values.title,
          listId,
          dueDate: dueMilliseconds,
          startDate: dueMilliseconds,
          isCompleted: values.completed,
          notes: values.notes,
          priority: reminderPriority(task.priority),
        });
        const { error: mappingError } = await supabase.from('apple_reminder_task_sync').upsert({
          user_id: userId,
          task_id: task.id,
          reminder_id: created.id,
          reminders_list_id: listId,
          ...storedSnapshot(values),
        }, { onConflict: 'user_id,reminder_id' });
        if (mappingError) throw mappingError;
        knownTaskIds.add(task.id);
        knownReminderIds.add(created.id);
      }

      for (const reminder of nativeReminders) {
        if (knownReminderIds.has(reminder.id)) continue;
        const values = reminderValues(reminder);
        const { data: insertedTask, error: taskError } = await supabase.from('tasks').insert({
          user_id: userId,
          title: values.title || 'New reminder',
          due_date: values.dueDate,
          status: values.completed ? 'completed' : 'not_started',
          completed_at: values.completed ? toIsoDate(reminder.completionDate) ?? new Date().toISOString() : null,
          notes: values.notes,
          priority: taskPriority(reminder.priority),
        }).select('id').single();
        if (taskError) throw taskError;
        const { error: mappingError } = await supabase.from('apple_reminder_task_sync').upsert({
          user_id: userId,
          task_id: insertedTask.id,
          reminder_id: reminder.id,
          reminders_list_id: listId,
          ...storedSnapshot(values),
        }, { onConflict: 'user_id,reminder_id' });
        if (mappingError) throw mappingError;
        knownReminderIds.add(reminder.id);
      }

      await fetchTasks();
      return true;
    } catch (syncError) {
      console.error('Apple Reminders sync failed:', syncError);
      setError(syncError instanceof Error ? syncError.message : 'Could not sync Apple Reminders.');
      return false;
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  }, [fetchTasks, settings?.reminders_list_id, supported, user]);
  runSyncRef.current = runSync;

  const chooseList = useCallback(async (list: RemindersList) => {
    if (!user) return false;
    const { error: saveError } = await supabase.from('apple_reminder_sync_settings').upsert({
      user_id: user.id,
      reminders_list_id: list.id,
      reminders_list_title: list.title ?? 'Reminders',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (saveError) {
      setError('Could not save the selected Reminders list.');
      return false;
    }
    setSettings({ reminders_list_id: list.id, reminders_list_title: list.title ?? 'Reminders' });
    setDialogOpen(false);
    await runSync(list.id, user.id);
    return true;
  }, [runSync, user]);

  const openListPicker = useCallback(async () => {
    setDialogOpen(true);
    try {
      const availableLists = await loadLists();
      if (availableLists.length === 0) setError('No Apple Reminders lists are available.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not access Apple Reminders.');
    }
  }, [loadLists]);

  useEffect(() => {
    if (!ready || !supported || !settings || !user || !tasks.length && loading) return;
    const timer = window.setTimeout(() => { void runSync(); }, 700);
    return () => window.clearTimeout(timer);
  }, [ready, supported, settings, user, tasks, loading, runSync]);

  useEffect(() => {
    if (!supported || !settings || !user) return;
    let active = true;
    let listener: { remove: () => Promise<void> } | undefined;
    App.addListener('resume', () => { void runSyncRef.current(); }).then(handle => {
      listener = handle;
      if (!active) void handle.remove();
    }).catch(() => undefined);
    return () => {
      active = false;
      if (listener) void listener.remove();
    };
  }, [supported, settings, user]);

  return {
    supported,
    connected: Boolean(settings),
    listTitle: settings?.reminders_list_title ?? null,
    selectedListId: settings?.reminders_list_id ?? '',
    lists,
    loading,
    syncing,
    dialogOpen,
    setDialogOpen,
    error,
    openListPicker,
    chooseList,
    syncNow: () => runSync(),
  };
}