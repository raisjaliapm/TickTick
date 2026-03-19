import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TrackerBoard = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TrackerPhase = {
  id: string;
  board_id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type TrackerItem = {
  id: string;
  phase_id: string;
  user_id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | 'on_hold';
  priority: string;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function useProductTracker() {
  const { user } = useAuth();
  const [boards, setBoards] = useState<TrackerBoard[]>([]);
  const [phases, setPhases] = useState<TrackerPhase[]>([]);
  const [items, setItems] = useState<TrackerItem[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBoards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('product_tracker_boards').select('*').eq('user_id', user.id).order('sort_order') as any;
    if (data) setBoards(data);
  }, [user]);

  const fetchPhases = useCallback(async (boardId: string) => {
    if (!user) return;
    const { data } = await supabase.from('product_tracker_phases').select('*').eq('board_id', boardId).eq('user_id', user.id).order('sort_order') as any;
    if (data) setPhases(data);
  }, [user]);

  const fetchItems = useCallback(async (boardId: string) => {
    if (!user) return;
    // Get all phases for this board, then all items for those phases
    const { data: phaseData } = await supabase.from('product_tracker_phases').select('id').eq('board_id', boardId).eq('user_id', user.id) as any;
    if (phaseData && phaseData.length > 0) {
      const phaseIds = phaseData.map((p: any) => p.id);
      const { data } = await supabase.from('product_tracker_items').select('*').in('phase_id', phaseIds).eq('user_id', user.id).order('sort_order') as any;
      if (data) setItems(data);
    } else {
      setItems([]);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchBoards().finally(() => setLoading(false));
    } else {
      setBoards([]);
      setPhases([]);
      setItems([]);
      setLoading(false);
    }
  }, [user, fetchBoards]);

  useEffect(() => {
    if (activeBoardId) {
      Promise.all([fetchPhases(activeBoardId), fetchItems(activeBoardId)]);
    } else {
      setPhases([]);
      setItems([]);
    }
  }, [activeBoardId, fetchPhases, fetchItems]);

  const addBoard = useCallback(async (name: string) => {
    if (!user) return;
    await supabase.from('product_tracker_boards').insert({ user_id: user.id, name, sort_order: boards.length } as any);
    await fetchBoards();
  }, [user, boards.length, fetchBoards]);

  const deleteBoard = useCallback(async (id: string) => {
    await supabase.from('product_tracker_boards').delete().eq('id', id);
    if (activeBoardId === id) setActiveBoardId(null);
    await fetchBoards();
  }, [activeBoardId, fetchBoards]);

  const addPhase = useCallback(async (boardId: string, name: string) => {
    if (!user) return;
    await supabase.from('product_tracker_phases').insert({ board_id: boardId, user_id: user.id, name, sort_order: phases.length } as any);
    await fetchPhases(boardId);
  }, [user, phases.length, fetchPhases]);

  const deletePhase = useCallback(async (phaseId: string) => {
    await supabase.from('product_tracker_phases').delete().eq('id', phaseId);
    if (activeBoardId) {
      await Promise.all([fetchPhases(activeBoardId), fetchItems(activeBoardId)]);
    }
  }, [activeBoardId, fetchPhases, fetchItems]);

  const addItem = useCallback(async (phaseId: string, title: string) => {
    if (!user) return;
    const phaseItems = items.filter(i => i.phase_id === phaseId);
    await supabase.from('product_tracker_items').insert({ phase_id: phaseId, user_id: user.id, title, sort_order: phaseItems.length } as any);
    if (activeBoardId) await fetchItems(activeBoardId);
  }, [user, items, activeBoardId, fetchItems]);

  const updateItemStatus = useCallback(async (itemId: string, status: TrackerItem['status']) => {
    await supabase.from('product_tracker_items').update({ status } as any).eq('id', itemId);
    if (activeBoardId) await fetchItems(activeBoardId);
  }, [activeBoardId, fetchItems]);

  const deleteItem = useCallback(async (itemId: string) => {
    await supabase.from('product_tracker_items').delete().eq('id', itemId);
    if (activeBoardId) await fetchItems(activeBoardId);
  }, [activeBoardId, fetchItems]);

  const activeBoard = boards.find(b => b.id === activeBoardId) || null;

  return {
    boards, phases, items, activeBoard, activeBoardId, setActiveBoardId, loading,
    addBoard, deleteBoard, addPhase, deletePhase, addItem, updateItemStatus, deleteItem,
  };
}
