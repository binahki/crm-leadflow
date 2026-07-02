import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown, Download, MoreHorizontal, MessageCircle, Users, Check, X as XIcon, Calendar as CalendarIcon, User as UserIcon, Search } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsAppAccount } from '@/hooks/useWhatsAppAccount';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { useTerminology, useModeloNegocio } from '@/hooks/useTerminology';
import { useStatusConfig } from '@/hooks/useStatusConfig';
import { AppLayout } from '@/components/AppLayout';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { useAppStore, calcularFaixa } from '@/stores/appStore';
import { safeName, safeInitials } from '@/utils/safeName';
import { getAvatarColor, getAvatarTextColor } from '@/utils/avatarColor';
import { getMetaCache, setMetaCache, clearMetaCache } from '@/lib/metaCache';

interface Lead { id: string; nome: string; cidade: string | null; whatsapp: string | null; status: string | number | null; created_at: string; utm_source?: string | null; faixa?: string | null;[key: string]: unknown; }
interface Campaign { id: string; name: string; status: string; spend: number; leads_api: number; }
interface MetaMetrics { spend: number; leads: number; cpl: number; impressions: number; clicks: number; ctr: number; cplRealTime: number; }


const STORAGE_KEY = 'dashboard_period';
const STORAGE_CUSTOM = 'dashboard_custom_range';

const PERIOD_FILTERS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: '7days' },
  { label: '30 dias', value: '30days' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' },
];

const FUNNEL_CONFIG = [
  { stage: 'Em atendimento', statusId: 1, color: '#3b82f6' },
  { stage: 'Reunião', statusId: 2, color: '#8b5cf6' },
  { stage: 'Contrato/App', statusId: 5, color: '#f59e0b' },
  { stage: 'Aprovado', statusId: 3, color: '#10b981' },
];

const STATUS_LABEL: Record<number, string> = { 0: 'Em atendimento', 1: 'Em atendimento', 2: 'Reunião', 3: 'Aprovado', 4: 'Reprovado', 5: 'Contrato/App', 6: 'Sem Retorno' };
const STATUS_DARK_COLOR: Record<number, string> = { 0: '#93c5fd', 1: '#93c5fd', 2: '#c4b5fd', 3: '#6ee7b7', 4: '#fda4af', 5: '#fdba74', 6: '#a1a1aa' };
const STATUS_DARK_BG: Record<number, string> = { 0: 'rgba(59,130,246,0.20)', 1: 'rgba(59,130,246,0.20)', 2: 'rgba(139,92,246,0.28)', 3: 'rgba(16,185,129,0.20)', 4: 'rgba(244,63,94,0.20)', 5: 'rgba(249,115,22,0.20)', 6: 'rgba(113,113,122,0.20)' };
const STATUS_DARK_PILL_BORDER: Record<number, string> = { 0: 'rgba(59,130,246,0.22)', 1: 'rgba(59,130,246,0.22)', 2: 'rgba(139,92,246,0.30)', 3: 'rgba(16,185,129,0.22)', 4: 'rgba(244,63,94,0.22)', 5: 'rgba(249,115,22,0.22)', 6: 'rgba(113,113,122,0.22)' };
const STATUS_DARK_DOT: Record<number, string> = { 0: '#3b82f6', 1: '#3b82f6', 2: '#8b5cf6', 3: '#10b981', 4: '#f43f5e', 5: '#f97316', 6: '#71717a' };
const STATUS_LIGHT_BG: Record<number, string> = { 0: '#dbeafe', 1: '#dbeafe', 2: '#ede9fe', 3: '#d1fae5', 4: '#fee2e2', 5: '#ffedd5', 6: '#f4f4f5' };
const STATUS_LIGHT_TEXT: Record<number, string> = { 0: '#1d4ed8', 1: '#1d4ed8', 2: '#6d28d9', 3: '#065f46', 4: '#991b1b', 5: '#9a3412', 6: '#3f3f46' };
const STATUS_LIGHT_DOT: Record<number, string> = { 0: '#3b82f6', 1: '#3b82f6', 2: '#7e3beb', 3: '#10b981', 4: '#f43f5e', 5: '#f97316', 6: '#71717a' };
const STATUS_LIGHT_PILL_BORDER: Record<number, string> = { 0: 'rgba(29,78,216,0.12)', 1: 'rgba(29,78,216,0.12)', 2: 'rgba(109,40,217,0.15)', 3: 'rgba(6,95,70,0.12)', 4: 'rgba(153,27,27,0.12)', 5: 'rgba(154,52,18,0.12)', 6: 'rgba(63,63,70,0.12)' };
const STATUS_TIMESTAMP_FIELD: Record<number, string> = {
  0: 'status_atendimento_at',
  1: 'status_atendimento_at',
  2: 'status_reuniao_at',
  3: 'status_aprovado_at',
  5: 'status_contrato_at',
  6: 'status_sem_retorno_at',
};

// ── Utilitários de data — Brasília ────────────────────────────
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
    // UTC-3 fixo (Brasil), independente do fuso do browser
    const br = new Date(d.getTime() - 3 * 60 * 60 * 1000);
    return br.toISOString().slice(0, 10);
  } catch { return ''; }
}

function todayBR(): string {
  try {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return new Date().toISOString().slice(0, 10); }
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function subDays(dateStr: string, n: number): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d.getTime())) return dateStr;
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  } catch { return dateStr; }
}

function filterByPeriod(leads: Lead[], period: string, from?: string, to?: string): Lead[] {
  if (period === 'all') return leads;
  const today = todayBR();
  const ok = (l: Lead, a: string, b: string) => { const d = leadDateBR(l.created_at); return !!d && d >= a && d <= b; };
  switch (period) {
    case 'today': return leads.filter(l => ok(l, today, today));
    case 'yesterday': { const y = subDays(today, 1); return leads.filter(l => ok(l, y, y)); }
    case '7days': { const f = subDays(today, 6); return leads.filter(l => ok(l, f, today)); }
    case '30days': { const f = subDays(today, 29); return leads.filter(l => ok(l, f, today)); }
    case 'month': { const f = today.slice(0, 7) + '-01'; return leads.filter(l => ok(l, f, today)); }
    case 'custom': { if (!from || !to) return leads; return leads.filter(l => ok(l, from, to)); }
    default: return leads;
  }
}

function getStatusMoveDate(lead: Lead, statusId: number): string | null {
  const field = STATUS_TIMESTAMP_FIELD[statusId];
  const exact = field ? (lead as any)[field] : null;
  if (exact) return exact;
  let currentStatus = toNum(lead.status);
  if (currentStatus === 0) currentStatus = 1;
  if (currentStatus === statusId) return (lead as any).ultimo_status_change || lead.created_at || null;
  return null;
}

function isDateInPeriod(dateStr: string | null | undefined, period: string, from?: string, to?: string): boolean {
  if (period === 'all') return true;
  const today = todayBR();
  const ok = (a: string, b: string) => {
    const d = leadDateBR(dateStr);
    return !!d && d >= a && d <= b;
  };
  switch (period) {
    case 'today': return ok(today, today);
    case 'yesterday': {
      const y = subDays(today, 1);
      return ok(y, y);
    }
    case '7days': return ok(subDays(today, 6), today);
    case '30days': return ok(subDays(today, 29), today);
    case 'month': return ok(today.slice(0, 7) + '-01', today);
    case 'custom': return !from || !to ? true : ok(from, to);
    default: return true;
  }
}

function isLeadMovedToStatusInPeriod(lead: Lead, statusId: number, period: string, from?: string, to?: string): boolean {
  let currentStatus = toNum(lead.status);
  if (currentStatus === 0) currentStatus = 1;
  if (currentStatus !== statusId) return false;
  return isDateInPeriod(getStatusMoveDate(lead, statusId), period, from, to);
}

function wasLeadMovedToStatusInPeriod(lead: Lead, statusId: number, period: string, from?: string, to?: string): boolean {
  return isDateInPeriod(getStatusMoveDate(lead, statusId), period, from, to);
}

function buildChartData(leads: Lead[], period: string, from?: string, to?: string) {
  const today = todayBR();
  let days = 30;
  let startDate = subDays(today, 29);

  if (period === 'today') { days = 1; startDate = today; }
  else if (period === 'yesterday') { days = 1; startDate = subDays(today, 1); }
  else if (period === '7days') { days = 7; startDate = subDays(today, 6); }
  else if (period === '30days') { days = 30; startDate = subDays(today, 29); }
  else if (period === 'month') { startDate = today.slice(0, 7) + '-01'; days = parseInt(today.slice(8, 10)); }
  else if (period === 'custom' && from && to) {
    startDate = from;
    const ms = new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime();
    days = Math.max(1, Math.round(ms / 86400000) + 1);
  }

  if (days === 1) {
    const slots: Record<string, number> = {};
    for (let h = 0; h < 24; h += 2) slots[`${String(h).padStart(2, '0')}h`] = 0;
    leads.forEach(l => {
      try {
        if (leadDateBR(l.created_at) !== startDate) return;
        const d = parseLeadDate(l.created_at);
        if (!d || isNaN(d.getTime())) return;
        const h = d.getHours();
        const sh = Math.floor(h / 2) * 2;
        const k = `${String(sh).padStart(2, '0')}h`;
        if (k in slots) slots[k]++;
      } catch { /* skip invalid date */ }
    });
    return Object.entries(slots).map(([date, cnt]) => ({ date, leads: cnt }));
  }

  const dayMap: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    try {
      const d = new Date(startDate + 'T12:00:00Z');
      if (isNaN(d.getTime())) continue;
      d.setUTCDate(d.getUTCDate() + i);
      if (isNaN(d.getTime())) continue;
      dayMap[d.toISOString().slice(0, 10)] = 0;
    } catch { continue; }
  }
  leads.forEach(l => {
    const k = leadDateBR(l.created_at);
    if (k && k in dayMap) dayMap[k]++;
  });
  return Object.entries(dayMap).map(([iso, cnt]) => {
    try {
      const d = new Date(iso + 'T12:00:00Z');
      if (isNaN(d.getTime())) return { date: '—', leads: cnt };
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return { date: `${day}/${month}`, leads: cnt };
    } catch { return { date: '—', leads: cnt }; }
  });
}

function buildChartDataDual(allLeads: Lead[], period: string, from?: string, to?: string, convertidoStatus = 3) {
  const today = todayBR();
  let days = 30;
  let startDate = subDays(today, 29);
  if (period === 'today') { days = 1; startDate = today; }
  else if (period === 'yesterday') { days = 1; startDate = subDays(today, 1); }
  else if (period === '7days') { days = 7; startDate = subDays(today, 6); }
  else if (period === '30days') { days = 30; startDate = subDays(today, 29); }
  else if (period === 'month') { startDate = today.slice(0, 7) + '-01'; days = parseInt(today.slice(8, 10)); }
  else if (period === 'custom' && from && to) {
    startDate = from;
    const ms = new Date(to + 'T12:00:00Z').getTime() - new Date(from + 'T12:00:00Z').getTime();
    days = Math.max(1, Math.round(ms / 86400000) + 1);
  }
  if (days === 1) {
    const slots: Record<string, { leads: number; revs: number }> = {};
    for (let h = 0; h < 24; h += 2) slots[`${String(h).padStart(2, '0')}h`] = { leads: 0, revs: 0 };
    allLeads.forEach(l => {
      try {
        if (leadDateBR(l.created_at) !== startDate) return;
        const d = parseLeadDate(l.created_at);
        if (!d || isNaN(d.getTime())) return;
        const sh = Math.floor(d.getHours() / 2) * 2;
        const k = `${String(sh).padStart(2, '0')}h`;
        if (k in slots) slots[k].leads++;
      } catch { }
    });
    allLeads.filter(l => toNum(l.status) === convertidoStatus).forEach(l => {
      try {
        const ref = getStatusMoveDate(l, convertidoStatus);
        if (leadDateBR(ref) !== startDate) return;
        const d = parseLeadDate(ref);
        if (!d || isNaN(d.getTime())) return;
        const sh = Math.floor(d.getHours() / 2) * 2;
        const k = `${String(sh).padStart(2, '0')}h`;
        if (k in slots) slots[k].revs++;
      } catch { }
    });
    return Object.entries(slots).map(([date, v]) => ({ date, ...v }));
  }
  const dayMap: Record<string, { leads: number; revs: number }> = {};
  for (let i = 0; i < days; i++) {
    try {
      const d = new Date(startDate + 'T12:00:00Z');
      if (isNaN(d.getTime())) continue;
      d.setUTCDate(d.getUTCDate() + i);
      if (isNaN(d.getTime())) continue;
      dayMap[d.toISOString().slice(0, 10)] = { leads: 0, revs: 0 };
    } catch { }
  }
  allLeads.forEach(l => { const k = leadDateBR(l.created_at); if (k && k in dayMap) dayMap[k].leads++; });
  allLeads.filter(l => toNum(l.status) === convertidoStatus).forEach(l => {
    const ref = getStatusMoveDate(l, convertidoStatus);
    const k = leadDateBR(ref);
    if (k && k in dayMap) dayMap[k].revs++;
  });
  return Object.entries(dayMap).map(([iso, v]) => {
    try {
      const d = new Date(iso + 'T12:00:00Z');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      return { date: `${day}/${month}`, ...v };
    } catch { return { date: '—', ...v }; }
  });
}

