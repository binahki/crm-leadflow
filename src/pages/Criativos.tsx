import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, ChevronDown, TrendingUp, Users, DollarSign, Activity, ShoppingBag } from 'lucide-react';

// ─── tipos ───────────────────────────────────────────────────────────────────

interface CreativeGroup {
  video_id: string | null;
  image_hash: string | null;
  creative_id: string;
  thumbnail_url: string | null;
  ad_ids: string[];
  ad_names: string[];
  campaigns: string[];
  campaign_ids: string[];
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  frequency: number;
  ctr: number;
  cpl: number;
  cpm: number;
}

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: 'last_7d' },
  { label: '30 dias', value: 'last_30d' },
  { label: 'Este mês', value: 'this_month' },
];

type SortKey = 'leads' | 'cpl' | 'ctr' | 'spend' | 'revs' | 'fadiga';

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── fetch + agrupamento ──────────────────────────────────────────────────────

async function fetchCreatives(
  datePreset: string,
  metaToken: string,
  metaAccount: string,
): Promise<CreativeGroup[]> {
  if (!metaToken || !metaAccount) return [];
  try {
    const adsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${metaAccount}/ads` +
        `?fields=id,name,status,adset{name},campaign{name,id},creative{id,thumbnail_url,image_url,video_id,image_hash}` +
        `&limit=100&access_token=${metaToken}`,
    );
    const adsData = await adsRes.json();
    if (!adsData.data?.length) return [];

    const groups = new Map<string, CreativeGroup>();

    await Promise.all(
      (adsData.data as any[]).map(async (ad: any) => {
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v18.0/${ad.id}/insights` +
              `?fields=spend,impressions,clicks,ctr,cpm,frequency,actions` +
              `&date_preset=${datePreset}&access_token=${metaToken}`,
          );
          const insData = await insRes.json();
          const ins = insData.data?.[0];
          if (!ins) return;

          const adSpend = parseFloat(ins.spend || '0');
          const adImpressions = parseInt(ins.impressions || '0');
          const adClicks = parseInt(ins.clicks || '0');
          const adFrequency = parseFloat(ins.frequency || '0');
          const adLeads = parseInt(
            (ins.actions || []).find((a: any) =>
              ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'].includes(
                a.action_type,
              ),
            )?.value || '0',
          );

          const key =
            ad.creative?.video_id ||
            ad.creative?.image_hash ||
            ad.creative?.id ||
            ad.id;

          const thumbnail =
            ad.creative?.thumbnail_url ||
            ad.creative?.image_url ||
            null;

          if (!groups.has(key)) {
            groups.set(key, {
              video_id: ad.creative?.video_id || null,
              image_hash: ad.creative?.image_hash || null,
              creative_id: ad.creative?.id || ad.id,
              thumbnail_url: thumbnail,
              ad_ids: [],
              ad_names: [],
              campaigns: [],
              campaign_ids: [],
              status: 'PAUSED',
              spend: 0,
              impressions: 0,
              clicks: 0,
              leads: 0,
              frequency: 0,
              ctr: 0,
              cpl: 0,
              cpm: 0,
            });
          }

          const g = groups.get(key)!;
          g.ad_ids.push(ad.id);
          if (!g.ad_names.includes(ad.name)) g.ad_names.push(ad.name);
          if (ad.campaign?.id && !g.campaign_ids.includes(ad.campaign.id)) {
            g.campaign_ids.push(ad.campaign.id);
            g.campaigns.push(ad.campaign?.name || '—');
          }
          if (ad.status === 'ACTIVE') g.status = 'ACTIVE';
          g.spend += adSpend;
          g.impressions += adImpressions;
          g.clicks += adClicks;
          g.leads += adLeads;
          g.frequency =
            g.impressions > 0
              ? (g.frequency * (g.impressions - adImpressions) + adFrequency * adImpressions) /
                g.impressions
              : adFrequency;
        } catch {
          /* silencia erros por ad */
        }
      }),
    );

    groups.forEach((g) => {
      g.ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0;
      g.cpl = g.leads > 0 ? g.spend / g.leads : 0;
      g.cpm = g.impressions > 0 ? (g.spend / g.impressions) * 1000 : 0;
    });

    return Array.from(groups.values())
      .filter((g) => g.spend > 0 || g.leads > 0)
      .sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  } catch (e) {
    console.error('[Criativos]', e);
    return [];
  }
}

