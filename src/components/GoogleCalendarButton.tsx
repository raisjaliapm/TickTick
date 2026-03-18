import { CalendarSync, CalendarX2, RefreshCw } from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { toast } from 'sonner';
import { useState } from 'react';

export function GoogleCalendarButton() {
  const { isConnected, loading, connect, disconnect, syncAll } = useGoogleCalendar();
  const [syncing, setSyncing] = useState(false);

  if (loading) return null;

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await syncAll();
      if (result?.synced !== undefined) {
        toast.success(`Synced ${result.synced} task${result.synced !== 1 ? 's' : ''} to Google Calendar`);
      }
    } catch {
      toast.error('Failed to sync tasks');
    } finally {
      setSyncing(false);
    }
  };

  if (isConnected) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 px-2 py-1">
          <CalendarSync className="h-3.5 w-3.5 text-[hsl(var(--status-completed))]" />
          <span className="text-[11px] font-mono text-[hsl(var(--status-completed))]">Calendar linked</span>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-mono text-sidebar-foreground hover:bg-sidebar-accent/50 protocol-transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync all tasks'}
        </button>
        <button
          onClick={disconnect}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-mono text-destructive/70 hover:text-destructive hover:bg-destructive/10 protocol-transition"
        >
          <CalendarX2 className="h-3.5 w-3.5" />
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-mono text-sidebar-foreground hover:bg-sidebar-accent/50 protocol-transition"
    >
      <CalendarSync className="h-3.5 w-3.5" />
      Connect Google Calendar
    </button>
  );
}