function isoToBR(iso: string): string {
  if (!iso || !iso.includes('-')) return iso || '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function relativeTime(str?: string | null): string {
  if (!str) return '—';
  try {
    const d = parseLeadDate(str);
    if (!d || isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    if (diff < 0) return 'agora';
    const min = Math.floor(diff / 60000);
    const h = Math.floor(min / 60);
    const days = Math.floor(h / 24);
    if (min < 1) return 'agora';
    if (min < 60) return `${min}m`;
    if (h < 24) return `${h}h`;
    if (days === 1) return '1d';
    return `${days}d`;
  } catch { return '—'; }
}

function toNum(s: any): number { if (s === null || s === undefined || s === '') return 0; const n = Number(s); return isNaN(n) ? 0 : n; }
function safe(val: number): number { return isNaN(val) || !isFinite(val) ? 0 : val; }
function getGreeting() { const h = new Date().getHours(); if (h >= 5 && h < 12) return 'Bom dia'; if (h >= 12 && h < 18) return 'Boa tarde'; return 'Boa noite'; }


async function fetchMetaData(period: string, from?: string, to?: string, leadsList: Lead[] = [], token = '', account = ''): Promise<{ metrics: MetaMetrics; campaigns: Campaign[] }> {
  const empty = { metrics: { spend: 0, leads: 0, cpl: 0, impressions: 0, clicks: 0, ctr: 0, cplRealTime: 0 }, campaigns: [] };
  if (!token || !account) return empty;
  try {
    const presetMap: Record<string, string> = { today: 'today', yesterday: 'yesterday', '7days': 'last_7d', '30days': 'last_30d', month: 'this_month' };
    const timeParam = period in presetMap ? `date_preset=${presetMap[period]}` : period === 'custom' && from && to ? `time_range=%7B%22since%22%3A%22${from}%22%2C%22until%22%3A%22${to}%22%7D` : 'date_preset=this_month';
    const insRes = await fetch(`https://graph.facebook.com/v18.0/act_${account}/insights?fields=spend,impressions,clicks,ctr,actions&${timeParam}&access_token=${token}`);
    const insData = await insRes.json();
    let spend = 0, impressions = 0, clicks = 0, ctr = 0, leads = 0;
    if (insData.data?.length) { const d = insData.data[0]; spend = parseFloat(d.spend || '0'); impressions = parseInt(d.impressions || '0'); clicks = parseInt(d.clicks || '0'); ctr = parseFloat(d.ctr || '0'); const la = (d.actions || []).find((a: any) => ['lead', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type)); leads = la ? parseInt(la.value || '0') : 0; }
    const campRes = await fetch(`https://graph.facebook.com/v18.0/act_${account}/insights?fields=campaign_id,campaign_name,spend,actions&level=campaign&${timeParam}&access_token=${token}`);
    const campData = await campRes.json();
    const campaigns: Campaign[] = [];
    (campData.data || []).forEach((ins: any) => {
      const cSpend = parseFloat(ins.spend || '0');
      const cLeads = parseInt((ins.actions || []).find((a: any) => ['lead', 'offsite_conversion.fb_pixel_lead'].includes(a.action_type))?.value || '0');
      if (cSpend > 0) campaigns.push({ id: ins.campaign_id, name: ins.campaign_name, status: 'ACTIVE', spend: cSpend, leads_api: cLeads });
    });
    const totalLeadsFB = leadsList.filter(l => {
      if (!l.utm_source) return false;
      const src = l.utm_source.toUpperCase();
      return src === 'FB' || src === 'TRÁFEGO PAGO' || src === 'TRAFEGO PAGO';
    }).length;
    return { metrics: { spend, impressions, clicks, ctr, leads, cpl: leads > 0 ? spend / leads : 0, cplRealTime: totalLeadsFB > 0 ? spend / totalLeadsFB : 0 }, campaigns };
  } catch (e) { console.error('[Meta]', e); return empty; }
}

function useTypewriter(text: string, speed = 60, delay = 100) {
  const [displayedText, setDisplayedText] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!text) { setDisplayedText(''); setDone(true); return; }
    setDisplayedText('');
    setDone(false);
    let idx = 0;
    let intervalId: ReturnType<typeof setInterval>;
    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        idx++;
        setDisplayedText(text.slice(0, idx));
        if (idx >= text.length) {
          clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, delay);
    return () => { clearTimeout(startTimeout); clearInterval(intervalId); };
  }, [text, speed, delay]);
  return { text: displayedText, done };
}

function AnimatedCounter({ value, duration = 800, decimals = 0 }: { value: number; duration?: number; decimals?: number }) {
  const [count, setCount] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = prevValue.current;
    const endValue = value;
    const easeOutQuad = (t: number) => t * (2 - t);

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = easeOutQuad(progress);
      const current = startValue + easedProgress * (endValue - startValue);
      setCount(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        prevValue.current = endValue;
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return (
    <>
      {decimals > 0
        ? count.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : Math.round(count).toLocaleString('pt-BR')
      }
    </>
  );
}

function RitmoTooltip({ dark }: { dark: boolean }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  return (
    <span
      ref={ref}
      onMouseEnter={() => {
        if (ref.current) {
          const r = ref.current.getBoundingClientRect();
          setPos({ top: r.top + window.scrollY, left: r.left + r.width / 2 + window.scrollX });
        }
        setVisible(true);
      }}
      onMouseLeave={() => setVisible(false)}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '13px', height: '13px', borderRadius: '50%', border: '1.2px solid rgba(255,255,255,0.3)', fontSize: '8px', fontWeight: 700, fontFamily: 'serif', color: 'rgba(255,255,255,0.4)', cursor: 'help', flexShrink: 0, lineHeight: 1, userSelect: 'none' }}
    >
      ?
      {visible && createPortal(
        <div style={{ position: 'absolute', top: pos.top - 10, left: pos.left, transform: 'translateX(-50%) translateY(-100%)', background: dark ? '#1e1e24' : '#1f2937', color: '#f9fafb', fontSize: '11.5px', lineHeight: 1.55, padding: '10px 13px', borderRadius: '9px', width: '230px', whiteSpace: 'normal', textAlign: 'center', zIndex: 999999, pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
          Compara suas revendedoras aprovadas com o ritmo necessário para bater a meta.
          Calculado em dias úteis, excluindo fins de semana e feriados configurados.
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '5px', borderStyle: 'solid', borderColor: `${dark ? '#1e1e24' : '#1f2937'} transparent transparent transparent` }}/>
        </div>,
        document.body
      )}
    </span>
  );
}

function getDiasUteisMes(feriadosExtras: string[] = []): { total: number; transcorridos: number; restantes: number } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaHoje = hoje.getDate();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const feriadosSet = new Set(feriadosExtras);
  let total = 0, transcorridos = 0;
  for (let d = 1; d <= ultimoDia; d++) {
    const dow = new Date(ano, mes, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const key = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    if (!isWeekend && !feriadosSet.has(key)) {
      total++;
      if (d <= diaHoje) transcorridos++;
    }
  }
  return { total, transcorridos, restantes: total - transcorridos };
}

function calcularRitmo(aprovadas: number, meta: number, feriados: string[] = []) {
  const du = getDiasUteisMes(feriados);
  const metaDiaria = du.total > 0 ? meta / du.total : 0;
  const esperado = Math.round(metaDiaria * du.transcorridos);
  const diff = aprovadas - esperado;
  return {
    diff,
    metaDiaria,
    restantes: du.restantes,
    status: diff >= 2 ? 'ok' : diff >= -2 ? 'ritmo' : 'atrasado',
  };
}

