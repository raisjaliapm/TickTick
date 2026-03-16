import { Command } from 'lucide-react';
import { format } from 'date-fns';
import { useTaskStore } from '@/hooks/useTaskStore';
import { SidebarNav } from '@/components/SidebarNav';
import { TaskInput } from '@/components/TaskInput';
import { TaskList } from '@/components/TaskList';
import { CommandPalette } from '@/components/CommandPalette';

const viewLabels = {
  all: 'All Tasks',
  today: 'Today',
  upcoming: 'Upcoming (7 days)',
  completed: 'Completed',
};

const Index = () => {
  const store = useTaskStore();

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav
        viewFilter={store.viewFilter}
        setViewFilter={store.setViewFilter}
        categoryFilter={store.categoryFilter}
        setCategoryFilter={store.setCategoryFilter}
        priorityFilter={store.priorityFilter}
        setPriorityFilter={store.setPriorityFilter}
        categories={store.categories}
        stats={store.stats}
      />

      <main className="flex-1 relative">
        {/* Grid bg */}
        <div className="fixed inset-0 bg-grid pointer-events-none z-0" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-12 md:py-16">
          {/* Header */}
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
              onClick={() => {
                // Trigger Cmd+K programmatically
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
              className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground bg-secondary px-2.5 py-1.5 rounded-lg border border-border hover:bg-task-hover protocol-transition"
            >
              <Command className="h-3 w-3" />
              <span>K</span>
            </button>
          </header>

          {/* Input */}
          {store.viewFilter !== 'completed' && (
            <TaskInput onAdd={store.addTask} categories={store.categories} />
          )}

          {/* Task list */}
          <TaskList
            tasks={store.tasks}
            categories={store.categories}
            onToggle={store.toggleTask}
            onUpdate={store.updateTask}
            onDelete={store.deleteTask}
          />
        </div>
      </main>

      {/* Command Palette */}
      <CommandPalette
        tasks={store.allTasks}
        onToggle={store.toggleTask}
        onDelete={store.deleteTask}
        onSearch={store.setSearchQuery}
      />
    </div>
  );
};

export default Index;
