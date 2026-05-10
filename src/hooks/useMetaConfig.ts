import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';

// Cache em memória por orgId
const metaCache: Record<string, { token: string; account: string }> = {};

export function useMetaConfig() {
  const { orgId, ready: orgReady } = useOrgId();

  // Tenta pegar do cache imediatamente
  const cached = orgId ? metaCache[orgId] : null;

  const [metaToken, setMetaToken] = useState<string>(cached?.token || '');
  const [metaAccount, setMetaAccount] = useState<string>(cached?.account || '');
  const [ready, setReady] = useState(!!cached); // já pronto se tiver cache

  useEffect(() => {
    if (!orgReady) return;
    if (!orgId) { setReady(true); return; }

    // Cache hit
    if (metaCache[orgId]) {
      setMetaToken(metaCache[orgId].token);
      setMetaAccount(metaCache[orgId].account);
      setReady(true);
      return;
    }

    // Busca no banco
    supabase
      .from('organizations')
      .select('meta_token, meta_account_id')
      .eq('id', orgId)
      .single()
      .then(({ data: org }) => {
        const token = org?.meta_token || '';
        const account = org?.meta_account_id || '';

        // Salva no cache
        metaCache[orgId] = { token, account };

        setMetaToken(token);
        setMetaAccount(account);
        setReady(true);
      })
      .catch(() => {
        metaCache[orgId] = { token: '', account: '' };
        setReady(true);
      });
  }, [orgId, orgReady]);

  return { metaToken, metaAccount, ready };
}