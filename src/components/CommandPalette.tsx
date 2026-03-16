import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Command, Search } from 'lucide-react';
import type { Task } from '@/types/task';

interface CommandPaletteProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSearch: (query: string) => void;
}

export function CommandPalette({ tasks, onToggle, onDelete, onSearch }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setQuery('');
    }
  }, [open]);

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">esc</kbd>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin p-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks found.</p>
            )}
            {filtered.map(task => (
              <button
                key={task.id}
                onClick={() => { onToggle(task.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-task-hover protocol-transition"
              >
                <span className={`h-2 w-2 rounded-full ${task.status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className={task.status === 'completed' ? 'text-task-completed line-through' : 'text-foreground'}>
                  {task.title}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
