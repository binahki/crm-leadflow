import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, CheckCircle2, XCircle, Activity, Key } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookLog {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
}

export default function WebhookPage() {
  const { leads } = useAppStore();
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [secretKey] = useState('lf_secret_' + Math.random().toString(36).substring(2, 10));
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const webhookUrl = `${window.location.origin}/api/webhook/inlead`;

  useEffect(() => {
    supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setLogs(data as unknown as WebhookLog[]); });

    const channel = supabase.channel('webhook-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs' }, p => {
        setLogs(prev => [p.new as unknown as WebhookLog, ...prev].slice(0, 50));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('URL copiada!');
  };

  const handleTest = async () => {
    setTestStatus('loading');
    try {
      const { error } = await supabase.from('leads').upsert(
        {
          nome: 'Lead de Teste', whatsapp: '(11) 99999-0000', cidade: 'São Paulo',
          status: 0, entrada: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), wa_sent: false,
        },
        { onConflict: 'nome,whatsapp', ignoreDuplicates: true }
      );
      if (error) throw error;
      await supabase.from('webhook_logs').insert({ event_type: 'test', payload: { nome: 'Lead de Teste', source: 'manual_test' }, status: 'success' });
      setTestStatus('success');
      toast.success('Lead de teste criado!');
    } catch { setTestStatus('error'); }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhook</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure o recebimento automático de leads</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-900">Endpoint Webhook</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400">Cole esta URL na configuração do seu quiz/formulário para receber leads automaticamente.</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">URL do Webhook</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono text-gray-700 break-all">{webhookUrl}</code>
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="hover:bg-gray-100 flex-shrink-0">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Secret Key</label>
                <Input value={secretKey} readOnly className="font-mono text-xs bg-gray-50 border-gray-200" />
              </div>
              <Button
                onClick={handleTest}
                disabled={testStatus === 'loading'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {testStatus === 'loading' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 mr-2" />}
                {testStatus === 'error'   && <XCircle className="w-4 h-4 mr-2" />}
                {testStatus === 'success' ? 'Teste enviado!' : testStatus === 'error' ? 'Erro no teste' : 'Testar webhook'}
              </Button>
            </div>
          </div>

          {/* Logs card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <h2 className="font-semibold text-gray-900">Log em tempo real</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="hover:bg-gray-50">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-10">
                  <Activity className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {logs.map(log => (
                    <div key={log.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex items-center gap-3">
                      <span className="text-gray-400 flex-shrink-0">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={log.status === 'success' ? 'text-green-700' : 'text-red-600'}>
                        {log.event_type}: {(log.payload as any)?.nome || 'Lead'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
