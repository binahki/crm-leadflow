import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save, Settings } from 'lucide-react';
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
      <div className="p-7 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-sm text-gray-400 mt-0.5">Gerencie integrações e preferências</p>
        </div>

        {/* Meta Ads card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden max-w-xl">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-900">Meta Ads API</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Account ID</label>
              <Input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="ID da conta de anúncios" className="bg-gray-50 border-gray-200" />
              <p className="text-xs text-gray-400 mt-1">ID atual: {metaAccountId}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Access Token</label>
              <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Token de acesso do Meta" className="bg-gray-50 border-gray-200" />
            </div>
            <Button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4 mr-2" /> Salvar configurações
            </Button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
