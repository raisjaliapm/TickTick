import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Task } from '@/hooks/useTaskStore';

export function useGoogleCalendar() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if Google Calendar is connected
  const checkConnection = useCallback(async () => {
    if (!user) { setIsConnected(false); setLoading(false); return; }
    const { data } = await supabase
      .from('google_calendar_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setIsConnected(!!data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Check URL params for successful connection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gcal') === 'connected') {
      setIsConnected(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Start OAuth flow
  const connect = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth-url', {
        body: { user_id: user.id },
      });
      if (error || !data?.authUrl) {
        console.error('Failed to get auth URL:', error);
        return;
      }
      window.location.href = data.authUrl;
    } catch (err) {
      console.error('Connect error:', err);
    }
  }, [user]);

  // Disconnect
  const disconnect = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('google_calendar_tokens')
      .delete()
      .eq('user_id', user.id);
    setIsConnected(false);
  }, [user]);

  // Sync a task to Google Calendar
  const syncTask = useCallback(async (action: 'create' | 'update' | 'delete', task: Partial<Task> & { id: string }) => {
    if (!isConnected || !user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action, task },
      });

      if (error) {
        console.error('Calendar sync error:', error);
      }
      return data;
    } catch (err) {
      console.error('Calendar sync failed:', err);
    }
  }, [isConnected, user]);

  // Sync all existing tasks
  const syncAll = useCallback(async () => {
    if (!isConnected || !user) return;
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'sync_all', task: {} },
      });
      if (error) console.error('Sync all error:', error);
      return data;
    } catch (err) {
      console.error('Sync all failed:', err);
    }
  }, [isConnected, user]);

  return {
    isConnected,
    loading,
    connect,
    disconnect,
    syncTask,
    syncAll,
    checkConnection,
  };
}
