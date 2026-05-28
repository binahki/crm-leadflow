import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tag {
  id: string;
  org_id: string;
  nome: string;
  cor: string;
  created_at: string;
}

export const CORES_TAGS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6',
  '#ec4899', '#6b7280', '#0044fd', '#b8fd2f',
];

export function useTags(orgId: string | null) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  // Unique per hook instance to avoid channel name collisions when multiple
  // components use useTags with the same orgId simultaneously.
  const channelId = useRef(`tags-${Math.random().toString(36).slice(2)}`);

  async function fetchTags() {
    if (!orgId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('tags')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    setTags(data || []);
    setLoading(false);
  }

  useEffect(() => { fetchTags(); }, [orgId]); // eslint-disable-line

  // Realtime: keep all hook instances in sync when tags are created/updated/deleted
  useEffect(() => {
    if (!orgId) return;
    const ch = (supabase as any)
      .channel(channelId.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tags', filter: `org_id=eq.${orgId}` }, (p: any) => {
        const newTag = p.new as Tag;
        setTags(prev => prev.find(t => t.id === newTag.id) ? prev : [...prev, newTag]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tags', filter: `org_id=eq.${orgId}` }, (p: any) => {
        const updated = p.new as Tag;
        setTags(prev => prev.map(t => t.id === updated.id ? updated : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tags' }, (p: any) => {
        const deletedId = (p.old as { id: string }).id;
        setTags(prev => prev.filter(t => t.id !== deletedId));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]); // eslint-disable-line

  async function createTag(nome: string, cor: string): Promise<Tag | null> {
    if (!orgId) return null;
    const { data, error } = await (supabase as any)
      .from('tags')
      .insert({ org_id: orgId, nome: nome.trim(), cor })
      .select('*')
      .single();
    if (error || !data) return null;
    // Realtime INSERT will update state; optimistic update for responsiveness
    setTags(prev => prev.find(t => t.id === data.id) ? prev : [...prev, data]);
    return data as Tag;
  }

  async function updateTag(id: string, updates: Partial<Pick<Tag, 'nome' | 'cor'>>) {
    const { error } = await (supabase as any).from('tags').update(updates).eq('id', id);
    if (!error) setTags(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  async function deleteTag(id: string) {
    const { error } = await (supabase as any).from('tags').delete().eq('id', id);
    // Realtime DELETE will update all instances; optimistic update for responsiveness
    if (!error) setTags(prev => prev.filter(t => t.id !== id));
  }

  return { tags, loading, createTag, updateTag, deleteTag, refetch: fetchTags };
}
