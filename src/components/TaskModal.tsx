import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Flag, Repeat, Hash, Circle, Clock, Pause, CheckCircle2,
  X, CalendarDays, Link as LinkIcon, FileText, ListChecks, Save,
  Mic, Square, Globe, Paperclip, Upload, Trash2, File
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatLocalDateTime } from '@/lib/dateUtils';
import { parseSpeechInput } from '@/lib/speechParser';
import { toast } from '@/hooks/use-toast';
import type { Task, Priority, Category, TaskStatus } from '@/hooks/useTaskStore';
import type { Project } from '@/hooks/useProjectStore';

export type Recurrence = 'daily' | 'weekly' | 'monthly' | null;

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  task?: Task | null;
  categories: Category[];
  projects?: Project[];
  activeProjectId?: string | null;
  onAddCategory?: (name: string) => Promise<void>;
  onSave: (data: TaskModalData) => void;
  onUpdateStatus?: (id: string, status: TaskStatus) => void;
  defaultDate?: Date | null;
  defaultHour?: number | null;
}

export interface TaskModalData {
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  startDate: string | null;
  endDate: string | null;
  categoryId: string | null;
  recurrence: Recurrence;
  notes: string;
  urls: string[];
  subtasks: string[];
  projectId: string | null;
  pendingFiles?: File[];
}

const priorityOptions: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-priority-low' },
  { value: 'medium', label: 'Medium', color: 'text-priority-medium' },
  { value: 'high', label: 'High', color: 'text-priority-high' },
  { value: 'urgent', label: 'Urgent', color: 'text-priority-urgent' },
];

const statusOptions: { value: TaskStatus; label: string; icon: React.ElementType; colorClass: string }[] = [
  { value: 'not_started', label: 'Not Started', icon: Circle, colorClass: 'text-[hsl(var(--status-not-started))]' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, colorClass: 'text-[hsl(var(--status-in-progress))]' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, colorClass: 'text-[hsl(var(--status-on-hold))]' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, colorClass: 'text-[hsl(var(--status-completed))]' },
];

