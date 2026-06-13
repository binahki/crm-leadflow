import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { useTerminology } from '@/hooks/useTerminology';
import { toast } from 'sonner';
import { GitBranch, ChevronDown, Loader2 } from 'lucide-react';

// ── Canal normalization ───────────────────────────────────────────────────────

function normalizarCanal(utm_source: string | null): string {
  const s = (utm_source ?? '').trim();
  const sl = s.toLowerCase();
  if (['fb', 'facebook', 'instagram', 'ig', 'meta'].includes(sl)) return 'Meta Ads';
  if (sl.startsWith('indica')) return 'Indicação';
  if (['instagram_organico', 'ig_organico', 'organico', 'orgânico', 'google', 'direto', 'seo'].includes(sl)) return 'Orgânico';
  if (sl.includes('antigo') || sl.includes('retorno') || sl.includes('executiva') || sl.includes('legado')) return 'Retorno';
  if (!s || s.length > 25) return 'Outros';
  return 'Outros';
}

const CANAIS_FIXOS = ['Meta Ads', 'Indicação', 'Orgânico', 'Retorno', 'Outros'] as const;

const CANAL_META: Record<string, { emoji: string; cor: string; desc: string }> = {
  'Meta Ads':  { emoji: '📘', cor: '#2563eb', desc: 'Facebook & Instagram Ads' },
  'Indicação': { emoji: '👥', cor: '#10b981', desc: 'Indicações diretas' },
  'Orgânico':  { emoji: '🌿', cor: '#8b5cf6', desc: 'Google, Instagram, direto' },
  'Retorno':   { emoji: '🔄', cor: '#f59e0b', desc: 'Leads que retornaram' },
  'Outros':    { emoji: '🔍', cor: '#9ca3af', desc: 'Origem não identificada' },
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadRaw {
  utm_source: string | null;
}

interface RevRaw {
  utm_source: string | null;
}

type BadgeTipo = 'verde' | 'azul' | 'ambar' | 'neutro';

interface CanalData {
  canal: string;
  emoji: string;
  cor: string;
  desc: string;
  leads: number;
  revendedoras: number;
  taxaConversao: number;
  investimento: number;
  cpr: number | null;
  prevRevendedoras: number;
  tendencia: { pct: number; tipo: 'up' | 'down' | 'flat' | 'none'; novo: boolean };
  badge: { texto: string; tipo: BadgeTipo } | null;
}

interface InvestItem { canal: string; mes: string; valor: number; }

type Periodo = '7d' | '30d' | 'mes' | 'mes_ant' | '3m' | '6m';

// ── Date helpers (all use local Brasília date, not UTC) ───────────────────────

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayBR = () => localDate(new Date());

function subDays(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return localDate(d);
}
function mesAtualStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function mesAntStart(): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function mesAntEnd(): string {
  const d = new Date(); d.setDate(0); return localDate(d);
}
function subMonthsStart(n: number): string {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function toYYYYMM(s: string): string { return s.slice(0, 7); }

function getRange(p: Periodo): { ini: string; fim: string } {
  const t = todayBR();
  switch (p) {
    case '7d':      return { ini: subDays(6),        fim: t };
    case '30d':     return { ini: subDays(29),        fim: t };
    case 'mes':     return { ini: mesAtualStart(),    fim: t };
    case 'mes_ant': return { ini: mesAntStart(),      fim: mesAntEnd() };
    case '3m':      return { ini: subMonthsStart(3),  fim: t };
    case '6m':      return { ini: subMonthsStart(6),  fim: t };
    default:        return { ini: subDays(29),        fim: t };
  }
}

function getPrevRange(ini: string, fim: string): { ini: string; fim: string } {
  const iniMs = new Date(ini + 'T12:00:00').getTime();
  const fimMs = new Date(fim + 'T12:00:00').getTime();
  const duration = fimMs - iniMs;
  const prevFimMs = iniMs - 86400000;
  return {
    ini: new Date(prevFimMs - duration).toISOString().slice(0, 10),
    fim: new Date(prevFimMs).toISOString().slice(0, 10),
  };
}

function iterMeses(ini: string, fim: string): Set<string> {
  const meses = new Set<string>();
  let cur = toYYYYMM(ini);
  const end = toYYYYMM(fim);
  while (cur <= end) {
    meses.add(cur);
    const [y, m] = cur.split('-').map(Number);
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  return meses;
}

// ── Badge assignment ──────────────────────────────────────────────────────────

function atribuirBadges(canais: CanalData[]): CanalData[] {
  const result = canais.map(d => ({ ...d, badge: null as CanalData['badge'] }));
  const ok = new Set<string>();

  result.forEach(d => {
    if (d.leads >= 30 && d.taxaConversao < 5) {
      d.badge = { texto: '⚠️ Atenção', tipo: 'ambar' as BadgeTipo };
      ok.add(d.canal);
    }
  });

  const elegTaxa = result.filter(d => d.leads >= 5 && !ok.has(d.canal));
  if (elegTaxa.length) {
    const max = Math.max(...elegTaxa.map(d => d.taxaConversao));
    if (max > 0) {
      const best = elegTaxa.find(d => d.taxaConversao === max);
      if (best) { best.badge = { texto: '🏆 Melhor taxa', tipo: 'verde' as BadgeTipo }; ok.add(best.canal); }
    }
  }

  const elegCPR = result.filter(d => d.cpr != null && d.revendedoras > 0 && !ok.has(d.canal));
  if (elegCPR.length) {
    const min = Math.min(...elegCPR.map(d => d.cpr!));
    const best = elegCPR.find(d => d.cpr === min);
    if (best) { best.badge = { texto: '💡 Mais eficiente', tipo: 'azul' as BadgeTipo }; ok.add(best.canal); }
  }

  const semBadge = result.filter(d => !ok.has(d.canal) && d.leads > 0);
  if (semBadge.length) {
    const maxL = Math.max(...semBadge.map(d => d.leads));
    const top = semBadge.find(d => d.leads === maxL);
    if (top) top.badge = { texto: '🔥 Mais volume', tipo: 'neutro' as BadgeTipo };
  }

  return result;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODO_OPTIONS: { value: Periodo; label: string }[] = [
  { value: '7d',      label: 'Últimos 7 dias' },
  { value: '30d',     label: 'Últimos 30 dias' },
  { value: 'mes',     label: 'Este mês' },
  { value: 'mes_ant', label: 'Mês passado' },
  { value: '3m',      label: 'Últimos 3 meses' },
  { value: '6m',      label: 'Últimos 6 meses' },
];

const MEDALS = ['🥇', '🥈', '🥉'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Origens() {
  const { orgId } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const term = useTerminology();

  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const [leads, setLeads] = useState<LeadRaw[]>([]);
  const [revs, setRevs] = useState<RevRaw[]>([]);
  const [revsAnt, setRevsAnt] = useState<RevRaw[]>([]);
  const [investimentos, setInvestimentos] = useState<InvestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getRange(periodo), [periodo]);
  const prevRange = useMemo(() => getPrevRange(range.ini, range.fim), [range.ini, range.fim]);
  const mesesRange = useMemo(() => iterMeses(range.ini, range.fim), [range.ini, range.fim]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const INI  = range.ini     + 'T00:00:00-03:00';
      const FIM  = range.fim     + 'T23:59:59-03:00';
      const PINI = prevRange.ini + 'T00:00:00-03:00';
      const PFIM = prevRange.fim + 'T23:59:59-03:00';

      const [
        leadsRes,
        rev1Res, rev2Res, rev3Res,
        antRev1Res, antRev2Res, antRev3Res,
        invRes,
      ] = await Promise.all([
        // Total leads criados no período (para contagem por canal)
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId)
          .gte('created_at', INI).lte('created_at', FIM),

        // Revendedoras com status_aprovado_at no período
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .not('status_aprovado_at', 'is', null)
          .gte('status_aprovado_at', INI).lte('status_aprovado_at', FIM),

        // Revendedoras com ultimo_status_change (sem status_aprovado_at)
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .is('status_aprovado_at', null)
          .not('ultimo_status_change', 'is', null)
          .gte('ultimo_status_change', INI).lte('ultimo_status_change', FIM),

        // Revendedoras sem data de conversão — fallback created_at
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .is('status_aprovado_at', null).is('ultimo_status_change', null)
          .gte('created_at', INI).lte('created_at', FIM),

        // Período anterior — revendedoras por status_aprovado_at
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .not('status_aprovado_at', 'is', null)
          .gte('status_aprovado_at', PINI).lte('status_aprovado_at', PFIM),

        // Período anterior — revendedoras por ultimo_status_change
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .is('status_aprovado_at', null)
          .not('ultimo_status_change', 'is', null)
          .gte('ultimo_status_change', PINI).lte('ultimo_status_change', PFIM),

        // Período anterior — fallback created_at
        supabase.from('leads').select('utm_source')
          .eq('org_id', orgId).eq('status', 3)
          .is('status_aprovado_at', null).is('ultimo_status_change', null)
          .gte('created_at', PINI).lte('created_at', PFIM),

        // Investimentos (sem filtro de data — processado por mês em memória)
        (supabase as any).from('investimentos_trafego')
          .select('canal, mes, valor').eq('org_id', orgId),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (invRes.error) throw invRes.error;

      setLeads(leadsRes.data || []);
      setRevs([
        ...(rev1Res.data || []),
        ...(rev2Res.data || []),
        ...(rev3Res.data || []),
      ]);
      setRevsAnt([
        ...(antRev1Res.data || []),
        ...(antRev2Res.data || []),
        ...(antRev3Res.data || []),
      ]);
      setInvestimentos(invRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados de origens');
    } finally {
      setLoading(false);
    }
  }, [orgId, range.ini, range.fim, prevRange.ini, prevRange.fim]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Process ───────────────────────────────────────────────────────────────

  const prevMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const r of revsAnt) {
      const canal = normalizarCanal(r.utm_source);
      map[canal] = (map[canal] || 0) + 1;
    }
    return map;
  }, [revsAnt]);

  const canaisData = useMemo((): CanalData[] => {
    const map: Record<string, CanalData> = {};

    for (const canal of CANAIS_FIXOS) {
      const meta = CANAL_META[canal];
      map[canal] = {
        canal, emoji: meta.emoji, cor: meta.cor, desc: meta.desc,
        leads: 0, revendedoras: 0, taxaConversao: 0,
        investimento: 0, cpr: null, prevRevendedoras: 0,
        tendencia: { pct: 0, tipo: 'none', novo: false },
        badge: null,
      };
    }

    for (const lead of leads) {
      const canal = normalizarCanal(lead.utm_source);
      map[canal].leads++;
    }

    for (const rev of revs) {
      const canal = normalizarCanal(rev.utm_source);
      map[canal].revendedoras++;
    }

    for (const inv of investimentos) {
      if (mesesRange.has(inv.mes) && map[inv.canal]) {
        map[inv.canal].investimento += Number(inv.valor);
      }
    }

    for (const d of Object.values(map)) {
      d.taxaConversao = d.leads > 0 ? Math.round((d.revendedoras / d.leads) * 1000) / 10 : 0;
      if (d.investimento > 0 && d.revendedoras > 0) {
        d.cpr = Math.round((d.investimento / d.revendedoras) * 100) / 100;
      }
      const prevRev = prevMap[d.canal] ?? 0;
      d.prevRevendedoras = prevRev;
      if (d.leads > 0) {
        if (prevRev > 0) {
          const pct = Math.round(((d.revendedoras - prevRev) / prevRev) * 100);
          d.tendencia = { pct, tipo: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', novo: false };
        } else if (d.revendedoras > 0) {
          d.tendencia = { pct: 0, tipo: 'up', novo: true };
        }
      }
    }

    const arr = Object.values(map).sort((a, b) => {
      if (a.leads === 0 && b.leads > 0) return 1;
      if (b.leads === 0 && a.leads > 0) return -1;
      if (a.leads === 0 && b.leads === 0) {
        return CANAIS_FIXOS.indexOf(a.canal as typeof CANAIS_FIXOS[number]) - CANAIS_FIXOS.indexOf(b.canal as typeof CANAIS_FIXOS[number]);
      }
      return b.revendedoras - a.revendedoras || b.leads - a.leads;
    });

    return atribuirBadges(arr);
  }, [leads, revs, investimentos, mesesRange, prevMap]);

  // Summary derivations
  const totalLeads = leads.length;
  const totalRevendedoras = useMemo(() => leads.filter(l => l.status === 3).length, [leads]);
  const melhorCanal = useMemo(() => [...canaisData].filter(d => d.leads >= 5).sort((a, b) => b.taxaConversao - a.taxaConversao)[0] ?? null, [canaisData]);
  const menorCPR = useMemo(() => {
    const com = canaisData.filter(d => d.cpr != null && d.revendedoras > 0);
    return com.length > 0 ? [...com].sort((a, b) => a.cpr! - b.cpr!)[0] : null;
  }, [canaisData]);
  const gratuitoMelhor = useMemo(() =>
    canaisData.filter(d => d.canal !== 'Meta Ads' && d.revendedoras > 0).sort((a, b) => b.revendedoras - a.revendedoras)[0] ?? null,
  [canaisData]);
  const maxRev = useMemo(() => Math.max(...canaisData.map(d => d.revendedoras), 1), [canaisData]);
  const canaisComLeads = useMemo(() => canaisData.filter(d => d.leads > 0), [canaisData]);

  // ── Theme tokens ──────────────────────────────────────────────────────────

  const surface = isDark ? '#0f0f10'                  : '#f3f4f6';
  const card    = isDark ? '#19191d'                  : '#ffffff';
  const line    = isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(0,0,0,0.07)';
  const ink     = isDark ? '#f0f0f2'                  : '#0f0f11';
  const muted   = isDark ? 'rgba(240,240,242,0.42)'   : '#737380';
  const track   = isDark ? '#222228'                  : '#ebebed';
  const green   = isDark ? '#4ade80'                  : '#16a34a';

  const badgeSt = (tipo: BadgeTipo): React.CSSProperties => {
    const cfg: Record<BadgeTipo, { bg: string; color: string }> = {
      verde:  { bg: isDark ? 'rgba(16,185,129,0.15)'   : 'rgba(16,185,129,0.12)',  color: isDark ? '#34d399' : '#059669' },
      azul:   { bg: isDark ? 'rgba(37,99,235,0.18)'    : 'rgba(37,99,235,0.10)',   color: isDark ? '#60a5fa' : '#1d4ed8' },
      ambar:  { bg: isDark ? 'rgba(245,158,11,0.18)'   : 'rgba(245,158,11,0.12)',  color: isDark ? '#fbbf24' : '#b45309' },
      neutro: { bg: isDark ? 'rgba(148,163,184,0.12)'  : 'rgba(107,114,128,0.10)', color: isDark ? '#94a3b8' : '#52525b' },
    };
    const { bg, color } = cfg[tipo];
    return { background: bg, color, fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap' as const, flexShrink: 0 };
  };

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
  };

  const periodLabel = PERIODO_OPTIONS.find(o => o.value === periodo)?.label ?? '';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div
        style={{ background: surface, minHeight: '100vh' }}
        onClick={() => showPeriodMenu && setShowPeriodMenu(false)}
      >
        <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '28px 24px 80px' }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <GitBranch style={{ width: '17px', height: '17px', color: muted }} />
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: ink, letterSpacing: '-0.02em' }}>Origens</h1>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: muted }}>De onde vêm suas melhores {term.convertidoPlural}</p>
            </div>

            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setShowPeriodMenu(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '8px', border: `1px solid ${line}`, background: card, color: ink, fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {periodLabel}
                <ChevronDown style={{ width: '14px', height: '14px', color: muted, flexShrink: 0 }} />
              </button>
              {showPeriodMenu && (
                <div style={{ position: 'absolute', right: 0, top: '42px', zIndex: 200, background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '6px', minWidth: '190px', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)' }}>
                  {PERIODO_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => { setPeriodo(opt.value); setShowPeriodMenu(false); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: '6px', border: 'none', background: periodo === opt.value ? (isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0') : 'transparent', color: periodo === opt.value ? ink : muted, fontSize: '13px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: periodo === opt.value ? 600 : 400 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Loading ──────────────────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '100px 0' }}>
              <Loader2 style={{ width: '22px', height: '22px', color: muted, animation: '_spin 0.8s linear infinite' }} />
            </div>

          ) : (
            <>
              {/* ── 4 summary cards ──────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '28px' }}>

                <div style={{ background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: ink, lineHeight: 1, letterSpacing: '-0.025em' }}>
                    {totalLeads.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ ...lbl, marginTop: '7px' }}>Leads totais</div>
                </div>

                <div style={{ background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '16px 20px' }}>
                  <div style={{ fontSize: '26px', fontWeight: 700, color: '#10b981', lineHeight: 1, letterSpacing: '-0.025em' }}>
                    {totalRevendedoras.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ ...lbl, marginTop: '7px' }}>{term.convertidoPlural}</div>
                  <div style={{ fontSize: '11px', color: muted, marginTop: '5px' }}>
                    Leads deste período com status convertido
                  </div>
                </div>

                <div style={{ background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '16px 20px' }}>
                  {melhorCanal ? (
                    <>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: ink, lineHeight: 1.2 }}>
                        {melhorCanal.emoji} {melhorCanal.canal}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#10b981', marginTop: '3px' }}>
                        {melhorCanal.taxaConversao}% conversão
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '20px', color: muted, lineHeight: 1 }}>—</div>
                  )}
                  <div style={{ ...lbl, marginTop: '8px' }}>Melhor origem</div>
                </div>

                {/* Menor custo/rev. — mostra CPR se existir, senão canal gratuito com mais conversões */}
                <div style={{ background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '16px 20px' }}>
                  {menorCPR ? (
                    <>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: ink, lineHeight: 1, letterSpacing: '-0.02em' }}>
                        R$ {menorCPR.cpr!.toFixed(0)}
                      </div>
                      <div style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>
                        {menorCPR.emoji} {menorCPR.canal}
                      </div>
                    </>
                  ) : gratuitoMelhor ? (
                    <>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: green, lineHeight: 1 }}>
                        Gratuito
                      </div>
                      <div style={{ fontSize: '12px', color: muted, marginTop: '3px' }}>
                        {gratuitoMelhor.emoji} {gratuitoMelhor.canal} · {gratuitoMelhor.revendedoras} {term.convertidoPlural}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '20px', color: muted, lineHeight: 1 }}>—</div>
                  )}
                  <div style={{ ...lbl, marginTop: '8px' }}>Menor custo/rev.</div>
                </div>
              </div>

              {/* ── Ranking visual (só se >= 2 canais com leads) ─────────── */}
              {canaisComLeads.length >= 2 && (
                <div style={{ background: card, borderRadius: '12px', border: `1px solid ${line}`, padding: '20px 24px', marginBottom: '24px' }}>
                  <h2 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: ink }}>Ranking de Origens</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {canaisComLeads.map((d, i) => (
                      <div key={d.canal} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '22px', flexShrink: 0, textAlign: 'center' }}>
                          {i < 3
                            ? <span style={{ fontSize: '16px', lineHeight: 1 }}>{MEDALS[i]}</span>
                            : <span style={{ fontSize: '11px', fontWeight: 700, color: muted }}>{i + 1}</span>}
                        </div>
                        <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{d.emoji}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: ink, width: '150px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.canal}
                        </span>
                        <div style={{ flex: 1, height: '8px', background: track, borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(d.revendedoras / maxRev) * 100}%`, background: d.cor, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', width: '30px', textAlign: 'right', flexShrink: 0 }}>
                          {d.revendedoras}
                        </span>
                        <span style={{ fontSize: '12px', color: muted, width: '42px', textAlign: 'right', flexShrink: 0 }}>
                          {d.taxaConversao}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Canal cards ──────────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                {canaisData.map(d => {
                  const isEmpty = d.leads === 0;
                  const { tipo: tTipo, pct: tPct, novo: tNovo } = d.tendencia;
                  const tendColor = tTipo === 'up' ? '#10b981' : tTipo === 'down' ? '#ef4444' : muted;
                  const participacao = totalLeads > 0 ? Math.round((d.leads / totalLeads) * 100) : 0;
                  const isGratuito = d.investimento === 0;
                  const cprColor = isGratuito ? green : ink;
                  const cprValue = isGratuito ? 'R$0' : d.cpr != null ? `R$${d.cpr.toFixed(0)}` : '—';
                  const cprLabel = isGratuito ? 'Gratuito' : 'Custo/Rev.';

                  let tendText: string | null = null;
                  if (!isEmpty) {
                    if (tNovo) {
                      tendText = '↑ Novo no período';
                    } else if (tTipo === 'up') {
                      tendText = `↑ +${Math.abs(tPct)}% vs período anterior`;
                    } else if (tTipo === 'down') {
                      tendText = `↓ ${tPct}% vs período anterior`;
                    } else if (tTipo === 'flat') {
                      tendText = '→ Estável vs período anterior';
                    }
                  }

                  return (
                    <div key={d.canal} style={{ background: card, borderRadius: '12px', border: `1px solid ${line}`, padding: '22px 24px', display: 'flex', flexDirection: 'column', opacity: isEmpty ? 0.45 : 1 }}>

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '18px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '20px', lineHeight: 1 }}>{d.emoji}</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: ink, letterSpacing: '-0.015em' }}>{d.canal}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: muted }}>{d.desc}</span>
                        </div>
                        {d.badge && <span style={badgeSt(d.badge.tipo)}>{d.badge.texto}</span>}
                      </div>

                      {isEmpty ? (
                        <div style={{ fontSize: '13px', color: muted, fontStyle: 'italic' }}>
                          Sem dados no período
                        </div>
                      ) : (
                        <>
                          {/* Metrics: Leads | Revendedoras | CAC */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '10px' }}>
                            <div>
                              <div style={{ fontSize: '28px', fontWeight: 700, color: ink, lineHeight: 1, letterSpacing: '-0.025em' }}>
                                {d.leads.toLocaleString('pt-BR')}
                              </div>
                              <div style={{ ...lbl, marginTop: '5px' }}>Leads</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '28px', fontWeight: 700, color: '#10b981', lineHeight: 1, letterSpacing: '-0.025em' }}>
                                {d.revendedoras}
                              </div>
                              <div style={{ ...lbl, marginTop: '5px' }}>{term.convertidoPlural}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '28px', fontWeight: 700, color: cprColor, lineHeight: 1, letterSpacing: '-0.025em' }}>
                                {cprValue}
                              </div>
                              <div style={{ ...lbl, marginTop: '5px' }}>{cprLabel}</div>
                            </div>
                          </div>

                          {/* Taxa + leads como linha discreta */}
                          <div style={{ fontSize: '12px', color: muted, marginBottom: '10px' }}>
                            {d.taxaConversao}% de conversão · {d.leads.toLocaleString('pt-BR')} leads
                          </div>

                          {/* Participação + Tendência */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: muted }}>
                              {participacao}% dos leads
                            </span>
                            {tendText && (
                              <span style={{ fontSize: '12px', fontWeight: 500, color: tendColor }}>
                                {tendText}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
