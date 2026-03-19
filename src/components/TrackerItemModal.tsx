import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Paperclip, X, File as FileIcon, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { TrackerItem } from '@/hooks/useProductTracker';

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface ItemAttachment {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  created_at: string;
}

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'on_hold', label: 'On Hold' },
];

const priorityOptions = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

interface TrackerItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  phaseId?: string;
  item?: TrackerItem & { notes?: string };
  onSave: (data: {
    title: string;
    priority: string;
    status: TrackerItem['status'];
    due_date: string | null;
    assignee: string | null;
    notes: string;
  }) => Promise<string | void>;
  onFilesUploaded?: () => void;
}

export function TrackerItemModal({ open, onOpenChange, mode, phaseId, item, onSave, onFilesUploaded }: TrackerItemModalProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState<TrackerItem['status']>('todo');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [assignee, setAssignee] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<ItemAttachment[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && item) {
        setTitle(item.title);
        setPriority(item.priority);
        setStatus(item.status);
        setDueDate(item.due_date ? new Date(item.due_date) : undefined);
        setAssignee(item.assignee || '');
        setNotes((item as any).notes || '');
        setPendingFiles([]);
        // Fetch existing attachments
        fetchAttachments(item.id);
      } else {
        setTitle('');
        setPriority('medium');
        setStatus('todo');
        setDueDate(undefined);
        setAssignee('');
        setNotes('');
        setPendingFiles([]);
        setExistingAttachments([]);
      }
    }
  }, [open, mode, item]);

  const fetchAttachments = async (itemId: string) => {
    const { data } = await supabase.from('product_tracker_item_attachments').select('*').eq('item_id', itemId).order('created_at', { ascending: false }) as any;
    if (data) setExistingAttachments(data);
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: `Max 100 MB. ${oversized.map(f => f.name).join(', ')} skipped.`, variant: 'destructive' });
    }
    const valid = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
    setPendingFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteExistingAttachment = async (att: ItemAttachment) => {
    await supabase.storage.from('task-attachments').remove([att.storage_path]);
    await supabase.from('product_tracker_item_attachments').delete().eq('id', att.id);
    setExistingAttachments(prev => prev.filter(a => a.id !== att.id));
  };

  const downloadAttachment = async (att: ItemAttachment) => {
    const { data } = await supabase.storage.from('task-attachments').createSignedUrl(att.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const uploadFiles = async (itemId: string) => {
    if (!user || pendingFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const storagePath = `${user.id}/${itemId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('task-attachments').upload(storagePath, file);
        if (error) { toast({ title: 'Upload failed', description: `${file.name}: ${error.message}`, variant: 'destructive' }); continue; }
        await supabase.from('product_tracker_item_attachments').insert({
          item_id: itemId, user_id: user.id, file_name: file.name,
          file_size: file.size, file_type: file.type || null, storage_path: storagePath,
        } as any);
      }
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({
        title: title.trim(),
        priority,
        status,
        due_date: dueDate ? formatLocalDate(dueDate) : null,
        assignee: assignee.trim() || null,
        notes,
      });

      // Upload pending files
      const itemId = mode === 'edit' ? item?.id : result;
      if (itemId && pendingFiles.length > 0) {
        await uploadFiles(itemId as string);
      }

      onFilesUploaded?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New Task' : 'Edit Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="item-title">Task Name</Label>
            <Input
              id="item-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter task name..."
              autoFocus
            />
          </div>

          {/* Priority & Status row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as TrackerItem['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))
                  }
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date & Assignee row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                  {dueDate && (
                    <div className="px-3 pb-3">
                      <button onClick={() => setDueDate(undefined)} className="w-full text-xs text-destructive hover:underline">Clear date</button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-assignee">Assignee</Label>
              <Input
                id="item-assignee"
                value={assignee}
                onChange={e => setAssignee(e.target.value)}
                placeholder="Assignee name..."
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="item-notes">Notes</Label>
            <Textarea
              id="item-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={4}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <Label>Attachments</Label>

            {/* Existing attachments (edit mode) */}
            {existingAttachments.map(att => (
              <div key={att.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border">
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <button onClick={() => downloadAttachment(att)} className="text-xs text-primary hover:underline truncate flex-1 text-left">{att.file_name}</button>
                <span className="text-[10px] text-muted-foreground">{formatFileSize(att.file_size)}</span>
                <button onClick={() => deleteExistingAttachment(att)} className="p-0.5 text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Pending files */}
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 border border-border">
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{file.name}</span>
                <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} className="p-0.5 text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <input ref={fileInputRef} type="file" multiple onChange={e => handleFilesSelected(e.target.files)} className="hidden" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed"
            >
              <Paperclip className="h-3.5 w-3.5 mr-1.5" />
              Attach files
            </Button>
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving || uploading} className="w-full">
            {saving || uploading ? 'Saving...' : mode === 'create' ? 'Create Task' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
