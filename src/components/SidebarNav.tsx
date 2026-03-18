import { Circle, CalendarDays, Inbox, CheckCircle2, ListTodo, Hash, CalendarRange, LogOut, BarChart3, FileText, Clock, Pause, Columns3 } from 'lucide-react';
import { GoogleCalendarButton } from '@/components/GoogleCalendarButton';
import type { ViewFilter, Category, Priority, TaskStatus } from '@/hooks/useTaskStore';
import { useAuth } from '@/contexts/AuthContext';

interface SidebarNavProps {
  viewFilter: ViewFilter;
  setViewFilter: (v: ViewFilter) => void;
  categoryFilter: string | null;
  setCategoryFilter: (id: string | null) => void;
  priorityFilter: Priority | null;
  setPriorityFilter: (p: Priority | null) => void;
  statusFilter: TaskStatus | null;
  setStatusFilter: (s: TaskStatus | null) => void;
  categories: Category[];
  stats: { total: number; today: number; completed: number; overdue: number; notStarted: number; inProgress: number; onHold: number };
}

const viewItems: { key: ViewFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All Tasks', icon: Inbox },
  { key: 'today', label: 'Today', icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming', icon: ListTodo },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'calendar', label: 'Calendar', icon: CalendarRange },
  { key: 'kanban', label: 'Board', icon: Columns3 },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'weekly-reports', label: 'Weekly Reports', icon: FileText },
];

const priorities: { key: Priority; label: string; color: string }[] = [
  { key: 'urgent', label: 'Urgent', color: 'bg-priority-urgent' },
  { key: 'high', label: 'High', color: 'bg-priority-high' },
  { key: 'medium', label: 'Medium', color: 'bg-priority-medium' },
  { key: 'low', label: 'Low', color: 'bg-priority-low' },
];

const statusItems: { key: TaskStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { key: 'not_started', label: 'Not Started', icon: Circle, colorClass: 'text-[hsl(var(--status-not-started))]' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, colorClass: 'text-[hsl(var(--status-in-progress))]' },
  { key: 'on_hold', label: 'On Hold', icon: Pause, colorClass: 'text-[hsl(var(--status-on-hold))]' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, colorClass: 'text-[hsl(var(--status-completed))]' },
];

export function SidebarNav({ viewFilter, setViewFilter, categoryFilter, setCategoryFilter, priorityFilter, setPriorityFilter, statusFilter, setStatusFilter, categories, stats }: SidebarNavProps) {
  const { signOut, user } = useAuth();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar p-4 flex flex-col gap-6 h-screen sticky top-0 overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-2 px-2 pt-2">
        <Circle className="h-4 w-4 fill-primary text-primary" />
        <span className="text-base font-display font-medium tracking-tight text-foreground">Todoist</span>
      </div>

      <nav className="space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 mb-2">Views</p>
        {viewItems.map(item => {
          const active = viewFilter === item.key && !categoryFilter && !priorityFilter;
          const count = item.key === 'all' ? stats.total : item.key === 'today' ? stats.today : item.key === 'completed' ? stats.completed : undefined;
          return (
            <button key={item.key} onClick={() => { setViewFilter(item.key); setCategoryFilter(null); setPriorityFilter(null); }}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm protocol-transition ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <item.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {count !== undefined && <span className="text-[10px] font-mono text-muted-foreground">{count}</span>}
            </button>
          );
        })}
      </nav>

      <nav className="space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 mb-2">Priority</p>
        {priorities.map(p => (
          <button key={p.key} onClick={() => { setPriorityFilter(priorityFilter === p.key ? null : p.key); setCategoryFilter(null); if (viewFilter === 'completed' || viewFilter === 'calendar') setViewFilter('all'); }}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm protocol-transition ${priorityFilter === p.key ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
            <div className={`h-2 w-2 rounded-full ${p.color}`} /><span>{p.label}</span>
          </button>
        ))}
      </nav>

      <nav className="space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 mb-2">Status</p>
        {statusItems.map(s => {
          const Icon = s.icon;
          const count = s.key === 'not_started' ? stats.notStarted : s.key === 'in_progress' ? stats.inProgress : s.key === 'on_hold' ? stats.onHold : s.key === 'completed' ? stats.completed : undefined;
          return (
            <button key={s.key} onClick={() => { setStatusFilter(statusFilter === s.key ? null : s.key); setCategoryFilter(null); setPriorityFilter(null); if (viewFilter === 'calendar') setViewFilter('all'); }}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm protocol-transition ${statusFilter === s.key ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
              <Icon className={`h-4 w-4 ${s.colorClass}`} />
              <span className="flex-1 text-left">{s.label}</span>
              {count !== undefined && <span className="text-[10px] font-mono text-muted-foreground">{count}</span>}
            </button>
          );
        })}
      </nav>

      <nav className="space-y-0.5">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-2 mb-2">Categories</p>
        {categories.map(cat => (
          <button key={cat.id} onClick={() => { setCategoryFilter(categoryFilter === cat.id ? null : cat.id); setPriorityFilter(null); if (viewFilter === 'completed' || viewFilter === 'calendar') setViewFilter('all'); }}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm protocol-transition ${categoryFilter === cat.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
            <Hash className="h-3.5 w-3.5" /><span>{cat.name}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-2 px-2 pb-2">
        {stats.overdue > 0 && <span className="text-[11px] font-mono text-priority-urgent block">{stats.overdue} overdue</span>}
        {user && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground truncate flex-1">{user.email}</span>
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground protocol-transition">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
