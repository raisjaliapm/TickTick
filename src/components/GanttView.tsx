import { useMemo, useState, useRef } from 'react';
import { format, differenceInDays, addDays, startOfDay, endOfDay, isWithinInterval, startOfWeek, endOfWeek, addWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Calendar } from 'lucide-react';
import type { Task, Category } from '@/hooks/useTaskStore';
import type { Project } from '@/hooks/useProjectStore';

interface GanttViewProps {
  tasks: Task[];
  categories: Category[];
  projects: Project[];
}

type ZoomLevel = 'day' | 'week' | 'month';

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; label: string }> = {
  day: { dayWidth: 48, label: 'Day' },
  week: { dayWidth: 24, label: 'Week' },
  month: { dayWidth: 8, label: 'Month' },
};

const STATUS_COLORS: Record<string, string> = {
  not_started: 'hsl(var(--status-not-started))',
  in_progress: 'hsl(var(--status-in-progress))',
  on_hold: 'hsl(var(--status-on-hold))',
  completed: 'hsl(var(--status-completed))',
};

const PRIORITY_OPACITY: Record<string, number> = {
  urgent: 1,
  high: 0.9,
  medium: 0.75,
  low: 0.6,
};

export function GanttView({ tasks, categories, projects }: GanttViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const [offset, setOffset] = useState(0); // weeks offset from current
  const scrollRef = useRef<HTMLDivElement>(null);

  const config = ZOOM_CONFIG[zoom];

  // Calculate the timeline range
  const timeline = useMemo(() => {
    const now = startOfDay(new Date());
    const rangeStart = addWeeks(startOfWeek(now, { weekStartsOn: 1 }), offset);
    const weeksToShow = zoom === 'day' ? 4 : zoom === 'week' ? 8 : 16;
    const rangeEnd = addWeeks(rangeStart, weeksToShow);
    const totalDays = differenceInDays(rangeEnd, rangeStart);

    const days: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      days.push(addDays(rangeStart, i));
    }

    return { rangeStart, rangeEnd, totalDays, days };
  }, [zoom, offset]);

  // Group tasks by project
  const groupedTasks = useMemo(() => {
    // Include tasks that have any date (due_date, start_date, or end_date)
    const tasksWithDates = tasks.filter(t => t.due_date || (t as any).start_date || (t as any).end_date);

    const projectMap = new Map<string, { project: Project | null; tasks: Task[] }>();

    // "No Project" group
    projectMap.set('__none__', { project: null, tasks: [] });

    projects.forEach(p => {
      projectMap.set(p.id, { project: p, tasks: [] });
    });

    tasksWithDates.forEach(task => {
      const key = task.project_id || '__none__';
      if (!projectMap.has(key)) {
        projectMap.set(key, { project: null, tasks: [] });
      }
      projectMap.get(key)!.tasks.push(task);
    });

    // Filter out empty groups
    return Array.from(projectMap.entries())
      .filter(([, group]) => group.tasks.length > 0)
      .map(([key, group]) => ({
        key,
        project: group.project,
        tasks: group.tasks.sort((a, b) => {
          const aStart = (a as any).start_date || a.due_date || a.created_at;
          const bStart = (b as any).start_date || b.due_date || b.created_at;
          return new Date(aStart).getTime() - new Date(bStart).getTime();
        }),
      }));
  }, [tasks, projects]);

  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 56;
  const LABEL_WIDTH = 220;

  const getTaskPosition = (task: Task) => {
    const taskStartDate = (task as any).start_date;
    const taskEndDate = (task as any).end_date;
    const taskDueDate = task.due_date;

    // Determine bar start: start_date > created_at
    const barStartRaw = taskStartDate
      ? startOfDay(new Date(taskStartDate))
      : startOfDay(new Date(task.created_at));

    // Determine bar end: end_date > due_date > start_date + 1 day
    const barEndRaw = taskEndDate
      ? startOfDay(new Date(taskEndDate))
      : taskDueDate
        ? startOfDay(new Date(taskDueDate))
        : addDays(barStartRaw, 1);

    const start = barStartRaw < timeline.rangeStart ? timeline.rangeStart : barStartRaw;
    const end = barEndRaw;

    const startOffset = differenceInDays(start, timeline.rangeStart);
    const duration = Math.max(differenceInDays(end, start), 1);

    const overdueDate = taskDueDate ? startOfDay(new Date(taskDueDate)) : taskEndDate ? startOfDay(new Date(taskEndDate)) : null;

    return {
      left: startOffset * config.dayWidth,
      width: duration * config.dayWidth,
      isOverdue: overdueDate ? overdueDate < startOfDay(new Date()) && task.status !== 'completed' : false,
    };
  };

  const todayOffset = differenceInDays(startOfDay(new Date()), timeline.rangeStart) * config.dayWidth;

  const zoomLevels: ZoomLevel[] = ['month', 'week', 'day'];
  const currentZoomIndex = zoomLevels.indexOf(zoom);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(o => o - (zoom === 'day' ? 1 : zoom === 'week' ? 2 : 4))}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
          >
            <Calendar className="h-3.5 w-3.5" />
            Today
          </button>
          <button
            onClick={() => setOffset(o => o + (zoom === 'day' ? 1 : zoom === 'week' ? 2 : 4))}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={currentZoomIndex <= 0}
            onClick={() => setZoom(zoomLevels[currentZoomIndex - 1])}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition disabled:opacity-30"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-muted-foreground font-medium w-12 text-center">{config.label}</span>
          <button
            disabled={currentZoomIndex >= zoomLevels.length - 1}
            onClick={() => setZoom(zoomLevels[currentZoomIndex + 1])}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition disabled:opacity-30"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="flex">
          {/* Left Labels */}
          <div className="shrink-0 border-r border-border bg-card z-10" style={{ width: LABEL_WIDTH }}>
            {/* Header spacer */}
            <div className="border-b border-border px-4 flex items-center" style={{ height: HEADER_HEIGHT }}>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Task</span>
            </div>

            {/* Task labels */}
            {groupedTasks.map(group => (
              <div key={group.key}>
                {/* Project header */}
                <div
                  className="flex items-center gap-2 px-4 border-b border-border bg-secondary/50"
                  style={{ height: ROW_HEIGHT }}
                >
                  {group.project ? (
                    <>
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: group.project.color }} />
                      <span className="text-xs font-semibold text-foreground truncate">{group.project.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{group.tasks.length}</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2.5 w-2.5 rounded-sm shrink-0 bg-muted-foreground/30" />
                      <span className="text-xs font-semibold text-muted-foreground">No Project</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{group.tasks.length}</span>
                    </>
                  )}
                </div>

                {/* Task rows */}
                {group.tasks.map(task => {
                  const taskStart = (task as any).start_date;
                  const taskEnd = (task as any).end_date;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 px-4 border-b border-border/50 hover:bg-accent/30 protocol-transition"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS.not_started }}
                      />
                      <span className={`text-xs truncate flex-1 ${task.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
                        {taskStart ? format(new Date(taskStart), 'M/d') : '—'}
                        {' → '}
                        {taskEnd ? format(new Date(taskEnd), 'M/d') : task.due_date ? format(new Date(task.due_date), 'M/d') : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

            {groupedTasks.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">No tasks with dates</p>
                <p className="text-xs text-muted-foreground mt-1">Add start/end or due dates to see tasks on the timeline</p>
              </div>
            )}
          </div>

          {/* Right Timeline */}
          <div className="flex-1 overflow-x-auto scrollbar-thin" ref={scrollRef}>
            <div style={{ width: timeline.totalDays * config.dayWidth, minWidth: '100%' }}>
              {/* Date headers */}
              <div className="border-b border-border relative" style={{ height: HEADER_HEIGHT }}>
                {/* Month labels */}
                <div className="flex h-1/2 border-b border-border/50">
                  {(() => {
                    const months: { label: string; left: number; width: number }[] = [];
                    let currentMonth = '';
                    let monthStart = 0;

                    timeline.days.forEach((day, i) => {
                      const monthLabel = format(day, 'MMMM yyyy');
                      if (monthLabel !== currentMonth) {
                        if (currentMonth) {
                          months.push({ label: currentMonth, left: monthStart * config.dayWidth, width: (i - monthStart) * config.dayWidth });
                        }
                        currentMonth = monthLabel;
                        monthStart = i;
                      }
                    });
                    months.push({ label: currentMonth, left: monthStart * config.dayWidth, width: (timeline.days.length - monthStart) * config.dayWidth });

                    return months.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full flex items-center px-3 border-r border-border/30"
                        style={{ left: m.left, width: m.width }}
                      >
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{m.label}</span>
                      </div>
                    ));
                  })()}
                </div>

                {/* Day/week labels */}
                <div className="flex h-1/2 relative">
                  {timeline.days.map((day, i) => {
                    const isWeekStart = day.getDay() === 1;
                    const showLabel = zoom === 'day' || (zoom === 'week' && isWeekStart) || (zoom === 'month' && day.getDate() === 1);
                    const isToday = isSameDay(day, new Date());

                    if (!showLabel) return null;

                    return (
                      <div
                        key={i}
                        className={`absolute top-0 h-full flex items-center justify-center border-r border-border/20 ${isToday ? 'bg-primary/5' : ''}`}
                        style={{ left: i * config.dayWidth, width: zoom === 'week' ? 7 * config.dayWidth : zoom === 'month' ? config.dayWidth : config.dayWidth }}
                      >
                        <span className={`text-[10px] ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {zoom === 'day' ? format(day, 'd') : zoom === 'week' ? format(day, 'MMM d') : format(day, 'd')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Task bars */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= timeline.totalDays * config.dayWidth && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
                    style={{ left: todayOffset }}
                  >
                    <div className="absolute -top-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                )}

                {/* Weekend shading */}
                {timeline.days.map((day, i) => {
                  if (day.getDay() === 0 || day.getDay() === 6) {
                    return (
                      <div
                        key={`weekend-${i}`}
                        className="absolute top-0 bottom-0 bg-muted/30 pointer-events-none"
                        style={{ left: i * config.dayWidth, width: config.dayWidth }}
                      />
                    );
                  }
                  return null;
                })}

                {groupedTasks.map(group => (
                  <div key={group.key}>
                    {/* Project header row */}
                    <div className="border-b border-border bg-secondary/50" style={{ height: ROW_HEIGHT }} />

                    {/* Task bar rows */}
                    {group.tasks.map(task => {
                      const pos = getTaskPosition(task);
                      const projectColor = group.project?.color || 'hsl(var(--muted-foreground))';
                      const opacity = PRIORITY_OPACITY[task.priority] || 0.75;

                      return (
                        <div
                          key={task.id}
                          className="relative border-b border-border/50"
                          style={{ height: ROW_HEIGHT }}
                        >
                          {pos && (
                            <div
                              className="absolute top-1.5 rounded-md group cursor-pointer protocol-transition hover:brightness-110"
                              style={{
                                left: Math.max(pos.left, 0),
                                width: Math.max(pos.width, 4),
                                height: ROW_HEIGHT - 12,
                                backgroundColor: task.status === 'completed' ? 'hsl(var(--status-completed))' : projectColor,
                                opacity,
                              }}
                              title={`${task.title}${(task as any).start_date ? `\nStart: ${format(new Date((task as any).start_date), 'MMM d, yyyy')}` : ''}${(task as any).end_date ? `\nEnd: ${format(new Date((task as any).end_date), 'MMM d, yyyy')}` : ''}${task.due_date ? `\nDue: ${format(new Date(task.due_date), 'MMM d, yyyy')}` : ''}\nStatus: ${task.status?.replace('_', ' ')}\nPriority: ${task.priority}`}
                            >
                              {/* Progress fill for in-progress tasks */}
                              {task.status === 'in_progress' && (
                                <div
                                  className="absolute inset-y-0 left-0 rounded-l-md bg-white/20"
                                  style={{ width: '50%' }}
                                />
                              )}

                              {/* Overdue indicator */}
                              {pos.isOverdue && (
                                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-destructive border-2 border-card" />
                              )}

                              {/* Label on bar */}
                              {pos.width > 60 && (
                                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate">
                                  {task.title}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Legend</span>
        {[
          { label: 'Not Started', color: 'hsl(var(--status-not-started))' },
          { label: 'In Progress', color: 'hsl(var(--status-in-progress))' },
          { label: 'On Hold', color: 'hsl(var(--status-on-hold))' },
          { label: 'Completed', color: 'hsl(var(--status-completed))' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-2.5 w-8 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="h-3 w-3 rounded-full bg-destructive border-2 border-card" />
          <span className="text-[10px] text-muted-foreground">Overdue</span>
        </div>
      </div>
    </div>
  );
}
