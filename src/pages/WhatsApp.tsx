import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Send, CheckCircle2, MessageSquare, Zap, Settings } from 'lucide-react';
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
        {/* Header */}
        <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Integração WhatsApp</h1>
              <p className="text-sm text-muted-foreground mt-1">Configure mensagens automáticas para seus leads</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Connection */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-white/20 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-green-600" />
                <h2 className="text-sm font-bold font-display">Configuração da API</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">API Key (Z-API / Evolution)</label>
                <Input 
                  type="password" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)} 
                  placeholder="Sua chave de API" 
                  className="backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">Instance ID</label>
                <Input 
                  value={instanceId} 
                  onChange={(e) => setInstanceId(e.target.value)} 
                  placeholder="ID da instância" 
                  className="backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10"
                />
              </div>
              <Button 
                onClick={handleSave} 
                className="w-full backdrop-blur-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-lg"
              >
                <Save className="w-4 h-4 mr-2" /> Salvar configuração
              </Button>
            </div>
          </div>

          {/* Message Template */}
          <div className="backdrop-blur-xl bg-white/60 dark:bg-white/5 rounded-2xl border border-white/20 dark:border-white/10 shadow-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-white/20 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                <h2 className="text-sm font-bold font-display">Mensagem automática</h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">Enviada automaticamente quando um lead é aprovado.</p>
              <Textarea 
                value={messageTemplate} 
                onChange={(e) => setMessageTemplate(e.target.value)} 
                rows={6} 
                className="backdrop-blur-xl bg-white/40 dark:bg-white/5 border border-white/20 dark:border-white/10"
              />
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-3">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{nome}}', '{{cidade}}', '{{data}}'].map((tag) => (
                    <button 
                      key={tag} 
                      onClick={() => insertTag(tag)} 
                      className="px-3 py-1.5 backdrop-blur-xl bg-white/60 dark:bg-white/10 border border-white/20 dark:border-white/10 text-xs rounded-full hover:bg-white/80 dark:hover:bg-white/20 transition-all duration-300"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-white/20 dark:border-white/10" 
                  onClick={() => toast.info('Teste enviado!')}
                >
                  <Send className="w-4 h-4 mr-2" /> Enviar teste
                </Button>
                <Button 
                  className="flex-1 backdrop-blur-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-0 shadow-lg"
                  onClick={handleSave}
                >
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
              </div>
              <div className="pt-4 border-t border-white/20 dark:border-white/10">
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
