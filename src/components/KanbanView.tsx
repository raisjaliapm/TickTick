import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Circle, Clock, Pause, CheckCircle2, GripVertical } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import type { Task, Category, TaskStatus } from '@/hooks/useTaskStore';

interface KanbanViewProps {
  tasks: Task[];
  categories: Category[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onToggle: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const columns: { status: TaskStatus; label: string; icon: React.ElementType; colorVar: string; borderColor: string }[] = [
  { status: 'not_started', label: 'Not Started', icon: Circle, colorVar: '--status-not-started', borderColor: 'border-[hsl(var(--status-not-started)/0.3)]' },
  { status: 'in_progress', label: 'In Progress', icon: Clock, colorVar: '--status-in-progress', borderColor: 'border-[hsl(var(--status-in-progress)/0.3)]' },
  { status: 'on_hold', label: 'On Hold', icon: Pause, colorVar: '--status-on-hold', borderColor: 'border-[hsl(var(--status-on-hold)/0.3)]' },
  { status: 'completed', label: 'Completed', icon: CheckCircle2, colorVar: '--status-completed', borderColor: 'border-[hsl(var(--status-completed)/0.3)]' },
];

const priorityDot: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

export function KanbanView({ tasks, categories, onUpdateStatus }: KanbanViewProps) {
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetStatus) {
        onUpdateStatus(taskId, targetStatus);
      }
    }
    setDragOverColumn(null);
    setDraggedTaskId(null);
  };

  return (
    <div className="grid grid-cols-4 gap-3 min-h-[60vh]">
      {columns.map(col => {
        const Icon = col.icon;
        const columnTasks = tasks.filter(t => t.status === col.status);
        const isOver = dragOverColumn === col.status;

        return (
          <div
            key={col.status}
            onDragOver={e => handleDragOver(e, col.status)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.status)}
            className={`flex flex-col rounded-xl border ${col.borderColor} bg-card/50 protocol-transition ${isOver ? 'bg-secondary/60 border-primary/40 scale-[1.01]' : ''}`}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-3 border-b border-border/50">
              <Icon className="h-4 w-4" style={{ color: `hsl(var(${col.colorVar}))` }} />
              <span className="text-xs font-mono font-medium text-foreground">{col.label}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                {columnTasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto scrollbar-thin min-h-[100px]">
              {isOver && columnTasks.length === 0 && (
                <div className="border-2 border-dashed border-primary/30 rounded-lg h-16 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-muted-foreground">Drop here</span>
                </div>
              )}
              <AnimatePresence mode="popLayout">
                {columnTasks.map(task => {
                  const category = categories.find(c => c.id === task.category_id);
                  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'completed';
                  const isDragging = draggedTaskId === task.id;

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: isDragging ? 0.5 : 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      className={`group rounded-lg border border-border bg-card p-2.5 cursor-grab active:cursor-grabbing hover:border-muted-foreground/30 protocol-transition ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 shrink-0 mt-0.5 protocol-transition" />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs leading-relaxed ${task.status === 'completed' ? 'text-task-completed line-through' : 'text-foreground'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot[task.priority] || priorityDot.medium}`} />
                            {category && (
                              <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-secondary text-muted-foreground uppercase tracking-wider">
                                {category.name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className={`text-[9px] font-mono ${isOverdue ? 'text-priority-urgent' : 'text-muted-foreground'}`}>
                                {isOverdue ? 'overdue' : format(new Date(task.due_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}
