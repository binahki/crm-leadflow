import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from './useOrgId';

export function useWhatsAppAccount() {
  const { orgId, ready } = useOrgId();
  const [hasWA, setHasWA] = useState(false);

  useEffect(() => {
    if (!ready || !orgId) return;

    (supabase as any)
      .from('whatsapp_accounts')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }: any) => {
        setHasWA(!!data);
      });
  }, [orgId, ready]);

  return { hasWA };
}
