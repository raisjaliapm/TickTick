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
  onCreateTask?: (date: Date, hour?: number) => void;
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
          className={`w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate protocol-transition hover:bg-task-hover flex items-center gap-1 ${task.status === 'completed' ? 'text-task-completed line-through' : task.status === 'not_started' ? 'text-destructive bg-destructive/10' : 'text-foreground'}`}>
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

export function CalendarView({ tasks, categories, onToggle, onUpdate, onDelete, onStopRecurrence, onCreateTask, mode: initialMode = 'month' }: CalendarViewProps) {
  const [mode, setMode] = useState<'month' | 'week'>(initialMode);
  const [currentDate, setCurrentDate] = useState(new Date());
  const isMobile = useIsMobile();

  const openAddDialog = useCallback((date: Date, hour?: number) => {
    if (onCreateTask) onCreateTask(date, hour);
  }, [onCreateTask]);

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
    <DeleteAllWrapper taskCount={tasks.length} onDeleteAll={() => tasks.forEach(t => onDelete(t.id))}>
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
                  onClick={() => onCreateTask && openAddDialog(day)}
                  className={`min-h-[56px] sm:min-h-[80px] p-1 sm:p-1.5 bg-background ${!inMonth ? 'opacity-30' : ''} ${onCreateTask ? 'cursor-pointer hover:bg-accent/30 protocol-transition' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`text-[10px] sm:text-[11px] font-mono mb-0.5 sm:mb-1 ${today ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                    {onCreateTask && (
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
                      onClick={() => onCreateTask && openAddDialog(day)}
                      className={`px-3 py-2 flex items-center justify-between ${today ? 'bg-primary/5' : 'bg-secondary/50'} ${onCreateTask ? 'cursor-pointer hover:bg-accent/30 protocol-transition' : ''}`}
                    >
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{format(day, 'EEE')}</span>
                        <span className={`text-sm font-display font-medium ml-2 ${today ? 'text-primary' : 'text-foreground'}`}>
                          {format(day, 'MMM d')}
                        </span>
                      </div>
                      {onCreateTask && <Plus className="h-4 w-4 text-muted-foreground/40" />}
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
                          onClick={() => onCreateTask && openAddDialog(day, hour)}
                          className={`min-h-[48px] border-r border-border last:border-r-0 p-0.5 ${today ? 'bg-primary/[0.02]' : ''} ${onCreateTask ? 'cursor-pointer hover:bg-accent/20 protocol-transition' : ''}`}
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

      {/* Task creation now handled by parent TaskModal */}
    </div>
    </DeleteAllWrapper>
  );
}