// ─── revendedoras com filtro de período ──────────────────────────────────────

function getGroupRevs(
  g: CreativeGroup,
  leads: any[],
  datePreset: string,
): { count: number; cpr: number } {
  const agora = Date.now();
  const getPeriodStart = () => {
    switch (datePreset) {
      case 'today': return new Date().setHours(0, 0, 0, 0);
      case 'yesterday': {
        const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0);
        return y.getTime();
      }
      case 'last_7d': return agora - 7 * 24 * 60 * 60 * 1000;
      case 'last_30d': return agora - 30 * 24 * 60 * 60 * 1000;
      case 'this_month':
        return new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      default: return agora - 7 * 24 * 60 * 60 * 1000;
    }
  };
  const periodStart = getPeriodStart();

  // Set evita que um lead bata com múltiplas campanhas e seja contado mais de uma vez
  const matchedIds = new Set<string>();
  for (const l of leads) {
    if (matchedIds.has(l.id)) continue;
    const utmRaw = (l.utm_campaign || '').trim();
    const utm = utmRaw.toLowerCase().split('|')[0].trim();
    if (!utm || utm.length < 3) continue;
    const bate = g.campaigns.some((campName) => {
      const cn = campName.toLowerCase().split('|')[0].trim();
      if (!cn || cn.length < 3) return false;
      if (utm === cn) return true;
      if (g.campaign_ids.some((id) => utmRaw.includes(id))) return true;
      const cnSlice = cn.slice(0, 25);
      if (utm.includes(cnSlice) || cnSlice.includes(utm.slice(0, 25))) return true;
      return false;
    });
    if (bate) matchedIds.add(l.id);
  }

  const matchedLeads = leads.filter((l) => matchedIds.has(l.id));
  const revs = matchedLeads.filter((l: any) => {
    if (Number(l.status) !== 3) return false;
    const changeDate = l.ultimo_status_change || l.created_at;
    if (!changeDate) return false;
    const ts = new Date(changeDate).getTime();
    if (datePreset === 'yesterday') {
      const endOfYesterday = new Date(); endOfYesterday.setHours(0, 0, 0, 0);
      return ts >= periodStart && ts < endOfYesterday.getTime();
    }
    return ts >= periodStart && ts <= agora;
  });

  return {
    count: revs.length,
    cpr: revs.length > 0 && g.spend > 0
      ? Math.round((g.spend / revs.length) * 100) / 100
      : 0,
  };
}

// ─── score de fadiga ──────────────────────────────────────────────────────────

