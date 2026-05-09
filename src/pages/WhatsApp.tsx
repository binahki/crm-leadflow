import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { Save, Settings, Zap, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';

export default function WhatsAppPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const { user } = useAuth();
  const dark = theme === 'dark';

  const [orgId, setOrgId] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState('');
  const [token, setToken] = useState('');
  const [clientToken, setClientToken] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    `Olá, {{nome}}!\n\nParabéns! Você foi aprovada como revendedora!\n\nNossa equipe vai entrar em contato em breve.\n\nFique de olho no WhatsApp!`
  );
  const [autoSend, setAutoSend] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: membership } = await supabase
        .from('memberships')
        .select('org_id')
        .eq('user_id', user!.id)
        .single();

      if (!membership?.org_id) return;
      setOrgId(membership.org_id);

      const { data: config } = await supabase
        .from('configuracoes_whatsapp')
        .select('*')
        .eq('org_id', membership.org_id)
        .single();

      if (config) {
        setInstanceId((config as any).instance_id || '');
        setToken((config as any).token || '');
        setClientToken((config as any).client_token || '');
        setMessageTemplate((config as any).message_template || messageTemplate);
        setAutoSend((config as any).auto_send ?? true);
      }
    }
    load();
  }, [user?.id]);

  const handleSave = async () => {
    if (!orgId) { toast.error('Organização não encontrada'); return; }
    setSaving(true);
    const config = {
      instance_id: instanceId,
      token,
      client_token: clientToken,
      message_template: messageTemplate,
      auto_send: autoSend,
    };
    const { data: existing } = await supabase
      .from('configuracoes_whatsapp')
      .select('id')
      .eq('org_id', orgId)
      .single();
    const { error } = existing
      ? await supabase.from('configuracoes_whatsapp').update(config).eq('org_id', orgId)
      : await supabase.from('configuracoes_whatsapp').insert({ ...config, org_id: orgId });
    setSaving(false);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Configuração salva!');
  };

  // ── Estilos ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
  };
  const cardHeader: React.CSSProperties = {
    padding: '16px 20px',
    borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`,
    display: 'flex', alignItems: 'center', gap: '8px',
    background: dark ? '#18181b' : '#fafafa',
  };
  const label: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600, color: dark ? '#71717a' : '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px',
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '10px',
    border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: dark ? '#f4f4f5' : '#111827',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', maxWidth: '860px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Integração WhatsApp</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Configure mensagens automáticas via Z-API</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Credenciais */}
          <div style={card}>
            <div style={cardHeader}>
              <Settings style={{ width: '16px', height: '16px', color: '#10b981' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Credenciais Z-API</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Help */}
              <a
                href="https://z-api.io"
                target="_blank"
                rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(16,185,129,0.08)' : '#f0fdf4', border: `1px solid ${dark ? 'rgba(16,185,129,0.2)' : '#bbf7d0'}`, textDecoration: 'none' }}
              >
                <ExternalLink style={{ width: '13px', height: '13px', color: '#10b981', flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', color: dark ? '#6ee7b7' : '#065f46' }}>
                  Encontre suas credenciais em <strong>z-api.io → sua instância → Security</strong>
                </span>
              </a>

              <div>
                <label style={label}>Instance ID</label>
                <input
                  style={input}
                  value={instanceId}
                  onChange={e => setInstanceId(e.target.value)}
                  placeholder="Ex: 3D5B2A1C4E6F..."
                />
              </div>

              <div>
                <label style={label}>Token da instância</label>
                <input
                  style={input}
                  type="password"
                  autoComplete="new-password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Token gerado pela Z-API"
                />
              </div>

              <div>
                <label style={label}>Client Token</label>
                <input
                  style={input}
                  type="password"
                  autoComplete="new-password"
                  value={clientToken}
                  onChange={e => setClientToken(e.target.value)}
                  placeholder="Client-Token (aba Security)"
                />
                <p style={{ fontSize: '11.5px', color: txtMid, margin: '5px 0 0' }}>Campo "Client-Token" em Security da sua instância</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#10b981', color: saving ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.15s' }}
              >
                <Save style={{ width: '14px', height: '14px' }} />
                {saving ? 'Salvando...' : 'Salvar configuração'}
              </button>
            </div>
          </div>

          {/* Mensagem */}
          <div style={card}>
            <div style={cardHeader}>
              <Zap style={{ width: '16px', height: '16px', color: '#10b981' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Mensagem automática</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>Enviada automaticamente quando um lead é aprovado.</p>

              <textarea
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
                rows={7}
                style={{ ...input, resize: 'vertical', lineHeight: 1.6 }}
              />

              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>Variáveis disponíveis</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {['{{nome}}', '{{cidade}}', '{{data}}'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => setMessageTemplate(p => p + ' ' + tag)}
                      style={{ padding: '4px 10px', borderRadius: '99px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#18181b' : '#f8fafc', color: dark ? '#a1a1aa' : '#374151', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle */}
              <div style={{ paddingTop: '12px', borderTop: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: txtMid }}>Enviar automaticamente ao aprovar</span>
                <button
                  onClick={() => setAutoSend(v => !v)}
                  style={{ width: '40px', height: '22px', borderRadius: '99px', border: 'none', background: autoSend ? '#10b981' : (dark ? '#27272a' : '#d1d5db'), cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: '3px', left: autoSend ? '20px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </button>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#10b981', color: saving ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.15s' }}
              >
                <Save style={{ width: '14px', height: '14px' }} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
