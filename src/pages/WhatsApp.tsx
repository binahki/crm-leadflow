import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Save, Send, Settings, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppPage() {
  const { leads } = useAppStore();
  const [apiKey, setApiKey] = useState('');
  const [instanceId, setInstanceId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    `Olá, {{nome}}!\n\nParabéns! Você foi aprovada como revendedora!\n\nNossa equipe vai entrar em contato em breve.\n\nFique de olho no WhatsApp!`
  );
  const [autoSend, setAutoSend] = useState(true);

  useEffect(() => {
    supabase.from('configuracoes_whatsapp').select('*').limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setApiKey((data as any).api_key || '');
        setInstanceId((data as any).instance_id || '');
        setMessageTemplate((data as any).message_template || messageTemplate);
        setAutoSend((data as any).auto_send ?? true);
      }
    });
  }, []);

  const handleSave = async () => {
    const config = { api_key: apiKey, instance_id: instanceId, message_template: messageTemplate, auto_send: autoSend };
    const { data: existing } = await supabase.from('configuracoes_whatsapp').select('id').limit(1).maybeSingle();
    if (existing) await supabase.from('configuracoes_whatsapp').update(config).eq('id', (existing as any).id);
    else          await supabase.from('configuracoes_whatsapp').insert(config);
    toast.success('Configuração salva!');
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integração WhatsApp</h1>
          <p className="text-sm text-gray-400 mt-0.5">Configure mensagens automáticas para seus leads</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API config */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
              <Settings className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Configuração da API</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">API Key (Z-API / Evolution)</label>
                <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Sua chave de API" className="bg-gray-50 border-gray-200" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Instance ID</label>
                <Input value={instanceId} onChange={e => setInstanceId(e.target.value)} placeholder="ID da instância" className="bg-gray-50 border-gray-200" />
              </div>
              <Button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <Save className="w-4 h-4 mr-2" /> Salvar configuração
              </Button>
            </div>
          </div>

          {/* Message template */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-900">Mensagem automática</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-400">Enviada automaticamente quando um lead é aprovado.</p>
              <Textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={6} className="bg-gray-50 border-gray-200" />
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Variáveis disponíveis:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{nome}}', '{{cidade}}', '{{data}}'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setMessageTemplate(p => p + ' ' + tag)}
                      className="px-3 py-1.5 bg-gray-100 border border-gray-200 text-xs rounded-full hover:bg-gray-200 transition-colors text-gray-700"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 border-gray-200" onClick={() => toast.info('Teste enviado!')}>
                  <Send className="w-4 h-4 mr-2" /> Enviar teste
                </Button>
                <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" /> Salvar
                </Button>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Switch checked={autoSend} onCheckedChange={setAutoSend} />
                  <span className="text-sm text-gray-500">Enviar automaticamente ao aprovar</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
