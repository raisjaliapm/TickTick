import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';
import { isToday, isPast, isWithinInterval, addDays, startOfDay } from 'date-fns';
import { formatLocalDateTime, parseLocalDate } from '@/lib/dateUtils';

export type Task = Tables<'tasks'> & { recurrence?: string | null };
export type Category = Tables<'categories'>;
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'not_started' | 'in_progress' | 'on_hold' | 'completed';
export type ViewFilter = 'all' | 'today' | 'upcoming' | 'completed' | 'active' | 'in_progress_view' | 'overdue' | 'calendar' | 'kanban' | 'gantt' | 'reports' | 'weekly-reports';

function getNextDueDate(currentDue: string | null, recurrence: string): string {
  const base = currentDue ? new Date(currentDue) : new Date();
  if (recurrence === 'daily') base.setDate(base.getDate() + 1);
  else if (recurrence === 'weekly') base.setDate(base.getDate() + 7);
  else if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
  return formatLocalDateTime(base);
}

function generateFutureInstances(
  baseDue: string,
  recurrence: string,
): string[] {
  const dates: string[] = [];
  let current = new Date(baseDue);
  const endOfYear = new Date(current.getFullYear(), 11, 31, 23, 59, 59);

  while (true) {
    if (recurrence === 'daily') current = new Date(current.getTime() + 86400000);
    else if (recurrence === 'weekly') current = new Date(current.getTime() + 7 * 86400000);
    else if (recurrence === 'monthly') {
      current = new Date(current);
      current.setMonth(current.getMonth() + 1);
    }
    if (current > endOfYear) break;
    dates.push(formatLocalDateTime(current));
  }
  return dates;
}

