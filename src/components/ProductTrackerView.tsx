import { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, ChevronLeft, Package, FolderPlus, Paperclip, Upload, File as FileIcon, X, CalendarIcon, AlertTriangle, User, Copy, Pencil } from 'lucide-react';
import { format, isPast, startOfDay, differenceInDays } from 'date-fns';
import { useProductTracker, type TrackerItem } from '@/hooks/useProductTracker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProductTrackerDashboard } from '@/components/ProductTrackerDashboard';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { TrackerItemModal } from '@/components/TrackerItemModal';
import { cn } from '@/lib/utils';
import { formatLocalDate, parseLocalDate } from '@/lib/dateUtils';

const statusColumns: { key: TrackerItem['status']; label: string }[] = [
  { key: 'todo', label: 'TO DO' },
  { key: 'in_progress', label: 'IN PROGRESS' },
  { key: 'done', label: 'DONE' },
  { key: 'on_hold', label: 'ON HOLD' },
];

const priorityColors: Record<string, string> = {
  urgent: 'bg-priority-urgent',
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-priority-low',
};

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

function isOverdue(item: TrackerItem): boolean {
  if (!item.due_date || item.status === 'done') return false;
  return isPast(startOfDay(new Date(new Date(item.due_date).getTime() + 86400000)));
}

function overdueDays(item: TrackerItem): number {
  if (!item.due_date) return 0;
  return differenceInDays(startOfDay(new Date()), startOfDay(new Date(item.due_date)));
}

