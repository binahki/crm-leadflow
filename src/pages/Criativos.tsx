import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { RefreshCw, ChevronDown, TrendingUp, Users, DollarSign, MousePointer, Trophy, Lightbulb } from 'lucide-react';

interface Creative {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number;
  ctr: number; cpm: number; leads: number; cpl: number;
  frequency: number; thumbnail_url: string | null;
  adset_name: string; campaign_name: string;
}

// token e account são passados como parâmetro — sem fallback para env vars

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: 'last_7d' },
  { label: '30 dias', value: 'last_30d' },
  { label: 'Este mês', value: 'this_month' },
];

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

async function fetchCreatives(datePreset: string, metaToken: string, metaAccount: string): Promise<Creative[]> {
  if (!metaToken || !metaAccount) return [];
  try {
    const adsRes = await fetch(
      `https://graph.facebook.com/v18.0/act_${metaAccount}/ads` +
      `?fields=id,name,status,adset{name},campaign{name},creative{id,thumbnail_url,image_url}` +
      `&limit=50&access_token=${metaToken}`
    );
    const adsData = await adsRes.json();
    if (!adsData.data?.length) return [];
    const results = await Promise.all(
      (adsData.data as any[]).map(async (ad: any) => {
        try {
          const insRes = await fetch(
            `https://graph.facebook.com/v18.0/${ad.id}/insights` +
            `?fields=spend,impressions,clicks,ctr,cpm,frequency,actions` +
            `&date_preset=${datePreset}&access_token=${metaToken}`
          );
          const insData = await insRes.json();
          const ins = insData.data?.[0];
          const spend = parseFloat(ins?.spend || '0');
          const leads = parseInt((ins?.actions || []).find((a: any) =>
            ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'].includes(a.action_type)
          )?.value || '0');
          return {
            id: ad.id, name: ad.name || 'Sem nome', status: ad.status || 'UNKNOWN',
            spend, impressions: parseInt(ins?.impressions || '0'), clicks: parseInt(ins?.clicks || '0'),
            ctr: parseFloat(ins?.ctr || '0'), cpm: parseFloat(ins?.cpm || '0'),
            frequency: parseFloat(ins?.frequency || '0'), leads, cpl: leads > 0 ? spend / leads : 0,
            thumbnail_url: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
            adset_name: ad.adset?.name || '—', campaign_name: ad.campaign?.name || '—',
          } as Creative;
        } catch { return null; }
      })
    );
    return (results.filter(Boolean) as Creative[]).sort((a, b) => b.leads - a.leads || b.spend - a.spend);
  } catch (e) { console.error('[Criativos]', e); return []; }
}

function generateAnalysis(top5: Creative[], avgCPL: number, avgCTR: number): string[] {
  if (!top5.length) return ['Nenhum dado disponível para análise no período selecionado.'];
  const insights: string[] = [];
  const best = top5[0];
  if (best.leads > 0) insights.push(`🏆 "${best.name.slice(0, 40)}" é o criativo mais eficiente com ${best.leads} leads e CPL de R$ ${fmt(best.cpl)}. Priorize mais verba neste criativo.`);
  const highFreq = top5.filter(c => c.frequency > 3);
  if (highFreq.length > 0) insights.push(`⚠️ "${highFreq[0].name.slice(0, 35)}" com frequência ${highFreq[0].frequency.toFixed(1)} — público saturando. Considere expandir a segmentação ou renovar o criativo.`);
  const lowCTR = top5.filter(c => c.ctr < 1 && c.spend > 20);
  if (lowCTR.length > 0) insights.push(`📉 "${lowCTR[0].name.slice(0, 35)}" com CTR de ${lowCTR[0].ctr.toFixed(2)}% — hook fraco. Teste uma abertura mais direta nos primeiros 3 segundos.`);
  const paused = top5.filter(c => c.status === 'PAUSED' && c.leads > 0);
  if (paused.length > 0) insights.push(`⏸️ "${paused[0].name.slice(0, 35)}" está pausado mas gerou ${paused[0].leads} leads. Vale testar reativar com orçamento controlado.`);
  if (avgCPL > 0 && avgCPL < 15) insights.push(`✅ CPL médio de R$ ${fmt(avgCPL)} excelente. Momento ideal para escalar os criativos vencedores.`);
  else if (avgCPL > 30) insights.push(`💡 CPL médio em R$ ${fmt(avgCPL)}. Teste variações do criativo #1 com ângulos diferentes — mesmo formato, headline diferente.`);
  if (avgCTR > 2) insights.push(`🎯 CTR médio de ${avgCTR.toFixed(2)}% acima da média do mercado (1-2%). Os criativos estão chamando atenção — foco agora é otimizar a landing page.`);
  if (insights.length === 0) insights.push('📊 Criativos dentro do esperado para o período. Continue testando novos ângulos e monitore a frequência.');
  return insights;
}

