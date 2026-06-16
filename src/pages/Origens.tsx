import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { useTerminology } from '@/hooks/useTerminology';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { toast } from 'sonner';
import {
  GitBranch, ChevronDown, Loader2,
  Megaphone, Users, Leaf, RotateCcw, HelpCircle,
  AlertTriangle, Award, Zap, TrendingUp,
} from 'lucide-react';

// ── Date helpers — idênticos ao Dashboard ────────────────────────────────────
// created_at tem dois formatos: ISO ("2026-06-15T20:44:19Z") e BR ("10/04/2026 18:13")
// Filtrar no banco com .gte/.lte não funciona para datas BR — por isso filtramos no frontend

function parseLeadDate(str?: string | null): Date {
  if (!str || typeof str !== 'string') return new Date(0);
  try {
    if (str.includes('T')) { const d = new Date(str); return isNaN(d.getTime()) ? new Date(0) : d; }
    if (/^\d{4}-\d{2}-\d{2} /.test(str)) { const d = new Date(str.replace(' ', 'T').replace('+00:00', 'Z').replace('+00', 'Z')); return isNaN(d.getTime()) ? new Date(0) : d; }
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) { const [, d, mo, y, h = '0', mi = '0'] = m; const dt = new Date(`${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi.padStart(2, '0')}:00-03:00`); return isNaN(dt.getTime()) ? new Date(0) : dt; }
    const d = new Date(str); return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

function leadDateBR(str?: string | null): string {
  try {
    const d = parseLeadDate(str);
    if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return ''; }
}

function todayBR(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function subDays(dateStr: string, n: number): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  } catch { return dateStr; }
}

function isoToBR(s: string): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ── Canal normalization ───────────────────────────────────────────────────────

export const UTM_SOURCES_TRAFEGO = [
  'FB', 'fb', 'facebook', 'Facebook',
  'ig', 'IG', 'Instagram', 'instagram',
  'Tráfego Pago', 'trafego pago', 'Tráfego pago', 'TRÁFEGO PAGO',
  'Tráfego Antigo', 'trafego antigo',
  'meta', 'Meta',
];

function normalizarCanal(utm_source: string | null, utm_campaign?: string | null): string {
  const s = (utm_source ?? '').trim();
  const sl = s.toLowerCase();
  // Indicação tem prioridade sobre qualquer outro critério
  if (sl.startsWith('indica')) return 'Indicação';
  // Lista explícita de utm_sources de tráfego pago
  if (UTM_SOURCES_TRAFEGO.includes(s)) return 'Meta Ads';
  // Sem utm_source mas com campanha rastreada = tráfego pago
  if (!s && utm_campaign && utm_campaign.trim()) return 'Meta Ads';
  if (['instagram_organico', 'ig_organico', 'organico', 'orgânico', 'google', 'direto', 'seo'].includes(sl)) return 'Orgânico';
  if (sl.includes('retorno') || sl.includes('executiva') || sl.includes('legado')) return 'Retorno';
  if (!s || s.length > 25) return 'Outros';
  return 'Outros';
}

const CANAIS_FIXOS = ['Meta Ads', 'Indicação', 'Orgânico', 'Retorno', 'Outros'] as const;

const CANAL_META: Record<string, { cor: string; desc: string }> = {
  'Meta Ads':  { cor: '#3b82f6', desc: 'Facebook & Instagram Ads' },
  'Indicação': { cor: '#f97316', desc: 'Indicações diretas' },
  'Orgânico':  { cor: '#8b5cf6', desc: 'Google, Instagram, direto' },
  'Retorno':   { cor: '#f59e0b', desc: 'Leads que retornaram' },
  'Outros':    { cor: '#94a3b8', desc: 'Origem não identificada' },
};

