import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { RefreshCw, ChevronDown, TrendingUp, Users, DollarSign, Activity, ShoppingBag } from 'lucide-react';

// ─── tipos ──────────────────────────────────────────────────────────────────

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

// ─── fetch + agrupamento ─────────────────────────────────────────────────────

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
          // frequência: média ponderada acumulada (simplificada)
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

// ─── revendedoras ────────────────────────────────────────────────────────────

function getGroupRevs(g: CreativeGroup, leads: any[]): { count: number; cpr: number } {
  const matched = leads.filter((l: any) => {
    const utmRaw = (l.utm_campaign || '').trim();
    const utm = utmRaw.toLowerCase().split('|')[0].trim();
    if (!utm || utm.length < 3) return false;

    return g.campaigns.some((campName) => {
      const cn = campName.toLowerCase().split('|')[0].trim();
      if (!cn || cn.length < 3) return false;

      // Match exato
      if (utm === cn) return true;

      // Match por ID numérico no UTM bruto
      if (g.campaign_ids.some((id) => utmRaw.includes(id))) return true;

      // Match parcial — primeiros 25 chars
      const cnSlice = cn.slice(0, 25);
      if (utm.includes(cnSlice) || cnSlice.includes(utm.slice(0, 25))) return true;

      return false;
    });
  });
  const revs = matched.filter((l: any) => Number(l.status) === 3);
  return {
    count: revs.length,
    cpr: revs.length > 0 && g.spend > 0 ? Math.round((g.spend / revs.length) * 100) / 100 : 0,
  };
}

// ─── score de fadiga ─────────────────────────────────────────────────────────

function getFadigaScore(g: CreativeGroup): {
  label: string;
  color: string;
  bg: string;
  pct: number;
  desc: string;
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
    return {
      label: '🔴 Trocar',
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      pct: score,
      desc: 'Criativo saturado — troque o vídeo ou pause',
    };
  if (score >= 30)
    return {
      label: '🟡 Atenção',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      pct: score,
      desc: 'Começando a saturar — monitore nos próximos dias',
    };
  return {
    label: '🟢 Saudável',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.1)',
    pct: score,
    desc: 'Criativo com boa performance — pode continuar escalando',
  };
}

// ─── análise automática ───────────────────────────────────────────────────────

function generateAnalysis(
  top5: CreativeGroup[],
  avgCPL: number,
  avgCTR: number,
): string[] {
  if (!top5.length)
    return [
      '📊 Aguardando dados suficientes para gerar insights automáticos. A análise fica disponível após 3+ dias de campanha ativa.',
    ];
  const insights: string[] = [];
  const best = top5[0];
  if (best.leads > 0)
    insights.push(
      `🏆 "${best.ad_names[0].slice(0, 40)}" é o criativo mais eficiente com ${best.leads} leads e CPL de R$ ${fmt(best.cpl)}. Priorize mais verba neste criativo.`,
    );
  const highFreq = top5.filter((c) => c.frequency > 3);
  if (highFreq.length > 0)
    insights.push(
      `⚠️ "${highFreq[0].ad_names[0].slice(0, 35)}" com frequência ${highFreq[0].frequency.toFixed(1)} — público saturando. Considere expandir a segmentação ou renovar o criativo.`,
    );
  const lowCTR = top5.filter((c) => c.ctr < 1 && c.spend > 20);
  if (lowCTR.length > 0)
    insights.push(
      `📉 "${lowCTR[0].ad_names[0].slice(0, 35)}" com CTR de ${lowCTR[0].ctr.toFixed(2)}% — hook fraco. Teste uma abertura mais direta nos primeiros 3 segundos.`,
    );
  const paused = top5.filter((c) => c.status === 'PAUSED' && c.leads > 0);
  if (paused.length > 0)
    insights.push(
      `⏸️ "${paused[0].ad_names[0].slice(0, 35)}" está pausado mas gerou ${paused[0].leads} leads. Vale testar reativar com orçamento controlado.`,
    );
  if (avgCPL > 0 && avgCPL < 15)
    insights.push(
      `✅ CPL médio de R$ ${fmt(avgCPL)} excelente. Momento ideal para escalar os criativos vencedores.`,
    );
  else if (avgCPL > 30)
    insights.push(
      `💡 CPL médio em R$ ${fmt(avgCPL)}. Teste variações do criativo #1 com ângulos diferentes — mesmo formato, headline diferente.`,
    );
  if (avgCTR > 2)
    insights.push(
      `🎯 CTR médio de ${avgCTR.toFixed(2)}% acima da média do mercado (1–2%). Os criativos estão chamando atenção — foco agora é otimizar a landing page.`,
    );
  if (insights.length === 0)
    insights.push(
      '📊 Criativos dentro do esperado para o período. Continue testando novos ângulos e monitore a frequência.',
    );
  return insights;
}

