import React, { useState, useRef, useEffect } from 'react';
import { Plus, Calendar, Flag } from 'lucide-react';
import type { Priority, Category } from '@/hooks/useTaskStore';

interface TaskInputProps {
  onAdd: (title: string, priority: Priority, dueDate: string | null, categoryId: string | null) => void;
  categories: Category[];
}

const priorityLabels: Record<Priority, string> = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urgent' };
const priorityColors: Record<Priority, string> = { low: 'text-priority-low', medium: 'text-priority-medium', high: 'text-priority-high', urgent: 'text-priority-urgent' };

export function TaskInput({ onAdd, categories }: TaskInputProps) {
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onAdd(value.trim(), priority, dueDate || null, categoryId);
      setValue(''); setPriority('medium'); setDueDate(''); setCategoryId(null);
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

  return (
    <div className="mb-6">
      <div className="relative">
        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input ref={inputRef} type="text" value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
          onFocus={() => setExpanded(true)} placeholder="Add a task..."
          className="w-full bg-surface-well border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring protocol-transition placeholder:text-muted-foreground/60" />
      </div>
      {expanded && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <button onClick={cyclePriority} className={`flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-md bg-secondary protocol-transition ${priorityColors[priority]}`}>
            <Flag className="h-3 w-3" />{priorityLabels[priority]}
          </button>
          <div className="relative">
            <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md pl-7 pr-2 py-1 protocol-transition focus:outline-none border-none" />
          </div>
          {categories.length > 0 && (
            <select value={categoryId ?? ''} onChange={e => setCategoryId(e.target.value || null)}
              className="text-[11px] font-mono bg-secondary text-secondary-foreground rounded-md px-2 py-1 protocol-transition focus:outline-none border-none">
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <span className="text-[10px] font-mono text-muted-foreground/40 ml-auto">enter ↵</span>
        </div>
      )}
    </div>
  );
}
