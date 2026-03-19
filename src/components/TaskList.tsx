import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import { DeleteAllWrapper } from './DeleteAllWrapper';
import { Keyboard } from 'lucide-react';
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
  onEditTask?: (task: Task) => void;
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

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const editShortcut = isMac ? '⌘+E' : 'Alt+E';
  const deleteShortcut = isMac ? '⌘+D' : 'Alt+D';
  const completeShortcut = isMac ? '⌘+C' : 'Alt+C';

  return (
    <DeleteAllWrapper taskCount={tasks.length} onDeleteAll={handleDeleteAll}>
      {/* Column headers - desktop */}
      <div className="hidden sm:flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 mb-1 text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">
        <div className="w-7 shrink-0" /> {/* status */}
        <div className="w-1.5 shrink-0" /> {/* priority dot */}
        <div className="flex-1">Task</div>
        <div className="min-w-[70px] text-center">Start</div>
        <div className="min-w-[70px] text-center">Due</div>
        <div className="min-w-[60px] text-center">Status</div>
        <div className="w-[68px]" /> {/* actions */}
      </div>
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} onAddCategory={onAddCategory} onUpdateStatus={onUpdateStatus} />
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4 text-[11px] font-mono text-muted-foreground/50">
        <span className="flex items-center gap-1.5">
          <Keyboard className="h-3 w-3" />
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">{editShortcut}</kbd>
          <span>Edit</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">{deleteShortcut}</kbd>
          <span>Delete</span>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">{completeShortcut}</kbd>
          <span>Complete</span>
        </span>
      </div>
    </DeleteAllWrapper>
  );
}
