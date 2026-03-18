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
export type ViewFilter = 'all' | 'today' | 'upcoming' | 'completed' | 'calendar' | 'reports' | 'weekly-reports';

function getNextDueDate(currentDue: string | null, recurrence: string): string {
  const base = currentDue ? new Date(currentDue) : new Date();
  if (recurrence === 'daily') base.setDate(base.getDate() + 1);
  else if (recurrence === 'weekly') base.setDate(base.getDate() + 7);
  else if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1);
  return formatLocalDateTime(base);
}

export function useTaskStore() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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

  const addTask = useCallback(async (title: string, priority: Priority = 'medium', dueDate: string | null = null, categoryId: string | null = null, recurrence: string | null = null) => {
    if (!user) return;
    await supabase.from('tasks').insert({
      user_id: user.id,
      title,
      priority,
      due_date: dueDate ? formatLocalDateTime(parseLocalDate(dueDate)) : null,
      category_id: categoryId,
      recurrence,
    } as any);
    await fetchTasks();
  }, [user, fetchTasks]);

  const toggleTask = useCallback(async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus = task.status === 'active' ? 'completed' : 'active';

    await supabase.from('tasks').update({
      status: newStatus,
      completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
    }).eq('id', id);

    // If completing a recurring task, create the next occurrence
    if (newStatus === 'completed' && task.recurrence && user) {
      const nextDue = getNextDueDate(task.due_date, task.recurrence);
      await supabase.from('tasks').insert({
        user_id: user.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        category_id: task.category_id,
        due_date: nextDue,
        recurrence: task.recurrence,
      } as any);
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

  const filteredTasks = tasks.filter(task => {
    if (viewFilter === 'completed' && task.status !== 'completed') return false;
    if (viewFilter !== 'completed' && viewFilter !== 'calendar' && task.status === 'completed') return false;
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
    total: tasks.filter(t => t.status === 'active').length,
    today: tasks.filter(t => t.status === 'active' && t.due_date && (isToday(new Date(t.due_date)) || isPast(new Date(t.due_date)))).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'active' && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length,
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    categories,
    viewFilter, setViewFilter,
    categoryFilter, setCategoryFilter,
    priorityFilter, setPriorityFilter,
    searchQuery, setSearchQuery,
    addTask, toggleTask, updateTask, deleteTask,
    addCategory,
    stats,
    loading,
  };
}
