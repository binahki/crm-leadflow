import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
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
        <h1 className="text-xl font-bold font-display tracking-tight">Webhook</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Config */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold font-display">Endpoint Webhook</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">Cole esta URL na configuração do seu quiz/formulário para receber leads automaticamente.</p>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">URL do Webhook</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all">{webhookUrl}</code>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Secret Key</label>
                <Input value={secretKey} readOnly className="font-mono text-xs" />
              </div>
              <Button onClick={handleTest} disabled={testStatus === 'loading'} className="w-full">
                {testStatus === 'loading' && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="w-4 h-4 mr-2" />}
                {testStatus === 'error' && <XCircle className="w-4 h-4 mr-2" />}
                {testStatus === 'success' ? 'Teste enviado!' : testStatus === 'error' ? 'Erro' : 'Testar webhook'}
              </Button>
            </div>
          </div>

          {/* Logs */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold font-display">Log de eventos</h2>
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-center py-10 text-sm text-muted-foreground italic">Nenhum evento registrado</p>
              ) : (
                <div className="space-y-2 font-mono text-xs">
                  {logs.map((log) => (
                    <div key={log.id} className="py-2 border-b border-border last:border-0 flex items-center gap-2">
                      <span className="text-muted-foreground">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                      <span className={log.status === 'success' ? 'text-success' : 'text-destructive'}>
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
