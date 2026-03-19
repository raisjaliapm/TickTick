import { useState, useRef } from 'react';
import { Plus, Trash2, ChevronLeft, Package, FolderPlus, Paperclip, Upload, File as FileIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { useProductTracker, type TrackerItem } from '@/hooks/useProductTracker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

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

export function ProductTrackerView() {
  const tracker = useProductTracker();
  const { user } = useAuth();
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showNewPhase, setShowNewPhase] = useState(false);
  const [addingItemPhaseId, setAddingItemPhaseId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemPendingFiles, setNewItemPendingFiles] = useState<File[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [itemAttachments, setItemAttachments] = useState<Record<string, ItemAttachment[]>>({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddItem = async (phaseId: string) => {
    if (newItemTitle.trim()) {
      tracker.addItem(phaseId, newItemTitle.trim());
      
      // If there are pending files, upload them after a short delay to let the item be created
      if (newItemPendingFiles.length > 0 && user) {
        // We need to find the newly created item - fetch items and find by title
        setTimeout(async () => {
          const { data: phaseData } = await supabase.from('product_tracker_phases').select('id').eq('board_id', tracker.activeBoardId!).eq('user_id', user.id) as any;
          if (phaseData) {
            const phaseIds = phaseData.map((p: any) => p.id);
            const { data: allItems } = await supabase.from('product_tracker_items').select('*').in('phase_id', phaseIds).eq('user_id', user.id).order('created_at', { ascending: false }) as any;
            if (allItems && allItems.length > 0) {
              const newItem = allItems[0]; // Most recent
              for (const file of newItemPendingFiles) {
                if (file.size > MAX_FILE_SIZE) continue;
                const storagePath = `${user.id}/${newItem.id}/${Date.now()}-${file.name}`;
                const { error } = await supabase.storage.from('task-attachments').upload(storagePath, file);
                if (!error) {
                  await supabase.from('product_tracker_item_attachments').insert({
                    item_id: newItem.id, user_id: user.id, file_name: file.name,
                    file_size: file.size, file_type: file.type || null, storage_path: storagePath,
                  } as any);
                }
              }
            }
          }
        }, 500);
      }
      
      setNewItemTitle('');
      setNewItemPendingFiles([]);
      setAddingItemPhaseId(null);
    }
  };

  const handleCreateFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      toast({ title: 'File too large', description: `Max 100 MB. ${oversized.map(f => f.name).join(', ')} skipped.`, variant: 'destructive' });
    }
    const valid = Array.from(files).filter(f => f.size <= MAX_FILE_SIZE);
    setNewItemPendingFiles(prev => [...prev, ...valid]);
    if (createFileInputRef.current) createFileInputRef.current.value = '';
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
                        onClick={() => { setAddingItemPhaseId(phase.id); setNewItemTitle(''); }}
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
                        <Card key={col.key} className="shadow-none bg-secondary/30 border-border/50">
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
                              colItems.map(item => (
                                <Card key={item.id} className="shadow-sm hover:shadow-md hover:border-primary/30 protocol-transition bg-card">
                                  <CardContent className="p-3 space-y-2">
                                    <p className="text-sm text-foreground font-medium leading-snug">{item.title}</p>
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={item.status}
                                        onChange={e => tracker.updateItemStatus(item.id, e.target.value as TrackerItem['status'])}
                                        className="text-[10px] font-mono bg-secondary text-muted-foreground border border-border rounded px-1.5 py-0.5 focus:outline-none"
                                      >
                                        {statusColumns.map(s => (
                                          <option key={s.key} value={s.key}>{s.label}</option>
                                        ))}
                                      </select>
                                      {item.due_date && (
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                          {format(new Date(item.due_date), 'MMM d')}
                                        </span>
                                      )}
                                      <div className={`h-2 w-2 rounded-full ml-auto ${priorityColors[item.priority] || priorityColors.medium}`} />
                                    </div>
                                  </CardContent>
                                </Card>
                              ))
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
