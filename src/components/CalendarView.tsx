import { useState, useMemo, useCallback } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isToday, addMonths, subMonths, addWeeks, subWeeks,
  getHours, isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Grid3X3, Rows3, Trash2, Plus, Flag, Repeat, Hash, Circle, Clock, Pause, CheckCircle2, X, ListChecks, Link as LinkIcon, FileText, CalendarX2 } from 'lucide-react';
import type { Task, Category, Priority, TaskStatus } from '@/hooks/useTaskStore';
import type { Recurrence } from '@/components/TaskInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { DeleteAllWrapper } from './DeleteAllWrapper';

import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onStopRecurrence?: (id: string, endDate: Date) => void;
  onAdd?: (title: string, priority: Priority, dueDate: string | null, categoryId: string | null, recurrence?: Recurrence, status?: TaskStatus, extras?: { description?: string; notes?: string; urls?: string[]; subtasks?: string[] }) => void;
  onAddCategory?: (name: string) => Promise<void>;
  mode?: 'month' | 'week';
}

const priorityDot: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

const priorityColors: Record<Priority, string> = { low: 'text-priority-low', medium: 'text-priority-medium', high: 'text-priority-high', urgent: 'text-priority-urgent' };

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

const statusConfig: { value: TaskStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { value: 'not_started', label: 'Not Started', icon: Circle, colorClass: 'text-[hsl(var(--status-not-started))]' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, colorClass: 'text-[hsl(var(--status-in-progress))]' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, colorClass: 'text-[hsl(var(--status-on-hold))]' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, colorClass: 'text-[hsl(var(--status-completed))]' },
];

const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: null, label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

// ---------- Inline Add Task Dialog ----------
function CalendarAddTaskDialog({
  open, onOpenChange, date, hour, categories, onAdd, onAddCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  date: Date;
  hour?: number;
  categories: Category[];
  onAdd: CalendarViewProps['onAdd'];
  onAddCategory?: CalendarViewProps['onAddCategory'];
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [dueTime, setDueTime] = useState<string>(() => hour != null ? `${String(hour).padStart(2, '0')}:00` : '');
  const [recurrence, setRecurrence] = useState<Recurrence>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const reset = () => {
    setTitle(''); setPriority('medium'); setStatus('not_started'); setDueTime(hour != null ? `${String(hour).padStart(2, '0')}:00` : '');
    setRecurrence(null); setCategoryId(null); setDescription(''); setNotes('');
    setSubtasks([]); setNewSubtask(''); setUrls([]); setNewUrl('');
    setShowNewCategory(false); setNewCategoryName('');
  };

  const handleSubmit = () => {
    if (!title.trim() || !onAdd) return;
    const dueDateStr = dueTime ? `${format(date, 'yyyy-MM-dd')}T${dueTime}` : format(date, 'yyyy-MM-dd');
    const extras = {
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      urls: urls.length ? urls : undefined,
      subtasks: subtasks.length ? subtasks : undefined,
    };
    onAdd(title.trim(), priority, dueDateStr, categoryId, recurrence, status, extras);
    reset();
    onOpenChange(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const currentStatus = statusConfig.find(s => s.value === status) || statusConfig[0];
  const StatusIcon = currentStatus.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-display">
            New task — {format(date, 'EEE, MMM d, yyyy')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && title.trim()) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Task title..."
            className="w-full bg-surface-well border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
          />

          {/* Priority & Status row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-0.5">Priority</span>
              {(['low', 'medium', 'high', 'urgent'] as Priority[]).map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono capitalize protocol-transition ${priority === p ? `${priorityColors[p]} bg-secondary border border-current/30` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-0.5">Status</span>
            {statusConfig.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${status === s.value ? `${s.colorClass} bg-secondary border border-current/30` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                  <Icon className="h-3 w-3" />{s.label}
                </button>
              );
            })}
          </div>

          {/* Time, Recurrence */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md pl-7 pr-2 py-1 protocol-transition focus:outline-none border-none" />
            </div>
            <div className="flex items-center gap-1">
              <Repeat className="h-3 w-3 text-muted-foreground" />
              {recurrenceOptions.map(r => (
                <button key={r.label} onClick={() => setRecurrence(r.value)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${recurrence === r.value ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-0.5">Category</span>
            <button onClick={() => setCategoryId(null)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${categoryId === null ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
              None
            </button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono protocol-transition ${categoryId === c.id ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                {c.name}
              </button>
            ))}
            {onAddCategory && (
              <button onClick={() => setShowNewCategory(true)}
                className="px-2 py-0.5 rounded text-[11px] font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 protocol-transition">
                + New
              </button>
            )}
          </div>

          {showNewCategory && (
            <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); } }}
                placeholder="Category name..."
                className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md px-2 py-1 focus:outline-none border-none flex-1" />
              <button onClick={handleAddCategory} className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">Add</button>
              <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="text-[11px] font-mono px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 protocol-transition">Cancel</button>
            </div>
          )}

          {/* Description */}
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Add a description..." rows={2}
            className="w-full bg-secondary/50 rounded-md px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground resize-none border border-border" />

          {/* Subtasks */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subtasks</span>
            </div>
            {subtasks.map((st, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-foreground flex-1">{st}</span>
                <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (newSubtask.trim()) { setSubtasks([...subtasks, newSubtask.trim()]); setNewSubtask(''); } }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition" title="Add subtask">
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newSubtask.trim()) { setSubtasks([...subtasks, newSubtask.trim()]); setNewSubtask(''); } } }}
                placeholder="Add a subtask..." className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Links</span>
            </div>
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-primary truncate flex-1">{url}</span>
                <button onClick={() => setUrls(urls.filter((_, idx) => idx !== i))} className="p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (newUrl.trim()) { setUrls([...urls, newUrl.trim()]); setNewUrl(''); } }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition" title="Add URL">
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newUrl.trim()) { setUrls([...urls, newUrl.trim()]); setNewUrl(''); } } }}
                placeholder="Add a URL..." className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</span>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..." rows={3}
              className="w-full bg-secondary/50 rounded-md px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground resize-y border border-border" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSubmit} disabled={!title.trim()} size="sm" className="text-xs">
              <Plus className="h-3 w-3 mr-1" /> Add Task
            </Button>
            <Button onClick={() => { reset(); onOpenChange(false); }} variant="outline" size="sm" className="text-xs">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Editable task chip ----------
