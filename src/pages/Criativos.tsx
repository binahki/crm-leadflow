import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown, Users, DollarSign, MousePointer, Eye, Trophy, Zap } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Creative {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  leads: number;
  cpl: number;
  frequency: number;
  thumbnail_url: string | null;
  adset_name: string;
  campaign_name: string;
}

// ─── Constants ────────────────────────────────────────────────

const META_TOKEN = import.meta.env.VITE_META_TOKEN;
const META_ACCOUNT = import.meta.env.VITE_META_ACCOUNT;

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: 'last_7d' },
  { label: '30 dias', value: 'last_30d' },
  { label: 'Este mês', value: 'this_month' },
];

// ─── Helpers ─────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtInt(n: number) { return n.toLocaleString('pt-BR'); }

// ─── Fetch criativos via Meta Ads API ────────────────────────

async function fetchCreatives(datePreset: string): Promise<Creative[]> {
  try {
    // 1. Busca todos os anúncios ativos/pausados com insights + creative
    const adsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/ads` +
      `?fields=id,name,status,adset{name},campaign{name},creative{id,thumbnail_url,image_url}` +
      `&limit=50&access_token=${META_TOKEN}`
    );
    const adsData = await adsRes.json();
    if (!adsData.data?.length) return [];

    // 2. Busca insights de cada anúncio
    const results = await Promise.all(
      (adsData.data as any[]).map(async (ad: any) => {
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v18.0/${ad.id}/insights` +
            `?fields=spend,impressions,clicks,ctr,cpm,frequency,actions` +
            `&date_preset=${datePreset}&access_token=${META_TOKEN}`
          );
          const insData = await insRes.json();
          const ins = insData.data?.[0];

          const spend = parseFloat(ins?.spend || '0');
          const impressions = parseInt(ins?.impressions || '0');
          const clicks = parseInt(ins?.clicks || '0');
          const ctr = parseFloat(ins?.ctr || '0');
          const cpm = parseFloat(ins?.cpm || '0');
          const frequency = parseFloat(ins?.frequency || '0');
          const actions: any[] = ins?.actions || [];
          const leads = parseInt(
            actions.find((a: any) =>
              ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'].includes(a.action_type)
            )?.value || '0'
          );

          const thumbnail =
            ad.creative?.thumbnail_url ||
            ad.creative?.image_url ||
            null;

          return {
            id: ad.id,
            name: ad.name || 'Sem nome',
            status: ad.status || 'UNKNOWN',
            spend, impressions, clicks, ctr, cpm, frequency,
            leads,
            cpl: leads > 0 ? spend / leads : 0,
            thumbnail_url: thumbnail,
            adset_name: ad.adset?.name || '—',
            campaign_name: ad.campaign?.name || '—',
          } as Creative;
        } catch {
          return null;
        }
      })
    );

    return (results.filter(Boolean) as Creative[])
      .sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  } catch (e) {
    console.error('[Criativos]', e);
    return [];
  }
}

// ─── FilterDropdown ───────────────────────────────────────────