type CanalIconKey = 'Meta Ads' | 'Indicação' | 'Orgânico' | 'Retorno' | 'Outros';
const CANAL_ICON: Record<CanalIconKey, React.FC<any>> = {
  'Meta Ads':  Megaphone,
  'Indicação': Users,
  'Orgânico':  Leaf,
  'Retorno':   RotateCcw,
  'Outros':    HelpCircle,
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadRaw {
  utm_source: string | null;
  utm_campaign: string | null;
  custo_indicacao: number | null;
  created_at: string;
  status: number | null;
  status_aprovado_at: string | null;
  ultimo_status_change: string | null;
}

interface InvestItem { canal: string; mes: string; valor: number; }

type BadgeTipo = 'verde' | 'azul' | 'ambar' | 'neutro';
type BadgeIcon = 'alert' | 'award' | 'zap' | 'trending';

interface CanalData {
  canal: string;
  cor: string;
  desc: string;
  leads: number;
  revendedoras: number;
  taxaConversao: number;
  investimento: number;
  cpr: number | null;
  prevRevendedoras: number;
  tendencia: { pct: number; tipo: 'up' | 'down' | 'flat' | 'none'; novo: boolean };
  badge: { texto: string; tipo: BadgeTipo; icon: BadgeIcon } | null;
}

type Periodo = 'today' | 'yesterday' | '7days' | '30days' | 'month' | 'custom';

// ── Range helpers ─────────────────────────────────────────────────────────────

function getRange(p: Periodo, customFrom?: string, customTo?: string): { ini: string; fim: string } {
  const t = todayBR();
  switch (p) {
    case 'today':     return { ini: t, fim: t };
    case 'yesterday': { const y = subDays(t, 1); return { ini: y, fim: y }; }
    case '7days':     return { ini: subDays(t, 6), fim: t };
    case '30days':    return { ini: subDays(t, 29), fim: t };
    case 'month':     return { ini: t.slice(0, 7) + '-01', fim: t };
    case 'custom':    return (customFrom && customTo) ? { ini: customFrom, fim: customTo } : { ini: subDays(t, 29), fim: t };
    default:          return { ini: subDays(t, 29), fim: t };
  }
}

function getPrevRange(ini: string, fim: string): { ini: string; fim: string } {
  const iniMs = new Date(ini + 'T12:00:00Z').getTime();
  const fimMs = new Date(fim + 'T12:00:00Z').getTime();
  const duration = fimMs - iniMs;
  const prevFimMs = iniMs - 86400000;
  return {
    ini: new Date(prevFimMs - duration).toISOString().slice(0, 10),
    fim: new Date(prevFimMs).toISOString().slice(0, 10),
  };
}

function toYYYYMM(s: string): string { return s.slice(0, 7); }

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
      d.badge = { texto: 'Atenção', tipo: 'ambar' as BadgeTipo, icon: 'alert' as BadgeIcon };
      ok.add(d.canal);
    }
  });

  const elegTaxa = result.filter(d => d.leads >= 5 && !ok.has(d.canal));
  if (elegTaxa.length) {
    const max = Math.max(...elegTaxa.map(d => d.taxaConversao));
    if (max > 0) {
      const best = elegTaxa.find(d => d.taxaConversao === max);
      if (best) { best.badge = { texto: 'Melhor taxa', tipo: 'verde' as BadgeTipo, icon: 'award' as BadgeIcon }; ok.add(best.canal); }
    }
  }

  const elegCPR = result.filter(d => d.cpr != null && d.revendedoras > 0 && !ok.has(d.canal));
  if (elegCPR.length) {
    const min = Math.min(...elegCPR.map(d => d.cpr!));
    const best = elegCPR.find(d => d.cpr === min);
    if (best) { best.badge = { texto: 'Mais eficiente', tipo: 'azul' as BadgeTipo, icon: 'zap' as BadgeIcon }; ok.add(best.canal); }
  }

  const semBadge = result.filter(d => !ok.has(d.canal) && d.leads > 0);
  if (semBadge.length) {
    const maxL = Math.max(...semBadge.map(d => d.leads));
    const top = semBadge.find(d => d.leads === maxL);
    if (top) top.badge = { texto: 'Mais volume', tipo: 'neutro' as BadgeTipo, icon: 'trending' as BadgeIcon };
  }

  return result;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODO_OPTIONS: { value: Periodo; label: string }[] = [
  { value: 'today',     label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7days',     label: '7 dias' },
  { value: '30days',    label: '30 dias' },
  { value: 'month',     label: 'Este mês' },
  { value: 'custom',    label: 'Personalizado' },
];

const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7c3e'];

const META_PRESET: Record<string, string> = {
  today: 'today', yesterday: 'yesterday', '7days': 'last_7d', '30days': 'last_30d', month: 'this_month',
};

function BadgeIconEl({ icon, size = 10 }: { icon: BadgeIcon; size?: number }) {
  const props = { width: size, height: size, style: { flexShrink: 0 } };
  if (icon === 'alert')  return <AlertTriangle {...props} />;
  if (icon === 'award')  return <Award {...props} />;
  if (icon === 'zap')    return <Zap {...props} />;
  return <TrendingUp {...props} />;
}

// ── Storage keys (shared with Dashboard) ─────────────────────────────────────
const STORAGE_KEY = 'dashboard_period';
const STORAGE_CUSTOM = 'dashboard_custom_range';

// ── Component ─────────────────────────────────────────────────────────────────

export default function Origens() {
  const { orgId } = useOrgId();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const term = useTerminology();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();

  const [periodo, setPeriodo] = useState<Periodo>('30days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);

  const [allLeads, setAllLeads] = useState<LeadRaw[]>([]);
  const [investimentos, setInvestimentos] = useState<InvestItem[]>([]);
  const [metaSpend, setMetaSpend] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getRange(periodo, customFrom, customTo), [periodo, customFrom, customTo]);
  const prevRange = useMemo(() => getPrevRange(range.ini, range.fim), [range.ini, range.fim]);
  const mesesRange = useMemo(() => iterMeses(range.ini, range.fim), [range.ini, range.fim]);

  // Sync filtro de período com Dashboard (lê localStorage ao montar)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPeriodo(saved as Periodo);
      const savedC = localStorage.getItem(STORAGE_CUSTOM);
      if (savedC) {
        const parsed = JSON.parse(savedC);
        if (parsed.from) setCustomFrom(parsed.from);
        if (parsed.to) setCustomTo(parsed.to);
      }
    } catch { }
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowPeriodMenu(false);
      if (customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Todos os leads sem filtro de data — created_at é texto misto (ISO + BR)
      // Filtramos no frontend via parseLeadDate para suportar ambos os formatos
      const leadsData: LeadRaw[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await (supabase as any)
          .from('leads')
          .select('utm_source, utm_campaign, custo_indicacao, created_at, status, status_aprovado_at, ultimo_status_change')
          .eq('org_id', orgId)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        leadsData.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const invRes = await (supabase as any)
        .from('investimentos_trafego')
        .select('canal, mes, valor')
        .eq('org_id', orgId);

      if (invRes.error) throw invRes.error;

      setAllLeads(leadsData);
      setInvestimentos(invRes.data || []);
    } catch {
      toast.error('Erro ao carregar dados de origens');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const fetchMetaSpend = useCallback(async () => {
    if (!metaToken || !metaAccount) { setMetaSpend(0); return; }
    try {
      const timeParam = periodo in META_PRESET
        ? `date_preset=${META_PRESET[periodo]}`
        : `time_range=%7B%22since%22%3A%22${range.ini}%22%2C%22until%22%3A%22${range.fim}%22%7D`;
      const res = await fetch(
        `https://graph.facebook.com/v18.0/act_${metaAccount}/insights?fields=spend&${timeParam}&access_token=${metaToken}`
      );
      const data = await res.json();
      setMetaSpend(parseFloat(data.data?.[0]?.spend || '0'));
    } catch {
      setMetaSpend(0);
    }
  }, [metaToken, metaAccount, periodo, range.ini, range.fim]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (metaReady) fetchMetaSpend(); }, [fetchMetaSpend, metaReady]);

  // ── Frontend filtering using parseLeadDate ─────────────────────────────────

  const leadsNoPeriodo = useMemo(() =>
    allLeads.filter(l => {
      const d = leadDateBR(l.created_at);
      return !!d && d >= range.ini && d <= range.fim;
    }),
  [allLeads, range]);

  // Revendedoras: status=3 com data de conversão no período
  // Prioridade: status_aprovado_at → ultimo_status_change → created_at
  const revsNoPeriodo = useMemo(() =>
    allLeads.filter(l => {
      if (Number(l.status) !== 3) return false;
      const dateRef = l.status_aprovado_at || l.ultimo_status_change || l.created_at;
      const d = leadDateBR(dateRef);
      return !!d && d >= range.ini && d <= range.fim;
    }),
  [allLeads, range]);

  const prevRevs = useMemo(() =>
    allLeads.filter(l => {
      if (Number(l.status) !== 3) return false;
      const dateRef = l.status_aprovado_at || l.ultimo_status_change || l.created_at;
      const d = leadDateBR(dateRef);
      return !!d && d >= prevRange.ini && d <= prevRange.fim;
    }),
  [allLeads, prevRange]);

  // ── Process ───────────────────────────────────────────────────────────────

  const prevMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    for (const r of prevRevs) {
      const canal = normalizarCanal(r.utm_source, r.utm_campaign);
      map[canal] = (map[canal] || 0) + 1;
    }
    return map;
  }, [prevRevs]);

  const canaisData = useMemo((): CanalData[] => {
    const map: Record<string, CanalData> = {};

    for (const canal of CANAIS_FIXOS) {
      const meta = CANAL_META[canal];
      map[canal] = {
        canal, cor: meta.cor, desc: meta.desc,
        leads: 0, revendedoras: 0, taxaConversao: 0,
        investimento: 0, cpr: null, prevRevendedoras: 0,
        tendencia: { pct: 0, tipo: 'none', novo: false },
        badge: null,
      };
    }

    for (const lead of leadsNoPeriodo) {
      const canal = normalizarCanal(lead.utm_source, lead.utm_campaign);
      map[canal].leads++;
      if (canal === 'Indicação' && lead.custo_indicacao && lead.status_aprovado_at != null) {
        map['Indicação'].investimento += lead.custo_indicacao;
      }
    }

    for (const rev of revsNoPeriodo) {
      const canal = normalizarCanal(rev.utm_source, rev.utm_campaign);
      map[canal].revendedoras++;
    }

    // Investimentos manuais para canais não calculados automaticamente
    for (const inv of investimentos) {
      if (mesesRange.has(inv.mes) && map[inv.canal] && inv.canal !== 'Meta Ads' && inv.canal !== 'Indicação') {
        map[inv.canal].investimento += Number(inv.valor);
      }
    }

    // Meta Ads: usa o gasto real da API (sobrescreve investimentos_trafego para este canal)
    if (metaSpend !== null && metaSpend > 0) {
      map['Meta Ads'].investimento = metaSpend;
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
  }, [leadsNoPeriodo, revsNoPeriodo, investimentos, mesesRange, prevMap, metaSpend]);

  // Merge Retorno + Outros → "Outros canais" para exibição (lógica interna preservada)
  const canaisDisplay = useMemo((): CanalData[] => {
    const retorno = canaisData.find(d => d.canal === 'Retorno');
    const outros  = canaisData.find(d => d.canal === 'Outros');
    const rest    = canaisData.filter(d => d.canal !== 'Retorno' && d.canal !== 'Outros');
    const leadsO  = (retorno?.leads ?? 0) + (outros?.leads ?? 0);
    const revsO   = (retorno?.revendedoras ?? 0) + (outros?.revendedoras ?? 0);
    const outrosCanais: CanalData = {
      canal: 'Outros canais',
      cor: '#94a3b8',
      desc: 'Retorno, sem origem e outros',
      leads: leadsO,
      revendedoras: revsO,
      taxaConversao: leadsO > 0 ? Math.round((revsO / leadsO) * 1000) / 10 : 0,
      investimento: 0,
      cpr: null,
      prevRevendedoras: (retorno?.prevRevendedoras ?? 0) + (outros?.prevRevendedoras ?? 0),
      tendencia: { pct: 0, tipo: 'none', novo: false },
      badge: null,
    };
    return [...rest, outrosCanais];
  }, [canaisData]);

  // Summary
  const totalLeads = leadsNoPeriodo.length;
  const totalRevendedoras = revsNoPeriodo.length;
  const totalInvestimento = useMemo(() => canaisData.reduce((sum, d) => sum + d.investimento, 0), [canaisData]);
  const totalCPR = totalRevendedoras > 0 && totalInvestimento > 0 ? totalInvestimento / totalRevendedoras : null;
  const maxRev = useMemo(() => Math.max(...canaisDisplay.map(d => d.revendedoras), 1), [canaisDisplay]);
  const canaisComLeads = useMemo(() => canaisDisplay.filter(d => d.leads > 0), [canaisDisplay]);

  // ── Period selection ──────────────────────────────────────────────────────

  function selectPeriod(value: Periodo) {
    if (value === 'custom') { setShowPeriodMenu(false); setShowCustom(true); return; }
    setPeriodo(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { }
    setShowPeriodMenu(false);
    setShowCustom(false);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setPeriodo('custom');
    try {
      localStorage.setItem(STORAGE_KEY, 'custom');
      localStorage.setItem(STORAGE_CUSTOM, JSON.stringify({ from: customFrom, to: customTo }));
    } catch { }
    setShowCustom(false);
  }

  const periodLabel = periodo === 'custom' && customFrom && customTo
    ? `${isoToBR(customFrom)} – ${isoToBR(customTo)}`
    : PERIODO_OPTIONS.find(o => o.value === periodo)?.label ?? '';

  // ── Theme tokens ──────────────────────────────────────────────────────────

  const surface = isDark ? '#0f0f10'                  : '#f3f4f6';
  const card    = isDark ? '#19191d'                  : '#ffffff';
  const line    = isDark ? 'rgba(255,255,255,0.07)'   : 'rgba(0,0,0,0.07)';
  const ink     = isDark ? '#f0f0f2'                  : '#0f0f11';
  const muted   = isDark ? 'rgba(240,240,242,0.42)'   : '#737380';
  const track   = isDark ? '#222228'                  : '#ebebed';
  const divLine = isDark ? 'rgba(255,255,255,0.06)'   : '#f3f4f6';
  const sep     = isDark ? 'rgba(255,255,255,0.10)'   : '#e2e8f0';

  const badgeSt = (tipo: BadgeTipo): React.CSSProperties => {
    const cfg: Record<BadgeTipo, { bg: string; color: string }> = {
      verde:  { bg: isDark ? 'rgba(16,185,129,0.15)'   : 'rgba(16,185,129,0.12)',  color: isDark ? '#34d399' : '#059669' },
      azul:   { bg: isDark ? 'rgba(37,99,235,0.18)'    : 'rgba(37,99,235,0.10)',   color: isDark ? '#60a5fa' : '#1d4ed8' },
      ambar:  { bg: isDark ? 'rgba(245,158,11,0.18)'   : 'rgba(245,158,11,0.12)',  color: isDark ? '#fbbf24' : '#b45309' },
      neutro: { bg: isDark ? 'rgba(148,163,184,0.12)'  : 'rgba(107,114,128,0.10)', color: isDark ? '#94a3b8' : '#52525b' },
    };
    const { bg, color } = cfg[tipo];
    return { background: bg, color, fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '999px', whiteSpace: 'nowrap' as const, flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' };
  };

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 600, color: muted,
    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
  };

  const inputSt: React.CSSProperties = {
    padding: '7px 10px', borderRadius: '8px', border: `1px solid ${line}`,
    background: isDark ? '#111113' : '#f9fafb', color: ink, fontSize: '13px',
    outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ background: surface, minHeight: '100vh' }}>
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

            {/* Period selector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div ref={dropRef} style={{ position: 'relative' }}>
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
                        onClick={() => selectPeriod(opt.value)}
                        style={{ display: 'block', width: '100%', padding: '8px 12px', borderRadius: '6px', border: 'none', background: periodo === opt.value ? (isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0') : 'transparent', color: periodo === opt.value ? ink : muted, fontSize: '13px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontWeight: periodo === opt.value ? 600 : 400 }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom date picker */}
              {showCustom && (
                <div ref={customRef} style={{ position: 'absolute', marginTop: '42px', right: '24px', zIndex: 201, background: card, border: `1px solid ${line}`, borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '240px', boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <div>
                    <label style={{ ...lbl, marginBottom: '6px' }}>De</label>
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={inputSt} />
                  </div>
                  <div>
                    <label style={{ ...lbl, marginBottom: '6px' }}>Até</label>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={inputSt} />
                  </div>
                  <button onClick={applyCustom} disabled={!customFrom || !customTo} style={{ padding: '9px', borderRadius: '8px', border: 'none', background: customFrom && customTo ? '#0044fd' : (isDark ? '#27272a' : '#e5e7eb'), color: customFrom && customTo ? '#fff' : muted, fontSize: '13px', fontWeight: 600, cursor: customFrom && customTo ? 'pointer' : 'default', fontFamily: 'inherit' }}>
                    Aplicar
                  </button>
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
              {/* ── 4 summary cards — limpos, sem border-top ────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
                {[
                  {
                    label: 'Valor Gasto',
                    value: totalInvestimento > 0
                      ? `R$ ${totalInvestimento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—',
                    color: totalInvestimento > 0 ? ink : muted,
                  },
                  {
                    label: 'Leads totais',
                    value: totalLeads.toLocaleString('pt-BR'),
                    color: ink,
                  },
                  {
                    label: term.convertidoPlural,
                    value: totalRevendedoras.toLocaleString('pt-BR'),
                    color: '#10b981',
                  },
                  {
                    label: `Custo por ${term.convertidoSingular}`,
                    value: totalCPR != null ? `R$ ${Math.round(totalCPR).toLocaleString('pt-BR')}` : '—',
                    color: totalCPR != null ? ink : muted,
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: card, border: `1px solid ${line}`, borderRadius: '10px', padding: '16px 20px', boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: muted, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: '8px' }}>{label}</div>
                    <div style={{ fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* ── Canal cards — 2 colunas, borda colorida, altura própria ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '28px', alignItems: 'start' }}>
                {canaisDisplay.map(d => {
                  const isEmpty = d.leads === 0;
                  const participacao = totalLeads > 0 ? Math.round((d.leads / totalLeads) * 100) : 0;

                  const cprDisplay = d.cpr != null
                    ? `R$ ${d.cpr.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '—';
                  const cprColor = d.cpr != null ? ink : (isDark ? 'rgba(255,255,255,0.20)' : '#d1d5db');

                  const metricLbl: React.CSSProperties = {
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.07em',
                    color: isDark ? 'rgba(255,255,255,0.30)' : '#9ca3af',
                    textTransform: 'uppercase' as const, marginTop: '5px',
                  };

                  const footerMuted = isDark ? 'rgba(255,255,255,0.28)' : '#9ca3af';
                  const secInk = isDark ? 'rgba(240,240,242,0.85)' : '#1e293b';
                  const Icon = CANAL_ICON[d.canal as CanalIconKey] ?? HelpCircle;

                  const gastoDisplay = d.investimento > 0
                    ? `R$ ${d.investimento.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '—';
                  const gastoColor = d.investimento > 0 ? secInk : (isDark ? 'rgba(255,255,255,0.20)' : '#d1d5db');

                  const convLine = isEmpty ? null : `${d.taxaConversao}% de conversão · ${participacao}% dos leads`;

                  return (
                    <div key={d.canal} style={{ background: card, borderRadius: '10px', border: `1px solid ${line}`, borderTop: `3px solid ${d.cor}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: isEmpty ? 0.35 : 1, boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }}>

                      {/* Header — limpo, sem badge */}
                      <div style={{ padding: '16px 20px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <Icon size={14} style={{ color: d.cor, flexShrink: 0 }} />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: ink, letterSpacing: '-0.015em' }}>{d.canal}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: muted, marginTop: '3px', paddingLeft: '21px' }}>{d.desc}</div>
                      </div>

                      {/* Métricas: Revendedoras | Custo/Rev com separador nítido */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${divLine}` }}>
                        <div style={{ padding: '16px 20px', borderRight: `1px solid ${sep}` }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981', lineHeight: 1, letterSpacing: '-0.03em' }}>
                            {isEmpty ? '—' : d.revendedoras}
                          </div>
                          <div style={metricLbl}>{term.convertidoPlural}</div>
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                          <div style={{ fontSize: '32px', fontWeight: 700, color: cprColor, lineHeight: 1, letterSpacing: '-0.03em' }}>
                            {isEmpty ? '—' : cprDisplay}
                          </div>
                          <div style={metricLbl}>Custo/{term.convertidoCurto}</div>
                        </div>
                      </div>

                      {/* Métricas secundárias: Leads | Gasto */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: `1px solid ${divLine}`, background: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' }}>
                        <div style={{ padding: '10px 20px', borderRight: `1px solid ${sep}` }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: isEmpty ? (isDark ? 'rgba(255,255,255,0.20)' : '#d1d5db') : secInk, lineHeight: 1, letterSpacing: '-0.01em' }}>
                            {isEmpty ? '—' : d.leads.toLocaleString('pt-BR')}
                          </div>
                          <div style={metricLbl}>Leads</div>
                        </div>
                        <div style={{ padding: '10px 20px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: isEmpty ? (isDark ? 'rgba(255,255,255,0.20)' : '#d1d5db') : gastoColor, lineHeight: 1, letterSpacing: '-0.01em' }}>
                            {isEmpty ? '—' : gastoDisplay}
                          </div>
                          <div style={metricLbl}>Gasto</div>
                        </div>
                      </div>

                      {/* Rodapé: conversão + badge */}
                      <div style={{ padding: '8px 20px 10px', borderTop: `1px solid ${divLine}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ fontSize: '11px', color: footerMuted }}>
                          {isEmpty ? 'Sem dados no período' : convLine}
                        </div>
                        {d.badge && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: d.cor, flexShrink: 0, letterSpacing: '0.02em' }}>
                            {d.badge.texto}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Ranking visual (só se >= 2 canais com leads) ─────────── */}
              {canaisComLeads.length >= 2 && (
                <div style={{ background: card, borderRadius: '12px', border: `1px solid ${line}`, padding: '20px 24px', boxShadow: isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <h2 style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: ink }}>Ranking de Origens</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {canaisComLeads.map((d, i) => {
                      const RankIcon = CANAL_ICON[d.canal as CanalIconKey] ?? HelpCircle;
                      const rankColor = i < 3 ? RANK_COLORS[i] : muted;
                      return (
                        <div key={d.canal} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '20px', flexShrink: 0, textAlign: 'center' as const, fontSize: '12px', fontWeight: 700, color: rankColor }}>
                            {i + 1}
                          </div>
                          <RankIcon size={14} style={{ color: d.cor, flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: ink, width: '140px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                            {d.canal}
                          </span>
                          <div style={{ flex: 1, height: '6px', background: track, borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${maxRev > 0 ? (d.revendedoras / maxRev) * 100 : 0}%`, background: d.cor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#10b981', width: '30px', textAlign: 'right' as const, flexShrink: 0 }}>
                            {d.revendedoras}
                          </span>
                          <span style={{ fontSize: '12px', color: muted, width: '42px', textAlign: 'right' as const, flexShrink: 0 }}>
                            {d.taxaConversao}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
