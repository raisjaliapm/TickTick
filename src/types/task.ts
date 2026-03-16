export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'active' | 'completed';

export interface Category {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null; // ISO string
  completedAt: string | null;
  categoryId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type ViewFilter = 'all' | 'today' | 'upcoming' | 'completed';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'Work' },
  { id: 'personal', name: 'Personal' },
  { id: 'health', name: 'Health' },
  { id: 'errands', name: 'Errands' },
];

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
