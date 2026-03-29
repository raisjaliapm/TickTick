import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Project = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function useProjectStore() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    try { const v = localStorage.getItem('ptt-active-project'); return v ? JSON.parse(v) : null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setProjects(data as Project[]);
  }, [user]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchProjects().finally(() => setLoading(false));
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [user, fetchProjects]);

  const addProject = useCallback(async (name: string, description?: string, color?: string) => {
    if (!user) return;
    await supabase.from('projects').insert({
      user_id: user.id,
      name,
      description: description || '',
      color: color || '#3B82F6',
    } as any);
    await fetchProjects();
  }, [user, fetchProjects]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    await supabase.from('projects').update(updates as any).eq('id', id);
    await fetchProjects();
  }, [fetchProjects]);

  const deleteProject = useCallback(async (id: string) => {
    // Unlink tasks first
    await supabase.from('tasks').update({ project_id: null } as any).eq('project_id', id);
    await supabase.from('projects').delete().eq('id', id);
    if (activeProjectId === id) setActiveProjectId(null);
    await fetchProjects();
  }, [activeProjectId, fetchProjects]);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    activeProject,
    addProject,
    updateProject,
    deleteProject,
    fetchProjects,
    loading,
  };
}
