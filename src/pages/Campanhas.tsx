import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, DollarSign, Users, RefreshCw, Zap,
  ChevronDown, AlertCircle, ArrowUpRight, Lightbulb,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  leads_api: number;
  cpl?: number;
  perf?: number;
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

// ─── Helpers ──────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n: number) { return n.toLocaleString('pt-BR'); }

function parseLeadDate(str?: string | null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) return new Date(str);
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) { const [, d, mo, y, h = '0', mi = '0'] = m; return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)); }
  return new Date(str);
}

function filterLeadsByPreset(leads: any[], preset: string) {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const ts = startOf(now);
  const te = endOf(now);

  const inR = (l: any, a: Date, b: Date) => {
    const d = parseLeadDate(l.created_at);
    return d >= a && d <= b;
  };

  switch (preset) {
    case 'today': return leads.filter(l => inR(l, ts, te));
    case 'yesterday': { const ys = new Date(ts); ys.setDate(ys.getDate() - 1); const ye = new Date(te); ye.setDate(ye.getDate() - 1); return leads.filter(l => inR(l, ys, ye)); }
    case 'last_7d': { const a = new Date(ts); a.setDate(a.getDate() - 6); return leads.filter(l => inR(l, a, te)); }
    case 'last_30d': { const a = new Date(ts); a.setDate(a.getDate() - 29); return leads.filter(l => inR(l, a, te)); }
    case 'this_month': { const f = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0); return leads.filter(l => inR(l, f, te)); }
    default: return leads;
  }
}

// Gera insights automáticos baseados nas métricas
function generateInsights(campaigns: Campaign[]): string[] {
  const insights: string[] = [];
  if (!campaigns.length) return ['Nenhuma campanha com dados disponíveis para análise.'];

  const active = campaigns.filter(c => c.status === 'ACTIVE');
  const withLeads = campaigns.filter(c => c.leads_api > 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_api, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;

  // Melhor campanha por CPL
  if (withLeads.length > 0) {
    const best = [...withLeads].sort((a, b) => (a.spend / a.leads_api) - (b.spend / b.leads_api))[0];
    const bestCPL = best.spend / best.leads_api;
    insights.push(`🏆 "${best.name.slice(0, 40)}" tem o melhor CPL: R$ ${fmt(bestCPL)}. Considere aumentar o orçamento desta campanha para escalar os resultados.`);
  }

  // Campanha com maior gasto mas poucos leads
  const inefficient = campaigns.filter(c => c.spend > totalSpend * 0.15 && c.leads_api === 0);
  if (inefficient.length > 0) {
    insights.push(`⚠️ "${inefficient[0].name.slice(0, 40)}" gastou R$ ${fmt(inefficient[0].spend)} sem gerar leads. Revise a segmentação ou o criativo desta campanha.`);
  }

  // CPL médio acima de R$ 30
  if (avgCPL > 30 && totalLeads > 0) {
    insights.push(`💡 O CPL médio está em R$ ${fmt(avgCPL)}. Para reduzir, teste públicos mais específicos ou melhore a qualidade dos criativos.`);
  } else if (avgCPL > 0 && avgCPL <= 20) {
    insights.push(`✅ Excelente! CPL médio de R$ ${fmt(avgCPL)} está abaixo de R$ 20. Momento ideal para escalar o investimento nas campanhas ativas.`);
  }

  // CTR baixo
  const lowCTR = campaigns.filter(c => c.ctr < 1 && c.impressions > 1000);
  if (lowCTR.length > 0) {
    insights.push(`📉 ${lowCTR.length} campanha(s) com CTR abaixo de 1% — ${lowCTR[0].name.slice(0, 30)}. Teste novos criativos com chamadas para ação mais diretas.`);
  }

  // Campanhas pausadas com bom histórico
  const paused = campaigns.filter(c => c.status === 'PAUSED' && c.leads_api > 0);
  if (paused.length > 0) {
    insights.push(`⏸️ "${paused[0].name.slice(0, 40)}" está pausada mas gerou ${paused[0].leads_api} leads. Considere reativar com ajustes de orçamento.`);
  }

  // Concentração de gasto
  if (active.length > 0) {
    const topSpend = [...active].sort((a, b) => b.spend - a.spend)[0];
    const topPct = totalSpend > 0 ? (topSpend.spend / totalSpend) * 100 : 0;
    if (topPct > 70) {
      insights.push(`⚡ ${topPct.toFixed(0)}% do investimento está concentrado em "${topSpend.name.slice(0, 30)}". Diversifique para reduzir risco.`);
    }
  }

  if (insights.length === 0) {
    insights.push('📊 Continue monitorando — não há alertas críticos no momento. As campanhas estão dentro do esperado.');
  }

  return insights;
}

// ─── Fetch Meta Ads ───────────────────────────────────────────

async function fetchCampaigns(datePreset: string): Promise<Campaign[]> {
  try {
    // 1. Lista campanhas
    const listRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/campaigns?fields=id,name,status&limit=30&access_token=${META_TOKEN}`
    );
    const listData = await listRes.json();
    if (!listData.data?.length) return [];

    // 2. Busca insights de cada campanha com o período correto
    const results = await Promise.all(
      (listData.data as any[]).map(async (c: any) => {
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v18.0/${c.id}/insights?fields=spend,impressions,clicks,ctr,cpm,actions&date_preset=${datePreset}&access_token=${META_TOKEN}`
          );
          const insData = await insRes.json();
          const ins = insData.data?.[0];
          const spend = parseFloat(ins?.spend || '0');
          const impressions = parseInt(ins?.impressions || '0');
          const clicks = parseInt(ins?.clicks || '0');
          const ctr = parseFloat(ins?.ctr || '0');
          const cpm = parseFloat(ins?.cpm || '0');
          const actions: any[] = ins?.actions || [];
          const leads = parseInt(
            actions.find((a: any) => ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'].includes(a.action_type))?.value || '0'
          );
          return {
            id: c.id, name: c.name, status: c.status,
            spend, impressions, clicks, ctr, cpm, leads_api: leads,
            cpl: leads > 0 ? spend / leads : 0,
          } as Campaign;
        } catch { return null; }
      })
    );

    return (results.filter(Boolean) as Campaign[])
      .filter(c => c.spend > 0 || c.status === 'ACTIVE')
      .sort((a, b) => b.spend - a.spend);
  } catch (e) {
    console.error('[Campanhas]', e);
    return [];
  }
}

