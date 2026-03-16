import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import type { Task, Category } from '@/hooks/useTaskStore';

const protocolCurve = [0.16, 1, 0.3, 1] as const;

interface TaskItemProps {
  task: Task;
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const priorityDot: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function TaskItem({ task, categories, onToggle, onUpdate, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(task.title);
  const isCompleted = task.status === 'completed';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isCompleted;
  const category = categories.find(c => c.id === task.category_id);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editValue.trim()) onUpdate(task.id, { title: editValue.trim() });
      setIsEditing(false);
    }
    if (e.key === 'Escape') { setEditValue(task.title); setIsEditing(false); }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [...protocolCurve] }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-task-hover protocol-transition select-none"
    >
      <button onClick={() => onToggle(task.id)}
        className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border protocol-transition ${isCompleted ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-muted-foreground'}`}>
        {isCompleted && (
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
            <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
          </motion.div>
        )}
      </button>

      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />

      <div className="flex flex-1 items-center gap-3 min-w-0">
        {isEditing ? (
          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
            onBlur={() => { if (editValue.trim()) onUpdate(task.id, { title: editValue.trim() }); setIsEditing(false); }}
            className="flex-1 bg-transparent text-sm text-foreground outline-none" />
        ) : (
          <span onDoubleClick={() => { setIsEditing(true); setEditValue(task.title); }}
            className={`text-sm truncate protocol-transition ${isCompleted ? 'text-task-completed line-through' : 'text-foreground'}`}>
            {task.title}
          </span>
        )}
        {category && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider shrink-0">
            {category.name}
          </span>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 protocol-transition flex items-center gap-2 shrink-0">
        {task.due_date && (
          <span className={`text-[11px] font-mono ${isOverdue ? 'text-priority-urgent' : 'text-muted-foreground'}`}>
            {isOverdue ? 'overdue' : format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        <button onClick={() => onDelete(task.id)} className="text-[11px] font-mono text-muted-foreground hover:text-destructive protocol-transition">⌫</button>
      </div>

      {isOverdue && <span className="text-[11px] font-mono text-priority-urgent shrink-0 group-hover:hidden">overdue</span>}
      {task.due_date && !isOverdue && (
        <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0 group-hover:hidden">
          {format(new Date(task.due_date), 'MMM d')}
        </span>
      )}
    </motion.div>
  );
}