// ─── dropdown ─────────────────────────────────────────────────────────────────

function FilterDropdown({
  value,
  options,
  onChange,
  dark,
}: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  dark: boolean;
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
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 14px', borderRadius: '10px',
          border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
          background: dark ? '#111113' : '#fff',
          color: dark ? '#d4d4d8' : '#374151',
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {sel?.label}
        <ChevronDown
          style={{
            width: '14px', height: '14px',
            transform: open ? 'rotate(180deg)' : '',
            transition: 'transform 0.18s',
          }}
        />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
          <div
            style={{
              position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
              background: dark ? '#111113' : '#fff',
              border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
              borderRadius: '10px', padding: '4px', zIndex: 9999,
              boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)',
            }}
          >
            {options.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: '7px',
                  border: 'none',
                  background: value === o.value ? (dark ? 'rgba(255,255,255,0.08)' : '#eff6ff') : 'transparent',
                  color: value === o.value ? (dark ? '#60a5fa' : '#2563eb') : (dark ? '#a1a1aa' : '#374151'),
                  fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── card de criativo ─────────────────────────────────────────────────────────

function CreativeCard({
  g,
  rank,
  leads,
  dark,
  border,
  cardBg,
  txtHi,
  txtMid,
  avgCPL,
}: {
  g: CreativeGroup;
  rank: number;
  leads: any[];
  dark: boolean;
  border: string;
  cardBg: string;
  txtHi: string;
  txtMid: string;
  avgCPL: number;
}) {
  const fadiga = getFadigaScore(g);
  const revs = getGroupRevs(g, leads);

  return (
    <div
      style={{
        background: cardBg,
        borderRadius: '16px',
        border: `1px solid ${rank === 1 ? (dark ? 'rgba(251,191,36,0.35)' : '#fde68a') : border}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: rank === 1 ? (dark ? '0 0 0 1px rgba(251,191,36,0.15)' : '0 4px 20px rgba(245,158,11,0.08)') : 'none',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '4/5',
          minHeight: '220px',
          background: dark ? '#1a1a1e' : '#f3f4f6',
          overflow: 'hidden',
        }}
      >
        {g.thumbnail_url ? (
          <img
            src={g.thumbnail_url}
            alt={g.ad_names[0]}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '32px' }}>🎬</span>
          </div>
        )}

        {/* rank */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '6px' }}>
          {rank <= 3 && (
            <span style={{
              padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
              background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)',
              letterSpacing: '0.01em',
            }}>
              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'} #{rank}
            </span>
          )}
          <span style={{
            padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
            background: g.status === 'ACTIVE' ? 'rgba(16,185,129,0.88)' : 'rgba(0,0,0,0.5)',
            color: '#fff', backdropFilter: 'blur(4px)',
          }}>
            {g.status === 'ACTIVE' ? '● Ativo' : '○ Pausado'}
          </span>
        </div>

        {/* campanhas */}
        {g.campaigns.length > 1 && (
          <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
            <span style={{
              padding: '3px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)',
            }}>
              {g.campaigns.length} campanhas
            </span>
          </div>
        )}

        {/* fadiga badge na thumbnail */}
        <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
          <span style={{
            padding: '3px 9px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
            background: fadiga.color, color: '#fff',
          }}>
            {fadiga.label}
          </span>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Nome */}
        <div>
          <p style={{
            margin: 0, fontSize: '13px', fontWeight: 700, color: txtHi,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {g.ad_names[0]}
            {g.ad_names.length > 1 && (
              <span style={{ fontSize: '11px', color: txtMid, fontWeight: 400 }}>
                {' '}+{g.ad_names.length - 1} nome{g.ad_names.length > 2 ? 's' : ''}
              </span>
            )}
          </p>
          <p style={{
            margin: '2px 0 0', fontSize: '11px', color: txtMid,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {g.campaigns.slice(0, 2).join(' · ')}
            {g.campaigns.length > 2 && ` +${g.campaigns.length - 2}`}
          </p>
        </div>

        {/* Métricas 2x2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {[
            { label: 'Leads', value: String(g.leads), color: '#10b981' },
            { label: 'CPL', value: g.cpl > 0 ? `R$ ${fmt(g.cpl)}` : '—', color: '#3b82f6' },
            { label: 'Gasto', value: `R$ ${fmt(g.spend)}`, color: txtHi },
            {
              label: 'CTR',
              value: `${g.ctr.toFixed(2)}%`,
              color: g.ctr > 3 ? '#10b981' : g.ctr < 1 ? '#ef4444' : txtHi,
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                padding: '8px 10px', borderRadius: '8px',
                background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
                border: `1px solid ${border}`,
              }}
            >
              <p style={{
                margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {m.label}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: m.color }}>
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Revendedoras */}
        {revs.count === 0 ? (
          <div style={{
            padding: '8px 12px', borderRadius: '8px',
            background: dark ? 'rgba(255,255,255,0.02)' : '#f9fafb',
            border: `1px dashed ${border}`, textAlign: 'center',
          }}>
            <span style={{ fontSize: '12px', color: txtMid }}>Sem revendedoras identificadas</span>
          </div>
        ) : (
          <div style={{
            padding: '10px 12px', borderRadius: '10px',
            background: dark ? 'rgba(168,85,247,0.1)' : '#faf5ff',
            border: '1px solid rgba(168,85,247,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <p style={{
                margin: 0, fontSize: '10px', fontWeight: 700, color: '#8b5cf6',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                Revendedoras
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 800, color: '#a855f7' }}>
                {revs.count}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '10px', color: '#8b5cf6', fontWeight: 600 }}>CPR</p>
              <p style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: 700, color: '#a855f7' }}>
                R$ {fmt(revs.cpr)}
              </p>
            </div>
          </div>
        )}

        {/* Barra de fadiga */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{
              fontSize: '10px', color: txtMid, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Fadiga
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: fadiga.color }}>
              {fadiga.label}
            </span>
          </div>
          <div style={{
            height: '4px', borderRadius: '99px',
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${fadiga.pct}%`, borderRadius: '99px',
              background: fadiga.color, transition: 'width 1s ease',
            }} />
          </div>
          {g.frequency > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: txtMid, lineHeight: 1.5 }}>
              Freq. {g.frequency.toFixed(1)} · {fadiga.desc}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── página principal ─────────────────────────────────────────────────────────

export default function CriativosPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const dark = theme === 'dark';
  const [groups, setGroups] = useState<CreativeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('today');
  const [sortBy, setSortBy] = useState<SortKey>('leads');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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
  const totalRevs = useMemo(
    () => groups.reduce((s, g) => s + getGroupRevs(g, leads as any[]).count, 0),
    [groups, leads],
  );

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
      g2.sort((a, b) => getGroupRevs(b, leads as any[]).count - getGroupRevs(a, leads as any[]).count);
    else if (sortBy === 'fadiga')
      g2.sort((a, b) => getFadigaScore(b).pct - getFadigaScore(a).pct);
    return g2.slice(0, 10);
  }, [groups, sortBy, leads]);

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
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: '20px', flexWrap: 'wrap', gap: '10px',
        }}>
          <div>
            <h1 style={{
              fontSize: isMobile ? '20px' : '24px', fontWeight: 700,
              color: txtHi, letterSpacing: '-0.03em', margin: 0,
            }}>
              Criativos
            </h1>
            <p style={{ fontSize: '13px', color: txtMid, marginTop: '4px' }}>
              Agrupado por vídeo/imagem · análise automática · Meta Ads
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark} />
            <button
              onClick={load}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '10px',
                border: `1px solid ${border}`, background: cardBg, color: txtMid,
                fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <RefreshCw style={{ width: '14px', height: '14px', animation: loading ? 'spin 1s linear infinite' : '' }} />
              {loading ? 'Carregando…' : 'Atualizar'}
            </button>
          </div>
        </div>

        {/* Metric Cards — 5 cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
          gap: isMobile ? '8px' : '12px',
          marginBottom: '20px',
        }}>
          {[
            { label: 'Gasto Total', value: loading ? '…' : `R$ ${fmt(totalSpend)}`, icon: DollarSign, color: '#10b981', bgC: dark ? 'rgba(16,185,129,0.12)' : '#ecfdf5' },
            { label: 'Leads Gerados', value: loading ? '…' : String(totalLeads), icon: Users, color: '#3b82f6', bgC: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' },
            { label: 'CPL Médio', value: loading ? '…' : (avgCPL > 0 ? `R$ ${fmt(avgCPL)}` : '—'), icon: TrendingUp, color: '#f97316', bgC: dark ? 'rgba(249,115,22,0.12)' : '#fff7ed' },
            { label: 'Freq. Média', value: loading ? '…' : avgFrequency.toFixed(1), icon: Activity, color: '#8b5cf6', bgC: dark ? 'rgba(139,92,246,0.12)' : '#f5f3ff' },
            { label: 'Revendedoras', value: loading ? '…' : String(totalRevs), icon: ShoppingBag, color: '#a855f7', bgC: dark ? 'rgba(168,85,247,0.12)' : '#faf5ff' },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                background: cardBg, borderRadius: '14px',
                padding: isMobile ? '12px' : '18px',
                border: `1px solid ${border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: txtMid, fontWeight: 600 }}>{c.label}</span>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  background: c.bgC, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <c.icon style={{ width: '13px', height: '13px', color: c.color }} />
                </div>
              </div>
              <p style={{
                fontSize: isMobile ? '18px' : '22px', fontWeight: 700,
                color: txtHi, letterSpacing: '-0.03em', margin: 0,
              }}>
                {c.value}
              </p>
            </div>
          ))}
        </div>

        {/* Ordenação */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          marginBottom: '16px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '12px', color: txtMid, fontWeight: 500, marginRight: '2px' }}>
            Ordenar por:
          </span>
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              style={{
                padding: '5px 12px', borderRadius: '8px', border: 'none',
                fontSize: '12px', fontWeight: sortBy === s.key ? 600 : 400,
                background: sortBy === s.key ? '#2563eb' : (dark ? 'rgba(255,255,255,0.06)' : '#f3f4f6'),
                color: sortBy === s.key ? '#fff' : txtMid,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
            >
              {s.label}
            </button>
          ))}
          {!loading && groups.length > 0 && (
            <span style={{ fontSize: '11px', color: txtMid, marginLeft: 'auto' }}>
              {groups.length} criativo{groups.length !== 1 ? 's' : ''} agrupado{groups.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
            gap: '16px', marginBottom: '20px',
          }}>
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: '16px', overflow: 'hidden',
                  background: cardBg, border: `1px solid ${border}`,
                }}
              >
                <div style={{
                  aspectRatio: '4/5',
                  minHeight: '220px',
                  background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ height: '14px', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[...Array(4)].map((_, j) => (
                      <div key={j} style={{ height: '52px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error || sorted.length === 0 ? (
          <div style={{
            background: cardBg, borderRadius: '16px', border: `1px solid ${border}`,
            padding: '48px 24px', textAlign: 'center', marginBottom: '20px',
          }}>
            <p style={{ fontSize: '36px', margin: '0 0 12px' }}>📊</p>
            <p style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: '0 0 6px' }}>
              Aguardando dados suficientes
            </p>
            <p style={{ fontSize: '12px', color: txtMid, margin: 0, lineHeight: 1.6 }}>
              A análise fica disponível após 3+ dias de campanha ativa.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : sorted.length >= 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
            gap: '16px', marginBottom: '20px',
            alignItems: 'start',
          }}>
            {sorted.map((g, i) => (
              <CreativeCard
                key={g.creative_id + i}
                g={g}
                rank={i + 1}
                leads={leads as any[]}
                dark={dark}
                border={border}
                cardBg={cardBg}
                txtHi={txtHi}
                txtMid={txtMid}
                avgCPL={avgCPL}
              />
            ))}
          </div>
        )}

        {/* Análise & Sugestões */}
        <div style={{
          background: cardBg, borderRadius: '16px',
          border: `1px solid ${border}`, padding: isMobile ? '16px' : '24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: dark ? 'rgba(139,92,246,0.15)' : '#f5f3ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px',
            }}>
              💡
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: txtHi }}>Análise & Sugestões</h3>
              <p style={{ margin: 0, fontSize: '11.5px', color: txtMid }}>Baseado nos criativos do período</p>
            </div>
          </div>
          {loading ? (
            <div style={{ color: txtMid, fontSize: '13px', textAlign: 'center', padding: '16px' }}>
              Analisando criativos…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {analysis.map((a, i) => (
                <div
                  key={i}
                  style={{
                    padding: '14px', borderRadius: '10px',
                    background: dark ? 'rgba(255,255,255,0.03)' : '#fafafa',
                    border: `1px solid ${dark ? '#1e1e22' : '#e5e7eb'}`,
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#8b5cf6', flexShrink: 0, marginTop: '5px',
                  }} />
                  <p style={{
                    margin: 0, fontSize: '13px',
                    color: dark ? '#d4d4d8' : '#374151', lineHeight: 1.6,
                  }}>
                    {a}
                  </p>
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