function RitmoResumo({ metaDiaria, status, convertidoCurto, faltamMeta, compact = false }: {
  metaDiaria: number;
  status: string;
  convertidoCurto: string;
  faltamMeta: number;
  compact?: boolean;
}) {
  const ok = status === 'ok';
  const near = status === 'ritmo';
  const title = ok ? 'No ritmo da meta' : near ? 'Perto do ritmo' : 'Atrasado no ritmo';
  const color = ok ? 'rgba(134,239,172,0.98)' : near ? 'rgba(253,224,71,0.98)' : 'rgba(255,185,185,1)';
  const metaDiaLabel = metaDiaria.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div style={{ marginTop: compact ? '7px' : '8px', paddingTop: compact ? '7px' : '8px', borderTop: '1px solid rgba(255,255,255,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
        <span style={{ fontSize: compact ? '10.5px' : '11px', fontWeight: 800, color, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '10px', flexShrink: 0 }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: compact ? '10px' : '10.5px', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          faltam {faltamMeta} {convertidoCurto}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.24)', fontSize: '10px', flexShrink: 0 }}>·</span>
        <span style={{ color: 'rgba(255,255,255,0.58)', fontSize: compact ? '9.5px' : '10px', lineHeight: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          meta {metaDiaLabel}/dia
        </span>
      </div>
    </div>
  );
}

function FunilHorizontal({ funnelData, totalLeads, dark, loading, navigate, selectedPeriod }: {
  funnelData: { stage: string; statusId: number; color: string; value: number }[];
  totalLeads: number;
  dark: boolean;
  loading: boolean;
  navigate: (path: string) => void;
  selectedPeriod: string;
}) {
  const cardBg = dark ? '#1b1b1d' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';
  const cardShadow = dark ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' : '0 1px 3px rgba(0,0,0,0.06)';
  const txtHi = dark ? '#f0f0f0' : '#111827';
  const txtLow = dark ? '#8a8a96' : '#6b7280';
  return (
    <div style={{
      background: cardBg, borderRadius: '14px',
      padding: '20px 24px', border: `1px solid ${border}`,
      boxShadow: cardShadow, marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0 }}>Movimentos do funil</h3>
          <p style={{ fontSize: '11px', color: txtLow, margin: '3px 0 0' }}>Quando os leads entraram em cada status</p>
        </div>
        <span style={{ fontSize: '11px', color: txtLow }}>{totalLeads} leads no período</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {funnelData.map(stage => {
          const pct = totalLeads > 0 ? Math.min(Math.round((stage.value / totalLeads) * 100), 100) : 0;
          return (
            <div
              key={stage.stage}
              onClick={() => navigate(`/leads?status=${stage.statusId}&periodo=${selectedPeriod}`)}
              style={{
                flex: '1 1 0', minWidth: '80px', cursor: 'pointer',
                padding: '12px', borderRadius: '10px',
                border: `1px solid ${border}`,
                background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'}
            >
              <div style={{ height: '3px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginBottom: '10px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: stage.color, borderRadius: '99px', transition: 'width 0.8s ease' }}/>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: txtHi, lineHeight: 1, marginBottom: '4px' }}>
                {loading ? '…' : stage.value}
              </div>
              <div style={{ fontSize: '11px', color: txtLow, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                {stage.stage}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: stage.color }}>
                {loading ? '' : `${pct}%`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizarOrigem(src: string | null | undefined): string {
  if (!src) return 'Outros';
  const s = src.trim()
    .replace(/[àáâãäå]/gi, 'a').replace(/[èéêë]/gi, 'e')
    .replace(/[ìíîï]/gi, 'i').replace(/[òóôõö]/gi, 'o')
    .replace(/[ùúûü]/gi, 'u').replace(/ç/gi, 'c')
    .toUpperCase().trim();
  if (['FB','FACEBOOK','META','IG_BOOST','TRAFEGO PAGO','TRAFEGO ANTIGO','CAMPANHA'].includes(s)
      || s.startsWith('FB') || s.includes('PAGO') || s.includes('CAMPANHA')) return 'Meta Ads';
  if (s.includes('INSTAGRAM') || s === 'IG') return 'Orgânico';
  if (s.includes('INDICAC')) return 'Indicação';
  return 'Outros';
}

function corOrigem(nome: string): string {
  if (nome === 'Meta Ads') return '#3b82f6';
  if (nome === 'Indicação') return '#f97316';
  if (nome === 'Orgânico') return '#8b5cf6';
  return '#94a3b8';
}

function origemKey(src: string | null | undefined, camp?: string | null): 'meta' | 'indicacao' | 'organico' | 'outros' {
  const srcRaw = (src || '').trim();
  const campRaw = (camp || '').trim();
  const srcNorm = srcRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  // Indica\u00e7\u00e3o tem prioridade absoluta
  if (srcNorm.includes('INDICAC')) return 'indicacao';
  // Condi\u00e7\u00e3o 1: qualquer utm_campaign preenchido = tr\u00e1fego rastreado = Meta
  if (campRaw.length > 0) return 'meta';
  // Condi\u00e7\u00e3o 3: fbclid em qualquer campo de tracking
  if (srcRaw.toLowerCase().includes('fbclid')) return 'meta';
  // Condi\u00e7\u00f5es 2 + 4: utm_source reconhecido como Meta (suporta pipe-separated)
  if (srcNorm) {
    const seg = srcNorm.split('|')[0].trim();
    const isMeta = (s: string) =>
      ['FB', 'FACEBOOK', 'IG', 'INSTAGRAM', 'META', 'IG_BOOST', 'CAMPANHA'].includes(s)
      || s.startsWith('FB') || s.includes('TRAFEGO') || s.includes('PAGO');
    if (isMeta(srcNorm) || isMeta(seg)) return 'meta';
  }
  // Org\u00e2nico expl\u00edcito (ex: instagram_organico, organico)
  if (srcNorm.includes('ORGANICO') || srcNorm.includes('ORGANIC')) return 'organico';
  return 'outros';
}

function origemLabel(key: string): string {
  if (key === 'meta') return 'Meta Ads';
  if (key === 'indicacao') return 'Indicação';
  if (key === 'organico') return 'Orgânico';
  return 'Outros';
}

function origemColor(key: string): string {
  if (key === 'meta') return '#3b82f6';
  if (key === 'indicacao') return '#f97316';
  if (key === 'organico') return '#8b5cf6';
  return '#94a3b8';
}

function MiniCalendarioReuniao({ dark, orgId, reuniaoStatusIds, onDayClick }: {
  dark: boolean;
  orgId: string | null;
  reuniaoStatusIds: number[];
  onDayClick: (data: string) => void;
}) {
  const cardBg = dark ? '#1b1b1d' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';
  const txtHi = dark ? '#f0f0f0' : '#111827';
  const txtLow = dark ? '#8a8a96' : '#6b7280';
  const txtMid = dark ? '#a0a0a8' : '#374151';
  const rowPar = dark ? '#222225' : '#f9fafb';

  const hojeStr = todayBR();

  const navigate = useNavigate();

  const [semanaBase, setSemanaBase] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [diaFiltro, setDiaFiltro] = useState<string | null>(hojeStr);
  const [leadsCarregados, setLeadsCarregados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSlot, setModalSlot] = useState<{ hora: string; dia: string; leads: any[] } | null>(null);
  const [slotBusca, setSlotBusca] = useState('');
  const [slotLimite, setSlotLimite] = useState(10);
  const [showMesPicker, setShowMesPicker] = useState(false);
  const [anoPicker, setAnoPicker] = useState(() => new Date().getFullYear());
  const [horariosOrg, setHorariosOrg] = useState<string[]>(['10:00','12:00','15:00','17:00','19:00']);
  const [drawerLead, setDrawerLead] = useState<any | null>(null);
  const [leadReagendando, setLeadReagendando] = useState<string | null>(null);
  const [reagData, setReagData] = useState('');
  const [reagHora, setReagHora] = useState('');
  const [reagMes, setReagMes] = useState<Date>(() => new Date());
  const [reagSaving, setReagSaving] = useState(false);

  const reuniaoStatusIdsRef = useRef<number[]>([]);
  reuniaoStatusIdsRef.current = reuniaoStatusIds;

  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaBase);
    d.setDate(semanaBase.getDate() + i);
    return d;
  }), [semanaBase]);

  const inicioSemana = localDateKey(diasSemana[0]);
  const fimSemana = localDateKey(diasSemana[6]);
  const meioSemana = diasSemana[3];
  const mesLabel = meioSemana.toLocaleString('pt-BR', { month: 'long' });
  const anoLabel = meioSemana.getFullYear();

  useEffect(() => {
    if (!orgId || reuniaoStatusIds.length === 0) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from('leads')
        .select('id, nome, whatsapp, cidade, reuniao_agendada_at, faixa, score, status')
        .eq('org_id', orgId)
        .in('status', reuniaoStatusIds)
        .gte('reuniao_agendada_at', inicioSemana)
        .lte('reuniao_agendada_at', fimSemana + 'T23:59:59');
      setLeadsCarregados((data || []) as any[]);
      setLoading(false);
    })();
  }, [orgId, inicioSemana, reuniaoStatusIds.join(',')]); // eslint-disable-line

  useEffect(() => {
    if (!orgId) return;
    (supabase as any).from('organizations').select('reuniao_horarios').eq('id', orgId).single()
      .then(({ data }: any) => {
        const h = data?.reuniao_horarios;
        if (Array.isArray(h) && h.length > 0) setHorariosOrg(h);
      });
  }, [orgId]);

  // Ref para janela da semana — evita stale closure na subscription
  const semanaRef = useRef({ inicio: inicioSemana, fim: fimSemana });
  useEffect(() => { semanaRef.current = { inicio: inicioSemana, fim: fimSemana }; }, [inicioSemana, fimSemana]);
  useEffect(() => { if (modalSlot) { setSlotBusca(''); setSlotLimite(10); } }, [!!modalSlot]); // eslint-disable-line

  useEffect(() => {
    if (!orgId) return;
    const ch = (supabase as any)
      .channel(`mini-cal-${orgId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, (payload: any) => {
        const updated = payload.new;
        const { inicio, fim } = semanaRef.current;
        const at: string | null = updated.reuniao_agendada_at ?? null;
        const inReu = reuniaoStatusIdsRef.current.includes(Number(updated.status));
        const dentroDaSemana = at && at >= inicio && at <= fim + 'T23:59:59';
        const deveAparecer = inReu && !!dentroDaSemana;
        setLeadsCarregados(prev => {
          const exists = prev.some((l: any) => String(l.id) === String(updated.id));
          if (exists && deveAparecer) return prev.map((l: any) => String(l.id) === String(updated.id) ? { ...l, ...updated } : l);
          if (!exists && deveAparecer) return [...prev, updated];
          if (exists && !deveAparecer) return prev.filter((l: any) => String(l.id) !== String(updated.id));
          return prev;
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, (payload: any) => {
        const novo = payload.new;
        const { inicio, fim } = semanaRef.current;
        const at: string | null = novo.reuniao_agendada_at ?? null;
        const inReu = reuniaoStatusIdsRef.current.includes(Number(novo.status));
        if (inReu && at && at >= inicio && at <= fim + 'T23:59:59') {
          setLeadsCarregados(prev => [...prev, novo]);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]); // eslint-disable-line

  const slots = useMemo(() => {
    const slotMap: Record<string, any[]> = {};
    for (const l of leadsCarregados) {
      if (!l.reuniao_agendada_at) continue;
      const dt = new Date(l.reuniao_agendada_at);
      const dia = (l.reuniao_agendada_at as string).slice(0, 10);
      const hora = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
      const key = `${dia}|${hora}`;
      if (!slotMap[key]) slotMap[key] = [];
      slotMap[key].push(l);
    }
    return Object.entries(slotMap)
      .map(([key, leads]) => { const [dia, hora] = key.split('|'); return { dia, hora, leads }; })
      .sort((a, b) => (`${a.dia} ${a.hora}` < `${b.dia} ${b.hora}` ? -1 : 1));
  }, [leadsCarregados]);

  const slotsFiltrados = useMemo(
    () => diaFiltro ? slots.filter(s => s.dia === diaFiltro) : slots,
    [slots, diaFiltro]
  );

  function irSemana(dir: number) {
    const d = new Date(semanaBase);
    d.setDate(d.getDate() + dir * 7);
    d.setHours(0, 0, 0, 0);
    setSemanaBase(d);
    setDiaFiltro(localDateKey(d));
  }

  function irParaMes(mes: number, ano: number) {
    const p = new Date(ano, mes, 1);
    const dom = new Date(p);
    dom.setDate(p.getDate() - p.getDay());
    dom.setHours(0, 0, 0, 0);
    setSemanaBase(dom);
    setDiaFiltro(localDateKey(dom));
    setShowMesPicker(false);
  }

  const DIAS_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const navBtnSt: React.CSSProperties = {
    width: '22px', height: '22px', borderRadius: '6px',
    border: `1px solid ${border}`, background: 'transparent',
    color: txtMid, cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: '13px', fontFamily: 'inherit', padding: 0,
  };

  return (
    <div style={{
      background: cardBg, borderRadius: '14px', padding: '18px 20px 14px',
      border: `1px solid ${border}`,
      boxShadow: dark ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' : '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0 }}>Reuniões</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button style={navBtnSt} onClick={() => irSemana(-1)}>‹</button>

          {/* Month label + inline popover */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setAnoPicker(anoLabel); setShowMesPicker(v => !v); }}
              style={{ fontSize: '12px', color: txtMid, fontWeight: 500, textTransform: 'capitalize', background: dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit', padding: '3px 8px', userSelect: 'none' }}>
              {mesLabel} {anoLabel} ▾
            </button>

            {showMesPicker && (
              <>
                <div onClick={() => setShowMesPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9999,
                  background: dark ? '#1e1f26' : '#ffffff',
                  border: `1px solid ${border}`,
                  borderRadius: '12px', padding: '14px',
                  width: '220px',
                  boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)' : '0 8px 32px rgba(0,0,0,0.12)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <button style={navBtnSt} onClick={() => setAnoPicker(v => v - 1)}>‹</button>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: txtHi }}>{anoPicker}</span>
                    <button style={navBtnSt} onClick={() => setAnoPicker(v => v + 1)}>›</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {MESES_ABREV.map((m, idx) => {
                      const isViewed = idx === meioSemana.getMonth() && anoPicker === meioSemana.getFullYear();
                      const isAtual = idx === new Date().getMonth() && anoPicker === new Date().getFullYear();
                      return (
                        <button key={idx} onClick={() => irParaMes(idx, anoPicker)}
                          style={{ padding: '7px 2px', borderRadius: '7px', border: 'none', background: isViewed ? '#0044fd' : isAtual ? (dark ? 'rgba(0,68,253,0.2)' : 'rgba(0,68,253,0.08)') : 'transparent', color: isViewed ? '#ffffff' : isAtual ? '#0044fd' : txtMid, fontSize: '11.5px', fontWeight: isViewed || isAtual ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <button style={navBtnSt} onClick={() => irSemana(1)}>›</button>
        </div>
      </div>

      {/* Week strip — pt-BR, clicável, underline no dia selecionado/hoje */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '10px' }}>
        {diasSemana.map((dia, i) => {
          const dataStr = localDateKey(dia);
          const isHoje = dataStr === hojeStr;
          const isSelecionado = diaFiltro === dataStr;
          const cor = isSelecionado ? '#8b5cf6' : isHoje ? '#0044fd' : txtLow;
          return (
            <div key={i}
              onClick={() => setDiaFiltro(dataStr)}
              style={{ textAlign: 'center', padding: '1px 0', cursor: 'pointer' }}>
              <div style={{ fontSize: '10px', fontWeight: 500, color: cor, marginBottom: '3px', letterSpacing: '0.02em' }}>
                {DIAS_ABREV[i]}
              </div>
              <div style={{ fontSize: '13px', fontWeight: (isSelecionado || isHoje) ? 700 : 400, color: cor, lineHeight: '22px' }}>
                {dia.getDate()}
              </div>
              <div style={{ height: '3px', marginTop: '2px', display: 'flex', justifyContent: 'center' }}>
                {isSelecionado && <div style={{ width: '14px', height: '3px', borderRadius: '2px', background: cor }} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: '1px', background: border, marginBottom: '8px' }} />

      {/* Slots — só horários com leads, cards zebrados */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '290px' }}>
        {loading ? (
          <>
            {[0, 1].map(i => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 0' }}>
                <div style={{ width: '38px', flexShrink: 0 }}>
                  <div style={{ width: '32px', height: '10px', borderRadius: '4px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                </div>
                <div style={{ flex: 1, height: '58px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />
              </div>
            ))}
          </>
        ) : slotsFiltrados.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0 16px', gap: '6px' }}>
            <div style={{ fontSize: '22px', opacity: 0.3 }}>📅</div>
            <p style={{ fontSize: '12px', color: txtLow, margin: 0, textAlign: 'center' }}>{diaFiltro ? 'Nenhuma reunião neste dia' : 'Nenhuma reunião esta semana'}</p>
          </div>
        ) : slotsFiltrados.map((slot, idx) => {
          const maxAv = 4;
          const visAv = slot.leads.slice(0, maxAv);
          const extraAv = slot.leads.length - maxAv;
          const isZebra = idx % 2 === 1;
          const cardRowBg = isZebra ? rowPar : cardBg;
          const avBorder = cardRowBg;
          return (
            <div key={`${slot.dia}|${slot.hora}`}
              style={{ display: 'flex', gap: '0', alignItems: 'stretch', borderRadius: '9px', overflow: 'hidden', marginBottom: '5px', background: cardRowBg, border: `1px solid ${border}` }}>
              {/* Time label column */}
              <div style={{ width: '44px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: '8px', paddingTop: '12px', borderRight: `1px solid ${border}` }}>
                <span style={{ fontSize: '10.5px', color: txtLow, fontWeight: 500, lineHeight: 1 }}>{slot.hora}</span>
              </div>
              {/* Card */}
              <div
                onClick={() => setModalSlot(slot)}
                style={{ flex: 1, padding: '10px 12px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: txtHi, marginBottom: '1px' }}>
                  Reunião ({slot.leads.length} {slot.leads.length === 1 ? 'lead' : 'leads'})
                </div>
                <div style={{ fontSize: '11px', color: txtLow, marginBottom: '8px' }}>{slot.hora}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {visAv.map((lead: any, i: number) => {
                      const ac = getAvatarColor(lead.nome || '', dark, lead.id);
                      const tc = getAvatarTextColor(ac);
                      return (
                        <div key={lead.id} style={{ width: '22px', height: '22px', borderRadius: '50%', background: ac, color: tc, border: `2px solid ${avBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7.5px', fontWeight: 700, marginLeft: i === 0 ? 0 : '-5px', flexShrink: 0, position: 'relative', zIndex: maxAv - i }}>
                          {safeInitials(lead.nome || '')}
                        </div>
                      );
                    })}
                    {extraAv > 0 && (
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: dark ? '#3f3f46' : '#d4d4d8', color: txtMid, border: `2px solid ${avBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, marginLeft: '-5px', flexShrink: 0 }}>
                        +{extraAv}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: '8px', textAlign: 'center', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, paddingTop: '8px' }}>
        <button onClick={() => onDayClick('')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#8b5cf6', fontWeight: 500, fontFamily: 'inherit' }}>
          Ver calendário completo →
        </button>
      </div>

      {/* Modal rico de slot de horário */}
      {modalSlot && createPortal(
        <>
          <div onClick={() => { setModalSlot(null); setLeadReagendando(null); }} style={{ position: 'fixed', inset: 0, zIndex: 99990, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 99991, background: dark ? '#18191f' : '#ffffff', borderRadius: '18px', width: '440px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', boxShadow: dark ? '0 24px 64px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.07)' : '0 24px 64px rgba(0,0,0,0.16)', fontFamily: 'inherit' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 20px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'rgba(139,92,246,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: txtHi, margin: 0, lineHeight: 1.3 }}>Reuniões às {modalSlot.hora}</h3>
                  <span style={{ fontSize: '12px', color: txtLow }}>{modalSlot.leads.length} leads</span>
                </div>
                <p style={{ fontSize: '12px', color: txtLow, margin: 0 }}>
                  {(() => {
                    const d = new Date(modalSlot.dia + 'T12:00:00');
                    const nd = d.toLocaleDateString('pt-BR', { weekday: 'long' });
                    const df = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
                    return `${nd.charAt(0).toUpperCase() + nd.slice(1)}, ${df}`;
                  })()}
                </p>
              </div>
              <button onClick={() => { setModalSlot(null); setLeadReagendando(null); }} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtLow, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XIcon style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '10px 16px 0', flexShrink: 0, position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '26px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: txtLow, pointerEvents: 'none' }} />
              <input
                placeholder="Buscar lead..."
                value={slotBusca}
                onChange={e => { setSlotBusca(e.target.value); setSlotLimite(10); }}
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px', border: `1px solid ${border}`, background: dark ? 'rgba(255,255,255,0.05)' : '#f9fafb', color: txtHi, fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {/* Lead list */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', padding: '12px 16px' }}>
              {(() => {
                const leadsFiltrados = modalSlot.leads.filter((lead: any) => {
                  if (!slotBusca.trim()) return true;
                  const q = slotBusca.toLowerCase();
                  return (lead.nome || '').toLowerCase().includes(q) || (lead.whatsapp || '').includes(q);
                });
                const visiveis = leadsFiltrados.slice(0, slotLimite);
                return (<>
                  {visiveis.map((lead: any, li: number) => {
                const ac = getAvatarColor(lead.nome || '', dark, lead.id);
                const tc = getAvatarTextColor(ac);
                const rawPhone = (lead.whatsapp || '').replace(/\D/g, '');
                const wPhone = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`;
                const faixaCor = lead.faixa === 'verde' ? '#22c55e' : lead.faixa === 'amarelo' ? '#f59e0b' : lead.faixa === 'vermelho' ? '#ef4444' : null;
                const isReag = leadReagendando === lead.id;
                const rowBg = li % 2 === 1 ? (dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)') : 'transparent';
                return (
                  <div key={lead.id} style={{ borderRadius: '12px', border: `1px solid ${isReag ? 'rgba(139,92,246,0.35)' : border}`, background: isReag ? (dark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.03)') : rowBg, overflow: 'hidden', transition: 'border-color 0.15s', marginBottom: '8px' }}>

                    {/* Linha única: avatar + nome + WA + Reagendar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 12px' }}>
                      <div onClick={() => setDrawerLead(lead)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: ac, color: tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0, cursor: 'pointer' }}>
                        {safeInitials(lead.nome || '')}
                      </div>
                      <div onClick={() => setDrawerLead(lead)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeName(lead.nome) || 'Lead'}</div>
                        {lead.cidade && <div style={{ fontSize: '11px', color: txtLow, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.cidade}</div>}
                      </div>
                      {rawPhone && (
                        <a href={`https://wa.me/${wPhone}`} target="_blank" rel="noreferrer"
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: dark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', textDecoration: 'none', flexShrink: 0 }}>
                          <MessageCircle style={{ width: '14px', height: '14px' }} />
                        </a>
                      )}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (isReag) { setLeadReagendando(null); return; }
                          const at = lead.reuniao_agendada_at;
                          if (at) {
                            const d = new Date(at);
                            setReagData(d.toLocaleDateString('pt-BR', { year:'numeric',month:'2-digit',day:'2-digit' }).split('/').reverse().join('-'));
                            setReagHora(d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }));
                            setReagMes(new Date(d.getFullYear(), d.getMonth(), 1));
                          } else {
                            const hj = new Date();
                            const hjStr = `${hj.getFullYear()}-${String(hj.getMonth()+1).padStart(2,'0')}-${String(hj.getDate()).padStart(2,'0')}`;
                            setReagData(hjStr);
                            setReagHora('');
                            setReagMes(new Date(hj.getFullYear(), hj.getMonth(), 1));
                          }
                          setLeadReagendando(lead.id);
                        }}
                        style={isReag ? { height: '32px', borderRadius: '8px', padding: '0 10px', background: '#8b5cf6', border: '1px solid #8b5cf6', color: '#fff', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, transition: 'all 0.15s' } : { width: '32px', height: '32px', borderRadius: '8px', padding: 0, background: dark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                        <CalendarIcon style={{ width: '13px', height: '13px' }} />{isReag ? 'Fechar' : ''}
                      </button>
                    </div>

                    {/* Mini-picker de reagendamento */}
                    {isReag && (() => {
                      const ano = reagMes.getFullYear();
                      const mes = reagMes.getMonth();
                      const mesesPt = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
                      const primeiroDia = new Date(ano, mes, 1).getDay();
                      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
                      const hoje = new Date();
                      const hojeStr2 = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;
                      const dias: (number | null)[] = Array(primeiroDia).fill(null);
                      for (let d = 1; d <= diasNoMes; d++) dias.push(d);
                      return (
                        <div style={{ borderTop: `1px solid ${border}`, padding: '14px 12px 12px' }}>
                          {/* Navegação de mês */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <button onClick={() => setReagMes(new Date(ano, mes - 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, fontSize: '15px', padding: '2px 6px', borderRadius: '5px' }}>‹</button>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: txtHi }}>{mesesPt[mes]} {ano}</span>
                            <button onClick={() => setReagMes(new Date(ano, mes + 1, 1))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: txtMid, fontSize: '15px', padding: '2px 6px', borderRadius: '5px' }}>›</button>
                          </div>
                          {/* Dias da semana */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '1px', marginBottom: '3px' }}>
                            {['D','S','T','Q','Q','S','S'].map((d, i) => (
                              <div key={i} style={{ textAlign: 'center', fontSize: '9.5px', fontWeight: 600, color: txtLow, padding: '3px 0' }}>{d}</div>
                            ))}
                          </div>
                          {/* Grade de dias */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '12px' }}>
                            {dias.map((d, i) => {
                              if (!d) return <div key={`e${i}`} />;
                              const dStr = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                              const isHoje2 = dStr === hojeStr2;
                              const isSel = dStr === reagData;
                              const isPast = dStr < hojeStr2;
                              return (
                                <button key={d} disabled={isPast} onClick={() => setReagData(dStr)}
                                  style={{ aspectRatio: '1', borderRadius: '6px', border: 'none', cursor: isPast ? 'default' : 'pointer', background: isSel ? '#8b5cf6' : isHoje2 ? (dark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)') : 'transparent', color: isSel ? '#fff' : isPast ? (dark ? '#3f3f46' : '#d1d5db') : isHoje2 ? '#3b82f6' : (dark ? '#e4e4e7' : '#374151'), fontSize: '11px', fontWeight: isSel || isHoje2 ? 600 : 400, opacity: isPast ? 0.4 : 1, transition: 'background 0.1s' }}>
                                  {d}
                                </button>
                              );
                            })}
                          </div>
                          {/* Chips de horário */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                            {horariosOrg.map(h => (
                              <button key={h} onClick={() => setReagHora(h)}
                                style={{ padding: '5px 12px', borderRadius: '99px', border: `1px solid ${reagHora === h ? '#8b5cf6' : (dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb')}`, background: reagHora === h ? '#8b5cf6' : 'transparent', color: reagHora === h ? '#fff' : (dark ? '#a0a0a8' : '#374151'), fontSize: '12px', fontWeight: reagHora === h ? 600 : 400, cursor: 'pointer', transition: 'all 0.1s', fontFamily: 'inherit' }}>
                                {h}
                              </button>
                            ))}
                          </div>
                          {/* Botões confirmar/cancelar */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setLeadReagendando(null)}
                              style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                              Cancelar
                            </button>
                            <button
                              disabled={!reagData || !reagHora || reagSaving}
                              onClick={async () => {
                                if (!reagData || !reagHora) return;
                                setReagSaving(true);
                                const novaData = `${reagData}T${reagHora}:00-03:00`;
                                await (supabase as any).from('leads').update({ reuniao_agendada_at: novaData }).eq('id', lead.id);
                                setLeadsCarregados(prev => {
                                  const { inicio, fim } = semanaRef.current;
                                  return prev
                                    .map((l: any) => String(l.id) === String(lead.id) ? { ...l, reuniao_agendada_at: novaData } : l)
                                    .filter((l: any) => {
                                      if (String(l.id) !== String(lead.id)) return true;
                                      const at: string = l.reuniao_agendada_at;
                                      return at && at >= inicio && at <= fim + 'T23:59:59';
                                    });
                                });
                                setModalSlot(null);
                                setLeadReagendando(null);
                                setReagSaving(false);
                              }}
                              style={{ flex: 2, padding: '8px', borderRadius: '8px', border: 'none', background: (!reagData || !reagHora) ? (dark ? '#27272a' : '#e5e7eb') : '#8b5cf6', color: (!reagData || !reagHora) ? (dark ? '#52525b' : '#9ca3af') : '#fff', fontSize: '12px', fontWeight: 600, cursor: (!reagData || !reagHora || reagSaving) ? 'not-allowed' : 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
                              {reagSaving ? 'Salvando…' : 'Confirmar'}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
                  })}
                  {leadsFiltrados.length > slotLimite && (
                    <button
                      onClick={() => setSlotLimite(l => l + 10)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: '#8b5cf6', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px' }}
                    >
                      Ver mais {leadsFiltrados.length - slotLimite} leads ↓
                    </button>
                  )}
                </>);
              })()}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* LeadDrawer aberto de dentro do modal */}
      {drawerLead && createPortal(
        <LeadDrawer
          lead={drawerLead}
          isOpen
          onClose={() => setDrawerLead(null)}
          onUpdate={(updated: any) => {
            setDrawerLead((prev: any) => prev?.id === updated.id ? { ...prev, ...updated } : prev);
            setLeadsCarregados(prev => prev.map((l: any) => l.id === updated.id ? { ...l, ...updated } : l));
          }}
        />,
        document.body
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const { orgId, ready: orgReady } = useOrgId();
  const { theme } = useTheme();
  const t = useTerminology();
  const modelo = useModeloNegocio();
  const { config: statusConfig } = useStatusConfig(modelo);
  const reuniaoStatusIds = useMemo(
    () => statusConfig.statuses.filter(s => (s as any).tipo === 'reuniao').map(s => s.id),
    [statusConfig]
  );
  const funnelConfig = useMemo(() => {
    const sorted = [...statusConfig.statuses].sort((a, b) => a.ordem - b.ordem);
    const convertidoIdx = sorted.findIndex(s => s.id === statusConfig.convertido_status);
    const stages = convertidoIdx >= 0 ? sorted.slice(0, convertidoIdx + 1) : sorted.slice(0, 4);
    return stages.map(s => ({ stage: s.label, statusId: s.id, color: s.cor }));
  }, [statusConfig]);

  function getStatusPillStyle(statusId: number, dark: boolean): React.CSSProperties {
    const cfg = statusConfig.statuses.find(s => s.id === statusId);
    if (cfg?.cor && cfg.cor !== '#6b7280' && cfg.cor !== '') {
      const hex = cfg.cor.replace('#', '');
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
      if (dark) {
        return { background: `rgba(${r},${g},${b},0.18)`, color: cfg.cor, border: `1px solid rgba(${r},${g},${b},0.3)`, dotColor: cfg.cor } as any;
      }
      if (luminance > 0.6) {
        const dr = Math.max(0, r - 60), dg = Math.max(0, g - 60), db = Math.max(0, b - 60);
        const lr = Math.min(255, r + Math.round((255-r)*0.88)), lg = Math.min(255, g + Math.round((255-g)*0.88)), lb = Math.min(255, b + Math.round((255-b)*0.88));
        return { background: `rgb(${lr},${lg},${lb})`, color: `rgb(${dr},${dg},${db})`, border: `1px solid rgba(${dr},${dg},${db},0.2)`, dotColor: `rgb(${dr},${dg},${db})` } as any;
      }
      const lr = Math.min(255, r + Math.round((255-r)*0.82)), lg = Math.min(255, g + Math.round((255-g)*0.82)), lb = Math.min(255, b + Math.round((255-b)*0.82));
      return { background: `rgb(${lr},${lg},${lb})`, color: cfg.cor, border: `1px solid rgba(${r},${g},${b},0.22)`, dotColor: cfg.cor } as any;
    }
    if (dark) return { background: STATUS_DARK_BG[statusId] ?? 'rgba(113,113,122,0.2)', color: STATUS_DARK_COLOR[statusId] ?? '#a1a1aa', border: `1px solid ${STATUS_DARK_PILL_BORDER[statusId] ?? 'rgba(113,113,122,0.22)'}`, dotColor: STATUS_DARK_DOT[statusId] ?? '#71717a' } as any;
    return { background: STATUS_LIGHT_BG[statusId] ?? '#f4f4f5', color: STATUS_LIGHT_TEXT[statusId] ?? '#3f3f46', border: `1px solid ${STATUS_LIGHT_PILL_BORDER[statusId] ?? 'rgba(0,0,0,0.1)'}`, dotColor: STATUS_LIGHT_DOT[statusId] ?? '#6b7280' } as any;
  }
  const statusLabelFn = (st: number) =>
    statusConfig.statuses.find(s => s.id === st)?.label ?? STATUS_LABEL[st] ?? 'Aguardando';
  const navigate = useNavigate();
  const location = useLocation();
  const dark = theme === 'dark';
  const { configuracoes } = useAppStore();

  const { hasWA } = useWhatsAppAccount();

  const handleWhatsApp = useCallback((lead: Lead) => {
    if (!lead.whatsapp) return;
    const clean = lead.whatsapp.replace(/\D/g, '');
    const phone = clean.startsWith('55') ? clean : `55${clean}`;

    if (hasWA) {
      navigate(`/whatsapp?phone=${phone}`);
    } else {
      window.open(`https://wa.me/${phone}`, '_blank');
    }
  }, [navigate, hasWA]);

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [metaOrg, setMetaOrg] = useState({ revs: 0, budget: 0 });
  const [feriadosMes, setFeriadosMes] = useState<string[]>([]);

  // Modal de configuração inicial de metas
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaModalBudget, setMetaModalBudget] = useState(5000);
  const [metaModalRevs, setMetaModalRevs] = useState(50);
  const [metaModalSaving, setMetaModalSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (supabase as any).from('organizations')
      .select('nome, ravena_meta_revendedoras, ravena_budget_mensal, meta_account_id, feriados_mes')
      .eq('id', orgId).single()
      .then(({ data }: any) => {
        if (data) {
          setNomeEmpresa(data.nome || '');
          const revs = Number(data.ravena_meta_revendedoras) || 0;
          const budget = Number(data.ravena_budget_mensal) || 0;
          setMetaOrg({ revs, budget });
          setFeriadosMes((data as any)?.feriados_mes || []);
          // Mostra modal na primeira visita se metas não configuradas
          const key = `floow_meta_setup_${orgId}`;
          if (!localStorage.getItem(key) && revs === 0 && !data.meta_account_id) {
            setMetaModalBudget(5000);
            setMetaModalRevs(50);
            setTimeout(() => setShowMetaModal(true), 1200);
          }
        }
      });
  }, [orgId]); // eslint-disable-line

  async function handleSaveMetaSetup() {
    if (!orgId) return;
    setMetaModalSaving(true);
    await (supabase as any).from('organizations').update({
      ravena_budget_mensal: metaModalBudget,
      ravena_meta_revendedoras: metaModalRevs,
    }).eq('id', orgId);
    setMetaOrg({ revs: metaModalRevs, budget: metaModalBudget });
    localStorage.setItem(`floow_meta_setup_${orgId}`, 'done');
    setMetaModalSaving(false);
    setShowMetaModal(false);
  }

  function closeMetaModal() {
    if (orgId) localStorage.setItem(`floow_meta_setup_${orgId}`, 'done');
    setShowMetaModal(false);
  }

  const primeiroNome = nomeEmpresa.split(' ')[0];

  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Carrega período salvo do localStorage após montar
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setSelectedPeriod(saved);
      const savedC = localStorage.getItem(STORAGE_CUSTOM);
      if (savedC) {
        const parsed = JSON.parse(savedC);
        if (parsed.from) setCustomFrom(parsed.from);
        if (parsed.to) setCustomTo(parsed.to);
      }
    } catch { }
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metaMetrics, setMetaMetrics] = useState<MetaMetrics>({ spend: 0, leads: 0, cpl: 0, impressions: 0, clicks: 0, ctr: 0, cplRealTime: 0 });
  const [metaCampaigns, setMetaCampaigns] = useState<Campaign[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);
  const [cardRevKey, setCardRevKey] = useState(0);
  const revTriggered = useRef(false);
  const [spendThisMonth, setSpendThisMonth] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);
  // Refs para evitar stale closure em callbacks assíncronos
  const metaReadyRef = useRef(false);
  const metaTokenRef = useRef('');
  const metaAccountRef = useRef('');
  const selectedPeriodRef = useRef(selectedPeriod);
  const customFromRef = useRef(customFrom);
  const customToRef = useRef(customTo);
  const orgIdRef = useRef(orgId);
  const allLeadsRef = useRef<Lead[]>([]);
  const isFirstLoadRef = useRef(true);

  // Mantém refs sempre atualizadas
  useEffect(() => { metaReadyRef.current = metaReady; }, [metaReady]);
  useEffect(() => { metaTokenRef.current = metaToken; }, [metaToken]);
  useEffect(() => { metaAccountRef.current = metaAccount; }, [metaAccount]);
  useEffect(() => { selectedPeriodRef.current = selectedPeriod; }, [selectedPeriod]);
  useEffect(() => { customFromRef.current = customFrom; }, [customFrom]);
  useEffect(() => { customToRef.current = customTo; }, [customTo]);
  useEffect(() => { orgIdRef.current = orgId; }, [orgId]);
  useEffect(() => { allLeadsRef.current = allLeads; }, [allLeads]);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => { function close(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDropdown(false); if (customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false); } document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);

  const DASH_FIELDS = 'id, nome, cidade, whatsapp, status, created_at, utm_source, utm_campaign, faixa, score, avaliado, ultimo_status_change, status_aprovado_at, status_reuniao_at, status_contrato_at, status_atendimento_at, status_sem_retorno_at, instagram, custo_indicacao, reuniao_agendada_at, reuniao_link';

  const fetchLeads = async (): Promise<Lead[]> => {
    if (!orgId) { setLoading(false); return []; }
    setLoading(true);

    const PAGE = 1000;

    const { data: firstData, error } = await supabase
      .from('leads')
      .select(DASH_FIELDS)
      .eq('org_id', orgId)
      .order('ultimo_status_change', { ascending: false })
      .range(0, PAGE - 1);

    if (error) {
      console.error('[Dashboard]', error.message);
      setLoading(false);
      return [];
    }

    const firstBatch = (firstData || []) as Lead[];

    if (firstBatch.length < PAGE) {
      setAllLeads(firstBatch);
      setLoading(false);
      return firstBatch;
    }

    let all = [...firstBatch];
    let from = PAGE;
    while (true) {
      const { data } = await supabase
        .from('leads')
        .select(DASH_FIELDS)
        .eq('org_id', orgId)
        .order('ultimo_status_change', { ascending: false })
        .range(from, from + PAGE - 1);

      const batch = (data || []) as Lead[];
      if (!batch.length) break;
      all = [...all, ...batch];
      if (batch.length < PAGE) break;
      from += PAGE;
    }

    setAllLeads(all);
    setLoading(false);
    return all;
  };
  function getMetaCacheKey(period: string, from?: string, to?: string) {
    if (period === 'custom' && from && to) return `meta_dash_${orgId}_custom_${from}_${to}`;
    return `meta_dash_${orgId}_${period}`;
  }

  const loadMeta = async (currentLeads?: Lead[]) => {
    // Usa refs para sempre ter os valores mais atuais (evita stale closure)
    const token = metaTokenRef.current;
    const account = metaAccountRef.current;
    const period = selectedPeriodRef.current;
    const from = customFromRef.current;
    const to = customToRef.current;
    const currentOrgId = orgIdRef.current;

    if (!token || !account) { setMetaLoading(false); return; }

    const key = (period === 'custom' && from && to)
      ? `meta_dash_${currentOrgId}_custom_${from}_${to}`
      : `meta_dash_${currentOrgId}_${period}`;

    const cached = getMetaCache(key);
    if (cached) {
      setMetaMetrics(cached.metrics);
      setMetaCampaigns(cached.campaigns);
      setMetaLoading(false);
      setMetaError(false);
      return;
    }
    setMetaLoading(true);
    setMetaError(false);
    try {
      const leads = currentLeads ?? allLeadsRef.current;
      const { metrics, campaigns } = await fetchMetaData(period, from, to, leads, token, account);
      if (metrics.spend > 0 || campaigns.length > 0) {
        setMetaCache(key, { metrics, campaigns });
      }
      setMetaMetrics(metrics);
      setMetaCampaigns(campaigns);
      setMetaError(false);
    } catch { setMetaError(true); }
    setMetaLoading(false);
  };


  useEffect(() => {
    if (!user || !orgReady || !orgId) return;
    // No primeiro carregamento (F5), sempre limpa o cache para forçar fetch fresco da API
    if (isFirstLoadRef.current) {
      const period = selectedPeriodRef.current;
      const from = customFromRef.current;
      const to = customToRef.current;
      const cacheKey = (period === 'custom' && from && to)
        ? `meta_dash_${orgId}_custom_${from}_${to}`
        : `meta_dash_${orgId}_${period}`;
      clearMetaCache(cacheKey);
      isFirstLoadRef.current = false;
    }
    fetchLeads().then(leads => {
      // Usa ref para ler metaReady — evita stale closure do momento em que o effect foi criado
      if (metaReadyRef.current && leads.length > 0) loadMeta(leads);
    });
  }, [user?.id, orgReady, orgId, location.key]); // eslint-disable-line

  // Quando metaReady muda para true, tenta carregar Meta se já tiver leads
  useEffect(() => {
    if (!metaReady) return;
    if (!metaToken || !metaAccount) {
      setMetaLoading(false);
      return;
    }
    const leads = allLeadsRef.current;
    if (leads.length > 0) loadMeta(leads);
  }, [metaReady]); // eslint-disable-line

  // Quando muda o período, recarrega os dados do Meta
  useEffect(() => {
    if (!metaReady) return;
    const leads = allLeadsRef.current;
    if (leads.length > 0) loadMeta(leads);
  }, [selectedPeriod, customFrom, customTo]); // eslint-disable-line

  // Gasto do mês corrente (independente do filtro de período)
  useEffect(() => {
    if (!metaToken || !metaAccount) return;
    fetch(
      `https://graph.facebook.com/v18.0/act_${metaAccount}/insights` +
      `?fields=spend&date_preset=this_month&access_token=${metaToken}`
    )
      .then(r => r.json())
      .then(data => {
        const s = parseFloat(data.data?.[0]?.spend || '0');
        setSpendThisMonth(s);
      })
      .catch(() => { });
  }, [metaToken, metaAccount]);

  useEffect(() => { if (!orgReady || !orgId) return; const ch = supabase.channel(`dash-rt-${orgId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, p => { setAllLeads(prev => [p.new as Lead, ...prev]); }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, p => { setAllLeads(prev => prev.map(l => l.id === (p.new as Lead).id ? p.new as Lead : l)); }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'leads' }, p => { setAllLeads(prev => prev.filter(l => l.id !== (p.old as { id: string }).id)); }).subscribe(); return () => { supabase.removeChannel(ch); }; }, [orgId, orgReady]); // eslint-disable-line

  // Polling: recarrega leads + Meta a cada 5 minutos
  useEffect(() => {
    if (!orgReady || !orgId || !metaReady || !metaToken || !metaAccount) return;
    const interval = setInterval(async () => {
      const p = selectedPeriodRef.current;
      const f = customFromRef.current;
      const t = customToRef.current;
      const key = (p === 'custom' && f && t) ? `meta_dash_${orgId}_custom_${f}_${t}` : `meta_dash_${orgId}_${p}`;
      clearMetaCache(key);
      const leads = await fetchLeads();
      await loadMeta(leads);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [orgId, orgReady, metaReady, metaToken, metaAccount]); // eslint-disable-line

  function selectPeriod(value: string) {
    if (value === 'custom') { setShowDropdown(false); setShowCustom(true); return; }
    const key = `meta_dash_${orgIdRef.current}_${value}`;
    clearMetaCache(key);
    setSelectedPeriod(value);
    try { localStorage.setItem(STORAGE_KEY, value); } catch { }
    setShowDropdown(false);
    setShowCustom(false);
  }
  function applyCustom() { if (!customFrom || !customTo) return; setSelectedPeriod('custom'); try { localStorage.setItem(STORAGE_KEY, 'custom'); localStorage.setItem(STORAGE_CUSTOM, JSON.stringify({ from: customFrom, to: customTo })); } catch { } setShowCustom(false); }
  async function handleRefresh() {
    const p = selectedPeriodRef.current;
    const f = customFromRef.current;
    const t = customToRef.current;
    const key = (p === 'custom' && f && t) ? `meta_dash_${orgIdRef.current}_custom_${f}_${t}` : `meta_dash_${orgIdRef.current}_${p}`;
    clearMetaCache(key);
    setIsRefreshing(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      const leads = await fetchLeads();
      await Promise.race([loadMeta(leads), timeout]);
    } catch (err) {
      console.warn('[refresh] timeout ou erro:', err);
    }
    setIsRefreshing(false);
  }

  // Navega para leads filtrados por campanha + período atual
  function goToLeads(campanhaNome: string) {
    const PERIOD_MAP: Record<string, string> = { today: 'today', yesterday: 'yesterday', '7days': '7days', '30days': '30days', month: 'month', custom: 'custom' };
    const p = PERIOD_MAP[selectedPeriod] || 'all';
    const customQ = selectedPeriod === 'custom' && customFrom && customTo ? `&de=${customFrom}&ate=${customTo}` : '';
    navigate(`/leads?campanha=${encodeURIComponent(campanhaNome.split('|')[0].trim())}&periodo=${p}${customQ}`);
  }

  const filtered = useMemo(() => filterByPeriod(allLeads, selectedPeriod, customFrom, customTo), [allLeads, selectedPeriod, customFrom, customTo]);
  const totalLeads = filtered.length;
  const approved = useMemo(() => {
    return allLeads.filter(l => isLeadMovedToStatusInPeriod(l, statusConfig.convertido_status, selectedPeriod, customFrom, customTo)).length;
  }, [allLeads, selectedPeriod, customFrom, customTo, statusConfig]);
  const approvedThisMonth = useMemo(() => {
    const today = todayBR();
    const from = today.slice(0, 7) + '-01';
    return allLeads.filter(l => {
      if (toNum(l.status) !== statusConfig.convertido_status) return false;
      return isDateInPeriod(getStatusMoveDate(l, statusConfig.convertido_status), 'custom', from, today);
    }).length;
  }, [allLeads, statusConfig]);
  const convRate = totalLeads > 0 ? safe((approved / totalLeads) * 100).toFixed(1) : '0.0';
  const metaSpend = metaMetrics.spend || 0;
  const custoIndicacaoOrigem = useMemo(() =>
    filtered
      .filter(l => origemKey((l as any).utm_source, (l as any).utm_campaign) === 'indicacao')
      .reduce((sum, l) => sum + (Number((l as any).custo_indicacao) || 0), 0),
    [filtered]);
  const custoTotalIndicacao = useMemo(() =>
    allLeads
      .filter(l => normalizarOrigem((l as any).utm_source) === 'IndicaÃ§Ã£o')
      .filter(l => isLeadMovedToStatusInPeriod(l, statusConfig.convertido_status, selectedPeriod, customFrom, customTo))
      .filter(l => (l as any).status_aprovado_at != null)
      .reduce((sum, l) => sum + (Number((l as any).custo_indicacao) || 0), 0),
    [allLeads, statusConfig, selectedPeriod, customFrom, customTo]);
  const spend = metaSpend + custoIndicacaoOrigem;
  const chartData = useMemo(() => buildChartDataDual(allLeads, selectedPeriod, customFrom, customTo, statusConfig.convertido_status), [allLeads, selectedPeriod, customFrom, customTo, statusConfig]);
  const funnelData = useMemo(() => {
    return funnelConfig.map(f => {
      const value = allLeads.filter(l => isLeadMovedToStatusInPeriod(l, f.statusId, selectedPeriod, customFrom, customTo)).length;
      return { ...f, value };
    });
  }, [allLeads, selectedPeriod, customFrom, customTo, funnelConfig]);
  const funnelTotal = useMemo(() => funnelData.reduce((sum, item) => sum + item.value, 0), [funnelData]);
  const recentLeads = useMemo(() => [...allLeads].sort((a, b) => parseLeadDate(b.created_at).getTime() - parseLeadDate(a.created_at).getTime()).slice(0, 5), [allLeads]);
  const rankingOrigens = useMemo(() => {
    const FIXAS = ['Meta Ads', 'Indicação', 'Orgânico', 'Outros'] as const;
    const isConvertidoNoPeriodo = (l: Lead) => {
      return isLeadMovedToStatusInPeriod(l, statusConfig.convertido_status, selectedPeriod, customFrom, customTo);
    };
    const revMap: Record<string, number> = { 'Meta Ads': 0, 'Indicação': 0, 'Orgânico': 0, 'Outros': 0 };
    const leadsMap: Record<string, number> = { 'Meta Ads': 0, 'Indicação': 0, 'Orgânico': 0, 'Outros': 0 };
    for (const lead of allLeads) {
      if (!isConvertidoNoPeriodo(lead)) continue;
      const nome = normalizarOrigem((lead as any).utm_source);
      revMap[nome] = (revMap[nome] || 0) + 1;
    }
    for (const lead of filtered) {
      const nome = normalizarOrigem((lead as any).utm_source);
      leadsMap[nome] = (leadsMap[nome] || 0) + 1;
    }
    return FIXAS.map(nome => {
      const aprovadas = revMap[nome] || 0;
      const totalLeads = leadsMap[nome] || 0;
      const investido = nome === 'Meta Ads' ? (metaSpend || 0) : nome === 'Indicação' ? (custoTotalIndicacao || 0) : 0;
      const cprMeta = investido > 0 && aprovadas > 0 ? investido / aprovadas : 0;
      return { nome, cor: corOrigem(nome), aprovadas, totalLeads, investido, cprMeta };
    });
  }, [allLeads, filtered, statusConfig, metaSpend, custoTotalIndicacao, selectedPeriod, customFrom, customTo]);

  const rankingOrigensCorrigido = useMemo(() => {
    const fixas = ['meta', 'indicacao', 'organico', 'outros'] as const;
    const revMap: Record<string, number> = { meta: 0, indicacao: 0, organico: 0, outros: 0 };
    const leadsMap: Record<string, number> = { meta: 0, indicacao: 0, organico: 0, outros: 0 };
    for (const lead of allLeads) {
      if (!isLeadMovedToStatusInPeriod(lead, statusConfig.convertido_status, selectedPeriod, customFrom, customTo)) continue;
      const nome = origemKey((lead as any).utm_source, (lead as any).utm_campaign);
      revMap[nome] = (revMap[nome] || 0) + 1;
    }
    for (const lead of filtered) {
      const nome = origemKey((lead as any).utm_source, (lead as any).utm_campaign);
      leadsMap[nome] = (leadsMap[nome] || 0) + 1;
    }
    return fixas.map(nome => {
      const aprovadas = revMap[nome] || 0;
      const totalLeadsOrigem = leadsMap[nome] || 0;
      const investido = nome === 'meta' ? (metaSpend || 0) : nome === 'indicacao' ? (custoIndicacaoOrigem || 0) : 0;
      const cprMeta = investido > 0 && aprovadas > 0 ? investido / aprovadas : 0;
      return { nome: origemLabel(nome), cor: origemColor(nome), aprovadas, totalLeads: totalLeadsOrigem, investido, cprMeta };
    });
  }, [allLeads, filtered, statusConfig, metaSpend, custoIndicacaoOrigem, selectedPeriod, customFrom, customTo]);

  const campRows = useMemo(() => {
    if (!metaCampaigns.length) return [];
    const withSpend = metaCampaigns.filter(c => Number(c.spend) > 0);
    if (!withSpend.length) return [];
    const maxSpend = Math.max(...withSpend.map(c => Number(c.spend)), 1);
    return withSpend.sort((a, b) => { const pA = a.leads_api > 0 ? a.leads_api / a.spend : 0; const pB = b.leads_api > 0 ? b.leads_api / b.spend : 0; if (pA !== pB) return pB - pA; return b.spend - a.spend; }).slice(0, 5).map(c => {
      // Conta leads no CRM pela utm_campaign (mais rápido que FB API, sem delay)
      const nameLower = c.name.toLowerCase().split('|')[0].trim();
      const leadsCRM = filtered.filter(l => {
        const la = l as any;
        const camp = (la.utm_campaign || '').toLowerCase().split('|')[0].trim();
        return camp && camp.includes(nameLower.slice(0, 20));
      }).length;
      const leadsCount = leadsCRM || c.leads_api || 0;
      return {
        name: c.name.length > 24 ? c.name.slice(0, 24) + '…' : c.name,
        fullName: c.name,
        spend: `R$ ${Number(c.spend || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        leads: leadsCount,
        cpl: leadsCount > 0 && c.spend > 0 ? `R$ ${(c.spend / leadsCount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—',
        perf: Math.round((Number(c.spend) / maxSpend) * 100),
        isCRM: leadsCRM > 0,
      };
    });
  }, [metaCampaigns, filtered]);


  const periodLabel = selectedPeriod === 'custom' && customFrom && customTo ? `${isoToBR(customFrom)} – ${isoToBR(customTo)}` : PERIOD_FILTERS.find(p => p.value === selectedPeriod)?.label ?? 'Hoje';

  const greetingPrefix = `${getGreeting()}${primeiroNome ? ',' : ''}`;
  const greetingName = primeiroNome ? `${primeiroNome}!` : '';
  const { text: typedName, done: typingDone } = useTypewriter(greetingName, 55, 300);

  const [metaTimeout, setMetaTimeout] = useState(false);
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setMetaTimeout(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  const allLoaded = !loading && (!metaLoading || metaTimeout);
  const [showContent, setShowContent] = useState(false);
  useEffect(() => {
    if (!loading && !revTriggered.current) {
      revTriggered.current = true;
      const t = setTimeout(() => { setCardRevKey(1); setShowContent(true); }, 50);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const sk = (w = '80px', h = '26px') => (
    <div style={{ display: 'inline-block', width: w, height: h, borderRadius: '6px', background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', animation: 'dashSkeleton 1.5s ease-in-out infinite', verticalAlign: 'middle' }} />
  );

  // Dark tokens — sistema coerente com toda a aplicação
  const bg = dark ? '#0f0f10' : '#f4f4f5';
  const cardBg = dark ? '#1b1b1d' : '#ffffff';
  const border = dark ? 'rgba(255,255,255,0.07)' : '#e5e7eb';
  const cardShadow = dark ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' : '0 1px 3px rgba(0,0,0,0.06)';
  const txtHi = dark ? '#f0f0f0' : '#111827';
  const txtMid = dark ? '#a0a0a8' : '#374151';
  const txtLow = dark ? '#8a8a96' : '#6b7280';
  const gridLn = dark ? 'rgba(255,255,255,0.04)' : '#f0f0f0';
  const divCls = dark ? 'rgba(255,255,255,0.05)' : '#f3f4f6';
  const hov = dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)';
  const pad = isMobile ? '16px 18px' : '32px';
  const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: txtMid, fontSize: '13px', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'inherit', boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.4)' : 'none' };
  // statusClass removido — pills usam STATUS_DARK_COLOR/BG/BORDER inline

  return (
    <AppLayout leadCount={allLeads.length}>
      <div style={{ padding: pad, background: bg, minHeight: '100vh', overflowX: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? '14px' : '20px', gap: '8px' }}>
          <div>
            {isMobile ? (
              <div style={{ margin: 0 }}>
                <p style={{ fontSize: '16px', fontWeight: 500, fontFamily: 'Inter, sans-serif', color: txtMid, margin: 0, animation: 'greetingWordIn 0.4s ease-out 0.1s both' }}>{greetingPrefix}</p>
                <p style={{ fontSize: '26px', fontWeight: 800, fontFamily: 'Inter, sans-serif', color: txtHi, margin: 0, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{typedName}</span>
                  {!typingDone && <span className="typewriter-cursor" style={{ animation: 'cursorBlink 0.7s step-end infinite', fontWeight: 100, color: txtLow }}>|</span>}
                  <img src="/wave.png" alt="" style={{ width: '26px', height: '26px', objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                </p>
              </div>
            ) : (
              <h1 style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Inter, sans-serif', color: txtHi, letterSpacing: '-0.04em', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ animation: 'greetingWordIn 0.4s ease-out 0.1s both' }}>{greetingPrefix}</span>
                <span>{typedName}</span>
                {!typingDone && <span className="typewriter-cursor" style={{ animation: 'cursorBlink 0.7s step-end infinite', fontWeight: 100, color: txtLow }}>|</span>}
                <img src="/wave.png" alt="" style={{ width: '22px', height: '22px', objectFit: 'contain', marginLeft: '4px' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </h1>
            )}
            <p style={{ fontSize: isMobile ? '11px' : '12px', color: txtLow, marginTop: isMobile ? '2px' : '3px' }}>{(() => {
              try {
                const d = new Date();
                const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
                const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
              } catch { return ''; }
            })()}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }} ref={dropRef}>
              <button onClick={() => { setShowDropdown(v => !v); setShowCustom(false); }} style={btnBase}>
                {periodLabel}
                <ChevronDown style={{ width: '14px', height: '14px', color: txtLow, transform: showDropdown ? 'rotate(180deg)' : '', transition: 'transform 0.18s' }} />
              </button>
              {showDropdown && (
                <div style={{ position: 'absolute', right: 0, left: 'auto', top: 'calc(100% + 6px)', background: cardBg, border: `1px solid ${border}`, borderRadius: '12px', padding: '4px', minWidth: '160px', maxWidth: 'calc(100vw - 32px)', zIndex: 50, boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.1)' }}>
                  {PERIOD_FILTERS.map(f => (
                    <button key={f.value} onClick={() => selectPeriod(f.value)} style={{ width: '100%', padding: '7px 10px', borderRadius: '8px', border: 'none', background: selectedPeriod === f.value ? (dark ? 'rgba(255,255,255,0.08)' : '#eff6ff') : 'transparent', color: selectedPeriod === f.value ? (dark ? '#6b9fff' : '#0044fd') : txtMid, fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              {showCustom && (
                <div ref={customRef} style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', padding: '16px', zIndex: 50, minWidth: '260px', boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 32px rgba(0,0,0,0.12)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Período personalizado</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[{ label: 'Data inicial', val: customFrom, set: setCustomFrom }, { label: 'Data final', val: customTo, set: setCustomTo }].map(({ label, val, set }) => (
                      <div key={label}>
                        <label style={{ fontSize: '11px', color: txtMid, display: 'block', marginBottom: '4px' }}>{label}</label>
                        <div style={{ position: 'relative' }}>
                          <input type="date" value={val} onChange={e => set(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : border}`, background: dark ? '#0f0f10' : cardBg, color: 'transparent', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as any, cursor: 'pointer' }} />
                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: val ? txtHi : txtLow, pointerEvents: 'none' }}>{val ? isoToBR(val) : 'dd/mm/aaaa'}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button onClick={applyCustom} style={{ flex: 1, padding: '8px', borderRadius: '8px', background: '#0044fd', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Aplicar</button>
                      <button onClick={() => setShowCustom(false)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${border}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleRefresh} style={{ ...btnBase, minWidth: isMobile ? '44px' : undefined, minHeight: isMobile ? '44px' : undefined, justifyContent: 'center' }}>
              <RefreshCw style={{ width: '14px', height: '14px', color: txtMid, animation: isRefreshing ? 'spin 1s linear infinite' : '' }} />
            </button>
            {!isMobile && (
              <button style={{ ...btnBase, background: '#0044fd', border: 'none', color: '#fff', fontWeight: 500 }}>
                <Download style={{ width: '14px', height: '14px' }} /> Exportar
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        {isMobile ? (
          /* ── MOBILE: coluna única, cards horizontais com acento lateral ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>

            {/* Card 1: META DO MÊS — hero azul */}
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 6px 18px rgba(0,68,253,0.28)', border: 'none', animation: showContent ? 'cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms both' : 'none', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', margin: '0 0 3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Meta do mês</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {showContent ? <AnimatedCounter value={approvedThisMonth} /> : <div style={{ display: 'inline-block', width: '48px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.25)', animation: 'dashSkeleton 1.5s ease-in-out infinite', verticalAlign: 'middle' }} />}
                    </div>
                    {metaOrg.revs > 0 && <span style={{ fontSize: '14px', fontWeight: 400, color: 'rgba(255,255,255,0.6)', paddingBottom: '2px' }}>/{metaOrg.revs}</span>}
                    {metaOrg.revs > 0 && approvedThisMonth != null && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '99px', verticalAlign: 'middle', flexShrink: 0 }}>{Math.round((approvedThisMonth / metaOrg.revs) * 100)}%</span>}
                  </div>
                </div>
              </div>
              {metaOrg.revs > 0 && approvedThisMonth != null && (() => {
                const { diff, metaDiaria, restantes, status } = calcularRitmo(approvedThisMonth, metaOrg.revs, feriadosMes);
                return <RitmoResumo metaDiaria={metaDiaria} status={status} convertidoCurto={t.convertidoCurto} faltamMeta={Math.max(metaOrg.revs - approvedThisMonth, 0)} compact />;
                const pct = Math.round((approvedThisMonth / metaOrg.revs) * 100);
                const cor = status === 'ok' ? 'rgba(134,239,172,0.95)' : status === 'ritmo' ? 'rgba(253,224,71,0.95)' : 'rgba(255,160,160,1)';
                const sinal = diff > 0 ? `+${diff}` : `${diff}`;
                return (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', flexWrap: 'nowrap', lineHeight: 1 }}>
                    <span style={{ color: cor, fontWeight: 700, flexShrink: 0 }}>{sinal} {t.convertidoCurto}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>·</span>
                    <span style={{ flexShrink: 0 }}>meta: {metaDiaria.toFixed(1)}/dia</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>·</span>
                    <span style={{ flexShrink: 0 }}>{restantes}d úteis</span>
                    <RitmoTooltip dark={dark} />
                  </div>
                );
              })()}
            </div>

            {/* Card 2: GASTO TOTAL — acento verde */}
            <div style={{ background: cardBg, borderRadius: '12px', padding: '18px 20px', border: `1px solid ${border}`, borderLeft: '3px solid #10b981', boxShadow: cardShadow, animation: showContent ? 'cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 80ms both' : 'none', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10px', color: txtLow, margin: '0 0 2px', fontWeight: 500 }}>Gasto Total</p>
                <div style={{ fontSize: '24px', fontWeight: 800, color: txtHi, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {allLoaded ? <>R$&nbsp;<AnimatedCounter value={spend} decimals={2} /></> : sk('80px', '24px')}
                </div>
              </div>
              <span style={{ fontSize: '12px', color: txtLow, textAlign: 'right', flexShrink: 0 }}>Total Período</span>
            </div>

            {/* Card 3: LEADS — acento azul */}
            <div style={{ background: cardBg, borderRadius: '12px', padding: '18px 20px', border: `1px solid ${border}`, borderLeft: '3px solid #0044fd', boxShadow: cardShadow, animation: showContent ? 'cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 160ms both' : 'none', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10px', color: txtLow, margin: '0 0 2px', fontWeight: 500 }}>Leads</p>
                <div style={{ fontSize: '24px', fontWeight: 800, color: txtHi, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {allLoaded ? <AnimatedCounter value={totalLeads} /> : sk('50px', '24px')}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '11px', color: txtLow, margin: 0 }}>Total Período</p>
                {spend > 0 && totalLeads > 0 && <p style={{ fontSize: '12px', fontWeight: 700, color: '#3b82f6', margin: '2px 0 0' }}>CPL R$ {safe(spend / totalLeads).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
              </div>
            </div>

            {/* Card 4: CONVERTIDOS — acento roxo */}
            <div style={{ background: cardBg, borderRadius: '12px', padding: '18px 20px', border: `1px solid ${border}`, borderLeft: '3px solid #7e3beb', boxShadow: cardShadow, animation: showContent ? 'cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 240ms both' : 'none', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '10px', color: txtLow, margin: '0 0 2px', fontWeight: 500 }}>{t.convertidoPlural}</p>
                <div style={{ fontSize: '24px', fontWeight: 800, color: txtHi, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {allLoaded ? <AnimatedCounter value={approved} /> : sk('50px', '24px')}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e', margin: 0 }}>{convRate}% conversão</p>
                {spend > 0 && approved > 0 && <p style={{ fontSize: '11px', color: txtMid, margin: '2px 0 0' }}>{t.custoConversaoSigla} R$ {safe(spend / approved).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>}
              </div>
            </div>

          </div>
        ) : (
          /* ── DESKTOP: original 4-col grid ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '16px' }}>

            {/* Card 1: META DO MÊS — hero */}
            <div style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 24px rgba(0,68,253,0.25)', border: 'none', animation: showContent ? `cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 0ms both` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Meta do mês</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', marginBottom: '10px' }}>
                <div style={{ fontSize: '36px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {showContent ? <AnimatedCounter value={approvedThisMonth} /> : <div style={{ display: 'inline-block', width: '56px', height: '36px', borderRadius: '8px', background: 'rgba(255,255,255,0.25)', animation: 'dashSkeleton 1.5s ease-in-out infinite', verticalAlign: 'middle' }} />}
                </div>
                {metaOrg.revs > 0 && <span style={{ fontSize: '16px', fontWeight: 400, color: 'rgba(255,255,255,0.7)', paddingBottom: '4px' }}>/{metaOrg.revs}</span>}
                {metaOrg.revs > 0 && approvedThisMonth != null && <span style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '99px', verticalAlign: 'middle', flexShrink: 0 }}>{Math.round((approvedThisMonth / metaOrg.revs) * 100)}%</span>}
              </div>
              {metaOrg.revs > 0 && approvedThisMonth != null && (() => {
                const { diff, metaDiaria, restantes, status } = calcularRitmo(approvedThisMonth, metaOrg.revs, feriadosMes);
                return <RitmoResumo metaDiaria={metaDiaria} status={status} convertidoCurto={t.convertidoCurto} faltamMeta={Math.max(metaOrg.revs - approvedThisMonth, 0)} />;
                const pct = Math.round((approvedThisMonth / metaOrg.revs) * 100);
                const cor = status === 'ok' ? 'rgba(134,239,172,0.95)' : status === 'ritmo' ? 'rgba(253,224,71,0.95)' : 'rgba(255,160,160,1)';
                const sinal = diff > 0 ? `+${diff}` : `${diff}`;
                return (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', flexWrap: 'nowrap', lineHeight: 1 }}>
                    <span style={{ color: cor, fontWeight: 700, flexShrink: 0 }}>{sinal} {t.convertidoCurto}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>·</span>
                    <span style={{ flexShrink: 0 }}>meta: {metaDiaria.toFixed(1)}/dia</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>·</span>
                    <span style={{ flexShrink: 0 }}>{restantes}d úteis</span>
                    <RitmoTooltip dark={dark} />
                  </div>
                );
              })()}
            </div>

            {/* Card 2: GASTO TOTAL */}
            <div style={{ background: cardBg, borderRadius: '14px', padding: '20px 24px', border: `1px solid ${border}`, boxShadow: cardShadow, animation: showContent ? `cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 80ms both` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
              <p style={{ fontSize: '11px', color: txtLow, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Gasto Total</p>
              <div style={{ fontSize: '32px', fontWeight: 800, color: txtHi, letterSpacing: '-0.03em', lineHeight: 1, margin: '8px 0' }}>
                {allLoaded ? <>R$&nbsp;<AnimatedCounter value={spend} decimals={2} /></> : sk('110px', '32px')}
              </div>
              <span style={{ fontSize: '11px', color: txtLow }}>Total Período</span>
            </div>

            {/* Card 3: LEADS + CPL */}
            <div style={{ background: cardBg, borderRadius: '14px', padding: '20px 24px', border: `1px solid ${border}`, boxShadow: cardShadow, animation: showContent ? `cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 160ms both` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
              <p style={{ fontSize: '11px', color: txtLow, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Leads</p>
              <div style={{ fontSize: '32px', fontWeight: 800, color: txtHi, letterSpacing: '-0.03em', lineHeight: 1, margin: '8px 0' }}>
                {allLoaded ? <AnimatedCounter value={totalLeads} /> : sk('60px', '32px')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: txtLow }}>Total Período</span>
                {spend > 0 && totalLeads > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#3b82f6' }}>
                    CPL R$ {safe(spend / totalLeads).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

            {/* Card 4: CONVERTIDOS + CUSTO CONVERSAO */}
            <div style={{ background: cardBg, borderRadius: '14px', padding: '20px 24px', border: `1px solid ${border}`, boxShadow: cardShadow, animation: showContent ? `cardIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) 240ms both` : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '140px' }}>
              <p style={{ fontSize: '11px', color: txtLow, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{t.convertidoPlural}</p>
              <div style={{ fontSize: '32px', fontWeight: 800, color: txtHi, letterSpacing: '-0.03em', lineHeight: 1, margin: '8px 0' }}>
                {allLoaded ? <AnimatedCounter value={approved} /> : sk('60px', '32px')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>{convRate}% conversão</span>
                {spend > 0 && approved > 0 && (
                  <span style={{ fontSize: '11px', color: txtMid }}>
                    {t.custoConversaoSigla} R$ {safe(spend / approved).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

          </div>
        )}

        {rankingOrigensCorrigido.length > 0 && allLoaded && showContent && !isMobile && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: txtHi }}>Origens no período</span>
              <button onClick={() => navigate('/origens')} style={{ border: 'none', background: 'transparent', color: '#3b82f6', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Ver detalhes
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {rankingOrigensCorrigido.slice(0, 4).map(origem => (
                <div
                  key={origem.nome}
                  onClick={() => navigate('/origens')}
                  style={{
                    background: cardBg,
                    border: `1px solid ${border}`,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    padding: '12px 14px',
                    transition: 'background 0.15s ease-out, transform 0.15s ease-out, border-color 0.15s ease-out',
                    boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.28)' : '0 1px 2px rgba(15,23,42,0.05)',
                    minWidth: 0,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.035)' : '#ffffff';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLElement).style.borderColor = dark ? 'rgba(255,255,255,0.12)' : 'rgba(59,130,246,0.18)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = cardBg;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    (e.currentTarget as HTMLElement).style.borderColor = border;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: origem.cor, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{origem.nome}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: txtLow, whiteSpace: 'nowrap' }}>{origem.totalLeads} leads</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: txtHi, lineHeight: 1 }}>{origem.aprovadas}</div>
                      <div style={{ fontSize: '9px', color: txtLow, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>{t.convertidoCurto}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: origem.investido > 0 ? 750 : 650, color: origem.investido > 0 ? txtMid : (dark ? 'rgba(255,255,255,0.32)' : 'rgba(107,114,128,0.45)'), lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {origem.investido > 0 ? `R$${Math.round(origem.investido).toLocaleString('pt-BR')}` : 'Sem custo'}
                      </div>
                      <div style={{ fontSize: '9px', color: txtLow, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Invest</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: origem.cprMeta > 0 ? 750 : 650, color: origem.cprMeta > 0 ? txtMid : (dark ? 'rgba(255,255,255,0.32)' : 'rgba(107,114,128,0.45)'), lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {origem.cprMeta > 0 ? `R$${Math.round(origem.cprMeta)}` : 'Aguard.'}
                      </div>
                      <div style={{ fontSize: '9px', color: txtLow, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>{t.custoConversaoSigla}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gráfico + Calendário */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
          <div style={{ background: cardBg, borderRadius: isMobile ? '12px' : '14px', padding: isMobile ? '14px 16px' : '24px', border: `1px solid ${border}`, boxShadow: cardShadow }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0 }}>Evolução de Leads</h3>
                <p style={{ fontSize: '11px', color: txtLow, marginTop: '2px' }}>{periodLabel}</p>
              </div>
              <button style={{ padding: '4px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <MoreHorizontal style={{ width: '14px', height: '14px', color: txtLow }} />
              </button>
            </div>
            {chartData.length > 0 && <>
              <div style={{ width: '100%', height: isMobile ? 140 : 200, minHeight: 120, animation: showContent ? 'chartIn 0.6s ease-out 0.3s both' : 'none' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="leads-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={dark ? '#0044fd' : '#3b82f6'} stopOpacity={dark ? 0.18 : 0.22} />
                        <stop offset="100%" stopColor={dark ? '#0044fd' : '#3b82f6'} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: txtLow, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: txtLow, fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                    <Tooltip contentStyle={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '10px', fontSize: '12px', color: txtHi }} formatter={(value: any) => [value, 'Leads']} />
                    <Area type="monotoneX" dataKey="leads" name="leads" stroke={dark ? '#0044fd' : '#3b82f6'} strokeWidth={2.5} fill="url(#leads-gradient)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: dark ? '#0044fd' : '#3b82f6' }} animationDuration={1200} animationEasing="ease-out" animationBegin={0} isAnimationActive={showContent} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </>}
          </div>
          {!isMobile && (
            <MiniCalendarioReuniao
              dark={dark}
              orgId={orgId}
              reuniaoStatusIds={reuniaoStatusIds}
              onDayClick={data => navigate(data === 'sem-data' ? '/calendario?semdata=1' : `/calendario?data=${data}`)}
            />
          )}
        </div>

        {/* Funil Horizontal */}
        <FunilHorizontal
          funnelData={funnelData}
          totalLeads={funnelTotal}
          dark={dark}
          loading={loading}
          navigate={navigate}
          selectedPeriod={selectedPeriod}
        />

        {/* Leads + Campanhas */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '14px', minWidth: 0, overflow: 'hidden' }}>

          {/* Leads Recentes */}
          <div style={{ background: cardBg, borderRadius: '14px', padding: isMobile ? '16px' : '24px', border: `1px solid ${border}`, boxShadow: cardShadow, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0 }}>Leads Recentes</h3>
              <Link to="/leads" style={{ fontSize: '12px', color: '#0044fd', fontWeight: 500, textDecoration: 'none' }}>Ver todos</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {loading ? [...Array(4)].map((_, i) => <div key={i} style={{ height: '44px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', marginBottom: '2px' }} />)
                : recentLeads.length === 0 ? <p style={{ fontSize: '13px', color: txtMid, textAlign: 'center', padding: '20px 0' }}>Nenhum lead</p>
                  : recentLeads.map((lead, idx) => {
                    const st = toNum(lead.status);
                    const safeNome = safeName(lead.nome) || 'Lead';
                    return (
                      <div key={lead.id} onClick={() => setViewingLead(lead)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '8px' : '7px 8px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.12s', animation: showContent ? `rowSlideIn 0.3s ease-out ${idx * 50}ms both` : 'none', background: idx % 2 !== 0 ? (dark ? '#141416' : '#f9fafb') : 'transparent', minHeight: isMobile ? '52px' : undefined }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = idx % 2 !== 0 ? (dark ? '#141416' : '#f9fafb') : 'transparent'}
                      >
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          {(() => { const sz = isMobile ? '32px' : '28px'; const ac = getAvatarColor(lead.nome, dark, lead.id); return <div style={{ width: sz, height: sz, borderRadius: '50%', background: ac, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getAvatarTextColor(ac), fontSize: '11px', fontWeight: 700 }}>{safeInitials(safeNome)}</div>; })()}
                          {(toNum(lead.status) === 0 || toNum(lead.status) === 1) && !(lead as any).avaliado && (
                            <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', border: `1.5px solid ${dark ? '#111113' : '#ffffff'}`, boxShadow: '0 0 0 1px rgba(59,130,246,0.25)', zIndex: 2 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12.5px', fontWeight: 500, color: txtHi, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{safeNome.split(' ').filter(Boolean).slice(0, 2).join(' ') || 'Lead'}</p>
                          <p style={{ fontSize: '11px', color: txtLow, margin: 0 }}>{lead.cidade || '—'}</p>
                        </div>
                        {!isMobile && (() => {
                          const la = lead as any;
                          const score = la.score != null ? Number(la.score) : null;
                          if (score == null) return null;
                          const faixaLead = (calcularFaixa(lead as any, configuracoes!) ?? la.faixa) as string || null;
                          const color = faixaLead === 'verde' ? (dark ? '#34d399' : '#10b981') : faixaLead === 'amarelo' ? (dark ? '#fbbf24' : '#f59e0b') : '#9ca3af';
                          return <span style={{ fontSize: '12px', fontWeight: 700, color, flexShrink: 0, whiteSpace: 'nowrap', minWidth: '72px', textAlign: 'center' }}>{score} pts</span>;
                        })()}
                        {(() => { const ps = getStatusPillStyle(st, dark); return (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minWidth: isMobile ? 'auto' : '130px', padding: isMobile ? '2px 8px' : '4px 10px', borderRadius: '6px', whiteSpace: 'nowrap', fontSize: isMobile ? '10px' : '11.5px', fontWeight: 600, background: ps.background, color: ps.color, border: ps.border }}>
                            {!isMobile && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: (ps as any).dotColor, flexShrink: 0, display: 'inline-block' }} />}
                            {statusLabelFn(st)}
                          </span>
                        ); })()}
                        {!isMobile && <span style={{ fontSize: '11px', color: txtLow, flexShrink: 0, minWidth: '28px', textAlign: 'right' }}>{relativeTime(lead.created_at)}</span>}
                        <button
                          onClick={e => { e.stopPropagation(); handleWhatsApp(lead); }}
                          className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center transition-colors flex-shrink-0"
                          style={{ border: 'none', cursor: lead.whatsapp ? 'pointer' : 'default', opacity: lead.whatsapp ? 1 : 0.4 }}>
                          <MessageCircle className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Campanhas */}
          <div style={{ background: cardBg, borderRadius: '14px', padding: isMobile ? '16px' : '24px', border: `1px solid ${border}`, boxShadow: cardShadow, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: txtHi, margin: 0 }}>Campanhas</h3>
                <div style={{ position: 'relative', width: '7px', height: '7px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: metaError ? '#ef4444' : '#22c55e' }} />
                  {!metaError && <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.6 }} />}
                </div>
              </div>
              <Link to="/campanhas" style={{ fontSize: '12px', color: '#0044fd', fontWeight: 500, textDecoration: 'none' }}>Ver todas</Link>
            </div>
            {metaLoading
              ? [...Array(3)].map((_, i) => <div key={i} style={{ height: '32px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', marginBottom: '8px' }} />)
              : !metaReady
                ? [...Array(3)].map((_, i) => <div key={i} style={{ height: '32px', borderRadius: '8px', background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', marginBottom: '8px' }} />)
                : !metaToken || !metaAccount
                  ? <div style={{ textAlign: 'center', padding: '20px 0' }}><p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>Configure o token do Meta Ads em Configurações</p></div>
                  : metaError || campRows.length === 0
                    ? <div style={{ textAlign: 'center', padding: '20px 0' }}><p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>{metaError ? 'Erro ao conectar ao Meta Ads' : 'Nenhuma campanha'}</p></div>
                    : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            {(['Campanha', 'Gasto', 'Leads', 'CPL', !isMobile && 'Perf.'] as any[]).filter(Boolean).map((h: string) => (
                              <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 600, color: txtLow, paddingBottom: '8px', letterSpacing: '0.05em', textTransform: 'uppercase', paddingRight: '6px', overflow: 'hidden' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {campRows.map((row, i) => (
                            <tr key={i}
                              style={{ background: i % 2 !== 0 ? (dark ? '#141416' : '#f9fafb') : 'transparent', borderTop: dark ? 'none' : `1px solid ${divCls}`, animation: showContent ? `rowSlideIn 0.3s ease-out ${i * 50}ms both` : 'none', cursor: 'default', transition: 'background 0.12s' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 !== 0 ? (dark ? '#141416' : '#f9fafb') : 'transparent'}
                            >
                              <td style={{ padding: '12px 6px 12px 0', fontSize: '12px', fontWeight: 500, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</td>
                              <td style={{ padding: '12px 6px 12px 0', fontSize: '12px', color: txtMid, whiteSpace: 'nowrap', overflow: 'hidden' }}>{row.spend}</td>
                              <td style={{ padding: '12px 6px 12px 0', fontSize: '12px' }}>
                                {row.leads > 0
                                  ? <button onClick={() => goToLeads(row.fullName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: (row as any).isCRM ? '#10b981' : '#0044fd', fontWeight: 600, fontSize: '12px', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }} >{row.leads}</button>
                                  : <span style={{ color: txtMid }}>0</span>
                                }
                              </td>
                              <td style={{ padding: '12px 6px 12px 0', fontSize: '12px', color: txtMid, whiteSpace: 'nowrap', overflow: 'hidden' }}>{row.cpl}</td>
                              {!isMobile && (
                                <td style={{ padding: '12px 0' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ height: '4px', width: '36px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', overflow: 'hidden', flexShrink: 0 }}>
                                      <div style={{ height: '100%', width: `${row.perf}%`, background: '#0044fd', borderRadius: '99px' }} />
                                    </div>
                                    <span style={{ fontSize: '11px', color: txtLow }}>{row.perf}%</span>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
            }
          </div>
        </div>
      </div>
      <LeadDrawer lead={viewingLead as any} isOpen={!!viewingLead} onClose={() => setViewingLead(null)} onUpdate={updated => { setAllLeads(prev => prev.map(l => l.id === updated.id ? updated as any : l)); setViewingLead(updated as any); }} />
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes dashSkeleton{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes greetingIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes greetingWordIn{from{opacity:0}to{opacity:1}}
        @keyframes chartIn{from{opacity:0}to{opacity:1}}
        @keyframes rowSlideIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
        @keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes drawLine{from{stroke-dashoffset:1000}to{stroke-dashoffset:0}}
        .recharts-area-curve{stroke-dasharray:1000;animation:drawLine 1.2s ease-out forwards}
        @keyframes metaModalIn{from{opacity:0;transform:translate(-50%,-48%) scale(0.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
      `}</style>

      {/* Modal de configuração inicial de metas */}
      {showMetaModal && (() => {
        const mBg = dark ? '#18191f' : '#ffffff';
        const mBdr = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
        const mTxt = dark ? '#f1f5f9' : '#0f172a';
        const mMid = dark ? '#94a3b8' : '#64748b';
        const mShadow = dark
          ? '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.07)'
          : '0 20px 60px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)';
        const mInp: React.CSSProperties = {
          width: '100%', padding: '10px 12px', borderRadius: '10px',
          border: `1px solid ${mBdr}`,
          background: dark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
          color: mTxt, fontSize: '14px', outline: 'none',
          fontFamily: "'Inter',system-ui,sans-serif", boxSizing: 'border-box',
          transition: 'border-color 0.15s',
        };
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9980, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={closeMetaModal} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 9981, width: '360px', maxWidth: 'calc(100vw - 32px)', background: mBg, border: `1px solid ${mBdr}`, borderRadius: '20px', padding: '28px 24px 24px', boxShadow: mShadow, fontFamily: "'Inter',system-ui,sans-serif", animation: 'metaModalIn 0.25s cubic-bezier(0.32,0.72,0,1)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: '24px', marginBottom: '10px', textAlign: 'center' }}>🎯</div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: mTxt, margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.02em' }}>Configure sua meta</h2>
              <p style={{ fontSize: '13px', color: mMid, margin: '0 0 20px', textAlign: 'center', lineHeight: 1.55 }}>
                Defina seus objetivos mensais para acompanhar resultados no dashboard.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: dark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                    Meta de revendedoras / mês
                  </label>
                  <input type="number" value={metaModalRevs} onChange={e => setMetaModalRevs(Number(e.target.value))}
                    style={mInp} min={1}
                    onFocus={e => (e.target.style.borderColor = '#0044fd')}
                    onBlur={e => (e.target.style.borderColor = mBdr)} />
                </div>
                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: dark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '6px' }}>
                    Orçamento mensal (R$)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: mMid, pointerEvents: 'none' }}>R$</span>
                    <input type="number" value={metaModalBudget} onChange={e => setMetaModalBudget(Number(e.target.value))}
                      style={{ ...mInp, paddingLeft: '32px' }} min={0}
                      onFocus={e => (e.target.style.borderColor = '#0044fd')}
                      onBlur={e => (e.target.style.borderColor = mBdr)} />
                  </div>
                </div>
              </div>
              <button onClick={handleSaveMetaSetup} disabled={metaModalSaving}
                style={{ width: '100%', padding: '12px', borderRadius: '11px', border: 'none', background: metaModalSaving ? mBdr : '#0044fd', color: metaModalSaving ? mMid : '#fff', fontSize: '14px', fontWeight: 600, cursor: metaModalSaving ? 'default' : 'pointer', fontFamily: "'Inter',system-ui,sans-serif", marginBottom: '8px', transition: 'background 0.15s' }}>
                {metaModalSaving ? 'Salvando…' : 'Salvar e começar'}
              </button>
              <button onClick={closeMetaModal}
                style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: mMid, fontSize: '12.5px', cursor: 'pointer', fontFamily: "'Inter',system-ui,sans-serif", textAlign: 'center', padding: '4px 0' }}>
                Pular por agora
              </button>
            </div>
          </>
        );
      })()}

    </AppLayout>
  );
}
