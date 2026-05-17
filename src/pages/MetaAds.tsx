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
  const [ravenaAtiva, setRavenaAtiva] = useState<boolean | null>(null);
  const [budgetMensal, setBudgetMensal] = useState(5000);
  const [metaRevs, setMetaRevs] = useState(50);
  const [modo, setModo] = useState<'conservador'|'equilibrado'|'agressivo'>('equilibrado');
  const [savingRavena, setSavingRavena] = useState(false);
  const [notifAtiva, setNotifAtiva] = useState(false);
  const [notifNumero, setNotifNumero] = useState('');

  useEffect(() => {
    if (!orgReady) return;
    if (!orgId) { setLoadingData(false); return; }
    (async () => {
      setLoadingData(true);
      const { data: org } = await supabase
        .from('organizations')
        .select('meta_account_id, meta_token, ravena_ativa, ravena_budget_mensal, ravena_meta_revendedoras, ravena_modo, ravena_notif_ativa, ravena_notif_numero')
        .eq('id', orgId)
        .single();
      if (org) {
        setAccountId((org as any).meta_account_id || '');
        setToken((org as any).meta_token || '');
        setRavenaAtiva((org as any).ravena_ativa === true);
        setBudgetMensal((org as any).ravena_budget_mensal || 5000);
        setMetaRevs((org as any).ravena_meta_revendedoras || 50);
        setModo((org as any).ravena_modo || 'equilibrado');
        setNotifAtiva(Boolean((org as any).ravena_notif_ativa));
        setNotifNumero((org as any).ravena_notif_numero || '');
      }
      setLoadingData(false);
    })();
  }, [orgId, orgReady]);

  async function handleSaveRavena() {
    if (!orgId) return;
    setSavingRavena(true);
    const novoValor = ravenaAtiva === true;
    const { error } = await supabase
      .from('organizations')
      .update({
        ravena_ativa: novoValor,
        ravena_budget_mensal: budgetMensal,
        ravena_meta_revendedoras: metaRevs,
        ravena_modo: modo,
        ravena_notif_ativa: notifAtiva,
        ravena_notif_numero: notifNumero.replace(/\D/g, ''),
      })
      .eq('id', orgId);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Ravena configurada!');
      const { data: org } = await supabase
        .from('organizations')
        .select('ravena_ativa, ravena_budget_mensal, ravena_meta_revendedoras, ravena_modo')
        .eq('id', orgId)
        .single();
      if (org) {
        setRavenaAtiva(Boolean((org as any).ravena_ativa));
        setBudgetMensal(Number((org as any).ravena_budget_mensal) || 5000);
        setMetaRevs(Number((org as any).ravena_meta_revendedoras) || 50);
        setModo((org as any).ravena_modo || 'equilibrado');
      }
    }
    setSavingRavena(false);
  }

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

  const MODOS = [
    { value: 'conservador', icon: '🛡️', label: 'Conservador', desc: 'Mexe pouco. Age só com certeza absoluta.' },
    { value: 'equilibrado', icon: '⚖️', label: 'Equilibrado', desc: 'Recomendado. Otimiza com base em dados sólidos.' },
    { value: 'agressivo',   icon: '🔥', label: 'Agressivo',   desc: 'Escala rápido e pausa o que não converte.' },
  ];

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

        {/* Ravena — IA de Tráfego */}
        <div style={{ ...card, marginTop: '20px' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, background: dark ? '#18181b' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🤖</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Ravena — IA de Tráfego</span>
            </div>
            {/* Toggle ativa/inativa */}
            {ravenaAtiva === null ? (
              <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: dark ? '#3f3f46' : '#d1d5db' }} />
            ) : (
              <div onClick={() => setRavenaAtiva(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', color: ravenaAtiva ? '#10b981' : txtMid, fontWeight: 600 }}>
                  {ravenaAtiva ? 'Ativa' : 'Inativa'}
                </span>
                <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: ravenaAtiva ? '#10b981' : (dark ? '#3f3f46' : '#d1d5db'), position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: ravenaAtiva ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', opacity: ravenaAtiva === true ? 1 : 0.5, pointerEvents: ravenaAtiva === true ? 'auto' : 'none' }}>
            {/* Metas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Investimento mensal</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>R$</span>
                  <input
                    type="number"
                    value={budgetMensal}
                    onChange={e => setBudgetMensal(Number(e.target.value))}
                    style={{ ...inp, paddingLeft: '32px' }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                </div>
              </div>
              <div>
                <label style={lbl}>Meta de revendedoras</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={metaRevs}
                    onChange={e => setMetaRevs(Number(e.target.value))}
                    style={{ ...inp, paddingRight: '44px' }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: txtMid, pointerEvents: 'none' }}>/mês</span>
                </div>
              </div>
            </div>

            {/* Modo de operação */}
            <div>
              <label style={lbl}>Modo de operação</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {MODOS.map(m => (
                  <div
                    key={m.value}
                    onClick={() => setModo(m.value as any)}
                    style={{ flex: 1, padding: '12px 10px', borderRadius: '12px', cursor: 'pointer', border: `2px solid ${modo === m.value ? '#3b82f6' : (dark ? '#27272a' : '#e5e7eb')}`, background: modo === m.value ? (dark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'transparent', textAlign: 'center', transition: 'all 150ms ease' }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '5px' }}>{m.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: modo === m.value ? '#3b82f6' : txt }}>{m.label}</div>
                    <div style={{ fontSize: '10px', color: txtMid, marginTop: '3px', lineHeight: 1.4 }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Relatórios e Avisos */}
            <div style={{ paddingTop: '16px', borderTop: `1px solid ${dark ? '#1e1e22' : '#f3f4f6'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: txt, margin: 0 }}>Relatórios e Avisos</p>
                  <p style={{ fontSize: '11px', color: txtMid, margin: '2px 0 0' }}>Receba alertas importantes no WhatsApp</p>
                </div>
                <div onClick={() => setNotifAtiva(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: notifAtiva ? '#10b981' : txtMid, fontWeight: 600 }}>
                    {notifAtiva ? 'Ativo' : 'Inativo'}
                  </span>
                  <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: notifAtiva ? '#10b981' : (dark ? '#3f3f46' : '#d1d5db'), position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: '2px', left: notifAtiva ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              </div>

              {notifAtiva && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <label style={lbl}>WhatsApp para receber avisos</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>🇧🇷 +55</span>
                      <input
                        type="tel"
                        value={notifNumero}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setNotifNumero(digits);
                        }}
                        placeholder="(11) 99999-9999"
                        style={{ ...inp, paddingLeft: '72px' }}
                        onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                        onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')}
                      />
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(251,191,36,0.08)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.25)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>⏳</span>
                    <p style={{ fontSize: '11px', color: dark ? '#fcd34d' : '#92400e', margin: 0, lineHeight: 1.5 }}>
                      Número salvo. Os avisos serão ativados assim que o WhatsApp da Ravena estiver disponível.
                    </p>
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.02)' : '#f9fafb', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}` }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>O que você vai receber</p>
                    {[
                      'Quando a Ravena aumentar ou pausar uma campanha',
                      'Quando uma campanha tiver queda brusca de performance',
                      'Relatório semanal com resumo das otimizações',
                      'Alertas de meta em risco',
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#10b981', flexShrink: 0, marginTop: '1px' }}>✓</span>
                        <span style={{ fontSize: '11px', color: txtMid, lineHeight: 1.4 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aviso agressivo */}
            {modo === 'agressivo' && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', fontSize: '12px', color: '#f97316' }}>
                ⚠️ Modo agressivo pode pausar campanhas e escalar budgets rapidamente. Monitore diariamente.
              </div>
            )}

            {/* Salvar */}
            <button
              onClick={handleSaveRavena}
              disabled={savingRavena}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: savingRavena ? (dark ? '#27272a' : '#e5e7eb') : '#3b82f6', color: savingRavena ? txtMid : '#fff', fontSize: '13.5px', fontWeight: 600, cursor: savingRavena ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}
            >
              <Save style={{ width: '14px', height: '14px' }} />
              {savingRavena ? 'Salvando…' : 'Salvar configuração da Ravena'}
            </button>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
