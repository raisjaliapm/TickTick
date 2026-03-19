import { useState } from 'react';
import { Command, PanelLeftClose, PanelLeftOpen, Sparkles, ListTodo, Menu, Search } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { format } from 'date-fns';
import { useTaskStore } from '@/hooks/useTaskStore';
import { useProjectStore } from '@/hooks/useProjectStore';
import { SidebarNav } from '@/components/SidebarNav';
import { TaskInput } from '@/components/TaskInput';
import { TaskList } from '@/components/TaskList';
import { CommandPalette } from '@/components/CommandPalette';
import { CalendarView } from '@/components/CalendarView';
import { ReportsView } from '@/components/ReportsView';
import { WeeklyReportsView } from '@/components/WeeklyReportsView';
import { KanbanView } from '@/components/KanbanView';
import { GanttView } from '@/components/GanttView';
import { GoogleCalendarAutoSync } from '@/components/GoogleCalendarAutoSync';
import { AIChatPanel } from '@/components/AIChatPanel';
import { DashboardView } from '@/components/DashboardView';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const viewLabels: Record<string, string> = {
  all: 'All Tasks',
  today: 'Today',
  upcoming: 'Upcoming (7 days)',
  completed: 'Completed',
  calendar: 'Calendar',
  kanban: 'Board',
  gantt: 'Timeline',
  reports: 'Reports',
  'weekly-reports': 'Weekly Reports',
};

type MainView = 'dashboard' | 'ai' | 'tasks';

const Index = () => {
  const store = useTaskStore();
  const projectStore = useProjectStore();
  const [mainView, setMainView] = useState<MainView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Filter tasks by active project
  const filteredByProject = projectStore.activeProjectId
    ? store.tasks.filter(t => (t as any).project_id === projectStore.activeProjectId)
    : store.tasks;

  const allTasksFilteredByProject = projectStore.activeProjectId
    ? store.allTasks.filter(t => (t as any).project_id === projectStore.activeProjectId)
    : store.allTasks;

  if (store.loading || projectStore.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-sm">Loading ProjectHub...</p>
        </div>
      </div>
    );
  }

  const sidebarProps = {
    viewFilter: store.viewFilter,
    setViewFilter: (v: any) => { store.setViewFilter(v); setMainView('tasks'); if (isMobile) setMobileSidebarOpen(false); },
    categoryFilter: store.categoryFilter,
    setCategoryFilter: (id: any) => { store.setCategoryFilter(id); setMainView('tasks'); if (isMobile) setMobileSidebarOpen(false); },
    priorityFilter: store.priorityFilter,
    setPriorityFilter: (p: any) => { store.setPriorityFilter(p); setMainView('tasks'); if (isMobile) setMobileSidebarOpen(false); },
    statusFilter: store.statusFilter,
    setStatusFilter: (s: any) => { store.setStatusFilter(s); setMainView('tasks'); if (isMobile) setMobileSidebarOpen(false); },
    categories: store.categories,
    stats: store.stats,
    onDeleteCategory: store.deleteCategory,
    onLogoClick: () => { setMainView('dashboard'); if (isMobile) setMobileSidebarOpen(false); },
    projects: projectStore.projects,
    activeProjectId: projectStore.activeProjectId,
    onSelectProject: (id: string | null) => { projectStore.setActiveProjectId(id); setMainView('tasks'); store.setViewFilter('all'); if (isMobile) setMobileSidebarOpen(false); },
    onAddProject: (name: string) => projectStore.addProject(name),
    onDeleteProject: projectStore.deleteProject,
    onDashboardClick: () => { setMainView('dashboard'); projectStore.setActiveProjectId(null); if (isMobile) setMobileSidebarOpen(false); },
  };

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && <SidebarNav {...sidebarProps} />}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav {...sidebarProps} className="border-0" />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-3 md:px-6 py-2.5 md:py-3 border-b border-border bg-card safe-area-top">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {isMobile ? (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-2 -ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
              >
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </button>
            )}

            {/* View toggle */}
            <div className="flex items-center bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => { setMainView('dashboard'); projectStore.setActiveProjectId(null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium protocol-transition ${
                  mainView === 'dashboard' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Overview</span>
              </button>
              <button
                onClick={() => setMainView('ai')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium protocol-transition ${
                  mainView === 'ai' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI</span>
              </button>
              <button
                onClick={() => setMainView('tasks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium protocol-transition ${
                  mainView === 'tasks' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" />
                <span>Tasks</span>
              </button>
            </div>

            {/* Active project badge */}
            {projectStore.activeProject && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-secondary text-sm">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: projectStore.activeProject.color }} />
                <span className="text-foreground font-medium truncate max-w-[150px]">{projectStore.activeProject.name}</span>
                <button
                  onClick={() => projectStore.setActiveProjectId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:block">
              {store.stats.total} active · {format(new Date(), 'EEE, MMM d')}
            </span>
            <NotificationBell />
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-lg border border-border hover:bg-accent protocol-transition"
            >
              <Command className="h-3 w-3" /><span>K</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-hidden">
          {mainView === 'dashboard' ? (
            <div className="h-full overflow-y-auto overscroll-contain">
              <DashboardView
                tasks={store.allTasks}
                categories={store.categories}
                projects={projectStore.projects}
                onNavigate={(view) => { store.setViewFilter(view as any); setMainView('tasks'); }}
              />
            </div>
          ) : mainView === 'ai' ? (
            <AIChatPanel onTasksChanged={() => store.fetchTasks?.()} />
          ) : (
            <div className="h-full overflow-y-auto overscroll-contain">
              <div className={`mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-8 sm:pb-6 ${store.viewFilter === 'calendar' || store.viewFilter === 'reports' || store.viewFilter === 'weekly-reports' || store.viewFilter === 'kanban' ? 'max-w-5xl' : 'max-w-2xl'}`}>
                <h1 className="text-lg md:text-xl font-semibold text-foreground mb-4 md:mb-6">
                  {viewLabels[store.viewFilter]}
                  {projectStore.activeProject && (
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      in {projectStore.activeProject.name}
                    </span>
                  )}
                </h1>

                {store.viewFilter !== 'completed' && store.viewFilter !== 'calendar' && store.viewFilter !== 'reports' && store.viewFilter !== 'weekly-reports' && store.viewFilter !== 'kanban' && (
                  <TaskInput onAdd={store.addTask} categories={store.categories} onAddCategory={store.addCategory} />
                )}

                {store.viewFilter === 'weekly-reports' ? (
                  <WeeklyReportsView />
                ) : store.viewFilter === 'reports' ? (
                  <ReportsView tasks={allTasksFilteredByProject} categories={store.categories} />
                ) : store.viewFilter === 'kanban' ? (
                  <KanbanView tasks={allTasksFilteredByProject} categories={store.categories} onUpdateStatus={store.updateTaskStatus} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} />
                ) : store.viewFilter === 'calendar' ? (
                  <CalendarView tasks={allTasksFilteredByProject} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} onStopRecurrence={store.stopRecurrence} onAdd={store.addTask} onAddCategory={store.addCategory} />
                ) : (
                  <TaskList tasks={filteredByProject} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} onStopRecurrence={store.stopRecurrence} onAddCategory={store.addCategory} onUpdateStatus={store.updateTaskStatus} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <CommandPalette tasks={store.allTasks} onToggle={store.toggleTask} />
      <GoogleCalendarAutoSync tasks={store.allTasks} />
    </div>
  );
};

export default Index;
