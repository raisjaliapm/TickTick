import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import type { Task, Category, TaskStatus } from '@/hooks/useTaskStore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Trash2 } from 'lucide-react';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (tasks.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-border rounded-2xl">
        <p className="text-muted-foreground text-sm">All clear. Enjoy the silence.</p>
      </div>
    );
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {tasks.map(task => (
                <TaskItem key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} onAddCategory={onAddCategory} onUpdateStatus={onUpdateStatus} />
              ))}
            </AnimatePresence>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete all tasks
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you really want to delete all tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all {tasks.length} visible tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (onDeleteAll) {
                  onDeleteAll();
                } else {
                  tasks.forEach(task => onDelete(task.id));
                }
              }}
            >
              Yes, delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
