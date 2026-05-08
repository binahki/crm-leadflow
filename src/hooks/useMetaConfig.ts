import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useMetaConfig() {
  const { user } = useAuth();
  const [metaToken, setMetaToken]     = useState<string>(import.meta.env.VITE_META_TOKEN || '');
  const [metaAccount, setMetaAccount] = useState<string>(import.meta.env.VITE_META_ACCOUNT || '');
  const [ready, setReady]             = useState(false);

  useEffect(() => {
    if (!user) { setReady(true); return; }
    async function load() {
      try {
        const { data: membership } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', user!.id)
          .single();

        if (membership) {
          const { data: org } = await supabase
            .from('organizations')
            .select('meta_token, meta_account_id')
            .eq('id', membership.org_id)
            .single();

          if (org?.meta_token)      setMetaToken(org.meta_token);
          if (org?.meta_account_id) setMetaAccount(org.meta_account_id);
        }
      } catch (e) {
        console.error('[useMetaConfig]', e);
      } finally {
        setReady(true);
      }
    }
    load();
  }, [user?.id]);

  return { metaToken, metaAccount, ready };
}
