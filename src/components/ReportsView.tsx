import { useMemo } from 'react';
import { Download, BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, isToday, isPast, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Task, Category } from '@/hooks/useTaskStore';

interface ReportsViewProps {
  tasks: Task[];
  categories: Category[];
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'hsl(0, 84%, 60%)',
  high: 'hsl(25, 95%, 53%)',
  medium: 'hsl(45, 93%, 47%)',
  low: 'hsl(217, 91%, 60%)',
};

const CATEGORY_COLORS = [
  'hsl(142, 71%, 45%)',
  'hsl(217, 91%, 60%)',
  'hsl(25, 95%, 53%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 65%, 60%)',
  'hsl(0, 84%, 60%)',
  'hsl(180, 60%, 45%)',
  'hsl(330, 70%, 55%)',
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
        <p className="text-xs font-mono text-foreground">{d.name}</p>
        <p className="text-xs font-mono text-muted-foreground">{d.percentage ?? d.value}%</p>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-md px-3 py-2 shadow-md">
        <p className="text-xs font-mono text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-xs font-mono text-muted-foreground">
            {p.name}: {p.value}%
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const renderPieLabel = ({ name, percentage }: any) => `${name} ${percentage}%`;

export function ReportsView({ tasks, categories }: ReportsViewProps) {
  const categoryMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach(c => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const stats = useMemo(() => {
    const now = new Date();
    const active = tasks.filter(t => t.status === 'active');
    const completed = tasks.filter(t => t.status === 'completed');
    const overdue = active.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const dueToday = active.filter(t => t.due_date && isToday(new Date(t.due_date)));
    const completedLast7 = completed.filter(t => t.completed_at && new Date(t.completed_at) >= subDays(now, 7));

    const byPriority: Record<string, number> = {};
    tasks.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; });

    const byCategory: Record<string, { active: number; completed: number }> = {};
    tasks.forEach(t => {
      const name = t.category_id ? (categoryMap[t.category_id] || 'Unknown') : 'Uncategorized';
      if (!byCategory[name]) byCategory[name] = { active: 0, completed: 0 };
      if (t.status === 'completed') byCategory[name].completed++;
      else byCategory[name].active++;
    });

    return { active: active.length, completed: completed.length, overdue: overdue.length, dueToday: dueToday.length, completedLast7: completedLast7.length, byPriority, byCategory, completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0 };
  }, [tasks, categoryMap]);

  // Chart data with percentages
  const statusPieData = useMemo(() => {
    const total = tasks.length || 1;
    return [
      { name: 'Active', value: stats.active, percentage: Math.round((stats.active / total) * 100), fill: 'hsl(217, 91%, 60%)' },
      { name: 'Completed', value: stats.completed, percentage: Math.round((stats.completed / total) * 100), fill: 'hsl(142, 71%, 45%)' },
      { name: 'Overdue', value: stats.overdue, percentage: Math.round((stats.overdue / total) * 100), fill: 'hsl(0, 84%, 60%)' },
    ].filter(d => d.value > 0);
  }, [tasks.length, stats]);

  const priorityPieData = useMemo(() => {
    const total = tasks.length || 1;
    return ['urgent', 'high', 'medium', 'low']
      .map(p => ({
        name: p.charAt(0).toUpperCase() + p.slice(1),
        value: stats.byPriority[p] || 0,
        percentage: Math.round(((stats.byPriority[p] || 0) / total) * 100),
      }))
      .filter(d => d.value > 0);
  }, [tasks.length, stats.byPriority]);

  const categoryBarData = useMemo(() => {
    const total = tasks.length || 1;
    return Object.entries(stats.byCategory).map(([name, v]) => ({
      name,
      Active: Math.round((v.active / total) * 100),
      Completed: Math.round((v.completed / total) * 100),
      activeRaw: v.active,
      completedRaw: v.completed,
    }));
  }, [tasks.length, stats.byCategory]);

  const exportToExcel = () => {
    const total = tasks.length || 1;
    const rows = tasks.map(t => ({
      Title: t.title,
      Status: t.status,
      Priority: t.priority,
      Category: t.category_id ? (categoryMap[t.category_id] || '') : '',
      'Due Date': t.due_date ? format(new Date(t.due_date), 'yyyy-MM-dd HH:mm') : '',
      'Created At': format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
      'Completed At': t.completed_at ? format(new Date(t.completed_at), 'yyyy-MM-dd HH:mm') : '',
      Description: t.description || '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'All Tasks');

    const summary = [
      ['Metric', 'Count', 'Percentage'],
      ['Total Tasks', tasks.length, '100%'],
      ['Active', stats.active, `${Math.round((stats.active / total) * 100)}%`],
      ['Completed', stats.completed, `${stats.completionRate}%`],
      ['Overdue', stats.overdue, `${Math.round((stats.overdue / total) * 100)}%`],
      ['Due Today', stats.dueToday, `${Math.round((stats.dueToday / total) * 100)}%`],
      ['Completed (Last 7 Days)', stats.completedLast7, `${Math.round((stats.completedLast7 / total) * 100)}%`],
      [],
      ['Priority', 'Count', 'Percentage'],
      ...['urgent', 'high', 'medium', 'low'].map(p => [p, stats.byPriority[p] || 0, `${Math.round(((stats.byPriority[p] || 0) / total) * 100)}%`]),
      [],
      ['Category', 'Active', 'Completed', '% of Total'],
      ...Object.entries(stats.byCategory).map(([k, v]) => [k, v.active, v.completed, `${Math.round(((v.active + v.completed) / total) * 100)}%`]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    XLSX.writeFile(wb, `ptt-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-display font-medium text-foreground">Task Reports</h2>
        </div>
        <Button onClick={exportToExcel} size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Completed
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{stats.completionRate}%</p>
            <p className="text-[11px] font-mono text-muted-foreground">{stats.completed} of {tasks.length} tasks</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-priority-medium" /> Active
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{tasks.length ? Math.round((stats.active / tasks.length) * 100) : 0}%</p>
            <p className="text-[11px] font-mono text-muted-foreground">{stats.active} tasks · {stats.dueToday} due today</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-priority-urgent" /> Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{tasks.length ? Math.round((stats.overdue / tasks.length) * 100) : 0}%</p>
            <p className="text-[11px] font-mono text-muted-foreground">{stats.overdue} tasks need attention</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-primary" /> Last 7 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{stats.completedLast7}</p>
            <p className="text-[11px] font-mono text-muted-foreground">completed recently</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="px-4 pt-4 pb-1">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status Distribution (%)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {statusPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(value) => <span className="text-xs font-mono text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Priority Pie Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="px-4 pt-4 pb-1">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Priority Distribution (%)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">No tasks yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={priorityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {priorityPieData.map((entry, i) => (
                      <Cell key={i} fill={PRIORITY_COLORS[entry.name.toLowerCase()] || CATEGORY_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(value) => <span className="text-xs font-mono text-muted-foreground">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Bar Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 pt-4 pb-1">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Category Breakdown (% of Total)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No tasks yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, categoryBarData.length * 50)}>
              <BarChart data={categoryBarData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: 'hsl(240, 5%, 54%)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(0, 0%, 98%)' }} width={90} />
                <Tooltip content={<BarTooltip />} />
                <Legend formatter={(value) => <span className="text-xs font-mono text-muted-foreground">{value}</span>} />
                <Bar dataKey="Active" stackId="a" fill="hsl(217, 91%, 60%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Completed" stackId="a" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Table with % */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Category Details</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs font-mono">Category</TableHead>
                <TableHead className="text-xs font-mono text-right">Active</TableHead>
                <TableHead className="text-xs font-mono text-right">Completed</TableHead>
                <TableHead className="text-xs font-mono text-right">Total</TableHead>
                <TableHead className="text-xs font-mono text-right">% of All</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.byCategory).map(([name, v]) => {
                const total = v.active + v.completed;
                const pct = tasks.length ? Math.round((total / tasks.length) * 100) : 0;
                return (
                  <TableRow key={name} className="border-border">
                    <TableCell className="text-sm text-foreground">{name}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">{v.active}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">{v.completed}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-foreground">{total}</TableCell>
                    <TableCell className="text-sm text-right font-mono text-primary">{pct}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* All Tasks Table */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">All Tasks ({tasks.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="max-h-[400px] overflow-auto scrollbar-thin">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-xs font-mono">Title</TableHead>
                  <TableHead className="text-xs font-mono">Status</TableHead>
                  <TableHead className="text-xs font-mono">Priority</TableHead>
                  <TableHead className="text-xs font-mono">Category</TableHead>
                  <TableHead className="text-xs font-mono">Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map(t => (
                  <TableRow key={t.id} className="border-border">
                    <TableCell className="text-sm text-foreground max-w-[200px] truncate">{t.title}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${t.status === 'completed' ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block h-2 w-2 rounded-full bg-priority-${t.priority} mr-1.5`} />
                      <span className="text-xs font-mono text-muted-foreground capitalize">{t.priority}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{t.category_id ? (categoryMap[t.category_id] || '—') : '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