export function ProductTrackerView() {
  const tracker = useProductTracker();
  const { user } = useAuth();
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showNewPhase, setShowNewPhase] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemAttachments, setItemAttachments] = useState<Record<string, ItemAttachment[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [modalPhaseId, setModalPhaseId] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<TrackerItem | null>(null);

  const openCreateModal = (phaseId: string) => {
    setModalPhaseId(phaseId);
    setModalMode('create');
    setModalItem(null);
    setModalOpen(true);
  };

  const openEditModal = (item: TrackerItem) => {
    setModalMode('edit');
    setModalItem(item);
    setModalPhaseId(item.phase_id);
    setModalOpen(true);
  };

  const handleModalSave = async (data: { title: string; priority: string; status: TrackerItem['status']; due_date: string | null; assignee: string | null; notes: string }) => {
    if (modalMode === 'create' && modalPhaseId) {
      const newId = await tracker.addItem(modalPhaseId, data.title, {
        priority: data.priority,
        status: data.status,
        due_date: data.due_date,
        assignee: data.assignee,
        notes: data.notes,
      });
      return newId;
    } else if (modalMode === 'edit' && modalItem) {
      await tracker.updateItem(modalItem.id, {
        title: data.title,
        priority: data.priority,
        status: data.status,
        due_date: data.due_date,
        assignee: data.assignee,
        notes: data.notes,
      });
      return modalItem.id;
    }
  };

  const handleModalFilesUploaded = () => {
    if (modalItem) fetchItemAttachments(modalItem.id);
  };

  const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    setDragItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) {
      tracker.updateItemStatus(itemId, colKey as TrackerItem['status']);
    }
    setDragItemId(null);
    setDragOverCol(null);
  }, [tracker]);

  const fetchItemAttachments = async (itemId: string) => {
    const { data } = await supabase.from('product_tracker_item_attachments').select('*').eq('item_id', itemId).order('created_at', { ascending: false }) as any;
    if (data) setItemAttachments(prev => ({ ...prev, [itemId]: data }));
  };

  const handleExpandItem = (itemId: string) => {
    if (expandedItemId === itemId) {
      setExpandedItemId(null);
    } else {
      setExpandedItemId(itemId);
      if (!itemAttachments[itemId]) fetchItemAttachments(itemId);
    }
  };

  const handleItemFileUpload = async (files: FileList | null, itemId: string) => {
    if (!files || !user) return;
    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: `Max 100 MB. ${oversized.map(f => f.name).join(', ')} skipped.`, variant: 'destructive' });
    }
    const validFiles = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of validFiles) {
        const storagePath = `${user.id}/${itemId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from('task-attachments').upload(storagePath, file);
        if (error) { toast({ title: 'Upload failed', description: `${file.name}: ${error.message}`, variant: 'destructive' }); continue; }
        await supabase.from('product_tracker_item_attachments').insert({
          item_id: itemId, user_id: user.id, file_name: file.name,
          file_size: file.size, file_type: file.type || null, storage_path: storagePath,
        } as any);
      }
      await fetchItemAttachments(itemId);
      toast({ title: 'Files uploaded', description: `${validFiles.length} file(s) uploaded` });
    } catch { toast({ title: 'Upload error', variant: 'destructive' }); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const deleteItemAttachment = async (att: ItemAttachment, itemId: string) => {
    await supabase.storage.from('task-attachments').remove([att.storage_path]);
    await supabase.from('product_tracker_item_attachments').delete().eq('id', att.id);
    setItemAttachments(prev => ({ ...prev, [itemId]: (prev[itemId] || []).filter(a => a.id !== att.id) }));
  };

  const downloadItemAttachment = async (att: ItemAttachment) => {
    const { data } = await supabase.storage.from('task-attachments').createSignedUrl(att.storage_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleAddBoard = () => {
    if (newBoardName.trim()) {
      tracker.addBoard(newBoardName.trim());
      setNewBoardName('');
      setShowCreateBoard(false);
    }
  };

  const handleAddPhase = () => {
    if (newPhaseName.trim() && tracker.activeBoardId) {
      tracker.addPhase(tracker.activeBoardId, newPhaseName.trim());
      setNewPhaseName('');
      setShowNewPhase(false);
    }
  };


  if (tracker.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Board list view
  if (!tracker.activeBoardId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Product Management Tracker</h2>
          <p className="text-sm text-muted-foreground mt-1">Organize product phases with mini Kanban boards</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Existing boards as cards */}
          {tracker.boards.map(board => (
            <Card
              key={board.id}
              className="cursor-pointer hover:border-primary/40 hover:shadow-lg protocol-transition group relative overflow-hidden"
              onClick={() => tracker.setActiveBoardId(board.id)}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary/60" />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{board.name}</CardTitle>
                  <button
                    onClick={(e) => { e.stopPropagation(); tracker.deleteBoard(board.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 protocol-transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CardDescription>
                  Created {format(new Date(board.created_at), 'MMM d, yyyy')}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}

          {/* Create New Board card */}
          {!showCreateBoard ? (
            <Card
              className="cursor-pointer border-dashed hover:border-primary/40 hover:shadow-md protocol-transition flex items-center justify-center min-h-[120px]"
              onClick={() => setShowCreateBoard(true)}
            >
              <CardContent className="flex flex-col items-center gap-2 py-6">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <FolderPlus className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Create New Board</span>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-primary/30 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">New Board</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={e => setNewBoardName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddBoard(); if (e.key === 'Escape') { setShowCreateBoard(false); setNewBoardName(''); } }}
                  placeholder="Board name..."
                  className="w-full text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddBoard}
                    disabled={!newBoardName.trim()}
                    className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 protocol-transition"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => { setShowCreateBoard(false); setNewBoardName(''); }}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent border border-border protocol-transition"
                  >
                    Cancel
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {tracker.boards.length === 0 && !showCreateBoard && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No boards yet. Click "Create New Board" to get started!</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dashboard Section */}
        {tracker.boards.length > 0 && (
          <ProductTrackerDashboard
            boards={tracker.boards}
            onSelectBoard={(boardId) => tracker.setActiveBoardId(boardId)}
          />
        )}
      </div>
    );
  }

  // Board detail view with phases
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => tracker.setActiveBoardId(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl truncate">{tracker.activeBoard?.name}</CardTitle>
              <CardDescription className="mt-0.5">{tracker.phases.length} phase{tracker.phases.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <button
              onClick={() => setShowNewPhase(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 protocol-transition"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Phase</span>
            </button>
          </div>
        </CardHeader>

        {/* New phase input */}
        {showNewPhase && (
          <CardContent className="pt-0">
            <Card className="border-primary/30">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPhaseName}
                    onChange={e => setNewPhaseName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddPhase(); if (e.key === 'Escape') setShowNewPhase(false); }}
                    placeholder="Phase name..."
                    className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button onClick={handleAddPhase} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 protocol-transition">Add</button>
                  <button onClick={() => setShowNewPhase(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent border border-border protocol-transition">Cancel</button>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      {/* Phases */}
      {tracker.phases.length === 0 && !showNewPhase ? (
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No phases yet. Click "Add Phase" to start organizing!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {tracker.phases.map(phase => {
            const phaseItems = tracker.items.filter(i => i.phase_id === phase.id);
            const totalItems = phaseItems.length;
            const doneItems = phaseItems.filter(i => i.status === 'done').length;

            return (
              <Card key={phase.id} className="overflow-hidden">
                {/* Phase header with accent bar */}
                <div className="h-0.5 bg-primary/40" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base">{phase.name}</CardTitle>
                      {totalItems > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                          {doneItems}/{totalItems} done
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openCreateModal(phase.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md protocol-transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Task
                      </button>
                      <button
                        onClick={() => tracker.deletePhase(phase.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 protocol-transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* Inline add item */}
                  {addingItemPhaseId === phase.id && (
                    <Card className="mb-4 border-primary/30">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddItem(phase.id); if (e.key === 'Escape') { setAddingItemPhaseId(null); setNewItemPendingFiles([]); } }}
                            placeholder="Task title..."
                            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                          <button onClick={() => handleAddItem(phase.id)} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 protocol-transition">Add</button>
                        </div>
                        {/* Pending files */}
                        {newItemPendingFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-secondary/50 border border-border">
                            <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[10px] text-foreground truncate flex-1">{file.name}</span>
                            <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                            <button onClick={() => setNewItemPendingFiles(prev => prev.filter((_, i) => i !== idx))} className="p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                          </div>
                        ))}
                        {/* File upload button */}
                        <div>
                          <input ref={createFileInputRef} type="file" multiple onChange={e => handleCreateFilesSelected(e.target.files)} className="hidden" />
                          <button
                            onClick={() => createFileInputRef.current?.click()}
                            className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground rounded border border-dashed border-border hover:border-primary/30 protocol-transition"
                          >
                            <Paperclip className="h-3 w-3" /> Attach files
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Mini kanban columns */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {statusColumns.map(col => {
                      const colItems = phaseItems.filter(i => i.status === col.key);
                      return (
                        <Card
                          key={col.key}
                          className={cn(
                            "shadow-none bg-secondary/30 border-border/50 protocol-transition",
                            dragOverCol === `${phase.id}:${col.key}` && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          )}
                          onDragOver={e => handleDragOver(e, `${phase.id}:${col.key}`)}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, col.key)}
                        >
                          <CardHeader className="p-3 pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-background text-muted-foreground">{colItems.length}</span>
                              </div>
                              <button
                                onClick={() => { setAddingItemPhaseId(phase.id + ':' + col.key); setNewItemTitle(''); }}
                                className="p-0.5 rounded text-muted-foreground/50 hover:text-muted-foreground protocol-transition"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </CardHeader>

                          <CardContent className="p-3 pt-0 space-y-2 min-h-[60px]">
                            {/* Inline add for specific column */}
                            {addingItemPhaseId === phase.id + ':' + col.key && (
                              <input
                                type="text"
                                value={newItemTitle}
                                onChange={e => setNewItemTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && newItemTitle.trim()) {
                                    tracker.addItem(phase.id, newItemTitle.trim());
                                    setNewItemTitle('');
                                    setAddingItemPhaseId(null);
                                  }
                                  if (e.key === 'Escape') setAddingItemPhaseId(null);
                                }}
                                placeholder="Task..."
                                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                            )}

                            {colItems.length === 0 && addingItemPhaseId !== phase.id + ':' + col.key ? (
                              <div className="border border-dashed border-border/60 rounded-lg p-4 text-center">
                                <span className="text-[10px] text-muted-foreground/60">Empty</span>
                              </div>
                            ) : (
                              colItems.map(item => {
                                const atts = itemAttachments[item.id] || [];
                                const isExpanded = expandedItemId === item.id;
                                const itemOverdue = isOverdue(item);
                                const days = overdueDays(item);
                                return (
                                <Card
                                  key={item.id}
                                  tabIndex={0}
                                  draggable
                                  onDragStart={e => handleDragStart(e, item.id)}
                                  onDragEnd={() => { setDragItemId(null); setDragOverCol(null); }}
                                  onKeyDown={(e) => {
                                    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
                                    const isDup = isMac ? e.metaKey && e.key.toLowerCase() === 'd' : e.altKey && e.key.toLowerCase() === 'd';
                                    if (isDup) { e.preventDefault(); tracker.duplicateItem(item); }
                                  }}
                                  className={cn(
                                    "shadow-sm hover:shadow-md hover:border-primary/30 protocol-transition bg-card cursor-grab active:cursor-grabbing focus:outline-none focus:ring-1 focus:ring-primary/50",
                                    dragItemId === item.id && "opacity-50",
                                    itemOverdue && "border-destructive/50 bg-destructive/5"
                                  )}
                                >
                                  <CardContent className="p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                      <p className="text-sm text-foreground font-medium leading-snug flex-1">{item.title}</p>
                                      {itemOverdue && (
                                        <span className="flex items-center gap-0.5 shrink-0 text-[9px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                                          <AlertTriangle className="h-2.5 w-2.5" />
                                          {days}d overdue
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <select
                                        value={item.status}
                                        onChange={e => tracker.updateItemStatus(item.id, e.target.value as TrackerItem['status'])}
                                        className="text-[10px] font-mono bg-secondary text-muted-foreground border border-border rounded px-1.5 py-0.5 focus:outline-none"
                                      >
                                        {statusColumns.map(s => (
                                          <option key={s.key} value={s.key}>{s.label}</option>
                                        ))}
                                      </select>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            className={cn(
                                              "flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border hover:border-primary/30 protocol-transition",
                                              itemOverdue
                                                ? "text-destructive bg-destructive/10 border-destructive/30"
                                                : item.due_date
                                                  ? "text-foreground bg-secondary border-border"
                                                  : "text-muted-foreground/60 border-dashed border-border"
                                            )}
                                          >
                                            <CalendarIcon className="h-2.5 w-2.5" />
                                            {item.due_date ? format(new Date(item.due_date), 'MMM d') : 'Due date'}
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <Calendar
                                            mode="single"
                                            selected={item.due_date ? new Date(item.due_date) : undefined}
                                            onSelect={(date) => {
                                              tracker.updateItemDueDate(item.id, date ? formatLocalDate(date) : null);
                                            }}
                                            initialFocus
                                            className={cn("p-3 pointer-events-auto")}
                                          />
                                          {item.due_date && (
                                            <div className="px-3 pb-3">
                                              <button
                                                onClick={() => tracker.updateItemDueDate(item.id, null)}
                                                className="w-full text-xs text-destructive hover:underline"
                                              >
                                                Clear due date
                                              </button>
                                            </div>
                                          )}
                                        </PopoverContent>
                                      </Popover>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button
                                            className={cn(
                                              "flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border hover:border-primary/30 protocol-transition max-w-[90px] truncate",
                                              item.assignee ? "text-foreground bg-secondary border-border" : "text-muted-foreground/60 border-dashed border-border"
                                            )}
                                          >
                                            <User className="h-2.5 w-2.5 shrink-0" />
                                            <span className="truncate">{item.assignee || 'Assign'}</span>
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-48 p-2" align="start">
                                          <input
                                            type="text"
                                            defaultValue={item.assignee || ''}
                                            placeholder="Assignee name..."
                                            className="w-full text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                const val = (e.target as HTMLInputElement).value.trim();
                                                tracker.updateItemAssignee(item.id, val || null);
                                              }
                                            }}
                                            onBlur={e => {
                                              const val = e.target.value.trim();
                                              tracker.updateItemAssignee(item.id, val || null);
                                            }}
                                            autoFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleExpandItem(item.id); }}
                                        className={`p-0.5 rounded protocol-transition ${isExpanded ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                                      >
                                        <Paperclip className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); tracker.duplicateItem(item); }}
                                        className="p-0.5 rounded text-muted-foreground/50 hover:text-primary protocol-transition"
                                        title="Duplicate (⌘+D)"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                      <div className={`h-2 w-2 rounded-full ml-auto ${priorityColors[item.priority] || priorityColors.medium}`} />
                                    </div>

                                    {/* Expanded attachment section */}
                                    {isExpanded && (
                                      <div className="border-t border-border pt-2 space-y-1.5">
                                        {atts.map(att => (
                                          <div key={att.id} className="flex items-center gap-1.5 group/att">
                                            <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                                            <button onClick={() => downloadItemAttachment(att)} className="text-[10px] text-primary hover:underline truncate flex-1 text-left">{att.file_name}</button>
                                            <span className="text-[9px] text-muted-foreground">{formatFileSize(att.file_size)}</span>
                                            <button onClick={() => deleteItemAttachment(att, item.id)} className="opacity-0 group-hover/att:opacity-100 p-0.5 text-muted-foreground hover:text-destructive">
                                              <Trash2 className="h-2.5 w-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                        <div>
                                          <input
                                            type="file"
                                            multiple
                                            onChange={e => { handleItemFileUpload(e.target.files, item.id); }}
                                            className="hidden"
                                            id={`file-upload-${item.id}`}
                                          />
                                          <button
                                            onClick={() => document.getElementById(`file-upload-${item.id}`)?.click()}
                                            disabled={uploading}
                                            className="flex items-center gap-1 w-full px-2 py-1 text-[10px] rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/30 protocol-transition disabled:opacity-50"
                                          >
                                            <Upload className="h-3 w-3" />
                                            {uploading ? 'Uploading...' : 'Upload files (max 100 MB)'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                                );
                              })
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
