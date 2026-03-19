import { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, FolderKanban, ListTodo, Pause, Circle } from 'lucide-react';
import { format, isToday, isPast, isWithinInterval, addDays, startOfDay } from 'date-fns';
import type { Task, Category } from '@/hooks/useTaskStore';
import type { Project } from '@/hooks/useProjectStore';

interface DashboardViewProps {
  tasks: Task[];
  categories: Category[];
  projects: Project[];
  onNavigate: (view: string) => void;
}

export function DashboardView({ tasks, categories, projects, onNavigate }: DashboardViewProps) {
  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');
    const overdue = active.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const dueToday = active.filter(t => t.due_date && isToday(new Date(t.due_date)));
    const upcoming = active.filter(t => t.due_date && isWithinInterval(new Date(t.due_date), {
      start: addDays(startOfDay(new Date()), 1),
      end: addDays(startOfDay(new Date()), 7),
    }));
    const inProgress = active.filter(t => t.status === 'in_progress');
    const notStarted = active.filter(t => t.status === 'not_started');
    const onHold = active.filter(t => t.status === 'on_hold');

    // Completion rate this week
    const weekStart = startOfDay(addDays(new Date(), -7));
    const completedThisWeek = completed.filter(t => t.completed_at && new Date(t.completed_at) >= weekStart);

    return { active, completed, overdue, dueToday, upcoming, inProgress, notStarted, onHold, completedThisWeek };
  }, [tasks]);

  const statCards = [
    { label: 'Active Tasks', value: stats.active.length, icon: ListTodo, color: 'text-primary', bg: 'bg-primary/10', navigateTo: 'active' },
    { label: 'In Progress', value: stats.inProgress.length, icon: Clock, color: 'text-info', bg: 'bg-info/10', navigateTo: 'in_progress_view' },
    { label: 'Completed', value: stats.completed.length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', navigateTo: 'completed' },
    { label: 'Due Today', value: stats.dueToday.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', navigateTo: 'today' },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')} · {stats.dueToday.length} tasks due today
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {statCards.map(card => (
          <button
            key={card.label}
            onClick={() => onNavigate(card.navigateTo)}
            className="bg-card border border-border rounded-xl p-4 md:p-5 text-left hover:border-primary/40 hover:shadow-md protocol-transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Due Today */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Due Today
            </h3>
            <button onClick={() => onNavigate('today')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          {stats.dueToday.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No tasks due today 🎉</p>
          ) : (
            <div className="space-y-2">
              {stats.dueToday.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                  <div className={`h-2 w-2 rounded-full ${
                    task.priority === 'urgent' ? 'bg-priority-urgent' :
                    task.priority === 'high' ? 'bg-priority-high' :
                    task.priority === 'medium' ? 'bg-priority-medium' : 'bg-priority-low'
                  }`} />
                  <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                  <span className="text-[10px] font-mono text-muted-foreground capitalize">{task.status?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue
            </h3>
            <span className="text-xs text-destructive font-medium">{stats.overdue.length} tasks</span>
          </div>
          {stats.overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All caught up!</p>
          ) : (
            <div className="space-y-2">
              {stats.overdue.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-sm text-foreground truncate flex-1">{task.title}</span>
                  <span className="text-[10px] font-mono text-destructive">
                    {task.due_date && format(new Date(task.due_date), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Projects
            </h3>
            <span className="text-xs text-muted-foreground">{projects.length} projects</span>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No projects yet. Create one from the sidebar!</p>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 5).map(project => {
                const projectTasks = tasks.filter(t => t.project_id === project.id);
                const completedCount = projectTasks.filter(t => t.status === 'completed').length;
                const progress = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0;
                return (
                  <div key={project.id} className="p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: project.color }} />
                      <span className="text-sm text-foreground flex-1 truncate">{project.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden ml-6">
                      <div className="h-full rounded-full protocol-transition" style={{ width: `${progress}%`, backgroundColor: project.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Status Breakdown
            </h3>
            <span className="text-xs text-muted-foreground">{stats.completedThisWeek.length} completed this week</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Not Started', count: stats.notStarted.length, icon: Circle, color: 'hsl(var(--status-not-started))' },
              { label: 'In Progress', count: stats.inProgress.length, icon: Clock, color: 'hsl(var(--status-in-progress))' },
              { label: 'On Hold', count: stats.onHold.length, icon: Pause, color: 'hsl(var(--status-on-hold))' },
              { label: 'Completed', count: stats.completed.length, icon: CheckCircle2, color: 'hsl(var(--status-completed))' },
            ].map(item => {
              const total = tasks.length || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <item.icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                      {item.label}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{item.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full protocol-transition" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
