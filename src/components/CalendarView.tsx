import { useState, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, isToday, addMonths, subMonths, addWeeks, subWeeks,
  getHours, isSameDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Grid3X3, Rows3, Trash2 } from 'lucide-react';
import type { Task, Category } from '@/hooks/useTaskStore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CalendarViewProps {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  mode?: 'month' | 'week';
}

const priorityDot: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 – 21:00

export function CalendarView({ tasks, categories, onToggle, mode: initialMode = 'month' }: CalendarViewProps) {
  const [mode, setMode] = useState<'month' | 'week'>(initialMode);
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button onClick={prev} className="p-1 rounded hover:bg-secondary protocol-transition">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={next} className="p-1 rounded hover:bg-secondary protocol-transition">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-display font-medium text-foreground ml-2">{headerLabel}</span>
        </div>
        <div className="flex items-center bg-secondary rounded-md p-0.5 gap-0.5">
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
            {dayHeaders.map(d => (
              <div key={d} className="text-[10px] font-mono text-muted-foreground text-center py-1 uppercase tracking-wider">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {monthDays.map(day => {
              const key = format(day, 'yyyy-MM-dd');
              const dayTasks = tasksByDate.get(key) || [];
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);
              return (
                <div key={key} className={`min-h-[80px] p-1.5 bg-background ${!inMonth ? 'opacity-30' : ''}`}>
                  <div className={`text-[11px] font-mono mb-1 ${today ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map(task => (
                      <button key={task.id} onClick={() => onToggle(task.id)}
                        className={`w-full text-left text-[10px] px-1 py-0.5 rounded truncate protocol-transition hover:bg-task-hover flex items-center gap-1 ${task.status === 'completed' ? 'text-task-completed line-through' : 'text-foreground'}`}>
                        <div className={`h-1 w-1 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />
                        <span className="truncate">{task.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[9px] font-mono text-muted-foreground px-1">+{dayTasks.length - 3} more</span>
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
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Day headers row */}
          <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
            <div className="border-r border-border" /> {/* gutter */}
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
                {/* Time label */}
                <div className="border-r border-border flex items-start justify-end pr-1.5 pt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground/60">{`${hour.toString().padStart(2, '0')}:00`}</span>
                </div>

                {/* Day cells */}
                {weekDays.map(day => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDate.get(key) || [];
                  const hourTasks = dayTasks.filter(t => {
                    if (!t.due_date) return false;
                    return getHours(new Date(t.due_date)) === hour;
                  });
                  const today = isToday(day);

                  return (
                    <div key={`${key}-${hour}`}
                      className={`min-h-[48px] border-r border-border last:border-r-0 p-0.5 ${today ? 'bg-primary/[0.02]' : ''}`}>
                      {hourTasks.map(task => (
                        <button key={task.id} onClick={() => onToggle(task.id)}
                          className={`w-full text-left text-[10px] px-1.5 py-1 rounded-md mb-0.5 protocol-transition flex items-center gap-1.5 ${
                            task.status === 'completed'
                              ? 'bg-secondary/50 text-task-completed line-through'
                              : 'bg-secondary hover:bg-task-hover text-foreground'
                          }`}>
                          <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />
                          <span className="truncate">{task.title}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Unscheduled tasks (no time set or no due_date) */}
          {(() => {
            const unscheduled = tasks.filter(t => {
              if (!t.due_date) return true;
              const d = new Date(t.due_date);
              const h = getHours(d);
              // Tasks outside the visible hour range or with midnight time (likely date-only)
              return weekDays.some(day => isSameDay(d, day)) && (h < 6 || h > 21 || h === 0);
            });
            if (unscheduled.length === 0) return null;
            return (
              <div className="border-t border-border p-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5 px-1">Unscheduled</p>
                <div className="flex flex-wrap gap-1">
                  {unscheduled.slice(0, 10).map(task => (
                    <button key={task.id} onClick={() => onToggle(task.id)}
                      className={`text-[10px] px-2 py-1 rounded-md protocol-transition flex items-center gap-1.5 ${
                        task.status === 'completed'
                          ? 'bg-secondary/50 text-task-completed line-through'
                          : 'bg-secondary hover:bg-task-hover text-foreground'
                      }`}>
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />
                      <span>{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