function FilterDropdown({ value, options, onChange, dark }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
        border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
        background: dark ? '#111113' : '#fff',
        color: dark ? '#d4d4d8' : '#374151',
        fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        {sel?.label}
        <ChevronDown style={{ width: '14px', height: '14px', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: dark ? '#111113' : '#fff',
            border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
            borderRadius: '10px', padding: '4px', minWidth: '150px', zIndex: 50,
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)',
          }}>
            {options.map(o => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{
                width: '100%', padding: '7px 10px', borderRadius: '7px', border: 'none',
                background: value === o.value ? (dark ? 'rgba(255,255,255,0.08)' : '#eff6ff') : 'transparent',
                color: value === o.value ? (dark ? '#60a5fa' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'),
                fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>{o.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Thumbnail ────────────────────────────────────────────────

function Thumbnail({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#f59e0b', '#ec4899'];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (!url || err) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '8px',
        background: color + '22', border: `1px solid ${color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size > 40 ? '14px' : '10px', fontWeight: 700, color, flexShrink: 0,
      }}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      onError={() => setErr(true)}
      style={{
        width: size, height: size, borderRadius: '8px',
        objectFit: 'cover', flexShrink: 0,
        border: '1px solid rgba(0,0,0,0.08)',
      }}
    />
  );
}

// ─── Score badge ──────────────────────────────────────────────

function ScoreBadge({ rank }: { rank: number }) {
  const colors: Record<number, { bg: string; text: string; label: string }> = {
    1: { bg: '#fef3c7', text: '#92400e', label: '🥇' },
    2: { bg: '#f3f4f6', text: '#374151', label: '🥈' },
    3: { bg: '#fff7ed', text: '#9a3412', label: '🥉' },
  };
  const c = colors[rank] || { bg: '#f3f4f6', text: '#6b7280', label: `#${rank}` };
  return (
    <div style={{
      width: '28px', height: '28px', borderRadius: '8px',
      background: c.bg, color: c.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: rank <= 3 ? '14px' : '11px', fontWeight: 700, flexShrink: 0,
    }}>
      {c.label}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function CriativosPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('this_month');
  const [sortBy, setSortBy] = useState<'leads' | 'cpl' | 'ctr' | 'spend'>('leads');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = async () => {
    setLoading(true); setError(false);
    const data = await fetchCreatives(datePreset);
    if (!data.length) setError(true);
    setCreatives(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [datePreset]); // eslint-disable-line

  // Métricas agregadas
  const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
  const totalLeads = creatives.reduce((s, c) => s + c.leads, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCTR = creatives.length > 0
    ? creatives.reduce((s, c) => s + c.ctr, 0) / creatives.length
    : 0;

  // Top 5 criativos por leads
  const top5 = useMemo(() =>
    [...creatives].filter(c => c.leads > 0 || c.spend > 0).slice(0, 5),
    [creatives]
  );

  // Tabela filtrada e ordenada
  const tableData = useMemo(() => {
    let data = statusFilter === 'all' ? creatives : creatives.filter(c => c.status === statusFilter);
    return [...data].sort((a, b) => {
      if (sortBy === 'leads') return b.leads - a.leads;
      if (sortBy === 'cpl') return (a.cpl || 999) - (b.cpl || 999);
      if (sortBy === 'ctr') return b.ctr - a.ctr;
      if (sortBy === 'spend') return b.spend - a.spend;
      return 0;
    });
  }, [creatives, sortBy, statusFilter]);

  // Tokens
  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const txtLow = dark ? '#52525b' : '#9ca3af';
  const divCls = dark ? '#1e1e22' : '#f3f4f6';

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
    borderRadius: '10px', border: `1px solid ${border}`, background: cardBg,
    color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
  };

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>Criativos</h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '4px' }}>Análise de performance dos anúncios via Meta Ads</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark} />
            <FilterDropdown
              value={statusFilter}
              options={[{ label: 'Todos', value: 'all' }, { label: 'Ativos', value: 'ACTIVE' }, { label: 'Pausados', value: 'PAUSED' }]}
              onChange={setStatusFilter}
              dark={dark}
            />
            <button onClick={load} disabled={loading} style={btnBase}>
              <RefreshCw style={{ width: '14px', height: '14px', animation: loading ? 'spin 1s linear infinite' : '' }} />
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'Gasto Total', value: loading ? '…' : `R$ ${fmt(totalSpend)}`, icon: DollarSign, color: '#10b981', bgC: dark ? 'rgba(16,185,129,0.12)' : '#ecfdf5' },
            { label: 'Leads Gerados', value: loading ? '…' : String(totalLeads), icon: Users, color: '#3b82f6', bgC: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
            { label: 'CPL Médio', value: loading ? '…' : (avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'), icon: TrendingUp, color: '#f97316', bgC: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed' },
            { label: 'CTR Médio', value: loading ? '…' : `${avgCTR.toFixed(2)}%`, icon: MousePointer, color: '#8b5cf6', bgC: dark ? 'rgba(139,92,246,0.12)' : '#f5f3ff' },
          ].map((c, i) => (
            <div key={i} style={{ background: cardBg, borderRadius: '16px', padding: '20px', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: txtMid }}>{c.label}</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.bgC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon style={{ width: '16px', height: '16px', color: c.color }} />
                </div>
              </div>
              <p style={{ fontSize: '26px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Top 5 Criativos */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: dark ? 'rgba(251,191,36,0.15)' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: txtHi }}>Top 5 Criativos</h3>
              <p style={{ margin: 0, fontSize: '12px', color: txtMid, marginTop: '2px' }}>Melhores performers do período</p>
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: '72px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
              ))}
            </div>
          ) : top5.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: txtMid, fontSize: '13px' }}>
              Nenhum criativo com dados no período selecionado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {top5.map((c, i) => {
                const isTop = i === 0;
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px', borderRadius: '12px',
                    background: isTop
                      ? (dark ? 'rgba(251,191,36,0.08)' : '#fffbeb')
                      : (dark ? 'rgba(255,255,255,0.02)' : '#fafafa'),
                    border: `1px solid ${isTop ? (dark ? 'rgba(251,191,36,0.2)' : '#fde68a') : (dark ? '#1e1e22' : '#f3f4f6')}`,
                    transition: 'all 0.15s',
                  }}>
                    <ScoreBadge rank={i + 1} />
                    <Thumbnail url={c.thumbnail_url} name={c.name} size={52} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: txtMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.campaign_name} • {c.adset_name}
                      </p>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', color: c.leads > 0 ? '#10b981' : txtLow, fontWeight: c.leads > 0 ? 600 : 400 }}>
                          {c.leads} leads
                        </span>
                        <span style={{ fontSize: '11px', color: txtLow }}>R$ {fmt(c.spend)} gasto</span>
                        {c.cpl > 0 && <span style={{ fontSize: '11px', color: txtLow }}>CPL: R$ {fmt(c.cpl)}</span>}
                        <span style={{ fontSize: '11px', color: txtLow }}>CTR: {c.ctr.toFixed(2)}%</span>
                        {c.frequency > 0 && <span style={{ fontSize: '11px', color: c.frequency > 3 ? '#f97316' : txtLow }}>Freq: {c.frequency.toFixed(1)}</span>}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span style={{
                      padding: '3px 10px', borderRadius: '99px', fontSize: '11.5px', fontWeight: 500, flexShrink: 0,
                      background: c.status === 'ACTIVE' ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                      color: c.status === 'ACTIVE' ? '#10b981' : txtMid,
                    }}>
                      {c.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tabela completa */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${divCls}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: txtHi }}>
              Todos os Criativos <span style={{ fontSize: '13px', fontWeight: 400, color: txtMid }}>({tableData.length})</span>
            </h3>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: txtMid }}>Ordenar por:</span>
              {[
                { key: 'leads', label: 'Leads' },
                { key: 'cpl', label: 'CPL' },
                { key: 'ctr', label: 'CTR' },
                { key: 'spend', label: 'Gasto' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key as any)} style={{
                  padding: '5px 10px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: sortBy === s.key ? 600 : 400,
                  background: sortBy === s.key ? '#2563eb' : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                  color: sortBy === s.key ? '#fff' : txtMid,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{s.label}</button>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: dark ? '#18181b' : '#f9fafb' }}>
                  {['Criativo', 'Status', 'Campanha', 'Gasto', 'Leads', 'CPL', 'CTR', 'CPM', 'Impressões', 'Freq.'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '10px 14px',
                      fontSize: '10.5px', fontWeight: 600, color: txtLow,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: `1px solid ${divCls}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={10} style={{ padding: '12px 14px' }}>
                        <div style={{ height: '14px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    </tr>
                  ))
                ) : error || tableData.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: txtMid, fontSize: '13px' }}>
                      {error ? '⚠️ Erro ao conectar ao Meta Ads. Verifique o token.' : 'Nenhum criativo encontrado.'}
                    </td>
                  </tr>
                ) : tableData.map((c, idx) => (
                  <tr key={c.id}
                    style={{ borderBottom: `1px solid ${divCls}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Thumbnail url={c.thumbnail_url} name={c.name} size={36} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 500, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{c.name}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: txtLow, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{c.adset_name}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 500,
                        background: c.status === 'ACTIVE' ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                        color: c.status === 'ACTIVE' ? '#10b981' : txtMid,
                      }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.status === 'ACTIVE' ? '#10b981' : txtLow }} />
                        {c.status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: txtMid, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: txtMid }}>R$ {fmt(c.spend)}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '13px', fontWeight: c.leads > 0 ? 600 : 400, color: c.leads > 0 ? '#10b981' : txtMid }}>{c.leads}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: c.cpl > 0 && c.cpl < 20 ? '#10b981' : c.cpl > 40 ? '#ef4444' : txtMid, fontWeight: c.cpl > 0 ? 500 : 400 }}>
                      {c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: c.ctr > 2 ? '#10b981' : c.ctr < 0.5 ? '#ef4444' : txtMid }}>
                      {c.ctr.toFixed(2)}%
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: txtMid }}>R$ {fmt(c.cpm)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: txtMid }}>{fmtInt(c.impressions)}</td>
                    <td style={{ padding: '10px 14px', fontSize: '12px', color: c.frequency > 3 ? '#f97316' : txtMid, fontWeight: c.frequency > 3 ? 500 : 400 }}>
                      {c.frequency > 0 ? c.frequency.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </AppLayout>
  );
}
