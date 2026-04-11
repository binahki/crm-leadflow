import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, CheckCircle2, XCircle, Webhook, Activity, Key } from 'lucide-react';
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
    const fetchLogs = async () => {
      const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50);
      if (data) setLogs(data as unknown as WebhookLog[]);
    };
    fetchLogs();

    // Real-time logs
    const channel = supabase
      .channel('webhook-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'webhook_logs' }, (payload) => {
        setLogs((prev) => [payload.new as unknown as WebhookLog, ...prev].slice(0, 50));
      })
      .subscribe();

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
      const { error } = await supabase.from('leads').insert({
        nome: 'Lead de Teste',
        whatsapp: '(11) 99999-0000',
        cidade: 'São Paulo',
        status: 0,
        entrada: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        wa_sent: false,
      });
      if (error) throw error;
      await supabase.from('webhook_logs').insert({
        event_type: 'test',
        payload: { nome: 'Lead de Teste', source: 'manual_test' },
        status: 'success',
      });
      setTestStatus('success');
      toast.success('Lead de teste criado!');
    } catch {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
              <Webhook className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Webhook</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure o recebimento automático de leads</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-white/20 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-bold font-display">Endpoint Webhook</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Cole esta URL na configuração do seu quiz/formulário para receber leads automaticamente.</p>
              <div className="backdrop-blur-xl bg-white/40 dark:bg-white/5 rounded-xl p-4 border border-white/20 dark:border-white/10">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">URL do Webhook</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all bg-transparent">{webhookUrl}</code>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleCopy}
                    className="backdrop-blur-xl bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Secret Key</label>
                <Input 
                  value={secretKey} 
                  readOnly 
                  className="font-mono text-xs backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10" 
                />
              </div>
              <Button 
                onClick={handleTest} 
                disabled={testStatus === 'loading'} 
                className="w-full backdrop-blur-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg"
              >
                {testStatus === 'loading' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 mr-2" />}
                {testStatus === 'error' && <XCircle className="w-4 h-4 mr-2" />}
                {testStatus === 'success' ? 'Teste enviado!' : testStatus === 'error' ? 'Erro' : 'Testar webhook'}
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <h2 className="text-sm font-bold font-display">Log de eventos em tempo real</h2>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="backdrop-blur-xl bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/20"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-10">
                  <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground italic">Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="backdrop-blur-xl bg-white/40 dark:bg-white/5 rounded-lg p-3 border border-white/20 dark:border-white/10 flex items-center gap-3 hover:bg-white/60 dark:hover:bg-white/10 transition-colors">
                      <span className="text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className={log.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
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
