import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { Save, BarChart3, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export default function MetaAdsPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const { orgId, ready: orgReady } = useOrgId();
  const [accountId, setAccountId]     = useState('');
  const [token, setToken]             = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (!orgReady) return;
    if (!orgId) { setLoadingData(false); return; }
    (async () => {
      setLoadingData(true);
      const { data: org } = await supabase
        .from('organizations')
        .select('meta_account_id, meta_token')
        .eq('id', orgId)
        .single();
      if (org) {
        setAccountId((org as any).meta_account_id || '');
        setToken((org as any).meta_token || '');
      }
      setLoadingData(false);
    })();
  }, [orgId, orgReady]);

  async function handleSave() {
    if (!orgId) { toast.error('Organização não encontrada'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ meta_account_id: accountId, meta_token: token })
      .eq('id', orgId);
    setSaving(false);
    if (error) toast.error('Erro ao salvar configurações');
    else toast.success('Configurações salvas!');
  }

  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px',
    overflow: 'hidden',
    boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
    maxWidth: '520px',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: dark ? '#f4f4f5' : '#111827',
    fontSize: '13.5px', outline: 'none', fontFamily: FONT, boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };
  const lbl: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 600,
    color: dark ? '#71717a' : '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em',
    display: 'block', marginBottom: '6px',
  };
  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', fontFamily: FONT }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Meta Ads</h1>
          <p style={{ fontSize: '13px', color: txtMid, marginTop: '3px' }}>Configure a integração com a API do Meta Ads</p>
        </div>

        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: '8px', background: dark ? '#18181b' : '#fafafa' }}>
            <BarChart3 style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Meta Ads API</span>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loadingData ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: txtMid, fontSize: '13px' }}>
                Carregando configurações…
              </div>
            ) : (
              <>
                <div>
                  <label style={lbl}>Account ID</label>
                  <input
                    style={inp}
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    placeholder="ID da conta de anúncios (ex: act_123456789)"
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                </div>

                <div>
                  <label style={lbl}>Access Token</label>
                  <input
                    style={inp}
                    type="password"
                    autoComplete="new-password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="Token de acesso permanente"
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                  <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(59,130,246,0.07)' : '#eff6ff', border: `1px solid ${dark ? 'rgba(59,130,246,0.18)' : '#bfdbfe'}` }}>
                    <p style={{ fontSize: '12px', color: dark ? '#93c5fd' : '#1d4ed8', margin: 0, lineHeight: 1.6 }}>
                      Gere um token permanente em{' '}
                      <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
                        style={{ color: dark ? '#60a5fa' : '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                        business.facebook.com <ExternalLink style={{ width: '11px', height: '11px' }} />
                      </a>
                      {' '}→ Configurações → Usuários do Sistema → Gerar Token.
                      Marque as permissões <strong>ads_read</strong> e <strong>ads_management</strong>.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#3b82f6', color: saving ? txtMid : '#fff', fontSize: '13.5px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}
                >
                  <Save style={{ width: '14px', height: '14px' }} />
                  {saving ? 'Salvando…' : 'Salvar configurações'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
