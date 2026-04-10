import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppPage() {
  const { leads } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    `Olá, {{nome}}!\n\nParabéns! Você foi aprovada como revendedora!\n\nNossa equipe vai entrar em contato em breve.\n\nFique de olho no WhatsApp!`
  );
  const [autoSend, setAutoSend] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('configuracoes_whatsapp').select('*').limit(1).maybeSingle();
      if (data) {
        setApiKey((data as any).api_key || '');
        setInstanceId((data as any).instance_id || '');
        setMessageTemplate((data as any).message_template || messageTemplate);
        setAutoSend((data as any).auto_send ?? true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    const config = { api_key: apiKey, instance_id: instanceId, message_template: messageTemplate, auto_send: autoSend };
    const { data: existing } = await supabase.from('configuracoes_whatsapp').select('id').limit(1).maybeSingle();
    if (existing) {
      await supabase.from('configuracoes_whatsapp').update(config).eq('id', (existing as any).id);
    } else {
      await supabase.from('configuracoes_whatsapp').insert(config);
    }
    toast.success('Configuração salva!');
  };

  const insertTag = (tag: string) => setMessageTemplate((p) => p + ' ' + tag);

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-6 space-y-6">
        <h1 className="text-xl font-bold font-display tracking-tight">Integração WhatsApp</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold font-display">Conexão</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">API Key (Z-API / Evolution)</label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua chave de API" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Instance ID</label>
                <Input value={instanceId} onChange={(e) => setInstanceId(e.target.value)} placeholder="ID da instância" />
              </div>
              <Button onClick={handleSave} className="w-full"><Save className="w-4 h-4 mr-2" /> Salvar configuração</Button>
            </div>
          </div>

          {/* Message Template */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold font-display">Mensagem automática</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">Enviada automaticamente quando um lead é aprovado.</p>
              <Textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={6} />
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{nome}}', '{{cidade}}', '{{data}}'].map((tag) => (
                    <button key={tag} onClick={() => insertTag(tag)} className="px-2.5 py-1 bg-secondary text-xs rounded-full hover:bg-secondary/80 transition-colors">
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => toast.info('Teste enviado!')}><Send className="w-4 h-4 mr-2" /> Enviar teste</Button>
                <Button className="flex-1" onClick={handleSave}><Save className="w-4 h-4 mr-2" /> Salvar</Button>
              </div>
              <div className="pt-4 border-t border-border">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                  <span className="text-sm text-muted-foreground">Enviar automaticamente ao aprovar</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