export function useTaskStore() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>(() => {
    try { const v = localStorage.getItem('ptt-view-filter'); return v ? JSON.parse(v) : 'all'; } catch { return 'all'; }
  });
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => {
    try { const v = localStorage.getItem('ptt-category-filter'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(() => {
    try { const v = localStorage.getItem('ptt-priority-filter'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(() => {
    try { const v = localStorage.getItem('ptt-status-filter'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  // Persist filters to localStorage
  useEffect(() => { try { localStorage.setItem('ptt-view-filter', JSON.stringify(viewFilter)); } catch {} }, [viewFilter]);
  useEffect(() => { try { localStorage.setItem('ptt-category-filter', JSON.stringify(categoryFilter)); } catch {} }, [categoryFilter]);
  useEffect(() => { try { localStorage.setItem('ptt-priority-filter', JSON.stringify(priorityFilter)); } catch {} }, [priorityFilter]);
  useEffect(() => { try { localStorage.setItem('ptt-status-filter', JSON.stringify(statusFilter)); } catch {} }, [statusFilter]);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }).order('created_at', { ascending: false });
    if (data) setTasks(data as Task[]);
  }, [user]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('categories').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (data) setCategories(data);
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      Promise.all([fetchTasks(), fetchCategories()]).finally(() => setLoading(false));
    } else {
      setTasks([]);
      setCategories([]);
      setLoading(false);
    }
  }, [user, fetchTasks, fetchCategories]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, () => {
        fetchTasks();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchTasks]);

  const addTask = useCallback(async (
    title: string,
    priority: Priority = 'medium',
    dueDate: string | null = null,
    categoryId: string | null = null,
    recurrence: string | null = null,
    status: TaskStatus = 'not_started',
    extras?: { description?: string; notes?: string; urls?: string[]; subtasks?: string[]; projectId?: string | null; startDate?: string | null; endDate?: string | null }
  ) => {
    if (!user) return;
    let formattedDueDate: string | null = null;
    if (dueDate) {
      if (dueDate.includes('T')) {
        const d = new Date(dueDate);
        formattedDueDate = formatLocalDateTime(d);
      } else {
        formattedDueDate = formatLocalDateTime(parseLocalDate(dueDate));
      }
    }
    const { data: inserted } = await supabase.from('tasks').insert({
      user_id: user.id,
      title,
      priority,
      due_date: formattedDueDate,
      category_id: categoryId,
      recurrence,
      status,
      description: extras?.description || null,
      notes: extras?.notes || '',
      urls: extras?.urls?.length ? extras.urls : [],
      project_id: extras?.projectId || null,
      start_date: extras?.startDate ? formatLocalDateTime(new Date(extras.startDate + 'T00:00:00')) : null,
      end_date: extras?.endDate ? formatLocalDateTime(new Date(extras.endDate + 'T00:00:00')) : null,
    } as any).select('id').single();

    // Insert subtasks if provided
    if (inserted?.id && extras?.subtasks?.length) {
      const subtaskRows = extras.subtasks.map((st, i) => ({
        task_id: inserted.id,
        user_id: user.id,
        title: st,
        sort_order: i,
      }));
      await supabase.from('subtasks').insert(subtaskRows as any);
    }

    // Auto-generate future recurring instances
    if (recurrence && formattedDueDate) {
      const futureDates = generateFutureInstances(formattedDueDate, recurrence);
      const futureRows = futureDates.map(date => ({
        user_id: user.id,
        title,
        priority,
        due_date: date,
        category_id: categoryId,
        recurrence,
        status: 'not_started',
        description: extras?.description || null,
        notes: extras?.notes || '',
        urls: extras?.urls?.length ? extras.urls : [],
        project_id: extras?.projectId || null,
      }));
      if (futureRows.length > 0) {
        await supabase.from('tasks').insert(futureRows as any);
      }
    }

    await fetchTasks();
    return inserted?.id || null;
  }, [user, fetchTasks]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'not_started' : 'completed';

    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', id);

    await fetchTasks();
  }, [tasks, fetchTasks]);

  const updateTaskStatus = useCallback(async (id: string, status: TaskStatus) => {
    await supabase.from('tasks').update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', id);

    await fetchTasks();
  }, [fetchTasks]);

  const stopRecurrence = useCallback(async (id: string, endDate: Date) => {
    const task = tasks.find(t => t.id === id);
    if (!task || !task.recurrence) return;

    const endDateStr = formatLocalDateTime(endDate);

    // Delete all non-completed instances after the chosen end date
    if (user) {
      await supabase.from('tasks')
        .delete()
        .eq('user_id', user.id)
        .eq('title', task.title)
        .eq('recurrence', task.recurrence)
        .neq('status', 'completed')
        .gt('due_date', endDateStr);
    }

    await fetchTasks();
  }, [tasks, user, fetchTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    await supabase.from('tasks').update(updates as any).eq('id', id);
    await fetchTasks();
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    await fetchTasks();
  }, [fetchTasks]);

  const addCategory = useCallback(async (name: string) => {
    if (!user) return;
    await supabase.from('categories').insert({ user_id: user.id, name });
    await fetchCategories();
  }, [user, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    await supabase.from('tasks').update({ category_id: null } as any).eq('category_id', id);
    await supabase.from('categories').delete().eq('id', id);
    await Promise.all([fetchCategories(), fetchTasks()]);
  }, [fetchCategories, fetchTasks]);

  const filteredTasks = tasks.filter(task => {
    if (statusFilter) {
      if (task.status !== statusFilter) return false;
    } else {
      if (viewFilter === 'completed' && task.status !== 'completed') return false;
      if (viewFilter === 'active' && task.status === 'completed') return false;
      if (viewFilter === 'in_progress_view' && task.status !== 'in_progress') return false;
      if (viewFilter === 'overdue') {
        if (task.status === 'completed') return false;
        if (!task.due_date || !isPast(new Date(task.due_date)) || isToday(new Date(task.due_date))) return false;
      }
      if (viewFilter !== 'completed' && viewFilter !== 'calendar' && viewFilter !== 'in_progress_view' && viewFilter !== 'overdue' && task.status === 'completed') return false;
    }
    if (viewFilter === 'today' && task.due_date) {
      if (!isToday(new Date(task.due_date)) && !isPast(new Date(task.due_date))) return false;
    }
    if (viewFilter === 'today' && !task.due_date) return true;
    if (viewFilter === 'upcoming' && task.due_date) {
      const d = new Date(task.due_date);
      if (!isWithinInterval(d, { start: startOfDay(new Date()), end: addDays(startOfDay(new Date()), 7) })) return false;
    }
    if (categoryFilter && task.category_id !== categoryFilter) return false;
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: tasks.filter(t => t.status !== 'completed').length,
    today: tasks.filter(t => t.status !== 'completed' && t.due_date && (isToday(new Date(t.due_date)) || isPast(new Date(t.due_date)))).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status !== 'completed' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length,
    notStarted: tasks.filter(t => t.status === 'not_started').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    onHold: tasks.filter(t => t.status === 'on_hold').length,
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    categories,
    viewFilter, setViewFilter,
    categoryFilter, setCategoryFilter,
    priorityFilter, setPriorityFilter,
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    addTask, toggleTask, updateTaskStatus, updateTask, deleteTask, stopRecurrence,
    addCategory, deleteCategory, fetchTasks,
    stats,
    loading,
  };
}
