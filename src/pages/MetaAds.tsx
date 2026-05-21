import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { Save, BarChart3, ExternalLink, RefreshCw, Pencil, Check, X, ChevronRight, Layers } from 'lucide-react';
import { toast } from 'sonner';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const META_V = 'https://graph.facebook.com/v19.0';

type MetaStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
type Level = 'campaigns' | 'adsets' | 'ads';

interface MetaItem {
  id: string;
  name: string;
  status: MetaStatus;
  daily_budget?: string;
  lifetime_budget?: string;
  campaign_id?: string;
  adset_id?: string;
  insights?: { data: Array<{ spend?: string; impressions?: string; clicks?: string }> };
}

function fmtBudget(val?: string) {
  if (!val || val === '0') return null;
  return `R$${(parseInt(val) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function fmtSpend(insights?: MetaItem['insights']) {
  const v = insights?.data?.[0]?.spend;
  if (!v || v === '0') return '—';
  return `R$${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtImpressions(insights?: MetaItem['insights']) {
  const v = insights?.data?.[0]?.impressions;
  if (!v) return '—';
  const n = parseInt(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── Inline budget editor ───────────────────────────────────────
function BudgetEdit({ id, budget, token, dark, onSaved }: {
  id: string; budget?: string; token: string; dark: boolean; onSaved: (cents: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [hov, setHov] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const displayed = fmtBudget(budget);

  function startEdit() {
    setVal(budget ? String(Math.round(parseInt(budget) / 100)) : '');
    setEditing(true);
    setTimeout(() => ref.current?.select(), 30);
  }

  async function save() {
    const cents = Math.round(parseFloat(val.replace(',', '.')) * 100);
    if (isNaN(cents) || cents < 100) { setEditing(false); return; }
    setSaving(true);
    try {
      const qs = new URLSearchParams({ daily_budget: String(cents), access_token: token });
      const res = await fetch(`${META_V}/${id}?${qs}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error.error_user_msg);
      onSaved(cents);
      toast.success('Orçamento atualizado!');
    } catch (e: any) {
      toast.error(e.message?.includes('permission')
        ? 'Token precisa da permissão ads_management'
        : 'Erro: ' + e.message);
    }
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: dark ? '#71717a' : '#9ca3af' }}>R$</span>
        <input ref={ref} type="number" min="1" value={val} onChange={e => setVal(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{ width: '72px', padding: '3px 7px', borderRadius: '6px', border: '1.5px solid #3b82f6', background: dark ? '#0d0d0f' : '#eff6ff', color: dark ? '#f4f4f5' : '#111827', fontSize: '13px', outline: 'none', fontFamily: FONT }}
        />
        <button onClick={save} disabled={saving} style={{ width: '22px', height: '22px', borderRadius: '5px', border: 'none', background: '#10b981', color: '#fff', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {saving ? <span style={{ fontSize: '10px' }}>…</span> : <Check size={11} />}
        </button>
        <button onClick={() => setEditing(false)} style={{ width: '22px', height: '22px', borderRadius: '5px', border: 'none', background: dark ? '#27272a' : '#f3f4f6', color: dark ? '#a1a1aa' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontSize: '13px', color: displayed ? (dark ? '#d4d4d8' : '#374151') : (dark ? '#3f3f46' : '#d1d5db'), fontWeight: 500 }}>
        {displayed ? `${displayed}/dia` : '—'}
      </span>
      {displayed && (
        <button onClick={startEdit} style={{ width: '18px', height: '18px', borderRadius: '4px', border: 'none', background: 'transparent', color: dark ? '#52525b' : '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.12s' }}>
          <Pencil size={10} />
        </button>
      )}
    </div>
  );
}

// ── Status toggle dot ──────────────────────────────────────────
function ToggleDot({ status, loading, onToggle }: { status: MetaStatus; loading: boolean; onToggle: () => void }) {
  const active = status === 'ACTIVE';
  return (
    <button onClick={onToggle} disabled={loading} title={active ? 'Pausar' : 'Ativar'}
      style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: loading ? 'default' : 'pointer', background: active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
      {loading
        ? <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: '2px solid rgba(107,114,128,0.3)', borderTopColor: '#9ca3af', animation: 'meta-spin 0.7s linear infinite' }} />
        : <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: active ? '#10b981' : '#9ca3af', transition: 'background 0.2s', boxShadow: active ? '0 0 0 2px rgba(16,185,129,0.2)' : 'none' }} />
      }
    </button>
  );
}

// ── Campaign Manager ───────────────────────────────────────────
function CampaignManager({ token, accountId, dark }: { token: string; accountId: string; dark: boolean }) {
  const normId   = accountId.startsWith('act_') ? accountId : `act_${accountId}`;
  const border   = dark ? '#1e1e22' : 'rgba(0,0,0,0.06)';
  const cardBg   = dark ? '#111113' : '#ffffff';
  const headBg   = dark ? '#18181b' : '#fafafa';
  const txt      = dark ? '#f4f4f5' : '#111827';
  const txtMid   = dark ? '#71717a' : '#6b7280';

  const [tab, setTab]           = useState<Level>('campaigns');
  const [campaigns, setCampaigns] = useState<MetaItem[]>([]);
  const [adsets, setAdsets]     = useState<MetaItem[]>([]);
  const [ads, setAds]           = useState<MetaItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [selCamps, setSelCamps] = useState<Set<string>>(new Set());
  const [selSets, setSelSets]   = useState<Set<string>>(new Set());
  const [filterCamps, setFilterCamps] = useState<string[] | null>(null);
  const [filterSets, setFilterSets]   = useState<string[] | null>(null);

  const FIELDS_C = 'id,name,status,daily_budget,lifetime_budget,insights.date_preset(last_30d){spend,impressions,clicks}';
  const FIELDS_A = 'id,name,status,daily_budget,lifetime_budget,campaign_id,insights.date_preset(last_30d){spend,impressions,clicks}';
  const FIELDS_D = 'id,name,status,adset_id,campaign_id,insights.date_preset(last_30d){spend}';

  async function metaGet(path: string) {
    const res = await fetch(`${META_V}/${path}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error.error_user_msg || 'Erro Meta API');
    return data;
  }

  async function loadCampaigns() {
    setLoading(true);
    try {
      const d = await metaGet(`${normId}/campaigns?fields=${FIELDS_C}&limit=50&access_token=${token}`);
      setCampaigns(d.data || []);
    } catch (e: any) { toast.error('Campanhas: ' + e.message); }
    setLoading(false);
  }

  async function loadAdsets() {
    setLoading(true);
    try {
      const d = await metaGet(`${normId}/adsets?fields=${FIELDS_A}&limit=100&access_token=${token}`);
      setAdsets(d.data || []);
    } catch (e: any) { toast.error('Conjuntos: ' + e.message); }
    setLoading(false);
  }

  async function loadAds() {
    setLoading(true);
    try {
      const d = await metaGet(`${normId}/ads?fields=${FIELDS_D}&limit=200&access_token=${token}`);
      setAds(d.data || []);
    } catch (e: any) { toast.error('Anúncios: ' + e.message); }
    setLoading(false);
  }

  useEffect(() => { loadCampaigns(); }, []);

  function switchTab(t: Level) {
    setTab(t);
    if (t === 'adsets' && adsets.length === 0) loadAdsets();
    if (t === 'ads' && ads.length === 0) loadAds();
  }

  async function handleToggle(id: string, current: MetaStatus) {
    const next: MetaStatus = current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const upd = (arr: MetaItem[]) => arr.map(x => x.id === id ? { ...x, status: next } : x);
    const rev = (arr: MetaItem[]) => arr.map(x => x.id === id ? { ...x, status: current } : x);
    if (tab === 'campaigns') setCampaigns(upd);
    else if (tab === 'adsets') setAdsets(upd);
    else setAds(upd);
    setToggling(s => { const n = new Set(s); n.add(id); return n; });
    try {
      const qs = new URLSearchParams({ status: next, access_token: token });
      const res = await fetch(`${META_V}/${id}?${qs}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error.error_user_msg);
      toast.success(next === 'ACTIVE' ? 'Ativado!' : 'Pausado!');
    } catch (e: any) {
      if (tab === 'campaigns') setCampaigns(rev);
      else if (tab === 'adsets') setAdsets(rev);
      else setAds(rev);
      toast.error(e.message?.includes('permission')
        ? 'Token precisa da permissão ads_management'
        : 'Erro: ' + e.message);
    }
    setToggling(s => { const n = new Set(s); n.delete(id); return n; });
  }

  function handleBudgetSaved(id: string, cents: number) {
    const upd = (arr: MetaItem[]) => arr.map(x => x.id === id ? { ...x, daily_budget: String(cents) } : x);
    if (tab === 'campaigns') setCampaigns(upd);
    else if (tab === 'adsets') setAdsets(upd);
  }

  function drillAdsets() {
    setFilterCamps([...selCamps]); setSelCamps(new Set());
    if (adsets.length === 0) loadAdsets();
    setTab('adsets');
  }

  function drillAds() {
    setFilterSets([...selSets]); setSelSets(new Set());
    if (ads.length === 0) loadAds();
    setTab('ads');
  }

  const rows =
    tab === 'campaigns' ? campaigns :
    tab === 'adsets'    ? (filterCamps ? adsets.filter(a => filterCamps.includes(a.campaign_id!)) : adsets) :
                          (filterSets  ? ads.filter(a => filterSets.includes(a.adset_id!))        : ads);

  const selCount = tab === 'campaigns' ? selCamps.size : tab === 'adsets' ? selSets.size : 0;
  const TAB_TOTALS: Record<Level, number> = { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length };
  const TAB_LABELS: Record<Level, string> = { campaigns: 'Campanhas', adsets: 'Conjuntos', ads: 'Anúncios' };

  return (
    <div style={{ marginTop: '20px', background: cardBg, border: `1px solid ${border}`, borderRadius: '18px', overflow: 'hidden', boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${border}`, background: headBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
          <span style={{ fontSize: '14px', fontWeight: 600, color: txt, fontFamily: FONT }}>Gerenciador de Campanhas</span>
        </div>
        <button onClick={() => { if (tab === 'campaigns') loadCampaigns(); else if (tab === 'adsets') loadAdsets(); else loadAds(); }}
          style={{ width: '28px', height: '28px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'meta-spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${border}`, background: headBg, padding: '0 8px' }}>
        {(['campaigns', 'adsets', 'ads'] as Level[]).map(t => {
          const hasFilter = (t === 'adsets' && filterCamps !== null) || (t === 'ads' && filterSets !== null);
          return (
            <button key={t} onClick={() => switchTab(t)}
              style={{ padding: '10px 16px', border: 'none', borderBottom: `2px solid ${tab === t ? '#3b82f6' : 'transparent'}`, background: 'transparent', color: tab === t ? '#3b82f6' : txtMid, fontSize: '13px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s', fontFamily: FONT, marginBottom: '-1px' }}>
              {TAB_LABELS[t]}
              {TAB_TOTALS[t] > 0 && (
                <span style={{ padding: '1px 6px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, background: tab === t ? 'rgba(59,130,246,0.12)' : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'), color: tab === t ? '#3b82f6' : txtMid }}>
                  {TAB_TOTALS[t]}
                </span>
              )}
              {hasFilter && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* Selection bar */}
      {selCount > 0 && (
        <div style={{ padding: '10px 20px', background: dark ? 'rgba(59,130,246,0.07)' : '#eff6ff', borderBottom: `1px solid ${dark ? 'rgba(59,130,246,0.15)' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 10px', borderRadius: '99px', background: '#3b82f6', color: '#fff', fontSize: '12px', fontWeight: 700, fontFamily: FONT }}>
            {selCount} selecionado{selCount > 1 ? 's' : ''}
          </span>
          {tab === 'campaigns' && (
            <button onClick={drillAdsets} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', background: 'transparent', color: dark ? '#93c5fd' : '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Conjuntos para {selCount} {selCount === 1 ? 'campanha' : 'campanhas'} <ChevronRight size={13} />
            </button>
          )}
          {tab === 'adsets' && (
            <button onClick={drillAds} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', background: 'transparent', color: dark ? '#93c5fd' : '#2563eb', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              Anúncios para {selCount} {selCount === 1 ? 'conjunto' : 'conjuntos'} <ChevronRight size={13} />
            </button>
          )}
          <button onClick={() => { setSelCamps(new Set()); setSelSets(new Set()); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: txtMid, fontSize: '12px', fontFamily: FONT }}>
            Limpar seleção
          </button>
        </div>
      )}

      {/* Filter notices */}
      {tab === 'adsets' && filterCamps && (
        <div style={{ padding: '7px 20px', background: dark ? 'rgba(245,158,11,0.05)' : '#fffbeb', borderBottom: `1px solid ${dark ? 'rgba(245,158,11,0.15)' : '#fde68a'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, fontFamily: FONT }}>
            Mostrando conjuntos de {filterCamps.length} campanha{filterCamps.length > 1 ? 's' : ''}
          </span>
          <button onClick={() => setFilterCamps(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}
      {tab === 'ads' && filterSets && (
        <div style={{ padding: '7px 20px', background: dark ? 'rgba(245,158,11,0.05)' : '#fffbeb', borderBottom: `1px solid ${dark ? 'rgba(245,158,11,0.15)' : '#fde68a'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600, fontFamily: FONT }}>
            Mostrando anúncios de {filterSets.length} conjunto{filterSets.length > 1 ? 's' : ''}
          </span>
          <button onClick={() => setFilterSets(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '640px' }}>
          <thead>
            <tr style={{ background: dark ? 'rgba(255,255,255,0.01)' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
              <th style={{ width: '40px', padding: '10px 8px 10px 16px' }} />
              <th style={{ width: '36px' }} />
              <th style={{ padding: '10px 16px 10px 8px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Nome</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Orçamento</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Gasto 30d</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impressões</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: '12px 8px 12px 16px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', animation: 'meta-pulse 1.5s ease-in-out infinite' }} />
                  </td>
                  <td style={{ padding: '12px 0', textAlign: 'center' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', animation: 'meta-pulse 1.5s ease-in-out infinite', margin: '0 auto' }} />
                  </td>
                  {[200, 80, 60, 70, 60].map((w, j) => (
                    <td key={j} style={{ padding: '12px 16px' }}>
                      <div style={{ height: '13px', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', width: `${w}px`, animation: 'meta-pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
              : rows.length === 0
                ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: txtMid, fontSize: '13px', fontFamily: FONT }}>
                      {loading ? 'Carregando…' : 'Nenhum item encontrado'}
                    </td>
                  </tr>
                )
                : rows.map((item, idx) => {
                  const isSel = tab === 'campaigns' ? selCamps.has(item.id) : tab === 'adsets' ? selSets.has(item.id) : false;
                  const canSel = tab !== 'ads';
                  const rowBase = isSel
                    ? (dark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.03)')
                    : idx % 2 !== 0 ? (dark ? 'rgba(255,255,255,0.007)' : 'rgba(0,0,0,0.01)') : 'transparent';

                  function toggleSel() {
                    if (tab === 'campaigns') setSelCamps(s => { const n = new Set(s); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
                    else if (tab === 'adsets') setSelSets(s => { const n = new Set(s); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n; });
                  }

                  return (
                    <tr key={item.id}
                      style={{ borderBottom: `1px solid ${border}`, background: rowBase, transition: 'background 0.1s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBase; }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 8px 12px 16px', textAlign: 'center' }}>
                        {canSel && (
                          <input type="checkbox" checked={isSel} onChange={toggleSel}
                            style={{ width: '14px', height: '14px', accentColor: '#3b82f6', cursor: 'pointer' }} />
                        )}
                      </td>

                      {/* Toggle dot */}
                      <td style={{ padding: '12px 0', textAlign: 'center' }}>
                        <ToggleDot status={item.status} loading={toggling.has(item.id)} onToggle={() => handleToggle(item.id, item.status)} />
                      </td>

                      {/* Name */}
                      <td style={{ padding: '12px 16px 12px 8px', maxWidth: '260px' }}>
                        <span style={{ fontSize: '13px', color: txt, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={item.name}>
                          {item.name}
                        </span>
                      </td>

                      {/* Budget */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {tab === 'ads'
                          ? <span style={{ color: dark ? '#3f3f46' : '#d1d5db', fontSize: '12px' }}>—</span>
                          : <BudgetEdit id={item.id} budget={item.daily_budget} token={token} dark={dark} onSaved={cents => handleBudgetSaved(item.id, cents)} />
                        }
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', background: item.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)', color: item.status === 'ACTIVE' ? '#10b981' : '#9ca3af' }}>
                          {item.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                        </span>
                      </td>

                      {/* Spend */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: txtMid, fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        {fmtSpend(item.insights)}
                      </td>

                      {/* Impressions */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: txtMid, fontSize: '12.5px' }}>
                        {fmtImpressions(item.insights)}
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes meta-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes meta-spin  { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function MetaAdsPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { orgId, ready: orgReady } = useOrgId();

  const [accountId, setAccountId]   = useState('');
  const [token, setToken]           = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving]         = useState(false);
  const [ravenaAtiva, setRavenaAtiva] = useState<boolean | null>(null);
  const [budgetMensal, setBudgetMensal] = useState(5000);
  const [metaRevs, setMetaRevs]     = useState(50);
  const [modo, setModo]             = useState<'conservador'|'equilibrado'|'agressivo'>('equilibrado');
  const [savingRavena, setSavingRavena] = useState(false);
  const [notifAtiva, setNotifAtiva] = useState(false);
  const [notifNumero, setNotifNumero] = useState('');
  const [isMobile, setIsMobile]     = useState(false);

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
    const { error } = await supabase.from('organizations').update({
      ravena_ativa: ravenaAtiva === true,
      ravena_budget_mensal: budgetMensal,
      ravena_meta_revendedoras: metaRevs,
      ravena_modo: modo,
      ravena_notif_ativa: notifAtiva,
      ravena_notif_numero: notifNumero.replace(/\D/g, ''),
    }).eq('id', orgId);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Ravena configurada!');
    setSavingRavena(false);
  }

  async function handleSave() {
    if (!orgId) { toast.error('Organização não encontrada'); return; }
    setSaving(true);
    const { error } = await supabase.from('organizations').update({ meta_account_id: accountId, meta_token: token }).eq('id', orgId);
    setSaving(false);
    if (error) toast.error('Erro ao salvar configurações');
    else toast.success('Configurações salvas!');
  }

  const card: React.CSSProperties = {
    background: dark ? '#111113' : '#ffffff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px', overflow: 'hidden',
    boxShadow: dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.06)',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px',
    border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
    background: dark ? '#0d0d0f' : '#f8fafc',
    color: dark ? '#f4f4f5' : '#111827',
    fontSize: '13.5px', outline: 'none', fontFamily: FONT, boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const lbl: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 600, color: dark ? '#71717a' : '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px',
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

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', alignItems: 'start' }}>

          {/* API config card */}
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, display: 'flex', alignItems: 'center', gap: '8px', background: dark ? '#18181b' : '#fafafa' }}>
              <BarChart3 style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Meta Ads API</span>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingData ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: txtMid, fontSize: '13px' }}>Carregando configurações…</div>
              ) : (
                <>
                  <div>
                    <label style={lbl}>Account ID</label>
                    <input style={inp} value={accountId} onChange={e => setAccountId(e.target.value)}
                      placeholder="act_123456789"
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')} />
                  </div>
                  <div>
                    <label style={lbl}>Access Token</label>
                    <input style={inp} type="password" autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)}
                      placeholder="Token de acesso permanente"
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                      onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')} />
                    <div style={{ marginTop: '8px', padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(59,130,246,0.07)' : '#eff6ff', border: `1px solid ${dark ? 'rgba(59,130,246,0.18)' : '#bfdbfe'}` }}>
                      <p style={{ fontSize: '12px', color: dark ? '#93c5fd' : '#1d4ed8', margin: 0, lineHeight: 1.6 }}>
                        Gere um token em{' '}
                        <a href="https://business.facebook.com" target="_blank" rel="noreferrer"
                          style={{ color: dark ? '#60a5fa' : '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}>
                          business.facebook.com <ExternalLink style={{ width: '11px', height: '11px' }} />
                        </a>
                        {' '}→ Usuários do Sistema → Gerar Token. Permissões: <strong>ads_read</strong> e <strong>ads_management</strong>.
                      </p>
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving}
                    style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: saving ? (dark ? '#27272a' : '#e5e7eb') : '#3b82f6', color: saving ? txtMid : '#fff', fontSize: '13.5px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}>
                    <Save style={{ width: '14px', height: '14px' }} />
                    {saving ? 'Salvando…' : 'Salvar configurações'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Ravena card */}
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, background: dark ? '#18181b' : '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>🤖</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Ravena — IA de Tráfego</span>
              </div>
              {ravenaAtiva === null
                ? <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: dark ? '#3f3f46' : '#d1d5db' }} />
                : (
                  <div onClick={() => setRavenaAtiva(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '12px', color: ravenaAtiva ? '#10b981' : txtMid, fontWeight: 600 }}>{ravenaAtiva ? 'Ativa' : 'Inativa'}</span>
                    <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: ravenaAtiva ? '#10b981' : (dark ? '#3f3f46' : '#d1d5db'), position: 'relative', transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: '2px', left: ravenaAtiva ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                )}
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', opacity: ravenaAtiva === true ? 1 : 0.5, pointerEvents: ravenaAtiva === true ? 'auto' : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Investimento mensal</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: txtMid, pointerEvents: 'none' }}>R$</span>
                    <input type="number" value={budgetMensal} onChange={e => setBudgetMensal(Number(e.target.value))} style={{ ...inp, paddingLeft: '32px' }}
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Meta de revendedoras</label>
                  <div style={{ position: 'relative' }}>
                    <input type="number" value={metaRevs} onChange={e => setMetaRevs(Number(e.target.value))} style={{ ...inp, paddingRight: '44px' }}
                      onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')} />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: txtMid, pointerEvents: 'none' }}>/mês</span>
                  </div>
                </div>
              </div>
              <div>
                <label style={lbl}>Modo de operação</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {MODOS.map(m => (
                    <div key={m.value} onClick={() => setModo(m.value as any)}
                      style={{ flex: 1, padding: '12px 10px', borderRadius: '12px', cursor: 'pointer', border: `2px solid ${modo === m.value ? '#3b82f6' : (dark ? '#27272a' : '#e5e7eb')}`, background: modo === m.value ? (dark ? 'rgba(59,130,246,0.1)' : '#eff6ff') : 'transparent', textAlign: 'center', transition: 'all 150ms ease' }}>
                      <div style={{ fontSize: '20px', marginBottom: '5px' }}>{m.icon}</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: modo === m.value ? '#3b82f6' : txt }}>{m.label}</div>
                      <div style={{ fontSize: '10px', color: txtMid, marginTop: '3px', lineHeight: 1.4 }}>{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ paddingTop: '16px', borderTop: `1px solid ${dark ? '#1e1e22' : '#f3f4f6'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: txt, margin: 0 }}>Relatórios e Avisos</p>
                    <p style={{ fontSize: '11px', color: txtMid, margin: '2px 0 0' }}>Receba alertas importantes no WhatsApp</p>
                  </div>
                  <div onClick={() => setNotifAtiva(v => !v)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: notifAtiva ? '#10b981' : txtMid, fontWeight: 600 }}>{notifAtiva ? 'Ativo' : 'Inativo'}</span>
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
                        <input type="tel" value={notifNumero} onChange={e => setNotifNumero(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          placeholder="(11) 99999-9999" style={{ ...inp, paddingLeft: '72px' }}
                          onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = dark ? '#27272a' : '#e5e7eb')} />
                      </div>
                    </div>
                    <div style={{ padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(251,191,36,0.08)' : '#fffbeb', border: '1px solid rgba(251,191,36,0.25)' }}>
                      <p style={{ fontSize: '11px', color: dark ? '#fcd34d' : '#92400e', margin: 0, lineHeight: 1.5 }}>
                        ⏳ Os avisos serão ativados assim que o WhatsApp da Ravena estiver disponível.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {modo === 'agressivo' && (
                <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', fontSize: '12px', color: '#f97316' }}>
                  ⚠️ Modo agressivo pode pausar campanhas e escalar budgets rapidamente. Monitore diariamente.
                </div>
              )}
              <button onClick={handleSaveRavena} disabled={savingRavena}
                style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: savingRavena ? (dark ? '#27272a' : '#e5e7eb') : '#3b82f6', color: savingRavena ? txtMid : '#fff', fontSize: '13.5px', fontWeight: 600, cursor: savingRavena ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: FONT, transition: 'background 0.15s' }}>
                <Save style={{ width: '14px', height: '14px' }} />
                {savingRavena ? 'Salvando…' : 'Salvar configuração da Ravena'}
              </button>
            </div>
          </div>

        </div>{/* end config grid */}

        {/* Campaign Manager — só aparece quando token e accountId estão configurados */}
        {token && accountId && !loadingData && (
          <CampaignManager token={token} accountId={accountId} dark={dark} />
        )}

      </div>
    </AppLayout>
  );
}
