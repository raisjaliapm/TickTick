import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import { DeleteAllWrapper } from './DeleteAllWrapper';
import type { Task, Category, TaskStatus } from '@/hooks/useTaskStore';

interface TaskListProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onDeleteAll?: () => void;
  onStopRecurrence?: (id: string, endDate: Date) => void;
  onAddCategory?: (name: string) => Promise<void>;
  onUpdateStatus?: (id: string, status: TaskStatus) => void;
}

export function TaskList({ tasks, categories, onToggle, onUpdate, onDelete, onDeleteAll, onStopRecurrence, onAddCategory, onUpdateStatus }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-border rounded-2xl">
        <p className="text-muted-foreground text-sm">All clear. Enjoy the silence.</p>
      </div>
    );
  }

  const handleDeleteAll = () => {
    if (onDeleteAll) {
      onDeleteAll();
    } else {
      tasks.forEach(task => onDelete(task.id));
    }
  };

  return (
    <DeleteAllWrapper taskCount={tasks.length} onDeleteAll={handleDeleteAll}>
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} onAddCategory={onAddCategory} onUpdateStatus={onUpdateStatus} />
          ))}
        </AnimatePresence>
      </div>
    </DeleteAllWrapper>
  );
}
