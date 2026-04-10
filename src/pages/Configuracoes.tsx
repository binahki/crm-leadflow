import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracoesPage() {
  const { leads, metaAccountId, metaToken, setMetaAccountId, setMetaToken } = useAppStore();
  const [accountId, setAccountId] = useState(metaAccountId);
  const [token, setToken] = useState(metaToken);

  const handleSave = () => {
    setMetaAccountId(accountId);
    setMetaToken(token);
    toast.success('Configurações salvas!');
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold font-display tracking-tight">Configurações</h1>

        <div className="bg-card border border-border rounded-xl overflow-hidden max-w-xl">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold font-display">Meta Ads API</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Account ID</label>
              <Input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="ID da conta de anúncios" />
              <p className="text-xs text-muted-foreground mt-1">ID atual: {metaAccountId}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Access Token</label>
              <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de acesso do Meta" />
            </div>
            <Button onClick={handleSave} className="w-full"><Save className="w-4 h-4 mr-2" /> Salvar</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
