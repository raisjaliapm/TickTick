import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FileText, TrendingUp, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WeeklyReport {
  id: string;
  week_start: string;
  week_end: string;
  total_tasks: number;
  completed_tasks: number;
  active_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
  by_priority: Record<string, number>;
  by_category: Record<string, { active: number; completed: number }>;
  top_completed: Array<{ title: string; priority: string; completed_at: string }>;
  created_at: string;
}

export function WeeklyReportsView() {
  const { user } = useAuth();
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchReports = async () => {
      const { data } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(12);
      if (data) setReports(data as unknown as WeeklyReport[]);
      setLoading(false);
    };
    fetchReports();
  }, [user]);

  if (loading) {
    return <p className="text-sm text-muted-foreground text-center py-10 font-mono">Loading reports...</p>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground font-mono">No weekly reports yet</p>
        <p className="text-xs text-muted-foreground font-mono">Reports are auto-generated every Monday for the previous week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-medium text-foreground">Weekly Reports</h2>
      </div>

      {reports.map(report => {
        const expanded = expandedId === report.id;
        const byPriority = report.by_priority || {};
        const byCategory = (report.by_category || {}) as Record<string, { active: number; completed: number }>;
        const topCompleted = report.top_completed || [];

        return (
          <Card key={report.id} className="bg-card border-border">
            <CardHeader
              className="px-4 pt-4 pb-3 cursor-pointer hover:bg-task-hover protocol-transition rounded-t-lg"
              onClick={() => setExpandedId(expanded ? null : report.id)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-display font-medium text-foreground">
                  Week of {format(new Date(report.week_start + 'T00:00:00'), 'MMM d')} – {format(new Date(report.week_end + 'T00:00:00'), 'MMM d, yyyy')}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {report.completion_rate}% done
                  </Badge>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="px-4 pb-4 space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Completed</span>
                    </div>
                    <p className="text-xl font-display font-semibold text-foreground">{report.completed_tasks}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-priority-medium" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Active</span>
                    </div>
                    <p className="text-xl font-display font-semibold text-foreground">{report.active_tasks}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-priority-urgent" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Overdue</span>
                    </div>
                    <p className="text-xl font-display font-semibold text-foreground">{report.overdue_tasks}</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Total</span>
                    </div>
                    <p className="text-xl font-display font-semibold text-foreground">{report.total_tasks}</p>
                  </div>
                </div>

                {/* Priority Breakdown */}
                {Object.keys(byPriority).length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">By Priority</p>
                    <div className="flex flex-wrap gap-2">
                      {['urgent', 'high', 'medium', 'low'].map(p => {
                        const count = byPriority[p];
                        if (!count) return null;
                        return (
                          <span key={p} className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                            <span className={`h-2 w-2 rounded-full bg-priority-${p}`} />
                            {p}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category Breakdown */}
                {Object.keys(byCategory).length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">By Category</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(byCategory).map(([name, v]) => (
                        <Badge key={name} variant="outline" className="font-mono text-[11px]">
                          {name}: {v.active}a / {v.completed}c
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Completed */}
                {topCompleted.length > 0 && (
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Completed This Week</p>
                    <ul className="space-y-1">
                      {topCompleted.map((t, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate text-foreground">{t.title}</span>
                          <span className="font-mono text-[10px] text-muted-foreground capitalize ml-auto">{t.priority}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
