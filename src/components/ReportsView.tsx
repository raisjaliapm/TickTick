import { useMemo } from 'react';
import { Download, BarChart3, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { format, isToday, isPast, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Task, Category } from '@/hooks/useTaskStore';

interface ReportsViewProps {
  tasks: Task[];
  categories: Category[];
}

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

    const thisWeek = tasks.filter(t => t.due_date && isWithinInterval(new Date(t.due_date), { start: startOfWeek(now), end: endOfWeek(now) }));
    const thisMonth = tasks.filter(t => t.due_date && isWithinInterval(new Date(t.due_date), { start: startOfMonth(now), end: endOfMonth(now) }));

    const completedLast7 = completed.filter(t => t.completed_at && new Date(t.completed_at) >= subDays(now, 7));

    const byPriority: Record<string, number> = {};
    active.forEach(t => { byPriority[t.priority] = (byPriority[t.priority] || 0) + 1; });

    const byCategory: Record<string, { active: number; completed: number }> = {};
    tasks.forEach(t => {
      const name = t.category_id ? (categoryMap[t.category_id] || 'Unknown') : 'Uncategorized';
      if (!byCategory[name]) byCategory[name] = { active: 0, completed: 0 };
      if (t.status === 'completed') byCategory[name].completed++;
      else byCategory[name].active++;
    });

    return { active: active.length, completed: completed.length, overdue: overdue.length, dueToday: dueToday.length, thisWeek: thisWeek.length, thisMonth: thisMonth.length, completedLast7: completedLast7.length, byPriority, byCategory, completionRate: tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0 };
  }, [tasks, categoryMap]);

  const exportToExcel = () => {
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

    // All tasks sheet
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, 'All Tasks');

    // Summary sheet
    const summary = [
      ['Metric', 'Value'],
      ['Total Tasks', tasks.length],
      ['Active', stats.active],
      ['Completed', stats.completed],
      ['Overdue', stats.overdue],
      ['Due Today', stats.dueToday],
      ['Completion Rate', `${stats.completionRate}%`],
      ['Completed (Last 7 Days)', stats.completedLast7],
      [],
      ['Priority', 'Count'],
      ...Object.entries(stats.byPriority).map(([k, v]) => [k, v]),
      [],
      ['Category', 'Active', 'Completed'],
      ...Object.entries(stats.byCategory).map(([k, v]) => [k, v.active, v.completed]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

    XLSX.writeFile(wb, `todoist-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const priorityOrder = ['urgent', 'high', 'medium', 'low'];

  return (
    <div className="space-y-8">
      {/* Header with export */}
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
            <p className="text-2xl font-display font-semibold text-foreground">{stats.completed}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{stats.completionRate}% rate</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-priority-medium" /> Active
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{stats.active}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{stats.dueToday} due today</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-priority-urgent" /> Overdue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-display font-semibold text-foreground">{stats.overdue}</p>
            <p className="text-[11px] font-mono text-muted-foreground">need attention</p>
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
            <p className="text-[11px] font-mono text-muted-foreground">completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Priority Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Active by Priority</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-3">
            {priorityOrder.map(p => {
              const count = stats.byPriority[p] || 0;
              const total = stats.active || 1;
              return (
                <div key={p} className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono capitalize text-muted-foreground">{p}</span>
                    <span className="text-xs font-mono text-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full bg-priority-${p} protocol-transition`} style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">By Category</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs font-mono">Category</TableHead>
                <TableHead className="text-xs font-mono text-right">Active</TableHead>
                <TableHead className="text-xs font-mono text-right">Completed</TableHead>
                <TableHead className="text-xs font-mono text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.byCategory).map(([name, v]) => (
                <TableRow key={name} className="border-border">
                  <TableCell className="text-sm text-foreground">{name}</TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">{v.active}</TableCell>
                  <TableCell className="text-sm text-right text-muted-foreground">{v.completed}</TableCell>
                  <TableCell className="text-sm text-right font-medium text-foreground">{v.active + v.completed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Tasks Table */}
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
