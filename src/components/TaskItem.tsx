import React from 'react';
import { motion } from 'framer-motion';
import { Check, Pencil, Trash2, X, Save, CalendarDays, Repeat, Hash, Circle, Clock, Pause, CheckCircle2, Plus, Link, FileText, ListChecks } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { formatLocalDateTime } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import type { Task, Category, TaskStatus } from '@/hooks/useTaskStore';
import type { Recurrence } from '@/components/TaskInput';

const protocolCurve = [0.16, 1, 0.3, 1] as const;

interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
}

interface TaskItemProps {
  task: Task;
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddCategory?: (name: string) => Promise<void>;
  onUpdateStatus?: (id: string, status: TaskStatus) => void;
}

const statusOptions: { value: TaskStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { value: 'not_started', label: 'Not Started', icon: Circle, colorClass: 'text-[hsl(var(--status-not-started))]' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, colorClass: 'text-[hsl(var(--status-in-progress))]' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, colorClass: 'text-[hsl(var(--status-on-hold))]' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, colorClass: 'text-[hsl(var(--status-completed))]' },
];

const priorityDot: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

const priorityOptions = ['low', 'medium', 'high', 'urgent'] as const;
const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: null, label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];
const recurrenceLabels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export function TaskItem({ task, categories, onToggle, onUpdate, onDelete, onAddCategory, onUpdateStatus }: TaskItemProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(task.title);
  const [editDescription, setEditDescription] = React.useState(task.description || '');
  const [editPriority, setEditPriority] = React.useState(task.priority);
  const [editCategoryId, setEditCategoryId] = React.useState<string | null>(task.category_id);
  const [editDueDate, setEditDueDate] = React.useState<Date | undefined>(task.due_date ? new Date(task.due_date) : undefined);
  const [editDueTime, setEditDueTime] = React.useState<string>(() => {
    if (!task.due_date) return '';
    const d = new Date(task.due_date);
    const h = d.getHours();
    const m = d.getMinutes();
    return (h === 0 && m === 0) ? '' : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
  const [editRecurrence, setEditRecurrence] = React.useState<Recurrence>((task as any).recurrence || null);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [showNewCategory, setShowNewCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');

  // Subtasks state
  const [subtasks, setSubtasks] = React.useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState('');
  const subtaskInputRef = React.useRef<HTMLInputElement>(null);

  // URL ref
  const urlInputRef = React.useRef<HTMLInputElement>(null);

  // URLs state
  const [editUrls, setEditUrls] = React.useState<string[]>(() => {
    const urls = (task as any).urls;
    return Array.isArray(urls) ? urls : [];
  });
  const [newUrl, setNewUrl] = React.useState('');

  // Notes state
  const [editNotes, setEditNotes] = React.useState<string>((task as any).notes || '');

  const isCompleted = task.status === 'completed';
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && !isCompleted;
  const category = categories.find(c => c.id === task.category_id);
  const taskRecurrence = (task as any).recurrence as string | null;

  const fetchSubtasks = React.useCallback(async () => {
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', task.id).order('sort_order', { ascending: true });
    if (data) setSubtasks(data as any);
  }, [task.id]);

  // Fetch subtasks on mount for indicators
  React.useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const taskUrls: string[] = Array.isArray((task as any).urls) ? (task as any).urls : [];
  const taskNotes: string = (task as any).notes || '';

  const openEdit = () => {
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority);
    setEditCategoryId(task.category_id);
    setEditDueDate(task.due_date ? new Date(task.due_date) : undefined);
    const d = task.due_date ? new Date(task.due_date) : null;
    setEditDueTime(d && (d.getHours() !== 0 || d.getMinutes() !== 0) ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '');
    setEditRecurrence((task as any).recurrence || null);
    setEditUrls(Array.isArray((task as any).urls) ? (task as any).urls : []);
    setEditNotes((task as any).notes || '');
    setIsEditing(true);
    fetchSubtasks();
  };

  const saveEdit = () => {
    if (!editTitle.trim()) return;
    let finalDueDate: string | null = null;
    if (editDueDate) {
      const d = new Date(editDueDate);
      if (editDueTime) {
        const [h, m] = editDueTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      finalDueDate = formatLocalDateTime(d);
    }
    onUpdate(task.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      priority: editPriority,
      category_id: editCategoryId,
      due_date: finalDueDate,
      recurrence: editRecurrence,
      urls: editUrls,
      notes: editNotes.trim(),
    } as any);
    setIsEditing(false);
  };

  const cancelEdit = () => setIsEditing(false);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  // Subtask handlers
  const addSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from('subtasks').insert({
      task_id: task.id,
      user_id: userData.user.id,
      title: newSubtaskTitle.trim(),
      sort_order: subtasks.length,
    } as any);
    setNewSubtaskTitle('');
    fetchSubtasks();
  };

  const toggleSubtask = async (id: string, currentState: boolean) => {
    await supabase.from('subtasks').update({ is_completed: !currentState } as any).eq('id', id);
    fetchSubtasks();
  };

  const deleteSubtask = async (id: string) => {
    await supabase.from('subtasks').delete().eq('id', id);
    fetchSubtasks();
  };

  // URL handlers
  const addUrl = () => {
    if (!newUrl.trim()) return;
    setEditUrls([...editUrls, newUrl.trim()]);
    setNewUrl('');
  };

  const removeUrl = (index: number) => {
    setEditUrls(editUrls.filter((_, i) => i !== index));
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
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') cancelEdit(); }}
          placeholder="Task title"
          className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />

        <textarea
          value={editDescription}
          onChange={e => setEditDescription(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
          placeholder="Add a description..."
          rows={2}
          className="w-full bg-secondary/50 rounded-md px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground resize-none"
        />

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
          <div className="flex items-center gap-1 flex-wrap">
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
            {onAddCategory && (
              <button
                onClick={() => setShowNewCategory(true)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 protocol-transition"
              >
                + New
              </button>
            )}
          </div>
        </div>

        {showNewCategory && (
          <div className="flex items-center gap-2">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <input
              autoFocus
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); } }}
              placeholder="Category name..."
              className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md px-2 py-1 focus:outline-none border-none flex-1"
            />
            <button onClick={handleAddCategory} className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">Add</button>
            <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="text-[11px] font-mono px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 protocol-transition">Cancel</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Due Date */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 protocol-transition">
                <CalendarDays className="h-3 w-3" />
                {editDueDate ? format(editDueDate, 'MMM d, yyyy') : 'No due date'}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
              <Calendar
                mode="single"
                selected={editDueDate}
                onSelect={d => { setEditDueDate(d); setCalendarOpen(false); }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
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

          {/* Due Time */}
          {editDueDate && (
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                type="time"
                value={editDueTime}
                onChange={e => setEditDueTime(e.target.value)}
                className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md pl-7 pr-2 py-1 protocol-transition focus:outline-none border-none"
              />
            </div>
          )}

          {/* Recurrence */}
          <div className="flex items-center gap-1">
            <Repeat className="h-3 w-3 text-muted-foreground" />
            {recurrenceOptions.map(r => (
              <button
                key={r.label}
                onClick={() => setEditRecurrence(r.value)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${editRecurrence === r.value ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Status</span>
          {statusOptions.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => onUpdate(task.id, { status: s.value, completed_at: s.value === 'completed' ? new Date().toISOString() : null } as any)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${task.status === s.value ? `${s.colorClass} bg-secondary border border-current/30` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                <Icon className="h-3 w-3" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Subtasks Section */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subtasks</span>
            {subtasks.length > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                {subtasks.filter(s => s.is_completed).length}/{subtasks.length}
              </span>
            )}
          </div>
          {subtasks.map(st => (
            <div key={st.id} className="flex items-center gap-2 group/subtask">
              <button
                onClick={() => toggleSubtask(st.id, st.is_completed)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border protocol-transition ${st.is_completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'}`}
              >
                {st.is_completed && <Check className="h-2.5 w-2.5 text-primary-foreground stroke-[3]" />}
              </button>
              <span className={`text-xs flex-1 ${st.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {st.title}
              </span>
              <button
                onClick={() => deleteSubtask(st.id)}
                className="opacity-0 group-hover/subtask:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (newSubtaskTitle.trim()) {
                  addSubtask();
                } else {
                  subtaskInputRef.current?.focus();
                }
              }}
              className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition" type="button" title="Add subtask"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
            <input
              ref={subtaskInputRef}
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
              placeholder="Add a subtask..."
              className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            {newSubtaskTitle.trim() && (
              <button onClick={addSubtask} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">
                Add
              </button>
            )}
          </div>
        </div>

        {/* URLs Section */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <Link className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Links</span>
          </div>
          {editUrls.map((url, i) => (
            <div key={i} className="flex items-center gap-2 group/url">
              <Link className="h-3 w-3 text-muted-foreground shrink-0" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">
                {url}
              </a>
              <button
                onClick={() => removeUrl(i)}
                className="opacity-0 group-hover/url:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (newUrl.trim()) {
                  addUrl();
                } else {
                  urlInputRef.current?.focus();
                }
              }}
              className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition" type="button" title="Add URL"
            >
              <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
            <input
              ref={urlInputRef}
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
              placeholder="Add a URL..."
              className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
            />
            {newUrl.trim() && (
              <button onClick={addUrl} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">
                Add
              </button>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</span>
          </div>
          <textarea
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            placeholder="Add notes..."
            rows={4}
            className="w-full bg-secondary/50 rounded-md px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground resize-y min-h-[100px]"
          />
        </div>

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
      className="group flex items-start sm:items-center gap-2 sm:gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border hover:bg-task-hover protocol-transition select-none"
    >
      {/* Status popover */}
      <Popover>
        <PopoverTrigger asChild>
          {(() => {
            const currentStatus = statusOptions.find(s => s.value === task.status) || statusOptions[0];
            const StatusIcon = currentStatus.icon;
            return (
              <button
                className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border protocol-transition ${currentStatus.colorClass} ${isCompleted ? 'bg-[hsl(var(--status-completed))] border-[hsl(var(--status-completed))]' : 'border-current/40 hover:border-current'}`}
                title={`Status: ${currentStatus.label}`}
              >
                {isCompleted ? (
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
                    <Check className="h-3 w-3 text-primary-foreground stroke-[3]" />
                  </motion.div>
                ) : (
                  <StatusIcon className="h-3 w-3" />
                )}
              </button>
            );
          })()}
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1 pointer-events-auto z-50" align="start">
          {statusOptions.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => onUpdateStatus ? onUpdateStatus(task.id, s.value) : onToggle(task.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-mono protocol-transition ${task.status === s.value ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}
              >
                <Icon className={`h-3.5 w-3.5 ${s.colorClass}`} />
                {s.label}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />

      <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
        <span className={`text-sm truncate protocol-transition ${isCompleted ? 'text-task-completed line-through' : 'text-foreground'}`}>
          {task.title}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {category && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider shrink-0">
              {category.name}
            </span>
          )}
          {taskRecurrence && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
              <Repeat className="h-2.5 w-2.5" />
              {recurrenceLabels[taskRecurrence]}
            </span>
          )}
          {(() => {
            const s = statusOptions.find(opt => opt.value === task.status) || statusOptions[0];
            const Icon = s.icon;
            return (
              <span className={`flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary shrink-0 ${s.colorClass}`}>
                <Icon className="h-2.5 w-2.5" />
                {s.label}
              </span>
            );
          })()}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
              <ListChecks className="h-2.5 w-2.5" />
              {subtasks.filter(s => s.is_completed).length}/{subtasks.length}
            </span>
          )}
          {taskUrls.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
              <Link className="h-2.5 w-2.5" />
              {taskUrls.length}
            </span>
          )}
          {taskNotes.trim() && (
            <span className="flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
              <FileText className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
      </div>

      <div className="flex sm:opacity-0 sm:group-hover:opacity-100 protocol-transition items-center gap-1.5 shrink-0">
        {task.due_date && (
          <span className={`text-[11px] font-mono mr-1 ${isOverdue ? 'text-priority-urgent' : 'text-muted-foreground'}`}>
            {isOverdue ? 'overdue' : (() => {
              const d = new Date(task.due_date!);
              const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
              return hasTime ? format(d, 'MMM d, h:mm a') : format(d, 'MMM d');
            })()}
          </span>
        )}
        <button onClick={openEdit} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary protocol-transition" title="Edit task">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => onDelete(task.id)} className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 protocol-transition" title="Delete task">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOverdue && <span className="text-[11px] font-mono text-priority-urgent shrink-0 group-hover:hidden">overdue</span>}
      {task.due_date && !isOverdue && (
        <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0 group-hover:hidden">
          {(() => {
            const d = new Date(task.due_date!);
            const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
            return hasTime ? format(d, 'MMM d, h:mm a') : format(d, 'MMM d');
          })()}
        </span>
      )}
    </motion.div>
  );
}
