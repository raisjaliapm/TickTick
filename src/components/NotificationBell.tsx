import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  task_id: string | null;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notifications-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchNotifications();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  // Check for overdue tasks periodically
  useEffect(() => {
    if (!user) return;
    const checkOverdue = async () => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date')
        .eq('user_id', user.id)
        .neq('status', 'completed')
        .not('due_date', 'is', null)
        .lt('due_date', new Date().toISOString());

      if (!tasks?.length) return;

      // Check which overdue tasks already have a notification today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: existing } = await supabase
        .from('notifications')
        .select('task_id')
        .eq('user_id', user.id)
        .eq('title', 'Task Overdue')
        .gte('created_at', today.toISOString());

      const existingTaskIds = new Set((existing || []).map((n: any) => n.task_id));

      const newOverdue = tasks.filter(t => !existingTaskIds.has(t.id));
      if (newOverdue.length > 0) {
        const rows = newOverdue.map(t => ({
          user_id: user.id,
          title: 'Task Overdue',
          message: `"${t.title}" is past its due date`,
          type: 'overdue',
          task_id: t.id,
        }));
        await supabase.from('notifications').insert(rows as any);
        fetchNotifications();
      }
    };

    checkOverdue();
    const interval = setInterval(checkOverdue, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true } as any).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    if (!user) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    setNotifications([]);
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'success': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'overdue': return 'text-destructive';
      default: return 'text-primary';
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent protocol-transition active:scale-95">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">Notifications</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent protocol-transition" title="Mark all read">
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} className="text-[11px] text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 protocol-transition" title="Clear all">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-y-auto flex-1 scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map(n => (
              <button
                key={n.id}
                onClick={() => !n.is_read && markAsRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-accent/50 protocol-transition flex items-start gap-3 ${!n.is_read ? 'bg-accent/20' : ''}`}
              >
                <Circle className={`h-2 w-2 mt-1.5 shrink-0 fill-current ${!n.is_read ? typeColor(n.type) : 'text-transparent'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${!n.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {n.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