function getFadigaScore(g: CreativeGroup): {
  label: string; color: string; bg: string; pct: number; desc: string;
} {
  let score = 0;

  if (g.frequency >= 4) score += 60;
  else if (g.frequency >= 3) score += 40;
  else if (g.frequency >= 2) score += 20;
  else if (g.frequency >= 1.5) score += 10;

  if (g.impressions > 2000) {
    if (g.ctr < 1) score += 30;
    else if (g.ctr < 2) score += 15;
    else if (g.ctr > 4) score -= 10;
  }

  if (g.cpm > 50) score += 10;

  score = Math.max(0, Math.min(100, score));

  if (score >= 60)
    return { label: '🔴 Trocar', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', pct: score, desc: 'Criativo saturado — troque o vídeo ou pause' };
  if (score >= 30)
    return { label: '🟡 Atenção', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', pct: score, desc: 'Começando a saturar — monitore nos próximos dias' };
  return { label: '🟢 Saudável', color: '#10b981', bg: 'rgba(16,185,129,0.1)', pct: score, desc: 'Criativo com boa performance — pode continuar escalando' };
}

// ─── análise automática ───────────────────────────────────────────────────────

function generateAnalysis(top5: CreativeGroup[], avgCPL: number, avgCTR: number): string[] {
  if (!top5.length)
    return ['📊 Aguardando dados suficientes para gerar insights automáticos. A análise fica disponível após 3+ dias de campanha ativa.'];
  const insights: string[] = [];
  const best = top5[0];
  if (best.leads > 0)
    insights.push(`🏆 "${best.ad_names[0].slice(0, 40)}" é o criativo mais eficiente com ${best.leads} leads e CPL de R$ ${fmt(best.cpl)}. Priorize mais verba neste criativo.`);
  const highFreq = top5.filter((c) => c.frequency > 3);
  if (highFreq.length > 0)
    insights.push(`⚠️ "${highFreq[0].ad_names[0].slice(0, 35)}" com frequência ${highFreq[0].frequency.toFixed(1)} — público saturando. Considere expandir a segmentação ou renovar o criativo.`);
  const lowCTR = top5.filter((c) => c.ctr < 1 && c.spend > 20);
  if (lowCTR.length > 0)
    insights.push(`📉 "${lowCTR[0].ad_names[0].slice(0, 35)}" com CTR de ${lowCTR[0].ctr.toFixed(2)}% — hook fraco. Teste uma abertura mais direta nos primeiros 3 segundos.`);
  const paused = top5.filter((c) => c.status === 'PAUSED' && c.leads > 0);
  if (paused.length > 0)
    insights.push(`⏸️ "${paused[0].ad_names[0].slice(0, 35)}" está pausado mas gerou ${paused[0].leads} leads. Vale testar reativar com orçamento controlado.`);
  if (avgCPL > 0 && avgCPL < 15)
    insights.push(`✅ CPL médio de R$ ${fmt(avgCPL)} excelente. Momento ideal para escalar os criativos vencedores.`);
  else if (avgCPL > 30)
    insights.push(`💡 CPL médio em R$ ${fmt(avgCPL)}. Teste variações do criativo #1 com ângulos diferentes — mesmo formato, headline diferente.`);
  if (avgCTR > 2)
    insights.push(`🎯 CTR médio de ${avgCTR.toFixed(2)}% acima da média do mercado (1–2%). Os criativos estão chamando atenção — foco agora é otimizar a landing page.`);
  if (insights.length === 0)
    insights.push('📊 Criativos dentro do esperado para o período. Continue testando novos ângulos e monitore a frequência.');
  return insights;
}

// ─── dropdown ─────────────────────────────────────────────────────────────────

function FilterDropdown({
  value, options, onChange, dark,
}: {
  value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 180 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const sel = options.find((o) => o.value === value);
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      let left = r.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setPos({ top: r.bottom + 6, left, width: menuWidth });
    }
    setOpen((v) => !v);
  }
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#fff', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {sel?.label}
        <ChevronDown style={{ width: '14px', height: '14px', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '10px', padding: '4px', zIndex: 9999, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)' }}>
            {options.map((o) => (
              <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: 'none', background: value === o.value ? (dark ? 'rgba(255,255,255,0.08)' : '#eff6ff') : 'transparent', color: value === o.value ? (dark ? '#60a5fa' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'), fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function CriativosPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const { orgId, ready: orgReady } = useOrgId();
  const dark = theme === 'dark';

  const [groups, setGroups] = useState<CreativeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('today');
  const [sortBy, setSortBy] = useState<SortKey>('leads');
  const [isMobile, setIsMobile] = useState(false);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Busca leads do Supabase com ultimo_status_change
  useEffect(() => {
    if (!orgReady || !orgId) return;
    supabase
      .from('leads')
      .select('id, utm_campaign, status, created_at, ultimo_status_change')
      .eq('org_id', orgId)
      .limit(5000)
      .then(({ data }) => { if (data) setAllLeads(data); });
  }, [orgId, orgReady]);

  const load = async () => {
    if (!metaToken || !metaAccount) { setLoading(false); return; }
    setLoading(true); setError(false);
    const data = await fetchCreatives(datePreset, metaToken, metaAccount);
    if (!data.length) setError(true);
    setGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!metaReady) return;
    load();
  }, [datePreset, metaReady, metaToken, metaAccount]); // eslint-disable-line

  // métricas corretas
  const totalSpend = groups.reduce((s, g) => s + g.spend, 0);
  const totalLeads = groups.reduce((s, g) => s + g.leads, 0);
  const totalImpressions = groups.reduce((s, g) => s + g.impressions, 0);
  const totalClicks = groups.reduce((s, g) => s + g.clicks, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgFrequency = groups.length > 0 ? groups.reduce((s, g) => s + g.frequency, 0) / groups.length : 0;

  const totalRevs = useMemo(() => {
    const agora = Date.now();
    const getPeriodStart = () => {
      switch (datePreset) {
        case 'today': return new Date().setHours(0, 0, 0, 0);
        case 'yesterday': {
          const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0);
          return y.getTime();
        }
        case 'last_7d': return agora - 7 * 24 * 60 * 60 * 1000;
        case 'last_30d': return agora - 30 * 24 * 60 * 60 * 1000;
        case 'this_month':
          return new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        default: return agora - 7 * 24 * 60 * 60 * 1000;
      }
    };
    const periodStart = getPeriodStart();

    // Agrega todas as campanhas de todos os grupos
    const allCampNames = new Set<string>();
    const allCampIds = new Set<string>();
    groups.forEach((g) => {
      g.campaigns.forEach((c) => allCampNames.add(c.toLowerCase().split('|')[0].trim()));
      g.campaign_ids.forEach((id) => allCampIds.add(id));
    });

    // Set de IDs garante que cada lead aprovado é contado uma única vez
    const revsIds = new Set<string>();
    for (const l of allLeads) {
      if (Number(l.status) !== 3) continue;
      const changeDate = l.ultimo_status_change || l.created_at;
      if (!changeDate) continue;
      const ts = new Date(changeDate).getTime();
      let noperiodo = false;
      if (datePreset === 'yesterday') {
        const endOfYesterday = new Date(); endOfYesterday.setHours(0, 0, 0, 0);
        noperiodo = ts >= periodStart && ts < endOfYesterday.getTime();
      } else {
        noperiodo = ts >= periodStart && ts <= agora;
      }
      if (!noperiodo) continue;
      const utmRaw = (l.utm_campaign || '').trim();
      const utm = utmRaw.toLowerCase().split('|')[0].trim();
      if (!utm || utm.length < 3) continue;
      const bate =
        Array.from(allCampNames).some((cn) => {
          if (!cn || cn.length < 3) return false;
          if (utm === cn) return true;
          const cnSlice = cn.slice(0, 25);
          return utm.includes(cnSlice) || cnSlice.includes(utm.slice(0, 25));
        }) || Array.from(allCampIds).some((id) => utmRaw.includes(id));
      if (bate) revsIds.add(l.id);
    }
    return revsIds.size;
  }, [groups, allLeads, datePreset]);

  const top5 = useMemo(
    () => [...groups].filter((g) => g.leads > 0 || g.spend > 0).slice(0, 5),
    [groups],
  );
  const analysis = useMemo(() => generateAnalysis(top5, avgCPL, avgCTR), [top5, avgCPL, avgCTR]);

  const sorted = useMemo(() => {
    const g2 = [...groups];
    if (sortBy === 'leads') g2.sort((a, b) => b.leads - a.leads);
    else if (sortBy === 'cpl') g2.sort((a, b) => (a.cpl || 999) - (b.cpl || 999));
    else if (sortBy === 'ctr') g2.sort((a, b) => b.ctr - a.ctr);
    else if (sortBy === 'spend') g2.sort((a, b) => b.spend - a.spend);
    else if (sortBy === 'revs')
      g2.sort((a, b) => getGroupRevs(b, allLeads, datePreset).count - getGroupRevs(a, allLeads, datePreset).count);
    else if (sortBy === 'fadiga')
      g2.sort((a, b) => getFadigaScore(b).pct - getFadigaScore(a).pct);
    return g2;
  }, [groups, sortBy, allLeads, datePreset]);

  useEffect(() => { setShowAll(false); }, [datePreset, sortBy]);

  // cores
  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const pad = isMobile ? '16px' : '32px';

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'leads', label: 'Leads' },
    { key: 'cpl', label: 'CPL' },
    { key: 'ctr', label: 'CTR' },
    { key: 'spend', label: 'Gasto' },
    { key: 'revs', label: 'Revendedoras' },
    { key: 'fadiga', label: 'Fadiga' },
  ];

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: pad, background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>
              Criativos
            </h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '4px' }}>
              Agrupado por vídeo/imagem · análise automática · Meta Ads
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark} />
            <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <RefreshCw style={{ width: '14px', height: '14px', animation: loading ? 'spin 1s linear infinite' : '' }} />
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Metric Cards — 5 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)', gap: isMobile ? '12px' : '12px', marginBottom: '20px' }}>
          {[
            { label: 'Gasto Total', value: loading ? '…' : `R$ ${fmt(totalSpend)}`, icon: DollarSign, color: '#10b981', bgC: dark ? 'rgba(16,185,129,0.12)' : '#ecfdf5' },
            { label: 'Leads Gerados', value: loading ? '…' : String(totalLeads), icon: Users, color: '#3b82f6', bgC: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
            { label: 'CPL Médio', value: loading ? '…' : (avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'), icon: TrendingUp, color: '#f97316', bgC: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed' },
            { label: 'Freq. Média', value: loading ? '…' : avgFrequency.toFixed(1), icon: Activity, color: '#8b5cf6', bgC: dark ? 'rgba(139,92,246,0.12)' : '#f5f3ff' },
            { label: 'Revendedoras', value: loading ? '…' : String(totalRevs), icon: ShoppingBag, color: '#a855f7', bgC: dark ? 'rgba(168,85,247,0.12)' : '#faf5ff' },
          ].map((c, i) => (
            <div key={i} style={{ background: cardBg, borderRadius: '14px', padding: isMobile ? '12px' : '18px', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: txtMid, fontWeight: 600 }}>{c.label}</span>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: c.bgC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon style={{ width: '13px', height: '13px', color: c.color }} />
                </div>
              </div>
              <p style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Ordenação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: txtMid, fontWeight: 500, marginRight: '2px' }}>Ordenar por:</span>
          {SORT_OPTIONS.map((s) => (
            <button key={s.key} onClick={() => setSortBy(s.key)} style={{ padding: '5px 12px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: sortBy === s.key ? 600 : 400, background: sortBy === s.key ? '#2563eb' : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), color: sortBy === s.key ? '#fff' : txtMid, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}>
              {s.label}
            </button>
          ))}
          {!loading && groups.length > 0 && (
            <span style={{ fontSize: '11px', color: txtMid, marginLeft: 'auto' }}>
              {groups.length} criativo{groups.length !== 1 ? 's' : ''} agrupado{groups.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Skeleton */}
        {loading && (
          <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden', marginBottom: '20px' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderBottom: i < 4 ? `1px solid ${border}` : 'none' }}>
                <div style={{ width: '28px', height: '14px', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: '13px', width: '60%', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', animation: 'pulse 1.5s ease-in-out infinite', marginBottom: '6px' }} />
                  <div style={{ height: '11px', width: '40%', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                <div style={{ width: '110px', height: '52px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && (error || sorted.length === 0) && (
          <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: '48px 24px', textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '36px', margin: '0 0 12px' }}>📊</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: '0 0 6px' }}>Aguardando dados suficientes</p>
            <p style={{ fontSize: '12px', color: txtMid, margin: 0, lineHeight: 1.6 }}>A análise fica disponível após 3+ dias de campanha ativa.</p>
          </div>
        )}

        {/* Tabela compacta */}
        {!loading && sorted.length > 0 && (
          <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden', marginBottom: '20px' }}>
            {(() => {
              const visibleGroups = showAll ? sorted : sorted.slice(0, 5);
              return (
                <>
                  {visibleGroups.map((g, i) => {
              const fadiga = getFadigaScore(g);
              const revs = getGroupRevs(g, allLeads, datePreset);
              const isTop = i === 0;
              return (
                <div
                  key={g.creative_id + i}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderBottom: `1px solid ${border}`, background: isTop ? (dark ? 'rgba(251,191,36,0.05)' : '#fffdf0') : i % 2 === 0 ? 'transparent' : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'), transition: 'background 0.12s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isTop ? (dark ? 'rgba(251,191,36,0.05)' : '#fffdf0') : i % 2 === 0 ? 'transparent' : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'))}
                >
                  {/* Rank */}
                  <div style={{ width: '28px', flexShrink: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: '14px' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </span>
                  </div>

                  {/* Thumbnail */}
                  <div style={{ width: '52px', height: '52px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: dark ? '#1a1a1e' : '#f3f4f6', border: `1px solid ${border}` }}>
                    {g.thumbnail_url ? (
                      <img src={g.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '20px' }}>🎬</span>
                      </div>
                    )}
                  </div>

                  {/* Nome + campanha */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isMobile ? '120px' : '260px' }}>
                        {g.ad_names[0]}
                      </p>
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '99px', flexShrink: 0, background: g.status === 'ACTIVE' ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)', color: g.status === 'ACTIVE' ? '#10b981' : txtMid }}>
                        {g.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: txtMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.campaigns.slice(0, 2).join(' · ')}
                      {g.campaigns.length > 2 && ` +${g.campaigns.length - 2}`}
                    </p>
                  </div>

                  {/* Métricas inline — desktop */}
                  {!isMobile && (
                    <>
                      <div style={{ textAlign: 'center', minWidth: '54px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads</p>
                        <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: '#10b981' }}>{g.leads}</p>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '72px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CPL</p>
                        <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: '#3b82f6' }}>
                          {g.cpl > 0 ? `R$${Math.round(g.cpl)}` : '—'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: '54px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CTR</p>
                        <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: g.ctr > 3 ? '#10b981' : g.ctr < 1 ? '#ef4444' : txtHi }}>
                          {g.ctr.toFixed(1)}%
                        </p>
                      </div>
                      <div style={{ minWidth: '90px', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Fadiga</p>
                        <div style={{ height: '4px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden', marginBottom: '3px' }}>
                          <div style={{ height: '100%', width: `${fadiga.pct}%`, background: fadiga.color, borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: fadiga.color, fontWeight: 600 }}>{fadiga.label}</span>
                      </div>
                    </>
                  )}

                  {/* Revendedoras */}
                  <div style={{ padding: '10px 14px', borderRadius: '10px', flexShrink: 0, background: revs.count > 0 ? (dark ? 'rgba(168,85,247,0.15)' : '#faf5ff') : (dark ? 'rgba(255,255,255,0.03)' : '#f9fafb'), border: `1px solid ${revs.count > 0 ? 'rgba(168,85,247,0.3)' : border}`, minWidth: isMobile ? '80px' : '110px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: revs.count > 0 ? '#8b5cf6' : txtMid, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rev</p>
                    <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: revs.count > 0 ? '#a855f7' : txtMid }}>
                      {revs.count}
                    </p>
                    {revs.count > 0 && (
                      <p style={{ margin: '1px 0 0', fontSize: '11px', fontWeight: 600, color: '#8b5cf6' }}>
                        R${Math.round(revs.cpr)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
                  {sorted.length > 5 && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      style={{ display: 'block', width: '100%', padding: '14px', background: 'transparent', border: 'none', borderTop: `1px solid ${border}`, cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#8b5cf6', textAlign: 'center' }}
                    >
                      {showAll ? `Ver menos` : `Ver mais (${sorted.length - 5} criativos)`}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Análise & Sugestões */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: isMobile ? '16px' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: dark ? 'rgba(139,92,246,0.15)' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>
              💡
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txtHi }}>Análise & Sugestões</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: txtMid }}>Baseado nos criativos do período</p>
            </div>
          </div>
          {loading ? (
            <div style={{ color: txtMid, fontSize: '13px', textAlign: 'center', padding: '16px' }}>Analisando criativos…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {analysis.map((a, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.03)' : '#fafafa', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8b5cf6', flexShrink: 0, marginTop: '5px' }} />
                  <p style={{ margin: 0, fontSize: '13px', color: dark ? '#d4d4d8' : '#374151', lineHeight: 1.6 }}>{a}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
      `}</style>
    </AppLayout>
  );
}
