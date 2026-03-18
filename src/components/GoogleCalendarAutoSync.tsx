import { useEffect, useRef } from 'react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import type { Task } from '@/hooks/useTaskStore';

interface GoogleCalendarAutoSyncProps {
  tasks: Task[];
}

/**
 * Invisible component that auto-syncs tasks with Google Calendar.
 * When a task with a due date is added/updated/deleted and Google Calendar 
 * is connected, it syncs automatically.
 */
export function GoogleCalendarAutoSync({ tasks }: GoogleCalendarAutoSyncProps) {
  const { isConnected, syncTask } = useGoogleCalendar();
  const prevTasksRef = useRef<Task[]>([]);

  useEffect(() => {
    if (!isConnected) return;

    const prevTasks = prevTasksRef.current;
    const prevMap = new Map(prevTasks.map(t => [t.id, t]));
    const currentMap = new Map(tasks.map(t => [t.id, t]));

    // Find new tasks (in current but not in prev)
    for (const task of tasks) {
      const prev = prevMap.get(task.id);
      if (!prev && task.due_date) {
        // New task with due date — create event
        syncTask('create', task);
      } else if (prev) {
        // Check if task was updated in relevant ways
        const changed =
          prev.title !== task.title ||
          prev.due_date !== task.due_date ||
          prev.description !== task.description ||
          prev.status !== task.status;

        if (changed && (task.due_date || (task as any).google_calendar_event_id)) {
          syncTask('update', task);
        }
      }
    }

    // Find deleted tasks (in prev but not in current)
    for (const prev of prevTasks) {
      if (!currentMap.has(prev.id) && (prev as any).google_calendar_event_id) {
        syncTask('delete', prev);
      }
    }

    prevTasksRef.current = tasks;
  }, [tasks, isConnected, syncTask]);

  return null;
}
