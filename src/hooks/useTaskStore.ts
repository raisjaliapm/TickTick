import { useState, useEffect, useCallback } from 'react';
import type { Task, Category, Priority, ViewFilter, TaskStatus } from '@/types/task';
import { DEFAULT_CATEGORIES } from '@/types/task';
import { isToday, isFuture, isPast, isWithinInterval, addDays, startOfDay } from 'date-fns';

const STORAGE_KEY = 'protocol-tasks';
const CATEGORIES_KEY = 'protocol-categories';

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
  } catch { return DEFAULT_CATEGORIES; }
}

function saveCategories(categories: Category[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [categories, setCategories] = useState<Category[]>(loadCategories);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveCategories(categories); }, [categories]);

  const addTask = useCallback((title: string, priority: Priority = 'medium', dueDate: string | null = null, categoryId: string | null = null) => {
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      description: '',
      status: 'active',
      priority,
      dueDate,
      completedAt: null,
      categoryId,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    };
    setTasks(prev => [task, ...prev]);
    return task;
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newStatus: TaskStatus = t.status === 'active' ? 'completed' : 'active';
      return {
        ...t,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
    }));
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    ));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const reorderTasks = useCallback((reordered: Task[]) => {
    setTasks(reordered);
  }, []);

  const addCategory = useCallback((name: string) => {
    const cat: Category = { id: crypto.randomUUID(), name };
    setCategories(prev => [...prev, cat]);
    return cat;
  }, []);

  const filteredTasks = tasks.filter(task => {
    // View filter
    if (viewFilter === 'completed' && task.status !== 'completed') return false;
    if (viewFilter !== 'completed' && task.status === 'completed') return false;
    if (viewFilter === 'today' && task.dueDate) {
      if (!isToday(new Date(task.dueDate)) && !isPast(new Date(task.dueDate))) return false;
    }
    if (viewFilter === 'today' && !task.dueDate) return true; // show undated in today
    if (viewFilter === 'upcoming' && task.dueDate) {
      const d = new Date(task.dueDate);
      if (!isWithinInterval(d, { start: startOfDay(new Date()), end: addDays(startOfDay(new Date()), 7) })) return false;
    }

    // Category filter
    if (categoryFilter && task.categoryId !== categoryFilter) return false;

    // Priority filter
    if (priorityFilter && task.priority !== priorityFilter) return false;

    // Search
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;

    return true;
  });

  const stats = {
    total: tasks.filter(t => t.status === 'active').length,
    today: tasks.filter(t => t.status === 'active' && t.dueDate && (isToday(new Date(t.dueDate)) || isPast(new Date(t.dueDate)))).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'active' && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length,
  };

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    categories,
    viewFilter, setViewFilter,
    categoryFilter, setCategoryFilter,
    priorityFilter, setPriorityFilter,
    searchQuery, setSearchQuery,
    addTask, toggleTask, updateTask, deleteTask, reorderTasks,
    addCategory,
    stats,
  };
}