const recurrenceOptions: { value: Recurrence; label: string }[] = [
  { value: null, label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

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

// Subtask type for editing existing tasks
interface Subtask {
  id: string;
  title: string;
  is_completed: boolean;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  created_at: string;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function TaskModal({
  open, onOpenChange, mode, task, categories, projects, activeProjectId,
  onAddCategory, onSave, onUpdateStatus, defaultDate, defaultHour,
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>('not_started');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>(null);
  const [notes, setNotes] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newSubtaskItems, setNewSubtaskItems] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);

  // Existing subtasks (edit mode)
  const [existingSubtasks, setExistingSubtasks] = useState<Subtask[]>([]);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice input
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('en-US');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const recognitionRef = useRef<any>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  // Initialize form when opening
  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority as Priority);
      setStatus(task.status as TaskStatus);
      if (task.due_date) {
        const d = new Date(task.due_date);
        setDueDate(d);
        const h = d.getHours();
        const m = d.getMinutes();
        setDueTime((h === 0 && m === 0) ? '' : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      } else {
        setDueDate(undefined);
        setDueTime('');
      }
      setStartDate((task as any).start_date ? new Date((task as any).start_date) : undefined);
      setEndDate((task as any).end_date ? new Date((task as any).end_date) : undefined);
      setCategoryId(task.category_id);
      setRecurrence((task as any).recurrence || null);
      setNotes((task as any).notes || '');
      setUrls(Array.isArray((task as any).urls) ? (task as any).urls : []);
      setProjectId((task as any).project_id || null);
      setNewSubtaskItems([]);
      // Fetch existing subtasks
      fetchExistingSubtasks(task.id);
      fetchAttachments(task.id);
    } else {
      // Create mode
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStatus('not_started');
      if (defaultDate) {
        setDueDate(defaultDate);
        setDueTime(defaultHour != null ? `${String(defaultHour).padStart(2, '0')}:00` : '');
      } else {
        setDueDate(undefined);
        setDueTime('');
      }
      setCategoryId(null);
      setRecurrence(null);
      setNotes('');
      setUrls([]);
      setNewSubtaskItems([]);
      setProjectId(activeProjectId || null);
      setExistingSubtasks([]);
      setAttachments([]);
      setPendingFiles([]);
      setStartDate(undefined);
      setEndDate(undefined);
    }
    setNewUrl('');
    setNewSubtask('');
    setShowNewCategory(false);
    setNewCategoryName('');
  }, [open, mode, task, activeProjectId, defaultDate, defaultHour]);

  const fetchExistingSubtasks = async (taskId: string) => {
    const { data } = await supabase.from('subtasks').select('*').eq('task_id', taskId).order('sort_order', { ascending: true });
    if (data) setExistingSubtasks(data as any);
  };

  const toggleExistingSubtask = async (id: string, currentState: boolean) => {
    await supabase.from('subtasks').update({ is_completed: !currentState } as any).eq('id', id);
    setExistingSubtasks(prev => prev.map(s => s.id === id ? { ...s, is_completed: !currentState } : s));
  };

  const deleteExistingSubtask = async (id: string) => {
    await supabase.from('subtasks').delete().eq('id', id);
    setExistingSubtasks(prev => prev.filter(s => s.id !== id));
  };

  // Attachment functions
  const fetchAttachments = async (taskId: string) => {
    const { data } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false }) as any;
    if (data) setAttachments(data);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    
    // In create mode, just store files locally
    if (mode === 'create') {
      const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        toast({ title: 'File too large', description: `Max file size is 100 MB. ${oversized.map(f => f.name).join(', ')} skipped.`, variant: 'destructive' });
      }
      const validFiles = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
      setPendingFiles(prev => [...prev, ...validFiles]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    if (!task || mode !== 'edit') return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: `Max file size is 100 MB. ${oversized.map(f => f.name).join(', ')} skipped.`, variant: 'destructive' });
    }

    const validFiles = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of validFiles) {
        const storagePath = `${userData.user.id}/${task.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('task-attachments').upload(storagePath, file);
        if (uploadError) {
          toast({ title: 'Upload failed', description: `${file.name}: ${uploadError.message}`, variant: 'destructive' });
          continue;
        }
        await supabase.from('task_attachments').insert({
          task_id: task.id, user_id: userData.user.id, file_name: file.name,
          file_size: file.size, file_type: file.type || null, storage_path: storagePath,
        } as any);
      }
      await fetchAttachments(task.id);
      toast({ title: 'Files uploaded', description: `${validFiles.length} file(s) uploaded successfully` });
    } catch {
      toast({ title: 'Upload error', description: 'Something went wrong', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteAttachment = async (att: Attachment) => {
    await supabase.storage.from('task-attachments').remove([att.storage_path]);
    await supabase.from('task_attachments').delete().eq('id', att.id);
    setAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  const downloadAttachment = async (att: Attachment) => {
    const { data } = await supabase.storage.from('task-attachments').createSignedUrl(att.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    rec?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition is not supported in your browser.'); return; }
    const recognition = new SR();
    recognition.lang = speechLang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) {
        const parsed = parseSpeechInput(finalTranscript, categories);
        setTitle(prev => (prev ? prev + ' ' + parsed.cleanedText : parsed.cleanedText));
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.dueDate) {
          setDueDate(new Date(parsed.dueDate));
        }
        if (parsed.dueTime) setDueTime(parsed.dueTime);
        if (parsed.status) setStatus(parsed.status);
        if (parsed.recurrence) setRecurrence(parsed.recurrence);
        if (parsed.categoryId) setCategoryId(parsed.categoryId);

        const detected: string[] = [];
        if (parsed.priority) detected.push(`Priority: ${parsed.priority}`);
        if (parsed.dueDate) detected.push(`Due: ${parsed.dueDate}`);
        if (parsed.status) detected.push(`Status: ${parsed.status.replace('_', ' ')}`);
        if (parsed.recurrence) detected.push(`Repeat: ${parsed.recurrence}`);
        if (detected.length > 0) {
          toast({ title: '🎙️ Voice input parsed', description: detected.join(' · ') });
        }
      }
    };
    recognition.onerror = (e: any) => { if (e.error !== 'no-speech') setIsListening(false); };
    recognition.onend = () => {
      if (recognitionRef.current) { try { recognitionRef.current.start(); } catch {} } else setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [speechLang, categories]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    let finalDueDate: string | null = null;
    if (dueDate) {
      const d = new Date(dueDate);
      if (dueTime) {
        const [h, m] = dueTime.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      } else {
        d.setHours(0, 0, 0, 0);
      }
      finalDueDate = dueTime ? `${format(d, 'yyyy-MM-dd')}T${dueTime}` : format(d, 'yyyy-MM-dd');
    }

    onSave({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      dueDate: finalDueDate,
      startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
      endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
      categoryId,
      recurrence,
      notes: notes.trim(),
      urls,
      subtasks: newSubtaskItems,
      projectId,
      pendingFiles: mode === 'create' && pendingFiles.length > 0 ? pendingFiles : undefined,
    });

    if (isListening) stopListening();
    onOpenChange(false);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !onAddCategory) return;
    await onAddCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const addUrl = () => {
    if (!newUrl.trim()) return;
    setUrls([...urls, newUrl.trim()]);
    setNewUrl('');
  };

  const addSubtaskItem = () => {
    if (!newSubtask.trim()) return;
    setNewSubtaskItems([...newSubtaskItems, newSubtask.trim()]);
    setNewSubtask('');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o && isListening) stopListening();
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-foreground">
              {mode === 'create' ? 'Create Task' : 'Edit Task'}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Title with voice input */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Title</label>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && title.trim()) { e.preventDefault(); handleSubmit(); } }}
                placeholder="What needs to be done?"
                className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
              />
              <div className="relative">
                <button
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground protocol-transition"
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
                  onClick={startListening}
                  className="p-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground protocol-transition"
                  title="Voice input"
                >
                  <Mic className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={stopListening}
                  className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 protocol-transition animate-pulse"
                  title="Stop recording"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details..."
              rows={2}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground resize-none focus:ring-1 focus:ring-ring protocol-transition"
            />
          </div>

          {/* Two-column grid for Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Priority</label>
              <div className="flex flex-wrap gap-1">
                {priorityOptions.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-mono capitalize protocol-transition ${priority === p.value ? `${p.color} bg-secondary border border-current/30 font-medium` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1">
                {statusOptions.map(s => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.value}
                      onClick={() => {
                        setStatus(s.value);
                        if (mode === 'edit' && task && onUpdateStatus) {
                          onUpdateStatus(task.id, s.value);
                        }
                      }}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono protocol-transition ${status === s.value ? `${s.colorClass} bg-secondary border border-current/30 font-medium` : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                    >
                      <Icon className="h-3 w-3" />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Start Date</label>
              <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border protocol-transition">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Set start date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={d => { setStartDate(d); setStartCalendarOpen(false); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {startDate && (
                    <div className="px-3 pb-3">
                      <button onClick={() => { setStartDate(undefined); setStartCalendarOpen(false); }} className="text-[11px] font-mono text-destructive hover:underline">
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">End Date</label>
              <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border protocol-transition">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Set end date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={d => { setEndDate(d); setEndCalendarOpen(false); }}
                    disabled={startDate ? (date) => date < startDate : undefined}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {endDate && (
                    <div className="px-3 pb-3">
                      <button onClick={() => { setEndDate(undefined); setEndCalendarOpen(false); }} className="text-[11px] font-mono text-destructive hover:underline">
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Due Date, Time, Recurrence */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Due Date & Recurrence</label>
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border protocol-transition">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Set due date'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={d => { setDueDate(d); setCalendarOpen(false); }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                  {dueDate && (
                    <div className="px-3 pb-3">
                      <button onClick={() => { setDueDate(undefined); setDueTime(''); setCalendarOpen(false); }} className="text-[11px] font-mono text-destructive hover:underline">
                        Clear date
                      </button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {dueDate && (
                <div className="relative">
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="time"
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    className="text-xs font-mono bg-secondary text-secondary-foreground rounded-lg pl-8 pr-2 py-1.5 border border-border protocol-transition focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              <div className="flex items-center gap-1">
                <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                {recurrenceOptions.map(r => (
                  <button
                    key={r.label}
                    onClick={() => setRecurrence(r.value)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono protocol-transition ${recurrence === r.value ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category & Project row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Category</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryId(null)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono protocol-transition ${categoryId === null ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                >
                  None
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono protocol-transition ${categoryId === c.id ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
                  >
                    {c.name}
                  </button>
                ))}
                {onAddCategory && (
                  <button
                    onClick={() => setShowNewCategory(true)}
                    className="px-2 py-1 rounded-md text-[11px] font-mono bg-secondary text-muted-foreground hover:bg-secondary/80 protocol-transition"
                  >
                    + New
                  </button>
                )}
              </div>
              {showNewCategory && (
                <div className="flex items-center gap-2 mt-1">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowNewCategory(false); setNewCategoryName(''); } }}
                    placeholder="Category name..."
                    className="text-[11px] font-mono bg-secondary rounded-md px-2 py-1 focus:outline-none border border-border flex-1"
                  />
                  <button onClick={handleAddCategory} className="text-[11px] font-mono px-2 py-1 rounded-md bg-primary text-primary-foreground">Add</button>
                </div>
              )}
            </div>

            {/* Project */}
            {projects && projects.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Project</label>
                <select
                  value={projectId || ''}
                  onChange={e => setProjectId(e.target.value || null)}
                  className="w-full text-xs font-mono bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring protocol-transition"
                >
                  <option value="">No project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Subtasks</label>
              {(existingSubtasks.length + newSubtaskItems.length) > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                  {existingSubtasks.filter(s => s.is_completed).length}/{existingSubtasks.length + newSubtaskItems.length}
                </span>
              )}
            </div>
            {/* Existing subtasks (edit mode) */}
            {existingSubtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 group/subtask">
                <button
                  onClick={() => toggleExistingSubtask(st.id, st.is_completed)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border protocol-transition ${st.is_completed ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary'}`}
                >
                  {st.is_completed && <span className="text-primary-foreground text-[10px]">✓</span>}
                </button>
                <span className={`text-xs flex-1 ${st.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{st.title}</span>
                <button onClick={() => deleteExistingSubtask(st.id)} className="opacity-0 group-hover/subtask:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {/* New subtasks */}
            {newSubtaskItems.map((st, i) => (
              <div key={`new-${i}`} className="flex items-center gap-2">
                <div className="h-4 w-4 shrink-0 rounded border border-muted-foreground/40" />
                <span className="text-xs text-foreground flex-1">{st}</span>
                <button onClick={() => setNewSubtaskItems(prev => prev.filter((_, idx) => idx !== i))} className="p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (newSubtask.trim()) addSubtaskItem(); else subtaskInputRef.current?.focus(); }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input
                ref={subtaskInputRef}
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtaskItem(); } }}
                placeholder="Add a subtask..."
                className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Links</label>
            </div>
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 group/url">
                <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate flex-1">{url}</a>
                <button onClick={() => setUrls(urls.filter((_, idx) => idx !== i))} className="opacity-0 group-hover/url:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
            }
            <div className="flex items-center gap-2">
              <button
                onClick={() => { if (newUrl.trim()) addUrl(); else urlInputRef.current?.focus(); }}
                className="shrink-0 p-0.5 rounded hover:bg-secondary protocol-transition"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <input
                ref={urlInputRef}
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                placeholder="Add a URL..."
                className="flex-1 text-xs bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-2 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Attachments</label>
              {attachments.length > 0 && (
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Existing attachments */}
            {attachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 group/att p-2 rounded-lg bg-secondary/50 border border-border">
                <File className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <button onClick={() => downloadAttachment(att)} className="text-xs text-primary hover:underline truncate block max-w-full text-left">
                    {att.file_name}
                  </button>
                  <span className="text-[10px] text-muted-foreground">{formatFileSize(att.file_size)}</span>
                </div>
                <button onClick={() => deleteAttachment(att)} className="opacity-0 group-hover/att:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive protocol-transition">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Upload area */}
            {mode === 'edit' && task && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={e => handleFileUpload(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-dashed border-border bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50 hover:border-primary/30 protocol-transition disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-xs">{uploading ? 'Uploading...' : 'Upload files (max 100 MB each)'}</span>
                </button>
              </div>
            )}

            {mode === 'create' && (
              <p className="text-[10px] text-muted-foreground">Save the task first, then add attachments by editing it.</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5 border-t border-border pt-4">
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Notes</label>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground resize-y focus:ring-1 focus:ring-ring protocol-transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed protocol-transition"
            >
              {mode === 'create' ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {mode === 'create' ? 'Create Task' : 'Save Changes'}
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 protocol-transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
