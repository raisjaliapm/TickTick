import { useState } from 'react';
import { Command, PanelLeftClose, PanelLeftOpen, Sparkles, ListTodo, Menu } from 'lucide-react';
import { format } from 'date-fns';
import { useTaskStore } from '@/hooks/useTaskStore';
import { SidebarNav } from '@/components/SidebarNav';
import { TaskInput } from '@/components/TaskInput';
import { TaskList } from '@/components/TaskList';
import { CommandPalette } from '@/components/CommandPalette';
import { CalendarView } from '@/components/CalendarView';
import { ReportsView } from '@/components/ReportsView';
import { WeeklyReportsView } from '@/components/WeeklyReportsView';
import { KanbanView } from '@/components/KanbanView';
import { GoogleCalendarAutoSync } from '@/components/GoogleCalendarAutoSync';
import { AIChatPanel } from '@/components/AIChatPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

const viewLabels: Record<string, string> = {
  all: 'All Tasks',
  today: 'Today',
  upcoming: 'Upcoming (7 days)',
  completed: 'Completed',
  calendar: 'Calendar',
  kanban: 'Board',
  reports: 'Reports',
  'weekly-reports': 'Weekly Reports',
};

type MainView = 'ai' | 'tasks';

const Index = () => {
  const store = useTaskStore();
  const [mainView, setMainView] = useState<MainView>('ai');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  if (store.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm font-mono">Loading TickTick AI...</p>
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
    onLogoClick: () => { setMainView('ai'); if (isMobile) setMobileSidebarOpen(false); },
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && <SidebarNav {...sidebarProps} />}

      {/* Mobile Sidebar Sheet */}
      {isMobile && (
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav {...sidebarProps} className="border-0" />
          </SheetContent>
        </Sheet>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        <div className="fixed inset-0 bg-grid pointer-events-none z-0" />

        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-3 md:px-6 py-2.5 md:py-3 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {isMobile ? (
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
              >
                <Menu className="h-4 w-4" />
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
                onClick={() => setMainView('ai')}
                className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium protocol-transition ${
                  mainView === 'ai' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Assistant</span>
                <span className="sm:hidden">AI</span>
              </button>
              <button
                onClick={() => setMainView('tasks')}
                className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium protocol-transition ${
                  mainView === 'tasks' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListTodo className="h-3.5 w-3.5" />
                Tasks
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground hidden md:block">
              {store.stats.total} active · {format(new Date(), 'EEE, MMM d')}
            </span>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-lg border border-border hover:bg-task-hover protocol-transition"
            >
              <Command className="h-3 w-3" /><span>K</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="relative z-10 flex-1 overflow-hidden">
          {mainView === 'ai' ? (
            <AIChatPanel onTasksChanged={() => store.fetchTasks?.()} />
          ) : (
            <div className="h-full overflow-y-auto">
              <div className={`mx-auto px-4 md:px-6 py-6 md:py-8 ${store.viewFilter === 'calendar' || store.viewFilter === 'reports' || store.viewFilter === 'weekly-reports' || store.viewFilter === 'kanban' ? 'max-w-5xl' : 'max-w-2xl'}`}>
                <h1 className="text-lg md:text-xl font-display font-medium tracking-tight text-foreground mb-4 md:mb-6">
                  {viewLabels[store.viewFilter]}
                </h1>

                {store.viewFilter !== 'completed' && store.viewFilter !== 'calendar' && store.viewFilter !== 'reports' && store.viewFilter !== 'weekly-reports' && store.viewFilter !== 'kanban' && (
                  <TaskInput onAdd={store.addTask} categories={store.categories} onAddCategory={store.addCategory} />
                )}

                {store.viewFilter === 'weekly-reports' ? (
                  <WeeklyReportsView />
                ) : store.viewFilter === 'reports' ? (
                  <ReportsView tasks={store.allTasks} categories={store.categories} />
                ) : store.viewFilter === 'kanban' ? (
                  <KanbanView tasks={store.allTasks} categories={store.categories} onUpdateStatus={store.updateTaskStatus} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} />
                ) : store.viewFilter === 'calendar' ? (
                  <CalendarView tasks={store.allTasks} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} onAdd={store.addTask} onAddCategory={store.addCategory} />
                ) : (
                  <TaskList tasks={store.tasks} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} onStopRecurrence={store.stopRecurrence} onAddCategory={store.addCategory} onUpdateStatus={store.updateTaskStatus} />
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