// ─── FilterDropdown ───────────────────────────────────────────

function FilterDropdown({ value, options, onChange, dark }: {
  value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sel = options.find(o => o.value === value);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
        border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
        background: dark ? '#111113' : '#fff', color: dark ? '#d4d4d8' : '#374151',
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
            background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
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

// ─── Page ────────────────────────────────────────────────────

export default function CampanhasPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('this_month');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'campanhas' | 'insights'>('campanhas');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check(); window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = async () => {
    setLoading(true); setError(false);
    const data = await fetchCampaigns(datePreset);
    if (!data.length) setError(true);
    setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [datePreset]); // eslint-disable-line

  const filtered = useMemo(() =>
    statusFilter === 'all' ? campaigns : campaigns.filter(c => c.status === statusFilter),
    [campaigns, statusFilter]
  );

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalLeads = campaigns.reduce((s, c) => s + c.leads_api, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const maxSpend = Math.max(...campaigns.map(c => c.spend), 1);
  const avgPerf = campaigns.length > 0
    ? campaigns.reduce((s, c) => s + (c.spend / maxSpend) * 100, 0) / campaigns.length
    : 0;

  const insights = useMemo(() => generateInsights(campaigns), [campaigns]);

  const filteredLeads = useMemo(() => filterLeadsByPreset(leads, datePreset), [leads, datePreset]);
  const leadsFBCount = filteredLeads.filter(l => l.utm_source?.toUpperCase() === 'FB').length;
  const cplRealTime = leadsFBCount > 0 ? totalSpend / leadsFBCount : 0;

  const chartData = filtered.slice(0, 8).map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + '…' : c.name,
    gasto: c.spend,
    leads: c.leads_api,
  }));

  // Tokens
  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const txtLow = dark ? '#52525b' : '#9ca3af';
  const divCls = dark ? '#1e1e22' : '#f3f4f6';
  const gridLn = dark ? '#1e1e22' : '#f0f0f0';

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
    borderRadius: '10px', border: `1px solid ${border}`, background: cardBg,
    color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
  };

  const pad = isMobile ? '20px 16px' : '32px';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: pad, background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>Campanhas Meta Ads</h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '4px' }}>Dados em tempo real via API do Facebook</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark} />
            <FilterDropdown
              value={statusFilter}
              options={[{ label: 'Todas', value: 'all' }, { label: 'Ativas', value: 'ACTIVE' }, { label: 'Pausadas', value: 'PAUSED' }]}
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
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,1fr)', gap: isMobile ? '12px' : '14px', marginBottom: '20px' }}>
          {[
            { label: 'Gasto Total', value: loading ? '…' : `R$ ${fmt(totalSpend)}`, icon: DollarSign, color: '#10b981', bgC: dark ? 'rgba(16,185,129,0.12)' : '#ecfdf5' },
            { label: 'Leads (Sist. FB)', value: loading ? '…' : String(leadsFBCount), icon: Users, color: '#3b82f6', bgC: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
            { label: 'CPL Ads (Real)', value: loading ? '…' : (cplRealTime > 0 ? `R$ ${fmt(cplRealTime)}` : 'R$ —'), icon: TrendingUp, color: '#f97316', bgC: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed' },
            { label: 'Performance', value: loading ? '…' : `${avgPerf.toFixed(0)}%`, icon: Zap, color: '#8b5cf6', bgC: dark ? 'rgba(139,92,246,0.12)' : '#f5f3ff' },
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

        {/* Chart */}
        <div style={{ background: cardBg, borderRadius: '16px', padding: '24px', border: `1px solid ${border}`, marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: txtHi, margin: '0 0 20px' }}>Desempenho por Campanha</h3>
          <div style={{ height: '200px' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: txtMid, fontSize: '13px' }}>Carregando dados…</div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: txtMid, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: txtMid, fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '12px', fontSize: '12px', color: txtHi }} />
                  <Bar dataKey="gasto" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Gasto (R$)" />
                  <Bar dataKey="leads" fill="#10b981" radius={[6, 6, 0, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: txtMid, fontSize: '13px' }}>Nenhum dado disponível</div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden' }}>
          {/* Tab header */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${border}` }}>
            {[
              { key: 'campanhas', label: 'Detalhes das Campanhas', icon: TrendingUp },
              { key: 'insights', label: 'Insights & Recomendações', icon: Lightbulb },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '14px 20px', border: 'none', cursor: 'pointer',
                  background: activeTab === tab.key ? cardBg : 'transparent',
                  color: activeTab === tab.key ? txtHi : txtMid,
                  fontSize: '13.5px', fontWeight: activeTab === tab.key ? 600 : 400,
                  borderBottom: activeTab === tab.key ? `2px solid #2563eb` : '2px solid transparent',
                  transition: 'all 0.15s', fontFamily: 'inherit',
                  marginBottom: '-1px',
                }}
              >
                <tab.icon style={{ width: '14px', height: '14px' }} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Campanhas */}
          {activeTab === 'campanhas' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: dark ? '#18181b' : '#f9fafb' }}>
                    {['Campanha', 'Status', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'CPM', 'Leads', 'CPL', 'Performance'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10.5px', fontWeight: 600, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${divCls}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={10} style={{ padding: '12px 16px' }}>
                          <div style={{ height: '14px', borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        </td>
                      </tr>
                    ))
                  ) : error || filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: txtMid, fontSize: '13px' }}>
                        {error ? '⚠️ Erro ao conectar ao Meta Ads. Verifique o token.' : 'Nenhuma campanha encontrada.'}
                      </td>
                    </tr>
                  ) : filtered.map((c, i) => {
                    const perf = Math.round((c.spend / maxSpend) * 100);
                    return (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${divCls}`, transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: txtHi, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '99px', fontSize: '11.5px', fontWeight: 500, background: c.status === 'ACTIVE' ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), color: c.status === 'ACTIVE' ? '#10b981' : txtMid }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.status === 'ACTIVE' ? '#10b981' : txtLow }} />
                            {c.status === 'ACTIVE' ? 'Ativa' : 'Pausada'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>R$ {fmt(c.spend)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>{fmtInt(c.impressions)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>{fmtInt(c.clicks)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>{c.ctr.toFixed(2)}%</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>R$ {fmt(c.cpm)}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>{c.leads_api}</td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: txtMid }}>{c.leads_api > 0 ? `R$ ${fmt(c.spend / c.leads_api)}` : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ height: '4px', width: '60px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${perf}%`, background: perf > 60 ? '#10b981' : perf > 30 ? '#f97316' : '#3b82f6', borderRadius: '99px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: txtLow }}>{perf}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Insights */}
          {activeTab === 'insights' && (
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: dark ? 'rgba(139,92,246,0.15)' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lightbulb style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: txtHi }}>Análise Automática de Campanhas</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: txtMid, marginTop: '2px' }}>Baseado nos dados do período: {PERIOD_OPTIONS.find(p => p.value === datePreset)?.label}</p>
                </div>
              </div>

              {loading ? (
                <div style={{ color: txtMid, fontSize: '13px', textAlign: 'center', padding: '20px' }}>Analisando campanhas…</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{
                      padding: '16px', borderRadius: '12px',
                      background: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                      border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                    }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0, marginTop: '5px' }} />
                      <p style={{ margin: 0, fontSize: '13.5px', color: dark ? '#d4d4d8' : '#374151', lineHeight: 1.6 }}>{insight}</p>
                    </div>
                  ))}

                  {/* Resumo numérico */}
                  <div style={{ marginTop: '8px', padding: '16px', borderRadius: '12px', background: dark ? 'rgba(37,99,235,0.1)' : '#eff6ff', border: `1px solid ${dark ? 'rgba(59,130,246,0.2)' : '#bfdbfe'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <ArrowUpRight style={{ width: '14px', height: '14px', color: '#2563eb' }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: dark ? '#93c5fd' : '#1e40af' }}>Resumo do Período</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                      {[
                        { label: 'Total Investido', value: `R$ ${fmt(totalSpend)}` },
                        { label: 'Leads Gerados', value: String(totalLeads) },
                        { label: 'CPL Médio', value: avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—' },
                      ].map((s, i) => (
                        <div key={i}>
                          <p style={{ margin: 0, fontSize: '11px', color: dark ? '#93c5fd' : '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{s.label}</p>
                          <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: dark ? '#fff' : '#1e40af' }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </AppLayout>
  );
}
