import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Calendar, Flag, Repeat, Hash, Circle, Clock, Pause, CheckCircle2, Mic, MicOff, Globe, Square, FileText, Link, ListChecks, X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Priority, Category, TaskStatus } from '@/hooks/useTaskStore';
import { parseSpeechInput } from '@/lib/speechParser';
import { toast } from '@/hooks/use-toast';

export type Recurrence = 'daily' | 'weekly' | 'monthly' | null;

interface TaskInputProps {
  onAdd: (title: string, priority: Priority, dueDate: string | null, categoryId: string | null, recurrence?: Recurrence, status?: TaskStatus, extras?: { description?: string; notes?: string; urls?: string[]; subtasks?: string[] }) => void;
  categories: Category[];
  onAddCategory?: (name: string) => Promise<void>;
}

const priorityLabels: Record<Priority, string> = { low: 'Low', medium: 'Med', high: 'High', urgent: 'Urgent' };
const priorityColors: Record<Priority, string> = { low: 'text-priority-low', medium: 'text-priority-medium', high: 'text-priority-high', urgent: 'text-priority-urgent' };
const recurrenceLabels: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const speechLanguages = [
  { code: 'en-US', label: 'English' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'zh-CN', label: '中文' },
  { code: 'ja-JP', label: '日本語' },
  { code: 'ko-KR', label: '한국어' },
  { code: 'ar-SA', label: 'العربية' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
];

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
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('en-US');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    const recognition = new SR();
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const parsed = parseSpeechInput(finalTranscript, categories);
        setValue(prev => (prev ? prev + ' ' + parsed.cleanedText : parsed.cleanedText));
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.dueDate) setDueDate(parsed.dueDate);
        if (parsed.dueTime) setDueTime(parsed.dueTime);
        if (parsed.status) setStatus(parsed.status);
        if (parsed.recurrence) setRecurrence(parsed.recurrence);
        if (parsed.categoryId) setCategoryId(parsed.categoryId);

        // Build toast summary of detected fields
        const detected: string[] = [];
        if (parsed.priority) detected.push(`Priority: ${parsed.priority}`);
        if (parsed.dueDate) detected.push(`Due: ${parsed.dueDate}${parsed.dueTime ? ' ' + parsed.dueTime : ''}`);
        else if (parsed.dueTime) detected.push(`Time: ${parsed.dueTime}`);
        if (parsed.status) detected.push(`Status: ${parsed.status.replace('_', ' ')}`);
        if (parsed.recurrence) detected.push(`Repeat: ${parsed.recurrence}`);
        if (parsed.categoryId) {
          const cat = categories.find(c => c.id === parsed.categoryId);
          if (cat) detected.push(`Category: ${cat.name}`);
        }
        if (detected.length > 0) {
          toast({
            title: '🎙️ Voice input parsed',
            description: detected.join(' · '),
          });
        }
      }
      setExpanded(true);
    };
    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech') {
        setIsListening(false);
      }
    };
    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (ref is nulled on explicit stop)
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      } else {
        setIsListening(false);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setExpanded(true);
  }, [speechLang]);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  const handleSubmit = () => {
    if (!value.trim()) return;
    const dueDateWithTime = dueDate ? (dueTime ? `${dueDate}T${dueTime}` : dueDate) : null;
    const extras = {
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      urls: urls.length ? urls : undefined,
      subtasks: subtasks.length ? subtasks : undefined,
    };
    onAdd(value.trim(), priority, dueDateWithTime, categoryId, recurrence, status, extras);
    setValue(''); setPriority('medium'); setDueDate(''); setDueTime(''); setCategoryId(null); setRecurrence(null); setStatus('not_started');
    setDescription(''); setNotes(''); setUrls([]); setNewUrl(''); setSubtasks([]); setNewSubtask(''); setShowMore(false);
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
    <div className="mb-4 sm:mb-6">
      <div className="relative flex flex-col gap-2">
        <div className="relative flex-1">
          <button
            type="button"
            onClick={() => {
              if (value.trim()) {
                handleSubmit();
              } else {
                inputRef.current?.focus();
                setExpanded(true);
              }
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground protocol-transition hover:bg-secondary hover:text-foreground"
            title="Add task"
            aria-label="Add task"
          >
            <Plus className="h-4 w-4" />
          </button>
          <input ref={inputRef} type="text" value={value} onChange={e => setValue(e.target.value)} onKeyDown={handleKeyDown}
            onFocus={() => setExpanded(true)} placeholder="Add a task..."
            className="w-full bg-surface-well border border-border rounded-xl py-3 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring protocol-transition placeholder:text-muted-foreground/60" />
        </div>
        <div className="flex gap-1.5 sm:gap-2">
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(prev => !prev)}
              type="button"
              className="p-2.5 sm:p-3 rounded-xl protocol-transition bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95"
              title={`Language: ${speechLanguages.find(l => l.code === speechLang)?.label}`}
            >
              <Globe className="h-4 w-4" />
            </button>
            {showLangMenu && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px] max-h-[200px] overflow-y-auto">
                {speechLanguages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { setSpeechLang(lang.code); setShowLangMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent hover:text-accent-foreground protocol-transition ${speechLang === lang.code ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'}`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isListening ? (
            <button
              onClick={toggleListening}
              type="button"
              className="p-2.5 sm:p-3 rounded-xl protocol-transition bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95"
              title="Voice input"
            >
              <Mic className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-destructive/10 border border-destructive/30">
              <div className="flex items-end gap-[2px] h-4">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-destructive"
                    style={{
                      animation: `waveform 0.6s ease-in-out ${i * 0.08}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono text-destructive ml-1 animate-pulse">REC</span>
              <button
                onClick={stopListening}
                type="button"
                className="ml-1 p-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/80 protocol-transition active:scale-95"
                title="Stop recording"
              >
                <Square className="h-3 w-3 fill-current" />
              </button>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="flex-1 sm:flex-none px-4 py-2.5 sm:py-3 rounded-xl text-sm font-mono bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed protocol-transition active:scale-95"
          >
            Add
          </button>
        </div>
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

          <button
            onClick={() => setShowMore(!showMore)}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground ml-auto protocol-transition"
          >
            {showMore ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showMore ? 'Less' : 'More'}
          </button>
        </div>
      )}
      {expanded && showMore && (
        <div className="space-y-3 mt-3 px-1">
          {/* Description */}
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={2}
            className="w-full bg-secondary/50 rounded-md px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground resize-none border border-border"
          />

          {/* Subtasks */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Subtasks</span>
            </div>
            {subtasks.map((st, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-foreground flex-1">{st}</span>
                <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (newSubtask.trim()) {
                    setSubtasks([...subtasks, newSubtask.trim()]);
                    setNewSubtask('');
                  }
                }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition"
                title="Add subtask"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newSubtask.trim()) { setSubtasks([...subtasks, newSubtask.trim()]); setNewSubtask(''); } } }}
                placeholder="Add a subtask..."
                className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Links</span>
            </div>
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-primary truncate flex-1">{url}</span>
                <button onClick={() => setUrls(urls.filter((_, idx) => idx !== i))} className="p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (newUrl.trim()) {
                    setUrls([...urls, newUrl.trim()]);
                    setNewUrl('');
                  }
                }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition"
                title="Add URL"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newUrl.trim()) { setUrls([...urls, newUrl.trim()]); setNewUrl(''); } } }}
                placeholder="Add a URL..."
                className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Notes</span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-secondary/50 rounded-md px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground resize-y border border-border"
            />
          </div>

          <span className="text-[10px] font-mono text-muted-foreground/40 block text-right">enter ↵</span>
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
