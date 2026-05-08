import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useMetaConfig() {
  const { user } = useAuth();
  const [metaToken, setMetaToken]     = useState<string>('');
  const [metaAccount, setMetaAccount] = useState<string>('');
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user!.id)
        .single();

      if (!membership) { setLoading(false); return; }

      const { data: org } = await supabase
        .from('organizations')
        .select('meta_token, meta_account_id')
        .eq('id', membership.org_id)
        .single();

      if (org) {
        setMetaToken((org as any).meta_token || import.meta.env.VITE_META_TOKEN || '');
        setMetaAccount((org as any).meta_account_id || import.meta.env.VITE_META_ACCOUNT || '');
      }
      setLoading(false);
    }
    load();
  }, [user]);

  return { metaToken, metaAccount, loading };
}
