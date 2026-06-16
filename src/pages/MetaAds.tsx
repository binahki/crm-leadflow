import { useState, useEffect } from 'react';
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
        .select('meta_account_id,meta_token,meta_pixel_id,meta_capi_dataset_id,meta_capi_token,meta_capi_ativo,ravena_ativa,ravena_budget_mensal,ravena_meta_revendedoras,ravena_modo,ravena_notif_ativa,ravena_notif_numero')
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
    const { error } = await db.from('organizations').update({ ravena_ativa: next }).eq('id', orgId);
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

  function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
      <div style={{ padding: '15px 20px', borderBottom: `1px solid ${border}`, background: headBg, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: txt, lineHeight: 1.25 }}>{title}</div>
          <div style={{ fontSize: '11px', color: txtMid, marginTop: '1px' }}>{subtitle}</div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: isMobile ? '20px 16px' : '28px 32px', fontFamily: FONT, minHeight: '100%' }}>

        {/* Page header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '21px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Meta Ads</h1>
          <p style={{ fontSize: '13px', color: txtMid, margin: '4px 0 0' }}>Conecte sua conta e defina objetivos mensais</p>
        </div>

        {/* ── Row 1: Metas ────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: '16px' }}>
          <CardHeader
            icon={<Target style={{ width: '14px', height: '14px', color: ACCENT }} />}
            title="Metas do Negócio"
            subtitle="Objetivos mensais para acompanhar no dashboard"
          />
          <div style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 170px', minWidth: '130px' }}>
              <label style={lbl}>Investimento mensal</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>R$</span>
                <input type="number" value={budgetMensal} onChange={e => setBudgetMensal(Number(e.target.value))}
                  style={{ ...inp, paddingLeft: '32px' }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = border)} />
              </div>
            </div>
            <div style={{ flex: '1 1 170px', minWidth: '130px' }}>
              <label style={lbl}>Meta de revendedoras</label>
              <div style={{ position: 'relative' }}>
                <input type="number" value={metaRevs} onChange={e => setMetaRevs(Number(e.target.value))}
                  style={{ ...inp, paddingRight: '44px' }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = border)} />
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: txtMid, pointerEvents: 'none' }}>/mês</span>
              </div>
            </div>
            <button onClick={handleSaveMetas} disabled={savingMetas} style={{ ...primaryBtn(savingMetas), flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
              <Save style={{ width: '13px', height: '13px' }} />
              {savingMetas ? 'Salvando…' : 'Salvar metas'}
            </button>
          </div>
        </div>

        {/* ── Row 2: API + Ravena ──────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Meta Ads API card */}
          <div style={card}>
            <CardHeader
              icon={<BarChart3 style={{ width: '14px', height: '14px', color: ACCENT }} />}
              title="Meta Ads API"
              subtitle="Acesso às campanhas e métricas"
            />
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingData ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: txtMid, fontSize: '13px' }}>Carregando…</div>
              ) : (
                <>
                  <div>
                    <label style={lbl}>Account ID</label>
                    <input style={inp} value={accountId} onChange={e => setAccountId(e.target.value)}
                      placeholder="act_123456789"
                      onFocus={e => (e.target.style.borderColor = ACCENT)}
                      onBlur={e => (e.target.style.borderColor = border)} />
                  </div>
                  <div>
                    <label style={lbl}>Access Token</label>
                    <input style={inp} type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)}
                      placeholder="Token de acesso permanente"
                      onFocus={e => (e.target.style.borderColor = ACCENT)}
                      onBlur={e => (e.target.style.borderColor = border)} />
                    <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '9px', background: dark ? `${ACCENT}10` : '#eef2ff', border: `1px solid ${dark ? `${ACCENT}22` : '#c7d2fe'}` }}>
                      <p style={{ fontSize: '11.5px', color: dark ? '#93c5fd' : '#4338ca', margin: 0, lineHeight: 1.55 }}>
                        Gere em{' '}
                        <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
                          style={{ color: dark ? '#60a5fa' : '#4338ca', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}>
                          business.facebook.com <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </a>
                        {' '}→ Usuários do Sistema. Permissões: <strong>ads_read</strong> e <strong>ads_management</strong>.
                      </p>
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving} style={{ ...primaryBtn(saving), width: '100%' }}>
                    <Save style={{ width: '14px', height: '14px' }} />
                    {saving ? 'Salvando…' : 'Salvar configurações'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Ravena card */}
          <div style={card}>
            {/* Header with toggle */}
            <div style={{
              padding: '13px 20px',
              borderBottom: `1px solid ${border}`,
              background: ravenaAtiva && !ravenaLocked
                ? (dark ? 'linear-gradient(135deg, rgba(139,92,246,0.14), rgba(0,68,253,0.07))' : 'linear-gradient(135deg, #faf5ff, #eef2ff)')
                : headBg,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'background 0.3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: ravenaAtiva && !ravenaLocked ? 'rgba(139,92,246,0.14)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.3s' }}>
                  <Sparkles style={{ width: '14px', height: '14px', color: ravenaAtiva && !ravenaLocked ? '#8b5cf6' : txtMut, transition: 'color 0.3s' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: txt, lineHeight: 1.25 }}>Ravena AI</div>
                  <div style={{ fontSize: '11px', color: txtMid, marginTop: '1px' }}>Otimização de tráfego</div>
                </div>
              </div>
              {ravenaAtiva === null
                ? <div style={{ width: '40px', height: '22px', borderRadius: '99px', background: border }} />
                : <Toggle active={ravenaAtiva} toggling={togglingRavena} onToggle={handleToggleRavena} color="#8b5cf6" />
              }
            </div>

            {/* Locked banner */}
            {ravenaLocked && (
              <div style={{ padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: dark ? 'rgba(139,92,246,0.07)' : '#faf5ff', borderBottom: `1px solid ${dark ? 'rgba(139,92,246,0.14)' : 'rgba(139,92,246,0.11)'}` }}>
                <span style={{ fontSize: '12px', color: dark ? '#c4b5fd' : '#7c3aed', fontWeight: 500 }}>
                  Disponível no plano Starter
                </span>
                <button onClick={() => navigate('/assinatura')}
                  style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#8b5cf6', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT }}>
                  Ver planos
                </button>
              </div>
            )}

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Mode selector */}
              <div style={{ opacity: ravenaLocked || !ravenaAtiva ? 0.38 : 1, pointerEvents: ravenaLocked || !ravenaAtiva ? 'none' : 'auto', transition: 'opacity 0.25s' }}>
                <label style={lbl}>Modo de operação</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {MODOS.map(m => {
                    const sel = modo === m.value;
                    return (
                      <div key={m.value} onClick={() => setModo(m.value as any)}
                        style={{ flex: 1, padding: '11px 8px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', border: `1.5px solid ${sel ? m.color : border}`, background: sel ? (dark ? `${m.color}15` : `${m.color}0d`) : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: sel ? m.color : txt, marginBottom: '2px' }}>{m.label}</div>
                        <div style={{ fontSize: '10px', color: txtMut, lineHeight: 1.35 }}>{m.desc}</div>
                      </div>
                    );
                  })}
                </div>
                {modo === 'agressivo' && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '9px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.18)', fontSize: '11.5px', color: '#f97316', lineHeight: 1.5 }}>
                    Modo agressivo pode pausar campanhas e escalar budgets rapidamente.
                  </div>
                )}
              </div>

              {/* Notifications */}
              <div style={{ paddingTop: '16px', borderTop: `1px solid ${border}`, opacity: ravenaLocked || !ravenaAtiva ? 0.38 : 1, pointerEvents: ravenaLocked || !ravenaAtiva ? 'none' : 'auto', transition: 'opacity 0.25s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: notifAtiva ? '12px' : 0 }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: txt, margin: 0, lineHeight: 1.25 }}>Relatórios e Avisos</p>
                    <p style={{ fontSize: '11px', color: txtMid, margin: '2px 0 0' }}>Alertas no WhatsApp</p>
                  </div>
                  <Toggle active={notifAtiva} toggling={togglingNotif} onToggle={handleToggleNotif} />
                </div>
                {notifAtiva && (
                  <>
                    <div>
                      <label style={lbl}>WhatsApp para receber avisos</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>🇧🇷 +55</span>
                        <input type="tel" value={notifNumero}
                          onChange={e => setNotifNumero(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          placeholder="(11) 99999-9999" style={{ ...inp, paddingLeft: '72px' }}
                          onFocus={e => (e.target.style.borderColor = ACCENT)}
                          onBlur={e => (e.target.style.borderColor = border)} />
                      </div>
                    </div>
                    <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '9px', background: dark ? 'rgba(251,191,36,0.07)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.2)', fontSize: '11.5px', color: dark ? '#fcd34d' : '#92400e', lineHeight: 1.5 }}>
                      Avisos serão ativados assim que o WhatsApp da Ravena estiver disponível.
                    </div>
                  </>
                )}
              </div>

              {/* Save Ravena settings button */}
              <button onClick={handleSaveRavena}
                disabled={savingRavena || ravenaLocked || !ravenaAtiva}
                style={{ ...primaryBtn(savingRavena || ravenaLocked || !ravenaAtiva), width: '100%', background: (savingRavena || ravenaLocked || !ravenaAtiva) ? border : '#8b5cf6' }}>
                <Save style={{ width: '14px', height: '14px' }} />
                {savingRavena ? 'Salvando…' : 'Salvar configuração'}
              </button>
            </div>
          </div>

        </div>

        {/* ── CAPI card ──────────────────────────────────────── */}
        <div style={{ ...card, marginTop: '16px' }}>
          <div style={{ padding: '13px 20px', borderBottom: `1px solid ${border}`, background: headBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${ACCENT}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Target style={{ width: '14px', height: '14px', color: ACCENT }} />
              </div>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: txt, lineHeight: 1.25 }}>Conversions API</div>
                <div style={{ fontSize: '11px', color: txtMid, marginTop: '1px' }}>Eventos server-side para o Meta</div>
              </div>
            </div>
            <Toggle active={capiAtivo} toggling={togglingCapi} onToggle={handleToggleCapi} color={ACCENT} />
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: txtMid, lineHeight: 1.6, padding: '10px 12px', borderRadius: '9px', background: dark ? `${ACCENT}10` : '#eef2ff', border: `1px solid ${dark ? `${ACCENT}22` : '#c7d2fe'}` }}>
              Envia eventos de conversão direto para o Meta quando uma revendedora é aprovada no CRM. Melhora a qualidade do público e reduz o CPR ao longo do tempo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={lbl}>Pixel ID</label>
                <input style={inp} value={pixelId} onChange={e => setPixelId(e.target.value)}
                  placeholder="123456789012345"
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = border)} />
              </div>
              <div>
                <label style={lbl}>Dataset ID</label>
                <input style={inp} value={capiDatasetId} onChange={e => setCapiDatasetId(e.target.value)}
                  placeholder="123456789012345"
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = border)} />
              </div>
            </div>

            <div>
              <label style={lbl}>Token CAPI</label>
              <input style={inp} type="password" autoComplete="new-password" value={capiToken} onChange={e => setCapiToken(e.target.value)}
                placeholder="Token de acesso da Conversions API"
                onFocus={e => (e.target.style.borderColor = ACCENT)}
                onBlur={e => (e.target.style.borderColor = border)} />
            </div>

            <button onClick={handleSaveCapi} disabled={savingCapi} style={{ ...primaryBtn(savingCapi), width: isMobile ? '100%' : 'auto', alignSelf: 'flex-start' }}>
              <Save style={{ width: '13px', height: '13px' }} />
              {savingCapi ? 'Salvando…' : 'Salvar CAPI'}
            </button>
          </div>
        </div>

        {showRavenaUpgrade && (
          <UpgradeModal feature="ravena" planoNecessario="Starter" onClose={() => setShowRavenaUpgrade(false)} />
        )}

      </div>
    </AppLayout>
  );
}
