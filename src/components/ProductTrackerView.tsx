import { useState } from 'react';
import { Plus, Trash2, ChevronLeft, Package } from 'lucide-react';
import { format } from 'date-fns';
import { useProductTracker, type TrackerItem } from '@/hooks/useProductTracker';

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

export function ProductTrackerView() {
  const tracker = useProductTracker();
  const [newBoardName, setNewBoardName] = useState('');
  const [newPhaseName, setNewPhaseName] = useState('');
  const [showNewPhase, setShowNewPhase] = useState(false);
  const [addingItemPhaseId, setAddingItemPhaseId] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');

  const handleAddBoard = () => {
    if (newBoardName.trim()) {
      tracker.addBoard(newBoardName.trim());
      setNewBoardName('');
    }
  };

  const handleAddPhase = () => {
    if (newPhaseName.trim() && tracker.activeBoardId) {
      tracker.addPhase(tracker.activeBoardId, newPhaseName.trim());
      setNewPhaseName('');
      setShowNewPhase(false);
    }
  };

  const handleAddItem = (phaseId: string) => {
    if (newItemTitle.trim()) {
      tracker.addItem(phaseId, newItemTitle.trim());
      setNewItemTitle('');
      setAddingItemPhaseId(null);
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

        <div className="flex gap-2">
          <input
            type="text"
            value={newBoardName}
            onChange={e => setNewBoardName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddBoard()}
            placeholder="New board name..."
            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleAddBoard}
            disabled={!newBoardName.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 protocol-transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {tracker.boards.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No boards yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tracker.boards.map(board => (
              <button
                key={board.id}
                onClick={() => tracker.setActiveBoardId(board.id)}
                className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md protocol-transition group"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{board.name}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); tracker.deleteBoard(board.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-destructive protocol-transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Created {format(new Date(board.created_at), 'MMM d, yyyy')}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Board detail view with phases
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => tracker.setActiveBoardId(null)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-foreground">{tracker.activeBoard?.name}</h2>
        </div>
        <button
          onClick={() => setShowNewPhase(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg protocol-transition"
        >
          <Plus className="h-4 w-4" />
          Add Phase
        </button>
      </div>

      <div className="border-t border-border" />

      {/* New phase input */}
      {showNewPhase && (
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
          <button onClick={handleAddPhase} className="px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 protocol-transition">Add</button>
          <button onClick={() => setShowNewPhase(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent protocol-transition">Cancel</button>
        </div>
      )}

      {/* Phases */}
      {tracker.phases.length === 0 && !showNewPhase ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No phases yet. Add one to start organizing!</p>
        </div>
      ) : (
        <div className="space-y-8">
          {tracker.phases.map(phase => {
            const phaseItems = tracker.items.filter(i => i.phase_id === phase.id);

            return (
              <div key={phase.id} className="space-y-3">
                {/* Phase header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-base">{phase.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setAddingItemPhaseId(phase.id); setNewItemTitle(''); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground protocol-transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Task
                    </button>
                    <button
                      onClick={() => tracker.deletePhase(phase.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive protocol-transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline add item */}
                {addingItemPhaseId === phase.id && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newItemTitle}
                      onChange={e => setNewItemTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddItem(phase.id); if (e.key === 'Escape') setAddingItemPhaseId(null); }}
                      placeholder="Task title..."
                      className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button onClick={() => handleAddItem(phase.id)} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg hover:bg-primary/90 protocol-transition">Add</button>
                  </div>
                )}

                {/* Mini kanban columns */}
                <div className="grid grid-cols-4 gap-3">
                  {statusColumns.map(col => {
                    const colItems = phaseItems.filter(i => i.status === col.key);
                    return (
                      <div key={col.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-medium text-muted-foreground uppercase tracking-wider">{col.label}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">{colItems.length}</span>
                          <button
                            onClick={() => { setAddingItemPhaseId(phase.id + ':' + col.key); setNewItemTitle(''); }}
                            className="ml-auto text-muted-foreground/50 hover:text-muted-foreground protocol-transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Inline add for specific column */}
                        {addingItemPhaseId === phase.id + ':' + col.key && (
                          <input
                            type="text"
                            value={newItemTitle}
                            onChange={e => setNewItemTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newItemTitle.trim()) {
                                // Add with specific status
                                tracker.addItem(phase.id, newItemTitle.trim()).then(() => {
                                  // Update status after creation
                                  // We'll handle this by fetching then updating the latest
                                });
                                setNewItemTitle('');
                                setAddingItemPhaseId(null);
                              }
                              if (e.key === 'Escape') setAddingItemPhaseId(null);
                            }}
                            placeholder="Task..."
                            className="w-full text-xs bg-secondary border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        )}

                        <div className="space-y-1.5 min-h-[48px]">
                          {colItems.length === 0 && addingItemPhaseId !== phase.id + ':' + col.key ? (
                            <div className="border border-dashed border-border rounded-lg p-3 text-center">
                              <span className="text-[10px] text-muted-foreground">Empty</span>
                            </div>
                          ) : (
                            colItems.map(item => (
                              <div key={item.id} className="rounded-lg border border-border bg-card p-2.5 space-y-2 hover:border-muted-foreground/30 protocol-transition">
                                <p className="text-sm text-foreground font-medium">{item.title}</p>
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
                                  <div className={`h-1.5 w-1.5 rounded-full ml-auto ${priorityColors[item.priority] || priorityColors.medium}`} />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
