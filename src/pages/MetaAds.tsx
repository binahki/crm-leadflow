import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { useNavigate } from 'react-router-dom';
import { Save, BarChart3, ExternalLink, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { UpgradeModal } from '@/components/ui/UpgradeModal';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif";
const ACCENT = '#0044fd';
const db = supabase as any;

function Section({ title, subtitle, action, children }: {
  title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <div style={{ marginBottom: '0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: dark ? '#f4f4f5' : '#111827', letterSpacing: '-0.02em' }}>{title}</h2>
          {subtitle && <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: dark ? '#71717a' : '#6b7280', lineHeight: 1.5 }}>{subtitle}</p>}
        </div>
        {action && <div style={{ flexShrink: 0, paddingTop: '2px' }}>{action}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: dark ? '#71717a' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Divider() {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return <div style={{ height: '1px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '32px 0' }} />;
}

export default function MetaAdsPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();
  const navigate = useNavigate();
  const { features, loading: planLoading } = usePlanFeatures();
  const ravenaLocked = !planLoading && !features.ravena;
  const [showRavenaUpgrade, setShowRavenaUpgrade] = useState(false);

  // API state
  const [accountId, setAccountId] = useState('');
  const [token, setToken]         = useState('');
  const [saving, setSaving]       = useState(false);

  // Metas state (acessíveis em todos os planos)
  const [budgetMensal, setBudgetMensal] = useState(5000);
  const [metaRevs, setMetaRevs]         = useState(50);
  const [savingMetas, setSavingMetas]   = useState(false);

  // CAPI state
  const [pixelId, setPixelId]             = useState('');
  const [capiDatasetId, setCapiDatasetId] = useState('');
  const [capiToken, setCapiToken]         = useState('');
  const [capiAtivo, setCapiAtivo]         = useState(false);
  const [togglingCapi, setTogglingCapi]   = useState(false);
  const [savingCapi, setSavingCapi]       = useState(false);

  // Feriados state
  const [feriadosTodos, setFeriadosTodos] = useState<string[]>([]);
  const [feriadosMes, setFeriadosMes] = useState<string[]>([]);

  // Ravena state
  const [ravenaAtiva, setRavenaAtiva]     = useState<boolean | null>(null);
  const [togglingRavena, setTogglingRavena] = useState(false);
  const [modo, setModo]                   = useState<'conservador' | 'equilibrado' | 'agressivo'>('equilibrado');
  const [savingRavena, setSavingRavena]   = useState(false);
  const [notifAtiva, setNotifAtiva]       = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [notifNumero, setNotifNumero]     = useState('');
  const [loadingData, setLoadingData]     = useState(true);
  const [isMobile, setIsMobile]           = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!orgReady) return;
    if (!orgId) { setLoadingData(false); return; }
    (async () => {
      setLoadingData(true);
      const { data: org } = await db
        .from('organizations')
        .select('meta_account_id,meta_token,meta_pixel_id,meta_capi_dataset_id,meta_capi_token,meta_capi_ativo,ravena_ativa,ravena_budget_mensal,ravena_meta_revendedoras,ravena_modo,ravena_notif_ativa,ravena_notif_numero,feriados_mes')
        .eq('id', orgId).single();
      if (org) {
        setAccountId(org.meta_account_id || '');
        setToken(org.meta_token || '');
        setPixelId(org.meta_pixel_id || '');
        setCapiDatasetId(org.meta_capi_dataset_id || '');
        setCapiToken(org.meta_capi_token || '');
        setCapiAtivo(Boolean(org.meta_capi_ativo));
        setRavenaAtiva(org.ravena_ativa === true);
        setBudgetMensal(org.ravena_budget_mensal || 5000);
        setMetaRevs(org.ravena_meta_revendedoras || 50);
        setModo(org.ravena_modo || 'equilibrado');
        setNotifAtiva(Boolean(org.ravena_notif_ativa));
        setNotifNumero(org.ravena_notif_numero || '');
        const todosF: string[] = org.feriados_mes || [];
        setFeriadosTodos(todosF);
        const agora = new Date();
        const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
        setFeriadosMes(todosF.filter((f: string) => f.startsWith(mesAtual)));
      }
      setLoadingData(false);
    })();
  }, [orgId, orgReady]);

  async function handleSave() {
    if (!orgId) return;
    setSaving(true);
    const { error } = await db.from('organizations').update({ meta_account_id: accountId, meta_token: token }).eq('id', orgId);
    if (error) toast.error('Erro ao salvar');
    else toast.success('Configurações salvas!');
    setSaving(false);
  }

  async function handleSaveMetas() {
    if (!orgId) return;
    setSavingMetas(true);
    const { error } = await db.from('organizations').update({
      ravena_budget_mensal: budgetMensal,
      ravena_meta_revendedoras: metaRevs,
    }).eq('id', orgId);
    if (error) toast.error('Erro ao salvar metas');
    else toast.success('Metas salvas!');
    setSavingMetas(false);
  }

  async function handleToggleRavena() {
    if (ravenaLocked) { setShowRavenaUpgrade(true); return; }
    if (ravenaAtiva === null || togglingRavena) return;
    const next = !ravenaAtiva;
    setRavenaAtiva(next);
    setTogglingRavena(true);
    const updatePayload: any = { ravena_ativa: next };
    if (next) {
      const { data: orgAtual } = await db
        .from('organizations')
        .select('ravena_ativada_em')
        .eq('id', orgId)
        .single();
      if (!orgAtual?.ravena_ativada_em) {
        updatePayload.ravena_ativada_em = new Date().toISOString();
      }
    }
    const { error } = await db.from('organizations').update(updatePayload).eq('id', orgId);
    if (error) {
      setRavenaAtiva(!next);
      toast.error('Erro ao salvar');
    } else {
      toast.success(next ? 'Ravena ativada!' : 'Ravena desativada');
    }
    setTogglingRavena(false);
  }

  async function handleToggleNotif() {
    if (!orgId) return;
    const next = !notifAtiva;
    setNotifAtiva(next);
    setTogglingNotif(true);
    const { error } = await db.from('organizations').update({ ravena_notif_ativa: next }).eq('id', orgId);
    if (error) { setNotifAtiva(!next); toast.error('Erro ao salvar'); }
    setTogglingNotif(false);
  }

  async function handleSaveRavena() {
    if (!orgId) return;
    setSavingRavena(true);
    const { error } = await db.from('organizations').update({
      ravena_modo: modo,
      ravena_notif_ativa: notifAtiva,
      ravena_notif_numero: notifNumero.replace(/\D/g, ''),
    }).eq('id', orgId);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Ravena configurada!');
    setSavingRavena(false);
  }

  async function handleToggleCapi() {
    if (!orgId) return;
    const next = !capiAtivo;
    setCapiAtivo(next);
    setTogglingCapi(true);
    const { error } = await db.from('organizations').update({ meta_capi_ativo: next }).eq('id', orgId);
    if (error) { setCapiAtivo(!next); toast.error('Erro ao salvar'); }
    setTogglingCapi(false);
  }

  async function handleSaveCapi() {
    if (!orgId) return;
    setSavingCapi(true);
    const { error } = await db.from('organizations').update({
      meta_pixel_id: pixelId,
      meta_capi_dataset_id: capiDatasetId,
      meta_capi_token: capiToken,
      meta_capi_ativo: capiAtivo,
    }).eq('id', orgId);
    if (error) toast.error('Erro ao salvar CAPI');
    else toast.success('CAPI configurado!');
    setSavingCapi(false);
  }

  async function adicionarFeriado(data: string) {
    const novos = [...feriadosTodos, data].sort();
    setFeriadosTodos(novos);
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
    setFeriadosMes(novos.filter(f => f.startsWith(mesAtual)));
    await db.from('organizations').update({ feriados_mes: novos }).eq('id', orgId);
  }

  async function removerFeriado(data: string) {
    const novos = feriadosTodos.filter(f => f !== data);
    setFeriadosTodos(novos);
    const agora = new Date();
    const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth()+1).padStart(2,'0')}`;
    setFeriadosMes(novos.filter(f => f.startsWith(mesAtual)));
    await db.from('organizations').update({ feriados_mes: novos }).eq('id', orgId);
  }

  // ── Design tokens ─────────────────────────────────────────────
  const cardBg = dark ? '#13141a' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const headBg = dark ? 'rgba(255,255,255,0.025)' : '#f9fafb';
  const txt    = dark ? '#f1f5f9' : '#0f172a';
  const txtMid = dark ? '#94a3b8' : '#64748b';
  const txtMut = dark ? '#475569' : '#94a3b8';
  const shadow = dark
    ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
    : '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)';

  const card: React.CSSProperties = {
    background: cardBg, border: `1px solid ${border}`,
    borderRadius: '16px', overflow: 'hidden', boxShadow: shadow,
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${border}`,
    background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
    color: txt, fontSize: '13.5px', outline: 'none',
    fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s',
  };

  const lbl: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 600, color: txtMut,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    display: 'block', marginBottom: '6px',
  };

  const primaryBtn = (disabled: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: '10px', border: 'none',
    background: disabled ? border : ACCENT,
    color: disabled ? txtMid : '#fff',
    fontSize: '13.5px', fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
    fontFamily: FONT, transition: 'background 0.15s', whiteSpace: 'nowrap',
  });

  const MODOS = [
    { value: 'conservador', label: 'Conservador', desc: 'Age só com certeza.', color: '#64748b' },
    { value: 'equilibrado', label: 'Equilibrado', desc: 'Recomendado.',        color: ACCENT    },
    { value: 'agressivo',   label: 'Agressivo',   desc: 'Escala rápido.',      color: '#f97316' },
  ];

  function Toggle({ active, toggling, onToggle, color = '#10b981' }: { active: boolean; toggling: boolean; onToggle: () => void; color?: string }) {
    return (
      <button onClick={onToggle} disabled={toggling}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'none', border: 'none', cursor: toggling ? 'default' : 'pointer', padding: '4px', borderRadius: '8px', opacity: toggling ? 0.7 : 1 }}>
        <span style={{ fontSize: '11px', color: active ? color : txtMid, fontWeight: 600, letterSpacing: '0.02em', minWidth: '38px', textAlign: 'right' }}>
          {toggling ? '…' : active ? 'Ativo' : 'Inativo'}
        </span>
        <div style={{ width: '40px', height: '22px', borderRadius: '99px', background: active ? color : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'), position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: '2px', left: active ? '20px' : '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
        </div>
      </button>
    );
  }

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '40px 32px 64px', fontFamily: FONT }}>

        {/* ── Cabeçalho ── */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, letterSpacing: '-0.03em', margin: '0 0 4px' }}>
            Meta Ads
          </h1>
          <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
            Conexão com sua conta de anúncios e objetivos mensais
          </p>
        </div>

        {/* ── Seção: Metas ── */}
        <Section title="Metas do mês" subtitle="Usadas para calcular ritmo e projeções no dashboard">
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <Field label="Investimento mensal (R$)">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>R$</span>
                <input type="number" value={budgetMensal} onChange={e => setBudgetMensal(Number(e.target.value))}
                  style={{ ...inp, paddingLeft: '36px' }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
              </div>
            </Field>
            <Field label="Meta de revendedoras / mês">
              <div style={{ position: 'relative' }}>
                <input type="number" value={metaRevs} onChange={e => setMetaRevs(Number(e.target.value))}
                  style={{ ...inp, paddingRight: '44px' }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: txtMut, pointerEvents: 'none' }}>/mês</span>
              </div>
            </Field>
          </div>

          {/* Feriados do mês */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: txt }}>Feriados do mês</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: txtMid }}>
                  Excluídos do cálculo de dias úteis. Feriados nacionais de 2026 já estão pré-configurados.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {feriadosMes.length === 0 && (
                <span style={{ fontSize: '12px', color: txtMut }}>Nenhum feriado configurado para este mês.</span>
              )}
              {feriadosMes.map(f => {
                const d = new Date(f + 'T12:00:00');
                const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
                return (
                  <div key={f} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px', borderRadius: '99px',
                    background: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                    border: `1px solid ${border}`,
                    fontSize: '12px', color: txt,
                  }}>
                    📅 {label}
                    <button onClick={() => removerFeriado(f)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: txtMut, padding: '0 0 0 2px', lineHeight: 1,
                      display: 'flex', alignItems: 'center',
                    }}>×</button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" id="feriado-input-meta"
                style={{ ...inp, width: '160px' }}
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = border} />
              <button onClick={() => {
                const input = document.getElementById('feriado-input-meta') as HTMLInputElement;
                const val = input?.value;
                if (!val || feriadosTodos.includes(val)) return;
                adicionarFeriado(val);
                input.value = '';
              }} style={{ ...primaryBtn(false), padding: '9px 16px', fontSize: '12.5px' }}>
                + Adicionar
              </button>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveMetas} disabled={savingMetas} style={primaryBtn(savingMetas)}>
              <Save style={{ width: '13px', height: '13px' }} />
              {savingMetas ? 'Salvando…' : 'Salvar metas'}
            </button>
          </div>
        </Section>

        <Divider />

        {/* ── Seção: Meta Ads API ── */}
        <Section title="Conexão Meta Ads" subtitle="Token de acesso para campanhas e métricas em tempo real">
          {loadingData ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: txtMid, fontSize: '13px' }}>Carregando…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Field label="Account ID">
                <input style={inp} value={accountId} onChange={e => setAccountId(e.target.value)}
                  placeholder="act_123456789"
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
              </Field>
              <Field label="Access Token">
                <input style={inp} type="password" autoComplete="new-password"
                  value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Token de acesso permanente"
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
              </Field>
              <p style={{ margin: 0, fontSize: '12px', color: txtMid, lineHeight: 1.6 }}>
                Gere em{' '}
                <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
                  style={{ color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>
                  business.facebook.com
                </a>
                {' '}→ Configurações → Usuários do Sistema. Permissões necessárias:{' '}
                <code style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '11.5px' }}>ads_read</code>{' '}
                e{' '}
                <code style={{ background: dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6', padding: '1px 5px', borderRadius: '4px', fontSize: '11.5px' }}>ads_management</code>.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSave} disabled={saving} style={primaryBtn(saving)}>
                  <Save style={{ width: '13px', height: '13px' }} />
                  {saving ? 'Salvando…' : 'Salvar conexão'}
                </button>
              </div>
            </div>
          )}
        </Section>

        <Divider />

        {/* ── Seção: Ravena ── */}
        <Section
          title="Ravena AI"
          subtitle="Otimização automática de campanhas enquanto você dorme"
          action={
            ravenaAtiva === null ? null : (
              <Toggle active={ravenaAtiva} toggling={togglingRavena} onToggle={handleToggleRavena} color="#8b5cf6" />
            )
          }
        >
          {ravenaLocked && (
            <div style={{
              marginBottom: '20px', padding: '12px 14px', borderRadius: '10px',
              background: dark ? 'rgba(139,92,246,0.08)' : '#f5f3ff',
              border: `1px solid ${dark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <span style={{ fontSize: '13px', color: dark ? '#c4b5fd' : '#7c3aed' }}>Disponível no plano Starter</span>
              <button onClick={() => navigate('/assinatura')}
                style={{ padding: '5px 14px', borderRadius: '7px', border: 'none', background: '#8b5cf6', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                Ver planos
              </button>
            </div>
          )}

          <div style={{ opacity: ravenaLocked || !ravenaAtiva ? 0.4 : 1, pointerEvents: ravenaLocked || !ravenaAtiva ? 'none' : 'auto', transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <Field label="Modo de operação">
              <div style={{ display: 'flex', gap: '8px' }}>
                {MODOS.map(m => {
                  const sel = modo === m.value;
                  return (
                    <button key={m.value} onClick={() => setModo(m.value as any)}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                        border: `1.5px solid ${sel ? m.color : border}`,
                        background: sel ? (dark ? `${m.color}18` : `${m.color}0d`) : 'transparent',
                        textAlign: 'center', fontFamily: FONT, transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: sel ? m.color : txt, marginBottom: '2px' }}>{m.label}</div>
                      <div style={{ fontSize: '10.5px', color: txtMut, lineHeight: 1.3 }}>{m.desc}</div>
                    </button>
                  );
                })}
              </div>
              {modo === 'agressivo' && (
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#f97316', lineHeight: 1.5 }}>
                  Modo agressivo pode pausar campanhas e escalar budgets rapidamente.
                </p>
              )}
            </Field>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '16px', borderTop: `1px solid ${border}` }}>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: txt }}>Alertas no WhatsApp</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: txtMid }}>Receba relatórios e avisos da Ravena</p>
              </div>
              <Toggle active={notifAtiva} toggling={togglingNotif} onToggle={handleToggleNotif} />
            </div>

            {notifAtiva && (
              <Field label="WhatsApp para alertas">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>🇧🇷 +55</span>
                  <input type="tel" value={notifNumero}
                    onChange={e => setNotifNumero(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="(11) 99999-9999" style={{ ...inp, paddingLeft: '72px' }}
                    onFocus={e => e.target.style.borderColor = ACCENT}
                    onBlur={e => e.target.style.borderColor = border} />
                </div>
              </Field>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveRavena} disabled={savingRavena || ravenaLocked || !ravenaAtiva}
                style={{ ...primaryBtn(savingRavena || ravenaLocked || !ravenaAtiva), background: (savingRavena || ravenaLocked || !ravenaAtiva) ? border : '#8b5cf6' }}>
                <Save style={{ width: '13px', height: '13px' }} />
                {savingRavena ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          </div>
        </Section>

        <Divider />

        {/* ── Seção: CAPI ── */}
        <Section
          title="Conversions API"
          subtitle="Envia eventos direto ao Meta quando uma revendedora é aprovada no CRM, melhorando a qualidade do público e reduzindo o CPR ao longo do tempo"
          action={<Toggle active={capiAtivo} toggling={togglingCapi} onToggle={handleToggleCapi} color={ACCENT} />}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <Field label="Pixel ID">
                <input style={inp} value={pixelId} onChange={e => setPixelId(e.target.value)}
                  placeholder="1234567890"
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
              </Field>
              <Field label="Dataset ID">
                <input style={inp} value={capiDatasetId} onChange={e => setCapiDatasetId(e.target.value)}
                  placeholder="1234567890"
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e => e.target.style.borderColor = border} />
              </Field>
            </div>
            <Field label="Token CAPI">
              <input style={inp} type="password" autoComplete="new-password"
                value={capiToken} onChange={e => setCapiToken(e.target.value)}
                placeholder="Token gerado no Events Manager"
                onFocus={e => e.target.style.borderColor = ACCENT}
                onBlur={e => e.target.style.borderColor = border} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSaveCapi} disabled={savingCapi} style={primaryBtn(savingCapi)}>
                <Save style={{ width: '13px', height: '13px' }} />
                {savingCapi ? 'Salvando…' : 'Salvar CAPI'}
              </button>
            </div>
          </div>
        </Section>

        {showRavenaUpgrade && (
          <UpgradeModal feature="ravena" planoNecessario="Starter" onClose={() => setShowRavenaUpgrade(false)} />
        )}

      </div>
    </AppLayout>
  );
}
