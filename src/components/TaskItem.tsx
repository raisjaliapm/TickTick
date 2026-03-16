import React from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, Trash2, X, Save, CalendarDays } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
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

const priorityOptions = ['low', 'medium', 'high', 'urgent'] as const;

export function TaskItem({ task, categories, onToggle, onUpdate, onDelete }: TaskItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(task.title);
  const [editDescription, setEditDescription] = React.useState(task.description || '');
  const [editPriority, setEditPriority] = React.useState(task.priority);
  const [editCategoryId, setEditCategoryId] = React.useState<string | null>(task.category_id);
  const [editDueDate, setEditDueDate] = React.useState<Date | undefined>(task.due_date ? new Date(task.due_date) : undefined);
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const isCompleted = task.status === 'completed';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isCompleted;
  const category = categories.find(c => c.id === task.category_id);

  const openEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditCategoryId(task.category_id);
    setEditDueDate(task.due_date ? new Date(task.due_date) : undefined);
    setIsEditing(true);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      priority: editPriority,
      category_id: editCategoryId,
      due_date: editDueDate ? editDueDate.toISOString() : null,
    });
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [...protocolCurve] }}
        className="rounded-lg border border-border bg-card p-4 space-y-3"
      >
        {/* Title */}
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
          placeholder="Task title"
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />

        {/* Description */}
        <textarea
          value={editDescription}
          onChange={e => setEditDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
          placeholder="Add a description..."
          rows={2}
          className="w-full bg-secondary/50 rounded-md px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground resize-none"
        />

        {/* Priority + Category + Due Date row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Priority</span>
            {priorityOptions.map(p => (
              <button
                key={p}
                onClick={() => setEditPriority(p)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize protocol-transition ${editPriority === p ? `bg-priority-${p}/20 text-foreground border border-priority-${p}/50` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Category */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Category</span>
            <button
              onClick={() => setEditCategoryId(null)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${editCategoryId === null ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
            >
              None
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setEditCategoryId(c.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${editCategoryId === c.id ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Due Date */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 protocol-transition">
                <CalendarDays className="h-3 w-3" />
                {editDueDate ? format(editDueDate, 'MMM d, yyyy') : 'No due date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={editDueDate}
                onSelect={d => { setEditDueDate(d); setCalendarOpen(false); }}
                initialFocus
              />
              {editDueDate && (
                <div className="px-3 pb-3">
                  <button onClick={() => { setEditDueDate(undefined); setCalendarOpen(false); }} className="text-[11px] font-mono text-destructive hover:underline">
                    Clear date
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={saveEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono bg-secondary text-secondary-foreground hover:bg-secondary/80 protocol-transition">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </motion.div>
    );
  }

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
        <span className={`text-sm truncate protocol-transition ${isCompleted ? 'text-task-completed line-through' : 'text-foreground'}`}>
          {task.title}
        </span>
        {category && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider shrink-0">
            {category.name}
          </span>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 protocol-transition flex items-center gap-1.5 shrink-0">
        {task.due_date && (
          <span className={`text-[11px] font-mono mr-1 ${isOverdue ? 'text-priority-urgent' : 'text-muted-foreground'}`}>
            {isOverdue ? 'overdue' : format(new Date(task.due_date), 'MMM d')}
          </span>
        )}
        <button
          onClick={openEdit}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary protocol-transition"
          title="Edit task"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 protocol-transition"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
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