function FilterDropdown({ value, options, onChange, dark }: {
  value: string; options: { label: string; value: string }[]; onChange: (v: string) => void; dark: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 180 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const sel = options.find(o => o.value === value);
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuWidth = 180;
      let left = r.right - menuWidth;
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
      setPos({ top: r.bottom + 6, left, width: menuWidth });
    }
    setOpen(v => !v);
  }
  return (
    <div style={{ position: 'relative' }}>
      <button ref={btnRef} onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, background: dark ? '#111113' : '#fff', color: dark ? '#d4d4d8' : '#374151', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
        {sel?.label}<ChevronDown style={{ width: '14px', height: '14px', transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
      </button>
      {open && (<>
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`, borderRadius: '10px', padding: '4px', zIndex: 9999, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)' }}>
          {options.map(o => (<button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: 'none', background: value === o.value ? (dark ? 'rgba(255,255,255,0.08)' : '#eff6ff') : 'transparent', color: value === o.value ? (dark ? '#60a5fa' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'), fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{o.label}</button>))}
        </div>
      </>)}
    </div>
  );
}

function Thumbnail({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const colors = ['#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#f59e0b', '#ec4899'];
  const color = colors[name.charCodeAt(0) % colors.length];
  if (!url || err) return <div style={{ width: size, height: size, borderRadius: '8px', background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size > 40 ? '14px' : '10px', fontWeight: 700, color, flexShrink: 0 }}>{initials}</div>;
  return <img src={url} alt={name} onError={() => setErr(true)} style={{ width: size, height: size, borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(0,0,0,0.08)' }} />;
}

function ScoreBadge({ rank }: { rank: number }) {
  const labels: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
  return <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: rank === 1 ? '#fef3c7' : rank === 2 ? '#f3f4f6' : rank === 3 ? '#fff7ed' : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: rank <= 3 ? '14px' : '11px', fontWeight: 700, color: '#374151', flexShrink: 0 }}>{labels[rank] || `#${rank}`}</div>;
}

export default function CriativosPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const dark = theme === 'dark';
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('today');
  const [sortBy, setSortBy] = useState<'leads' | 'cpl' | 'ctr' | 'spend'>('leads');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);

  const load = async () => { if (!metaToken || !metaAccount) { setLoading(false); setError(true); return; } setLoading(true); setError(false); const data = await fetchCreatives(datePreset, metaToken, metaAccount); if (!data.length) setError(true); setCreatives(data); setLoading(false); };
  useEffect(() => { if (!metaReady) return; load(); }, [datePreset, metaReady, metaToken, metaAccount]); // eslint-disable-line

  const totalSpend = creatives.reduce((s, c) => s + c.spend, 0);
  const totalLeads = creatives.reduce((s, c) => s + c.leads, 0);
  const avgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCTR = creatives.length > 0 ? creatives.reduce((s, c) => s + c.ctr, 0) / creatives.length : 0;

  const top5 = useMemo(() => [...creatives].filter(c => c.leads > 0 || c.spend > 0).slice(0, 5), [creatives]);
  const analysis = useMemo(() => generateAnalysis(top5, avgCPL, avgCTR), [top5, avgCPL, avgCTR]);

  const sorted = useMemo(() => [...creatives].sort((a, b) => {
    if (sortBy === 'leads') return b.leads - a.leads;
    if (sortBy === 'cpl') return (a.cpl || 999) - (b.cpl || 999);
    if (sortBy === 'ctr') return b.ctr - a.ctr;
    return b.spend - a.spend;
  }).slice(0, 5), [creatives, sortBy]);

  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#ffffff';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#71717a' : '#6b7280';
  const txtLow = dark ? '#52525b' : '#9ca3af';
  const divCls = dark ? '#1e1e22' : '#f3f4f6';
  const pad = isMobile ? '16px' : '32px';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: pad, background: bg, minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>Criativos</h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '4px' }}>Top 5 · análise automática · Meta Ads</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark} />
            <button onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
              <RefreshCw style={{ width: '14px', height: '14px', animation: loading ? 'spin 1s linear infinite' : '' }} />
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: isMobile ? '10px' : '14px', marginBottom: '20px' }}>
          {[
            { label: 'Gasto Total', value: loading ? '…' : `R$ ${fmt(totalSpend)}`, icon: DollarSign, color: '#10b981', bgC: dark ? 'rgba(16,185,129,0.12)' : '#ecfdf5' },
            { label: 'Leads Gerados', value: loading ? '…' : String(totalLeads), icon: Users, color: '#3b82f6', bgC: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
            { label: 'CPL Médio', value: loading ? '…' : (avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'), icon: TrendingUp, color: '#f97316', bgC: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed' },
            { label: 'CTR Médio', value: loading ? '…' : `${avgCTR.toFixed(2)}%`, icon: MousePointer, color: '#8b5cf6', bgC: dark ? 'rgba(139,92,246,0.12)' : '#f5f3ff' },
          ].map((c, i) => (
            <div key={i} style={{ background: cardBg, borderRadius: '14px', padding: isMobile ? '14px' : '20px', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: txtMid }}>{c.label}</span>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: c.bgC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <c.icon style={{ width: '14px', height: '14px', color: c.color }} />
                </div>
              </div>
              <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: txtHi, letterSpacing: '-0.03em', margin: 0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Top 5 Criativos */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: dark ? 'rgba(251,191,36,0.15)' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy style={{ width: '15px', height: '15px', color: '#f59e0b' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txtHi }}>Top 5 Criativos</h3>
                <p style={{ margin: 0, fontSize: '11.5px', color: txtMid }}>Ordenar por:</p>
              </div>
            </div>
            {/* Sort buttons */}
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {[{ key: 'leads', label: 'Leads' }, { key: 'cpl', label: 'CPL' }, { key: 'ctr', label: 'CTR' }, { key: 'spend', label: 'Gasto' }].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key as any)} style={{ padding: '5px 10px', borderRadius: '8px', border: 'none', fontSize: '12px', fontWeight: sortBy === s.key ? 600 : 400, background: sortBy === s.key ? '#2563eb' : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), color: sortBy === s.key ? '#fff' : txtMid, cursor: 'pointer', fontFamily: 'inherit' }}>{s.label}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...Array(5)].map((_, i) => <div key={i} style={{ height: '72px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: txtMid, fontSize: '13px' }}>Nenhum criativo com dados no período</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sorted.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', background: i === 0 ? (dark ? 'rgba(251,191,36,0.08)' : '#fffbeb') : (dark ? 'rgba(255,255,255,0.02)' : '#fafafa'), border: `1px solid ${i === 0 ? (dark ? 'rgba(251,191,36,0.2)' : '#fde68a') : (dark ? '#1e1e22' : '#f3f4f6')}` }}>
                  <ScoreBadge rank={i + 1} />
                  <Thumbnail url={c.thumbnail_url} name={c.name} size={isMobile ? 40 : 48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: txtMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name}</p>
                    {/* Mobile: métricas empilhadas */}
                    {isMobile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '5px' }}>
                        <span style={{ fontSize: '11.5px', color: c.leads > 0 ? '#10b981' : txtLow, fontWeight: 600 }}>{c.leads} leads</span>
                        <span style={{ fontSize: '11px', color: txtLow }}>R$ {fmt(c.spend)} · CPL: {c.cpl > 0 ? `R$ ${fmt(c.cpl)}` : '—'}</span>
                        <span style={{ fontSize: '11px', color: txtLow }}>CTR: {c.ctr.toFixed(2)}% · Freq: {c.frequency > 0 ? c.frequency.toFixed(1) : '—'}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11.5px', color: c.leads > 0 ? '#10b981' : txtLow, fontWeight: c.leads > 0 ? 600 : 400 }}>{c.leads} leads</span>
                        <span style={{ fontSize: '11px', color: txtLow }}>R$ {fmt(c.spend)}</span>
                        {c.cpl > 0 && <span style={{ fontSize: '11px', color: txtLow }}>CPL: R$ {fmt(c.cpl)}</span>}
                        <span style={{ fontSize: '11px', color: txtLow }}>CTR: {c.ctr.toFixed(2)}%</span>
                        {c.frequency > 0 && <span style={{ fontSize: '11px', color: c.frequency > 3 ? '#f97316' : txtLow }}>Freq: {c.frequency.toFixed(1)}</span>}
                      </div>
                    )}
                  </div>
                  {!isMobile && (
                    <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 500, flexShrink: 0, background: c.status === 'ACTIVE' ? (dark ? 'rgba(16,185,129,0.15)' : '#d1fae5') : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'), color: c.status === 'ACTIVE' ? '#10b981' : txtMid }}>
                      {c.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Análise + Sugestões */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: isMobile ? '16px' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: dark ? 'rgba(139,92,246,0.15)' : '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb style={{ width: '15px', height: '15px', color: '#8b5cf6' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txtHi }}>Análise & Sugestões</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: txtMid }}>Baseado nos top 5 do período</p>
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
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </AppLayout>
  );
}
