import { useState } from 'react';
import { Circle, CalendarDays, Inbox, CheckCircle2, ListTodo, Hash, CalendarRange, LogOut, BarChart3, FileText, Clock, Pause, Columns3, Sun, Moon, X, LayoutDashboard, FolderKanban, Plus, ChevronDown, ChevronRight, GanttChart, AlertTriangle, Package } from 'lucide-react';
import { GoogleCalendarButton } from '@/components/GoogleCalendarButton';
import type { ViewFilter, Category, Priority, TaskStatus } from '@/hooks/useTaskStore';
import type { Project } from '@/hooks/useProjectStore';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

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
  onDeleteCategory?: (id: string) => void;
  onLogoClick?: () => void;
  className?: string;
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
  onAddProject?: (name: string) => void;
  onDeleteProject?: (id: string) => void;
  onDashboardClick?: () => void;
  onProductTrackerClick?: () => void;
}

const viewItems: { key: ViewFilter; label: string; icon: React.ElementType }[] = [
  { key: 'all', label: 'All Tasks', icon: Inbox },
  { key: 'active', label: 'Active Tasks', icon: ListTodo },
  { key: 'in_progress_view', label: 'In Progress', icon: Clock },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'today', label: 'Today', icon: CalendarDays },
  { key: 'upcoming', label: 'Upcoming', icon: ListTodo },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'calendar', label: 'Calendar', icon: CalendarRange },
  { key: 'kanban', label: 'Board', icon: Columns3 },
  { key: 'gantt', label: 'Timeline', icon: GanttChart },
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

