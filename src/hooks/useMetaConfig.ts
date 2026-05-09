import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';

export function useMetaConfig() {
  const { orgId, ready: orgReady } = useOrgId();

  const [metaToken,   setMetaToken]   = useState<string>(import.meta.env.VITE_META_TOKEN   || '');
  const [metaAccount, setMetaAccount] = useState<string>(import.meta.env.VITE_META_ACCOUNT || '');
  const [ready,       setReady]       = useState(false);

  useEffect(() => {
    if (!orgReady) return;
    if (!orgId)   { setReady(true); return; }

    supabase
      .from('organizations')
      .select('meta_token, meta_account_id')
      .eq('id', orgId)
      .single()
      .then(({ data: org }) => {
        if (org?.meta_token)      setMetaToken(org.meta_token);
        if (org?.meta_account_id) setMetaAccount(org.meta_account_id);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [orgId, orgReady]);

  return { metaToken, metaAccount, ready };
}
