import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListTodo, Clock, CheckCircle2, AlertTriangle, Pause, Circle,
  TrendingUp, FolderKanban, Package, BarChart3, Filter, Download, Users,
  Award, Target, Zap, Shield, Star, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { format, isPast, isToday, isWithinInterval, addDays, startOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { TrackerBoard, TrackerItem, TrackerPhase } from '@/hooks/useProductTracker';
import * as XLSX from 'xlsx';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
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

  const exportToExcel = useCallback(() => {
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

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (boards.length === 0) return null;

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Status Pie Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Status Distribution
          </h3>
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No items yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'To Do', value: stats.todo.length, fill: '#EF4444' },
                    { name: 'In Progress', value: stats.inProgress.length, fill: '#EAB308' },
                    { name: 'On Hold', value: stats.onHold.length, fill: '#FF9933' },
                    { name: 'Done', value: stats.done.length, fill: '#22C55E' },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Priority Bar Chart */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-destructive" />
            Priority Breakdown
          </h3>
          {stats.total === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No items yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { name: 'Low', count: filteredItems.filter(i => i.priority === 'low').length, fill: 'hsl(var(--success))' },
                { name: 'Medium', count: filteredItems.filter(i => i.priority === 'medium').length, fill: 'hsl(var(--warning))' },
                { name: 'High', count: filteredItems.filter(i => i.priority === 'high').length, fill: 'hsl(var(--destructive))' },
                { name: 'Urgent', count: filteredItems.filter(i => i.priority === 'urgent').length, fill: 'hsl(var(--destructive))' },
              ]} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {[
                    'hsl(var(--success))',
                    'hsl(var(--warning))',
                    'hsl(var(--destructive))',
                    'hsl(var(--destructive) / 0.7)',
                  ].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Board Completion Bar Chart */}
        {boards.length > 1 && (
          <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Board Completion
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={boards.map(b => {
                const bPhases = allPhases.filter(p => p.board_id === b.id);
                const bPhaseIds = new Set(bPhases.map(p => p.id));
                const bItems = allItems.filter(i => bPhaseIds.has(i.phase_id));
                const bDone = bItems.filter(i => i.status === 'done').length;
                return { name: b.name, Total: bItems.length, Done: bDone };
              })} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Total" fill="hsl(var(--muted-foreground))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Done" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Assignee Performance & Promotion Metrics */}
      {(() => {
        const assigneeMap = new Map<string, { total: number; done: number; inProgress: number; todo: number; onHold: number; overdue: number; highPriority: number; onTime: number; doneWithDueDate: number; phases: Set<string>; boards: Set<string> }>();
        filteredItems.forEach(item => {
          const name = item.assignee || 'Unassigned';
          const entry = assigneeMap.get(name) || { total: 0, done: 0, inProgress: 0, todo: 0, onHold: 0, overdue: 0, highPriority: 0, onTime: 0, doneWithDueDate: 0, phases: new Set<string>(), boards: new Set<string>() };
          entry.total++;
          if (item.status === 'done') entry.done++;
          if (item.status === 'in_progress') entry.inProgress++;
          if (item.status === 'todo') entry.todo++;
          if (item.status === 'on_hold') entry.onHold++;
          const isOverdue = item.status !== 'done' && item.due_date && isPast(new Date(item.due_date)) && !isToday(new Date(item.due_date));
          if (isOverdue) entry.overdue++;
          if (item.priority === 'high' || item.priority === 'urgent') entry.highPriority++;
          // On-time: done items that had a due date and were completed (updated_at) before or on due_date
          if (item.status === 'done' && item.due_date) {
            entry.doneWithDueDate++;
            if (new Date(item.updated_at) <= addDays(new Date(item.due_date), 1)) entry.onTime++;
          }
          entry.phases.add(item.phase_id);
          const phase = filteredPhases.find(p => p.id === item.phase_id);
          if (phase) entry.boards.add(phase.board_id);
          assigneeMap.set(name, entry);
        });

        const assigneeData = Array.from(assigneeMap.entries())
          .map(([name, d]) => {
            const completionRate = d.total > 0 ? Math.round((d.done / d.total) * 100) : 0;
            const onTimeRate = d.doneWithDueDate > 0 ? Math.round((d.onTime / d.doneWithDueDate) * 100) : (d.done > 0 ? 100 : 0);
            const reliabilityScore = Math.round((onTimeRate * 0.4) + (completionRate * 0.3) + ((1 - Math.min(d.overdue / Math.max(d.total, 1), 1)) * 100 * 0.3));
            const highImpactRate = d.total > 0 ? Math.round((d.highPriority / d.total) * 100) : 0;
            const capacityUtil = d.total > 0 ? Math.round(((d.inProgress + d.todo) / d.total) * 100) : 0;
            const crossFunctional = d.phases.size + d.boards.size;
            // Promotion score: weighted composite
            const promotionScore = Math.min(100, Math.round(
              reliabilityScore * 0.30 +
              completionRate * 0.25 +
              highImpactRate * 0.20 +
              Math.min(crossFunctional * 10, 100) * 0.15 +
              onTimeRate * 0.10
            ));
            return {
              name, ...d,
              phasesCount: d.phases.size, boardsCount: d.boards.size,
              completionRate, onTimeRate, reliabilityScore, highImpactRate, capacityUtil, crossFunctional, promotionScore,
            };
          })
          .sort((a, b) => b.promotionScore - a.promotionScore);

        const assignedOnly = assigneeData.filter(a => a.name !== 'Unassigned');
        if (assignedOnly.length === 0 && (assigneeData.length === 0 || (assigneeData.length === 1 && assigneeData[0].total === 0))) return null;

        const ASSIGNEE_COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--info))', '#8B5CF6', '#EC4899', '#14B8A6'];

        const getScoreBadge = (score: number) => {
          if (score >= 80) return { label: 'Excellent', color: 'bg-success/15 text-success border-success/30', icon: Star };
          if (score >= 60) return { label: 'Strong', color: 'bg-primary/15 text-primary border-primary/30', icon: ArrowUpRight };
          if (score >= 40) return { label: 'Growing', color: 'bg-warning/15 text-warning border-warning/30', icon: Minus };
          return { label: 'Developing', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: ArrowDownRight };
        };

        const getMetricColor = (value: number) => {
          if (value >= 80) return 'text-success';
          if (value >= 60) return 'text-primary';
          if (value >= 40) return 'text-warning';
          return 'text-destructive';
        };

        // Top performer for radar chart
        const radarSubjects = ['Completion', 'On-Time', 'Reliability', 'Impact', 'Cross-Func'];

        return (
          <>
            {/* Section Header */}
            <div className="flex items-center gap-2 pt-2">
              <Award className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Promotion & Performance Metrics</h3>
            </div>

            {/* Top Performer Cards */}
            {assignedOnly.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {assignedOnly.slice(0, 6).map((a, i) => {
                  const badge = getScoreBadge(a.promotionScore);
                  const BadgeIcon = badge.icon;
                  return (
                    <div key={a.name} className="bg-card border border-border rounded-xl p-4 relative overflow-hidden">
                      {i === 0 && assignedOnly.length > 1 && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">TOP</div>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0" style={{ backgroundColor: ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length] }}>
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                            <BadgeIcon className="h-2.5 w-2.5" />
                            {badge.label}
                          </div>
                        </div>
                        <div className="ml-auto text-right shrink-0">
                          <p className="text-2xl font-bold text-foreground">{a.promotionScore}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Score</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className={`text-sm font-semibold ${getMetricColor(a.completionRate)}`}>{a.completionRate}%</p>
                          <p className="text-[9px] text-muted-foreground">Done</p>
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${getMetricColor(a.onTimeRate)}`}>{a.onTimeRate}%</p>
                          <p className="text-[9px] text-muted-foreground">On-Time</p>
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${getMetricColor(a.reliabilityScore)}`}>{a.reliabilityScore}</p>
                          <p className="text-[9px] text-muted-foreground">Reliable</p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{a.highPriority}</p>
                          <p className="text-[9px] text-muted-foreground">Hi-Impact</p>
                        </div>
                      </div>
                      {/* Mini progress bar */}
                      <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full protocol-transition" style={{ width: `${a.promotionScore}%`, backgroundColor: ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Assignee Workload Stacked Bar */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Workload Distribution
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={assigneeData.filter(a => a.name !== 'Unassigned').slice(0, 8)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="done" name="Done" stackId="a" fill="hsl(var(--success))" />
                    <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="hsl(var(--warning))" />
                    <Bar dataKey="overdue" name="Overdue" stackId="a" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Promotion Score Ranking */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Promotion Readiness Score
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={assignedOnly.slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} formatter={(value: number) => [`${value}/100`, 'Score']} />
                    <Bar dataKey="promotionScore" radius={[0, 6, 6, 0]}>
                      {assignedOnly.slice(0, 8).map((a, i) => (
                        <Cell key={i} fill={a.promotionScore >= 80 ? 'hsl(var(--success))' : a.promotionScore >= 60 ? 'hsl(var(--primary))' : a.promotionScore >= 40 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Chart for Top Performers */}
              {assignedOnly.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4 text-info" />
                    Skills Radar — Top {Math.min(3, assignedOnly.length)}
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarSubjects.map(subject => {
                      const entry: any = { subject };
                      assignedOnly.slice(0, 3).forEach((a, i) => {
                        const values: Record<string, number> = {
                          'Completion': a.completionRate,
                          'On-Time': a.onTimeRate,
                          'Reliability': a.reliabilityScore,
                          'Impact': a.highImpactRate,
                          'Cross-Func': Math.min(a.crossFunctional * 15, 100),
                        };
                        entry[`p${i}`] = values[subject] || 0;
                      });
                      return entry;
                    })}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                      {assignedOnly.slice(0, 3).map((a, i) => (
                        <Radar key={a.name} name={a.name} dataKey={`p${i}`} stroke={ASSIGNEE_COLORS[i]} fill={ASSIGNEE_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* On-Time Delivery & Reliability */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-success" />
                  On-Time Delivery Rate
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={assignedOnly.filter(a => a.total > 0).slice(0, 8)} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px', color: 'hsl(var(--foreground))' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="onTimeRate" name="On-Time %" fill="hsl(var(--success))" radius={[0, 6, 6, 0]} />
                    <Bar dataKey="reliabilityScore" name="Reliability" fill="hsl(var(--info))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Full Performance Table */}
              <div className="bg-card border border-border rounded-xl p-5 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Detailed Performance Report
                  </h3>
                  <span className="text-xs text-muted-foreground">{assignedOnly.length} assignees</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Assignee</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Score</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Total</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Done</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">On-Time</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Reliability</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Hi-Impact</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Overdue</th>
                        <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground">Scope</th>
                        <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Readiness</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assigneeData.map((a, i) => {
                        const badge = getScoreBadge(a.promotionScore);
                        const BadgeIcon = badge.icon;
                        return (
                          <tr key={a.name} className="border-b border-border/50 hover:bg-accent/30 protocol-transition">
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0" style={{ backgroundColor: ASSIGNEE_COLORS[i % ASSIGNEE_COLORS.length] }}>
                                  {a.name === 'Unassigned' ? '?' : a.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-foreground font-medium truncate max-w-[100px]">{a.name}</span>
                              </div>
                            </td>
                            <td className="text-center py-2.5 px-2">
                              <span className={`font-bold font-mono ${getMetricColor(a.promotionScore)}`}>{a.promotionScore}</span>
                            </td>
                            <td className="text-center py-2.5 px-2 font-mono text-foreground">{a.total}</td>
                            <td className="text-center py-2.5 px-2 font-mono text-success">{a.completionRate}%</td>
                            <td className={`text-center py-2.5 px-2 font-mono ${getMetricColor(a.onTimeRate)}`}>{a.onTimeRate}%</td>
                            <td className={`text-center py-2.5 px-2 font-mono ${getMetricColor(a.reliabilityScore)}`}>{a.reliabilityScore}</td>
                            <td className="text-center py-2.5 px-2 font-mono text-foreground">{a.highPriority}</td>
                            <td className="text-center py-2.5 px-2 font-mono text-destructive">{a.overdue}</td>
                            <td className="text-center py-2.5 px-2 text-[10px] text-muted-foreground">{a.boardsCount}B · {a.phasesCount}P</td>
                            <td className="py-2.5 px-2">
                              <div className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.color}`}>
                                <BadgeIcon className="h-2.5 w-2.5" />
                                {badge.label}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Score Legend */}
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  <span className="font-medium">Score formula:</span>
                  <span>Reliability 30%</span>
                  <span>·</span>
                  <span>Completion 25%</span>
                  <span>·</span>
                  <span>High-Impact Work 20%</span>
                  <span>·</span>
                  <span>Cross-Functional 15%</span>
                  <span>·</span>
                  <span>On-Time 10%</span>
                </div>
              </div>
            </div>
          </>
        );
      })()}

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
              { label: 'To Do', count: stats.todo.length, icon: Circle, color: '#EF4444' },
              { label: 'In Progress', count: stats.inProgress.length, icon: Clock, color: '#EAB308' },
              { label: 'On Hold', count: stats.onHold.length, icon: Pause, color: '#FF9933' },
              { label: 'Done', count: stats.done.length, icon: CheckCircle2, color: '#22C55E' },
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
