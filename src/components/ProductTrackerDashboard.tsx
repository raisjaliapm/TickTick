import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListTodo, Clock, CheckCircle2, AlertTriangle, Pause, Circle,
  TrendingUp, FolderKanban, Package, BarChart3, Filter, Download
} from 'lucide-react';
import { format, isPast, isToday, isWithinInterval, addDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TrackerBoard, TrackerItem, TrackerPhase } from '@/hooks/useProductTracker';
import * as XLSX from 'xlsx';

interface ProductTrackerDashboardProps {
  boards: TrackerBoard[];
  onSelectBoard: (boardId: string) => void;
}

export function ProductTrackerDashboard({ boards, onSelectBoard }: ProductTrackerDashboardProps) {
  const { user } = useAuth();
  const [allItems, setAllItems] = useState<TrackerItem[]>([]);
  const [allPhases, setAllPhases] = useState<TrackerPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (!user || boards.length === 0) { setLoading(false); return; }
    const fetchAll = async () => {
      setLoading(true);
      const boardIds = boards.map(b => b.id);
      const { data: phases } = await supabase
        .from('product_tracker_phases').select('*')
        .in('board_id', boardIds).eq('user_id', user.id) as any;
      if (phases) {
        setAllPhases(phases);
        const phaseIds = phases.map((p: any) => p.id);
        if (phaseIds.length > 0) {
          const { data: items } = await supabase
            .from('product_tracker_items').select('*')
            .in('phase_id', phaseIds).eq('user_id', user.id) as any;
          if (items) setAllItems(items);
        }
      }
      setLoading(false);
    };
    fetchAll();
  }, [user, boards]);

  const selectedBoard = boards.find(b => b.id === selectedBoardId);

  // Filter phases and items by selected board
  const filteredPhases = useMemo(() => {
    if (!selectedBoardId) return allPhases;
    return allPhases.filter(p => p.board_id === selectedBoardId);
  }, [allPhases, selectedBoardId]);

  const filteredPhaseIds = useMemo(() => new Set(filteredPhases.map(p => p.id)), [filteredPhases]);

  const filteredItems = useMemo(() => {
    if (!selectedBoardId) return allItems;
    return allItems.filter(i => filteredPhaseIds.has(i.phase_id));
  }, [allItems, selectedBoardId, filteredPhaseIds]);

  const stats = useMemo(() => {
    const todo = filteredItems.filter(i => i.status === 'todo');
    const inProgress = filteredItems.filter(i => i.status === 'in_progress');
    const done = filteredItems.filter(i => i.status === 'done');
    const onHold = filteredItems.filter(i => i.status === 'on_hold');
    const overdue = filteredItems.filter(i => i.status !== 'done' && i.due_date && isPast(new Date(i.due_date)) && !isToday(new Date(i.due_date)));
    const dueToday = filteredItems.filter(i => i.status !== 'done' && i.due_date && isToday(new Date(i.due_date)));
    const upcoming = filteredItems.filter(i => i.status !== 'done' && i.due_date && isWithinInterval(new Date(i.due_date), {
      start: addDays(startOfDay(new Date()), 1),
      end: addDays(startOfDay(new Date()), 7),
    }));

    return { todo, inProgress, done, onHold, overdue, dueToday, upcoming, total: filteredItems.length };
  }, [filteredItems]);

  const statCards = [
    { label: 'Total Items', value: stats.total, icon: ListTodo, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'In Progress', value: stats.inProgress.length, icon: Clock, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Completed', value: stats.done.length, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    { label: 'Due Today', value: stats.dueToday.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
  ];

  const completionRate = stats.total > 0 ? Math.round((stats.done.length / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (boards.length === 0) return null;

  const exportToExcel = useCallback(() => {
    // Sheet 1: All Items
    const itemRows = filteredItems.map(item => {
      const phase = filteredPhases.find(p => p.id === item.phase_id);
      const board = boards.find(b => phase && b.id === phase.board_id);
      const isItemOverdue = item.status !== 'done' && item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date));
      return {
        'Title': item.title,
        'Board': board?.name || '',
        'Phase': phase?.name || '',
        'Status': item.status.replace('_', ' ').toUpperCase(),
        'Priority': item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
        'Assignee': (item as any).assignee || '',
        'Due Date': item.due_date ? format(new Date(item.due_date), 'yyyy-MM-dd') : '',
        'Overdue': isItemOverdue ? 'Yes' : 'No',
        'Created': format(new Date(item.created_at), 'yyyy-MM-dd'),
        'Updated': format(new Date(item.updated_at), 'yyyy-MM-dd'),
      };
    });

    // Sheet 2: Summary Stats
    const summaryRows = [
      { 'Metric': 'Total Items', 'Value': stats.total },
      { 'Metric': 'To Do', 'Value': stats.todo.length },
      { 'Metric': 'In Progress', 'Value': stats.inProgress.length },
      { 'Metric': 'Completed', 'Value': stats.done.length },
      { 'Metric': 'On Hold', 'Value': stats.onHold.length },
      { 'Metric': 'Overdue', 'Value': stats.overdue.length },
      { 'Metric': 'Due Today', 'Value': stats.dueToday.length },
      { 'Metric': 'Upcoming (7 days)', 'Value': stats.upcoming.length },
      { 'Metric': 'Completion Rate', 'Value': `${completionRate}%` },
    ];

    // Sheet 3: Board Breakdown
    const boardRows = boards.map(b => {
      const bPhases = filteredPhases.filter(p => p.board_id === b.id);
      const bPhaseIds = new Set(bPhases.map(p => p.id));
      const bItems = filteredItems.filter(i => bPhaseIds.has(i.phase_id));
      const bDone = bItems.filter(i => i.status === 'done').length;
      return {
        'Board': b.name,
        'Phases': bPhases.length,
        'Total Items': bItems.length,
        'Completed': bDone,
        'Completion %': bItems.length > 0 ? Math.round((bDone / bItems.length) * 100) + '%' : '0%',
      };
    });

    // Sheet 4: Phase Breakdown
    const phaseRows = filteredPhases.map(p => {
      const board = boards.find(b => b.id === p.board_id);
      const pItems = filteredItems.filter(i => i.phase_id === p.id);
      const pDone = pItems.filter(i => i.status === 'done').length;
      return {
        'Phase': p.name,
        'Board': board?.name || '',
        'Total Items': pItems.length,
        'Completed': pDone,
        'Completion %': pItems.length > 0 ? Math.round((pDone / pItems.length) * 100) + '%' : '0%',
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), 'All Items');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(boardRows), 'Boards');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(phaseRows), 'Phases');

    const fileName = selectedBoard
      ? `product-tracker-${selectedBoard.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      : `product-tracker-export-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [filteredItems, filteredPhases, boards, stats, completionRate, selectedBoard]);

  return (
    <div className="space-y-6">
      {/* Board Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Dashboard Overview</h3>
        <div className="flex items-center gap-2">
          {boards.length > 1 && (
            <>
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedBoardId || ''}
                onChange={e => setSelectedBoardId(e.target.value || null)}
                className="text-sm bg-card border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring protocol-transition min-w-[160px]"
              >
                <option value="">All Boards</option>
                {boards.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </>
          )}
          <button
            onClick={exportToExcel}
            disabled={filteredItems.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 protocol-transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>
        </div>
      </div>

      {/* Active board indicator */}
      {selectedBoard && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
          <div className="h-3 w-3 rounded-sm bg-primary" />
          <span className="text-sm font-medium text-foreground">{selectedBoard.name}</span>
          <span className="text-[10px] font-mono text-muted-foreground">{filteredItems.length} items · {filteredPhases.length} phases</span>
          <button
            onClick={() => setSelectedBoardId(null)}
            className="ml-auto text-xs text-primary hover:underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {statCards.map(card => (
          <div
            key={card.label}
            className="bg-card border border-border rounded-xl p-4 md:p-5 text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-foreground">{card.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Due Today */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Due Today
            </h3>
            <span className="text-xs text-muted-foreground">{stats.dueToday.length} items</span>
          </div>
          {stats.dueToday.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No items due today 🎉</p>
          ) : (
            <div className="space-y-2">
              {stats.dueToday.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                  <div className={`h-2 w-2 rounded-full ${
                    item.priority === 'urgent' ? 'bg-priority-urgent' :
                    item.priority === 'high' ? 'bg-priority-high' :
                    item.priority === 'medium' ? 'bg-priority-medium' : 'bg-priority-low'
                  }`} />
                  <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
                  <span className="text-[10px] font-mono text-muted-foreground capitalize">{item.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Overdue
            </h3>
            <span className="text-xs text-muted-foreground">{stats.overdue.length} items</span>
          </div>
          {stats.overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">All caught up!</p>
          ) : (
            <div className="space-y-2">
              {stats.overdue.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                  <div className="h-2 w-2 rounded-full bg-destructive" />
                  <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
                  <span className="text-[10px] font-mono text-destructive">
                    {item.due_date && format(new Date(item.due_date), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Boards Overview */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Boards
            </h3>
            <span className="text-xs text-muted-foreground">{boards.length} boards</span>
          </div>
          <div className="space-y-2">
            {boards.map(board => {
              const boardPhases = allPhases.filter(p => p.board_id === board.id);
              const boardPhaseIds = boardPhases.map(p => p.id);
              const boardItems = allItems.filter(i => boardPhaseIds.includes(i.phase_id));
              const doneCount = boardItems.filter(i => i.status === 'done').length;
              const progress = boardItems.length > 0 ? Math.round((doneCount / boardItems.length) * 100) : 0;
              const isSelected = selectedBoardId === board.id;
              return (
                <button
                  key={board.id}
                  onClick={() => setSelectedBoardId(isSelected ? null : board.id)}
                  className={`w-full p-2.5 rounded-lg protocol-transition text-left ${isSelected ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-sm bg-primary" />
                    <span className="text-sm text-foreground flex-1 truncate">{board.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{progress}%</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden ml-6">
                    <div className="h-full rounded-full bg-primary protocol-transition" style={{ width: `${progress}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Status Breakdown
            </h3>
            <span className="text-xs text-muted-foreground">{completionRate}% completion</span>
          </div>
          <div className="space-y-3">
            {[
              { label: 'To Do', count: stats.todo.length, icon: Circle, color: 'hsl(var(--status-not-started))' },
              { label: 'In Progress', count: stats.inProgress.length, icon: Clock, color: 'hsl(var(--status-in-progress))' },
              { label: 'On Hold', count: stats.onHold.length, icon: Pause, color: 'hsl(var(--status-on-hold))' },
              { label: 'Done', count: stats.done.length, icon: CheckCircle2, color: 'hsl(var(--status-completed))' },
            ].map(item => {
              const total = stats.total || 1;
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm text-foreground">
                      <item.icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                      {item.label}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{item.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full protocol-transition" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phases Overview */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Phases Overview
            </h3>
            <span className="text-xs text-muted-foreground">{filteredPhases.length} phases</span>
          </div>
          {filteredPhases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No phases yet. Open a board to add phases!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredPhases.map(phase => {
                const phaseItems = filteredItems.filter(i => i.phase_id === phase.id);
                const doneCount = phaseItems.filter(i => i.status === 'done').length;
                const board = boards.find(b => b.id === phase.board_id);
                return (
                  <button
                    key={phase.id}
                    onClick={() => onSelectBoard(phase.board_id)}
                    className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/30 protocol-transition text-left"
                  >
                    <p className="text-sm font-medium text-foreground truncate">{phase.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{board?.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="h-1.5 flex-1 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary protocol-transition"
                          style={{ width: `${phaseItems.length > 0 ? Math.round((doneCount / phaseItems.length) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{doneCount}/{phaseItems.length}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming */}
        <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-info" />
              Upcoming (Next 7 Days)
            </h3>
            <span className="text-xs text-muted-foreground">{stats.upcoming.length} items</span>
          </div>
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nothing upcoming this week</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.upcoming.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-accent/50 protocol-transition">
                  <div className={`h-2 w-2 rounded-full ${
                    item.priority === 'urgent' ? 'bg-priority-urgent' :
                    item.priority === 'high' ? 'bg-priority-high' :
                    item.priority === 'medium' ? 'bg-priority-medium' : 'bg-priority-low'
                  }`} />
                  <span className="text-sm text-foreground truncate flex-1">{item.title}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.due_date && format(new Date(item.due_date), 'MMM d')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