function CalendarTaskChip({ task, categories, onToggle, onUpdate, onDelete, onStopRecurrence }: {
  task: Task; categories: Category[]; onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void; onDelete: (id: string) => void;
  onStopRecurrence?: (id: string, endDate: Date) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [open, setOpen] = useState(false);
  const [endRecurrenceOpen, setEndRecurrenceOpen] = useState(false);
  const category = categories.find(c => c.id === task.category_id);

  const handleSave = () => {
    const updates: Partial<Task> = {};
    if (title.trim() && title.trim() !== task.title) updates.title = title.trim();
    if (priority !== task.priority) updates.priority = priority;
    if (Object.keys(updates).length > 0) onUpdate(task.id, updates);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) { setTitle(task.title); setPriority(task.priority); } }}>
      <PopoverTrigger asChild>
        <button
          onClick={e => e.stopPropagation()}
          className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate protocol-transition hover:bg-task-hover flex items-center gap-1 ${task.status === 'completed' ? 'text-task-completed line-through' : 'text-foreground'}`}>
          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />
          <span className="truncate">{task.title}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="start" onClick={e => e.stopPropagation()}>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setOpen(false); }} />
        </div>
        <div>
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1 block">Priority</label>
          <div className="flex gap-1">
            {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
              <button key={p} onClick={() => setPriority(p)}
                className={`text-[10px] px-2 py-1 rounded-md capitalize protocol-transition ${priority === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {category && (
          <div className="text-[10px] font-mono text-muted-foreground">Category: {category.name}</div>
        )}
        {(task as any).recurrence && onStopRecurrence && (
          <div className="pt-1 border-t border-border">
            <Popover open={endRecurrenceOpen} onOpenChange={setEndRecurrenceOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive w-full justify-start">
                  <CalendarX2 className="h-3 w-3 mr-1" /> End recurrence
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
                <div className="p-2 border-b border-border">
                  <span className="text-[11px] font-mono text-muted-foreground">End recurrence after:</span>
                </div>
                <Calendar
                  mode="single"
                  selected={undefined}
                  onSelect={(date) => {
                    if (date) {
                      onStopRecurrence(task.id, date);
                      setEndRecurrenceOpen(false);
                      setOpen(false);
                    }
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => { onDelete(task.id); setOpen(false); }}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { onToggle(task.id); setOpen(false); }}>
              {task.status === 'completed' ? 'Undo' : 'Done'}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CalendarView({ tasks, categories, onToggle, onUpdate, onDelete, onStopRecurrence, onAdd, onAddCategory, mode: initialMode = 'month' }: CalendarViewProps) {
  const [mode, setMode] = useState<'month' | 'week'>(initialMode);
  const [currentDate, setCurrentDate] = useState(new Date());
  const isMobile = useIsMobile();

  // Add-task dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogDate, setAddDialogDate] = useState<Date>(new Date());
  const [addDialogHour, setAddDialogHour] = useState<number | undefined>(undefined);

  const openAddDialog = useCallback((date: Date, hour?: number) => {
    setAddDialogDate(date);
    setAddDialogHour(hour);
    setAddDialogOpen(true);
  }, []);

  // ---------- MONTH helpers ----------
  const monthDays = useMemo(() => {
    if (mode !== 'month') return [];
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    });
  }, [currentDate, mode]);

  // ---------- WEEK helpers ----------
  const weekDays = useMemo(() => {
    if (mode !== 'week') return [];
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    const we = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: ws, end: we });
  }, [currentDate, mode]);

  // Tasks indexed by date key
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.due_date) {
        const key = format(new Date(t.due_date), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    });
    return map;
  }, [tasks]);

  // Navigation
  const prev = () => setCurrentDate(mode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));
  const next = () => setCurrentDate(mode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));

  const headerLabel = mode === 'month'
    ? format(currentDate, 'MMMM yyyy')
    : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;

  const dayHeadersFull = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayHeadersShort = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayHeaders = isMobile ? dayHeadersShort : dayHeadersFull;

  return (
    <div className="overflow-x-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={prev} className="p-1 rounded hover:bg-secondary protocol-transition shrink-0">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={next} className="p-1 rounded hover:bg-secondary protocol-transition shrink-0">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-xs sm:text-sm font-display font-medium text-foreground ml-2 truncate">{headerLabel}</span>
        </div>
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5 shrink-0">
          <button onClick={() => setMode('month')}
            className={`p-1.5 rounded protocol-transition ${mode === 'month' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setMode('week')}
            className={`p-1.5 rounded protocol-transition ${mode === 'week' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Rows3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ========== MONTH VIEW ========== */}
      {mode === 'month' && (
        <>
          <div className="grid grid-cols-7 gap-px mb-1">
            {dayHeaders.map((d, i) => (
              <div key={i} className="text-[10px] font-mono text-muted-foreground text-center py-1 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {monthDays.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(key) || [];
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              const maxVisible = isMobile ? 1 : 3;
              return (
                <div
                  key={key}
                  onClick={() => onAdd && openAddDialog(day)}
                  className={`min-h-[56px] sm:min-h-[80px] p-1 sm:p-1.5 bg-background ${!inMonth ? 'opacity-30' : ''} ${onAdd ? 'cursor-pointer hover:bg-accent/30 protocol-transition' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-[10px] sm:text-[11px] font-mono mb-0.5 sm:mb-1 ${today ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                    {onAdd && (
                      <Plus className="h-3 w-3 text-muted-foreground/30 hover:text-primary protocol-transition" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, maxVisible).map(task => (
                      <CalendarTaskChip key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
                    ))}
                    {dayTasks.length > maxVisible && (
                      <span className="text-[9px] font-mono text-muted-foreground px-1">+{dayTasks.length - maxVisible}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ========== WEEK VIEW ========== */}
      {mode === 'week' && (
        <>
          {/* Mobile: list-based week view */}
          {isMobile ? (
            <div className="space-y-3">
              {weekDays.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDate.get(key) || [];
                const today = isToday(day);
                return (
                  <div key={key} className={`rounded-lg border border-border overflow-hidden ${today ? 'ring-1 ring-primary/30' : ''}`}>
                    <div
                      onClick={() => onAdd && openAddDialog(day)}
                      className={`px-3 py-2 flex items-center justify-between ${today ? 'bg-primary/5' : 'bg-secondary/50'} ${onAdd ? 'cursor-pointer hover:bg-accent/30 protocol-transition' : ''}`}
                    >
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{format(day, 'EEE')}</span>
                        <span className={`text-sm font-display font-medium ml-2 ${today ? 'text-primary' : 'text-foreground'}`}>
                          {format(day, 'MMM d')}
                        </span>
                      </div>
                      {onAdd && <Plus className="h-4 w-4 text-muted-foreground/40" />}
                    </div>
                    <div className="p-2 space-y-0.5 min-h-[40px]">
                      {dayTasks.length === 0 && (
                        <p className="text-[10px] font-mono text-muted-foreground/40 text-center py-2">No tasks</p>
                      )}
                      {dayTasks.map(task => (
                        <CalendarTaskChip key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Unscheduled tasks */}
              {(() => {
                const unscheduled = tasks.filter(t => {
                  if (!t.due_date) return true;
                  const d = new Date(t.due_date);
                  const h = getHours(d);
                  return weekDays.some(day => isSameDay(d, day)) && (h < 6 || h > 21 || h === 0);
                });
                if (unscheduled.length === 0) return null;
                return (
                  <div className="rounded-lg border border-border p-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Unscheduled</p>
                    <div className="space-y-0.5">
                      {unscheduled.slice(0, 10).map(task => (
                        <CalendarTaskChip key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Desktop: grid-based week view */
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Day headers row */}
              <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
                <div className="border-r border-border" />
                {weekDays.map(day => {
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()} className={`text-center py-2 border-r border-border last:border-r-0 ${today ? 'bg-primary/5' : ''}`}>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={`text-sm font-display font-medium ${today ? 'text-primary' : 'text-foreground'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border last:border-b-0">
                    <div className="border-r border-border flex items-start justify-end pr-1.5 pt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground/60">{`${hour.toString().padStart(2, '0')}:00`}</span>
                    </div>
                    {weekDays.map(day => {
                      const key = format(day, 'yyyy-MM-dd');
                      const dayTasks = tasksByDate.get(key) || [];
                      const hourTasks = dayTasks.filter(t => {
                        if (!t.due_date) return false;
                        return getHours(new Date(t.due_date)) === hour;
                      });
                      const today = isToday(day);
                      return (
                        <div
                          key={`${key}-${hour}`}
                          onClick={() => onAdd && openAddDialog(day, hour)}
                          className={`min-h-[48px] border-r border-border last:border-r-0 p-0.5 ${today ? 'bg-primary/[0.02]' : ''} ${onAdd ? 'cursor-pointer hover:bg-accent/20 protocol-transition' : ''}`}
                        >
                          {hourTasks.map(task => (
                            <CalendarTaskChip key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Unscheduled tasks */}
              {(() => {
                const unscheduled = tasks.filter(t => {
                  if (!t.due_date) return true;
                  const d = new Date(t.due_date);
                  const h = getHours(d);
                  return weekDays.some(day => isSameDay(d, day)) && (h < 6 || h > 21 || h === 0);
                });
                if (unscheduled.length === 0) return null;
                return (
                  <div className="border-t border-border p-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Unscheduled</p>
                    <div className="flex flex-wrap gap-1">
                      {unscheduled.slice(0, 10).map(task => (
                        <CalendarTaskChip key={task.id} task={task} categories={categories} onToggle={onToggle} onUpdate={onUpdate} onDelete={onDelete} onStopRecurrence={onStopRecurrence} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Add Task Dialog */}
      {onAdd && (
        <CalendarAddTaskDialog
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          date={addDialogDate}
          hour={addDialogHour}
          categories={categories}
          onAdd={onAdd}
          onAddCategory={onAddCategory}
        />
      )}
    </div>
  );
}
