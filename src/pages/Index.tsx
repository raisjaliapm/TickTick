import { Command } from 'lucide-react';
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

const Index = () => {
  const store = useTaskStore();

  if (store.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm font-mono">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav
        viewFilter={store.viewFilter}
        setViewFilter={store.setViewFilter}
        categoryFilter={store.categoryFilter}
        setCategoryFilter={store.setCategoryFilter}
        priorityFilter={store.priorityFilter}
        setPriorityFilter={store.setPriorityFilter}
        statusFilter={store.statusFilter}
        setStatusFilter={store.setStatusFilter}
        categories={store.categories}
        stats={store.stats}
      />

      <main className="flex-1 relative">
        <div className="fixed inset-0 bg-grid pointer-events-none z-0" />

        <div className={`relative z-10 mx-auto px-6 py-12 md:py-16 ${store.viewFilter === 'calendar' || store.viewFilter === 'reports' || store.viewFilter === 'weekly-reports' ? 'max-w-5xl' : 'max-w-2xl'}`}>
          <header className="flex items-center justify-between mb-10">
            <div>
              <h1 className="text-xl font-display font-medium tracking-tight text-foreground">
                {viewLabels[store.viewFilter]}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 font-mono">
                {store.stats.total} active · {format(new Date(), 'EEEE, MMM d')}
              </p>
            </div>
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-lg border border-border hover:bg-task-hover protocol-transition">
              <Command className="h-3 w-3" /><span>K</span>
            </button>
          </header>

          {store.viewFilter !== 'completed' && store.viewFilter !== 'calendar' && store.viewFilter !== 'reports' && store.viewFilter !== 'weekly-reports' && (
            <TaskInput onAdd={store.addTask} categories={store.categories} onAddCategory={store.addCategory} />
          )}

          {store.viewFilter === 'weekly-reports' ? (
            <WeeklyReportsView />
          ) : store.viewFilter === 'reports' ? (
            <ReportsView tasks={store.allTasks} categories={store.categories} />
          ) : store.viewFilter === 'calendar' ? (
            <CalendarView tasks={store.allTasks} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} />
          ) : (
            <TaskList tasks={store.tasks} categories={store.categories} onToggle={store.toggleTask} onUpdate={store.updateTask} onDelete={store.deleteTask} onAddCategory={store.addCategory} onUpdateStatus={store.updateTaskStatus} />
          )}
        </div>
      </main>

      <CommandPalette tasks={store.allTasks} onToggle={store.toggleTask} />
    </div>
  );
};

export default Index;