export function SidebarNav({ 
  viewFilter, setViewFilter, categoryFilter, setCategoryFilter, priorityFilter, setPriorityFilter, statusFilter, setStatusFilter, 
  categories, stats, onDeleteCategory, onLogoClick, className,
  projects = [], activeProjectId, onSelectProject, onAddProject, onDeleteProject, onDashboardClick, onProductTrackerClick
}: SidebarNavProps) {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const handleAddProject = () => {
    if (newProjectName.trim() && onAddProject) {
      onAddProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  return (
    <aside className={`w-60 shrink-0 bg-sidebar flex flex-col h-screen sticky top-0 overflow-y-auto scrollbar-thin ${className ?? 'border-r border-sidebar-border'}`}>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5">
        <button onClick={onLogoClick} className="flex items-center gap-2.5 hover:opacity-80 protocol-transition">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <FolderKanban className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">PTT</span>
        </button>
      </div>

      <div className="px-3 flex-1 space-y-1 pb-4">
        {/* Dashboard */}
        <button
          onClick={onDashboardClick}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm protocol-transition ${
            viewFilter === 'all' && !categoryFilter && !priorityFilter && !statusFilter
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </button>

        {/* Product Management Tracker */}
        <button
          onClick={onProductTrackerClick}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm protocol-transition text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <Package className="h-4 w-4" />
          <span>Product Tracker</span>
        </button>

        {/* Projects section */}
        <div className="pt-4">
          <button
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground protocol-transition"
          >
            <span>Projects</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setShowNewProject(!showNewProject); }}
                className="p-0.5 rounded hover:bg-sidebar-accent"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {projectsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </div>
          </button>

          {projectsExpanded && (
            <div className="mt-1 space-y-0.5">
              {showNewProject && (
                <div className="px-2 py-1">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddProject(); if (e.key === 'Escape') setShowNewProject(false); }}
                    placeholder="Project name..."
                    className="w-full text-sm bg-sidebar-accent border border-sidebar-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              )}
              {projects.map(project => (
                <div key={project.id} className="group/proj flex items-center">
                  <button
                    onClick={() => onSelectProject?.(activeProjectId === project.id ? null : project.id)}
                    className={`flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm protocol-transition ${
                      activeProjectId === project.id
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                    }`}
                  >
                    <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                  {onDeleteProject && (
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      className="opacity-0 group-hover/proj:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive protocol-transition mr-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {projects.length === 0 && !showNewProject && (
                <p className="text-xs text-muted-foreground px-2.5 py-2">No projects yet</p>
              )}
            </div>
          )}
        </div>

        {/* Views */}
        <div className="pt-4">
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Views</p>
          <div className="mt-1 space-y-0.5">
            {viewItems.map(item => {
              const active = viewFilter === item.key && !categoryFilter && !priorityFilter;
              const count = item.key === 'all' ? stats.total : item.key === 'active' ? stats.total : item.key === 'in_progress_view' ? stats.inProgress : item.key === 'overdue' ? stats.overdue : item.key === 'today' ? stats.today : item.key === 'completed' ? stats.completed : undefined;
              return (
                <button key={item.key} onClick={() => { setViewFilter(item.key); setCategoryFilter(null); setPriorityFilter(null); }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm protocol-transition ${active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count !== undefined && <span className="text-[10px] font-mono text-muted-foreground">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters - Collapsible */}
        <div className="pt-4">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground protocol-transition"
          >
            <span>Filters</span>
            {filtersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>

          {filtersExpanded && (
            <div className="mt-1 space-y-3">
              {/* Priority */}
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground px-2.5 mb-1">Priority</p>
                {priorities.map(p => (
                  <button key={p.key} onClick={() => { setPriorityFilter(priorityFilter === p.key ? null : p.key); setCategoryFilter(null); if (viewFilter === 'completed' || viewFilter === 'calendar') setViewFilter('all'); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm protocol-transition ${priorityFilter === p.key ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                    <div className={`h-2 w-2 rounded-full ${p.color}`} /><span>{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Status */}
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground px-2.5 mb-1">Status</p>
                {statusItems.map(s => {
                  const Icon = s.icon;
                  const count = s.key === 'not_started' ? stats.notStarted : s.key === 'in_progress' ? stats.inProgress : s.key === 'on_hold' ? stats.onHold : s.key === 'completed' ? stats.completed : undefined;
                  return (
                    <button key={s.key} onClick={() => { setStatusFilter(statusFilter === s.key ? null : s.key); setCategoryFilter(null); setPriorityFilter(null); if (viewFilter === 'calendar') setViewFilter('all'); }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm protocol-transition ${statusFilter === s.key ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                      <Icon className={`h-3.5 w-3.5 ${s.colorClass}`} />
                      <span className="flex-1 text-left">{s.label}</span>
                      {count !== undefined && <span className="text-[10px] font-mono text-muted-foreground">{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Categories */}
              <div className="space-y-0.5">
                <p className="text-[10px] font-medium text-muted-foreground px-2.5 mb-1">Categories</p>
                {categories.map(cat => (
                  <div key={cat.id} className="group/cat flex items-center">
                    <button onClick={() => { setCategoryFilter(categoryFilter === cat.id ? null : cat.id); setPriorityFilter(null); if (viewFilter === 'completed' || viewFilter === 'calendar') setViewFilter('all'); }}
                      className={`flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm protocol-transition ${categoryFilter === cat.id ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}>
                      <Hash className="h-3.5 w-3.5" /><span>{cat.name}</span>
                    </button>
                    {onDeleteCategory && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteCategory(cat.id); if (categoryFilter === cat.id) setCategoryFilter(null); }}
                        className="opacity-0 group-hover/cat:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive protocol-transition mr-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Integrations */}
        <div className="pt-4">
          <p className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Integrations</p>
          <div className="mt-1 px-1">
            <GoogleCalendarButton />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3 space-y-2">
        {stats.overdue > 0 && (
          <div className="flex items-center gap-2 px-1">
            <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-destructive font-medium">{stats.overdue} overdue</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground protocol-transition p-1.5 rounded-lg hover:bg-sidebar-accent" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user && (
            <>
              <span className="text-xs text-muted-foreground truncate flex-1">{user.email}</span>
              <button onClick={signOut} className="text-muted-foreground hover:text-foreground protocol-transition p-1.5 rounded-lg hover:bg-sidebar-accent">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
