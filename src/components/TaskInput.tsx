import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Calendar, Flag, Repeat, Hash, Circle, Clock, Pause, CheckCircle2, Mic, MicOff } from 'lucide-react';
import type { Priority, Category, TaskStatus } from '@/hooks/useTaskStore';

export type Recurrence = 'daily' | 'weekly' | 'monthly' | null;

interface TaskInputProps {
  onAdd: (title: string, priority: Priority, dueDate: string | null, categoryId: string | null, recurrence?: Recurrence, status?: TaskStatus) => void;
  categories: Category[];
  onAddCategory?: (name: string) => Promise<void>;
}

const priorityLabels: Record<Priority, string> = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urgent' };
const priorityColors: Record<Priority, string> = { low: 'text-priority-low', medium: 'text-priority-medium', high: 'text-priority-high', urgent: 'text-priority-urgent' };
const recurrenceLabels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const statusConfig: { value: TaskStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { value: 'not_started', label: 'Not Started', icon: Circle, colorClass: 'text-[hsl(var(--status-not-started))]' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, colorClass: 'text-[hsl(var(--status-in-progress))]' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, colorClass: 'text-[hsl(var(--status-on-hold))]' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, colorClass: 'text-[hsl(var(--status-completed))]' },
];

export function TaskInput({ onAdd, categories, onAddCategory }: TaskInputProps) {
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>(null);
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [expanded, setExpanded] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!value.trim()) return;
    const dueDateWithTime = dueDate ? (dueTime ? `${dueDate}T${dueTime}` : dueDate) : null;
    onAdd(value.trim(), priority, dueDateWithTime, categoryId, recurrence, status);
    setValue(''); setPriority('medium'); setDueDate(''); setDueTime(''); setCategoryId(null); setRecurrence(null); setStatus('not_started');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      handleSubmit();
    }
    if (e.key === 'Escape') { setValue(''); setExpanded(false); inputRef.current?.blur(); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); inputRef.current?.focus(); setExpanded(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const cyclePriority = () => {
    const order: Priority[] = ['low', 'medium', 'high', 'urgent'];
    setPriority(order[(order.indexOf(priority) + 1) % order.length]);
  };

  const cycleRecurrence = () => {
    const order: (Recurrence)[] = [null, 'daily', 'weekly', 'monthly'];
    setRecurrence(order[(order.indexOf(recurrence) + 1) % order.length]);
  };

  const cycleStatus = () => {
    const order: TaskStatus[] = ['not_started', 'in_progress', 'on_hold', 'completed'];
    setStatus(order[(order.indexOf(status) + 1) % order.length]);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  useEffect(() => {
    if (showNewCategory) catInputRef.current?.focus();
  }, [showNewCategory]);

  const currentStatusConfig = statusConfig.find(s => s.value === status) || statusConfig[0];
  const StatusIcon = currentStatusConfig.icon;

  return (
    <div className="mb-6">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input ref={inputRef} type="text" value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setExpanded(true)} placeholder="Add a task..."
            className="w-full bg-surface-well border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring protocol-transition placeholder:text-muted-foreground/60" />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="px-4 py-3 rounded-xl text-sm font-mono bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed protocol-transition"
        >
          Add
        </button>
      </div>
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 mt-2 px-1">
          <button onClick={cyclePriority} className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md bg-secondary protocol-transition ${priorityColors[priority]}`}>
            <Flag className="h-3 w-3" />{priorityLabels[priority]}
          </button>

          {/* Status selector */}
          <button onClick={cycleStatus} className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md bg-secondary protocol-transition ${currentStatusConfig.colorClass}`}>
            <StatusIcon className="h-3 w-3" />{currentStatusConfig.label}
          </button>

          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md pl-7 pr-2 py-1 protocol-transition focus:outline-none border-none" />
          </div>
          {dueDate && (
            <div className="relative">
              <Clock className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)}
                className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md pl-7 pr-2 py-1 protocol-transition focus:outline-none border-none" />
            </div>
          )}
          <button onClick={cycleRecurrence} className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md protocol-transition ${recurrence ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-secondary-foreground'}`}>
            <Repeat className="h-3 w-3" />{recurrence ? recurrenceLabels[recurrence] : 'Once'}
          </button>

          {/* Category selector + add new */}
          <select value={categoryId ?? ''} onChange={e => {
            if (e.target.value === '__new__') { setShowNewCategory(true); setCategoryId(null); }
            else setCategoryId(e.target.value || null);
          }}
            className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md px-2 py-1 protocol-transition focus:outline-none border-none">
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {onAddCategory && <option value="__new__">+ New category</option>}
          </select>

          <span className="text-[10px] font-mono text-muted-foreground/40 ml-auto">enter ↵</span>
        </div>
      )}
      {showNewCategory && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <Hash className="h-3 w-3 text-muted-foreground" />
          <input
            ref={catInputRef}
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); } }}
            placeholder="Category name..."
            className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md px-2 py-1 protocol-transition focus:outline-none border-none flex-1"
          />
          <button onClick={handleAddCategory} className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 protocol-transition">Add</button>
          <button onClick={() => { setShowNewCategory(false); setNewCategoryName(''); }} className="text-[11px] font-mono px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 protocol-transition">Cancel</button>
        </div>
      )}
    </div>
  );
}
