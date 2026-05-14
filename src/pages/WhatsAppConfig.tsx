import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { ConfigView, WaAccount, WA_COLORS } from './WhatsApp';
import { useAppStore } from '@/stores/appStore';

export default function WhatsAppConfigPage() {
  const { orgId, ready } = useOrgId();
  const { theme } = useTheme();
  const colors = theme === 'dark' ? WA_COLORS.dark : WA_COLORS.light;
  const { leads: storeLeads } = useAppStore();
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !orgId) return;
    supabase
      .from('whatsapp_accounts')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data }) => {
        setAccount(data as WaAccount);
        setLoading(false);
      });
  }, [orgId, ready]);

  if (loading) return (
    <AppLayout leadCount={storeLeads.length}>
      <div className="flex-1 flex items-center justify-center h-screen">
        <p className="text-gray-500">Carregando...</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout leadCount={storeLeads.length}>
      <div className="flex-1 flex flex-col h-screen overflow-hidden" style={{ background: colors.bg }}>
        <ConfigView 
          colors={colors} 
          orgId={orgId!} 
          account={account} 
          onSaved={(acc) => setAccount(acc)} 
        />
      </div>
    </AppLayout>
  );
}
