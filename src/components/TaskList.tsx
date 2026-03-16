import { AnimatePresence } from 'framer-motion';
import { TaskItem } from './TaskItem';
import type { Task, Category } from '@/hooks/useTaskStore';

interface TaskListProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskList({ tasks, categories, onToggle, onUpdate, onDelete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-border rounded-2xl">
        <p className="text-muted-foreground text-sm">All clear. Enjoy the silence.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <AnimatePresence mode="popLayout">
        {tasks.map(task => (
          <TaskItem key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </AnimatePresence>
    </div>
  );
}
