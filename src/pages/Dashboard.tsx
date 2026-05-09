import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown, TrendingUp, TrendingDown, Download, MoreHorizontal, MessageCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { useTheme } from '@/hooks/useTheme';
import { AppLayout } from '@/components/AppLayout';
import { LeadDrawer } from '@/components/ui/lead-drawer';

interface Lead { id: string; nome: string; cidade: string | null; whatsapp: string | null; status: string | number | null; created_at: string; utm_source?: string | null; faixa?: string | null; [key: string]: unknown; }
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
  { stage: 'Reunião', statusId: 2, color: '#a855f7' },
  { stage: 'Contrato/App', statusId: 5, color: '#f59e0b' },
  { stage: 'Aprovado', statusId: 3, color: '#22c55e' },
];

const STATUS_LABEL: Record<number, string> = { 0: 'Em atendimento', 1: 'Em atendimento', 2: 'Reunião', 3: 'Aprovado', 4: 'Reprovado', 5: 'Contrato/App' };
const STATUS_DARK: Record<number, string> = { 0: 'bg-blue-900/40 text-blue-300', 1: 'bg-blue-900/40 text-blue-300', 2: 'bg-purple-900/40 text-purple-300', 3: 'bg-emerald-900/40 text-emerald-300', 4: 'bg-rose-900/40 text-rose-300', 5: 'bg-amber-900/40 text-amber-300' };
const STATUS_LIGHT: Record<number, string> = { 0: 'bg-blue-100 text-blue-700', 1: 'bg-blue-100 text-blue-700', 2: 'bg-purple-100 text-purple-700', 3: 'bg-emerald-100 text-emerald-700', 4: 'bg-rose-100 text-rose-700', 5: 'bg-amber-100 text-amber-700' };
const AVATAR_COLORS = ['bg-rose-400', 'bg-yellow-400', 'bg-emerald-400', 'bg-orange-400', 'bg-cyan-400', 'bg-violet-400', 'bg-pink-400'];

// ── Utilitários de data — Brasília ────────────────────────────
function parseLeadDate(str?: string | null): Date {
  if (!str || typeof str !== 'string') return new Date(0);
  try {
    if (str.includes('T')) { const d = new Date(str); return isNaN(d.getTime()) ? new Date(0) : d; }
    if (/^\d{4}-\d{2}-\d{2} /.test(str)) { const d = new Date(str.replace(' ', 'T').replace('+00:00', 'Z').replace('+00', 'Z')); return isNaN(d.getTime()) ? new Date(0) : d; }
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) { const [, d, mo, y, h = '0', mi = '0'] = m; const dt = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${mi.padStart(2,'0')}:00-03:00`); return isNaN(dt.getTime()) ? new Date(0) : dt; }
    const d = new Date(str); return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

function leadDateBR(str?: string | null): string {
  try {
    const d = parseLeadDate(str);
    if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
  } catch { return ''; }
}

function todayBR(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}

function subDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function filterByPeriod(leads: Lead[], period: string, from?: string, to?: string): Lead[] {
  if (period === 'all') return leads;
  const today = todayBR();
  const ok = (l: Lead, a: string, b: string) => { const d = leadDateBR(l.created_at); return !!d && d >= a && d <= b; };
  switch (period) {
    case 'today':     return leads.filter(l => ok(l, today, today));
    case 'yesterday': { const y = subDays(today, 1); return leads.filter(l => ok(l, y, y)); }
    case '7days':     { const f = subDays(today, 6);  return leads.filter(l => ok(l, f, today)); }
    case '30days':    { const f = subDays(today, 29); return leads.filter(l => ok(l, f, today)); }
    case 'month':     { const f = today.slice(0,7) + '-01'; return leads.filter(l => ok(l, f, today)); }
    case 'custom':    { if (!from || !to) return leads; return leads.filter(l => ok(l, from, to)); }
    default: return leads;
  }
}

function buildChartData(leads: Lead[], period: string, from?: string, to?: string) {
  const today = todayBR();
  let days = 30;
  let startDate = subDays(today, 29);

  if (period === 'today')     { days = 1; startDate = today; }
  else if (period === 'yesterday') { days = 1; startDate = subDays(today, 1); }
  else if (period === '7days')  { days = 7; startDate = subDays(today, 6); }
  else if (period === '30days') { days = 30; startDate = subDays(today, 29); }
  else if (period === 'month')  { startDate = today.slice(0,7) + '-01'; days = parseInt(today.slice(8,10)); }
  else if (period === 'custom' && from && to) {
    startDate = from;
    const ms = new Date(to+'T12:00:00Z').getTime() - new Date(from+'T12:00:00Z').getTime();
    days = Math.max(1, Math.round(ms/86400000)+1);
  }

  if (days === 1) {
    const slots: Record<string, number> = {};
    for (let h = 0; h < 24; h += 2) slots[`${String(h).padStart(2,'0')}h`] = 0;
    leads.forEach(l => {
      try {
        if (leadDateBR(l.created_at) !== startDate) return;
        const d = parseLeadDate(l.created_at);
        if (!d || isNaN(d.getTime())) return;
        const hStr = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' }).format(d);
        const sh = Math.floor(parseInt(hStr) / 2) * 2;
        const k = `${String(sh).padStart(2,'0')}h`;
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
      return { date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), leads: cnt };
    } catch { return { date: '—', leads: cnt }; }
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
function initials(n: string) { return (n||'').split(' ').slice(0,2).map((x:string)=>x[0]).join('').toUpperCase()||'?'; }
function getGreeting() { const h = new Date().getHours(); if (h>=5&&h<12) return 'Bom dia'; if (h>=12&&h<18) return 'Boa tarde'; return 'Boa noite'; }

async function fetchMetaData(period: string, from?: string, to?: string, leadsList: Lead[] = [], token = '', account = ''): Promise<{ metrics: MetaMetrics; campaigns: Campaign[] }> {
  const empty = { metrics: { spend:0, leads:0, cpl:0, impressions:0, clicks:0, ctr:0, cplRealTime:0 }, campaigns: [] };
  if (!token || !account) return empty;
  try {
    const presetMap: Record<string,string> = { today:'today', yesterday:'yesterday', '7days':'last_7d', '30days':'last_30d', month:'this_month' };
    const timeParam = period in presetMap ? `date_preset=${presetMap[period]}` : period==='custom'&&from&&to ? `time_range=%7B%22since%22%3A%22${from}%22%2C%22until%22%3A%22${to}%22%7D` : 'date_preset=this_month';
    const insRes = await fetch(`https://graph.facebook.com/v18.0/act_${account}/insights?fields=spend,impressions,clicks,ctr,actions&${timeParam}&access_token=${token}`);
    const insData = await insRes.json();
    let spend=0, impressions=0, clicks=0, ctr=0, leads=0;
    if (insData.data?.length) { const d=insData.data[0]; spend=parseFloat(d.spend||'0'); impressions=parseInt(d.impressions||'0'); clicks=parseInt(d.clicks||'0'); ctr=parseFloat(d.ctr||'0'); const la=(d.actions||[]).find((a:any)=>['lead','offsite_conversion.fb_pixel_lead'].includes(a.action_type)); leads=la?parseInt(la.value||'0'):0; }
    const campRes = await fetch(`https://graph.facebook.com/v18.0/act_${account}/insights?fields=campaign_id,campaign_name,spend,actions&level=campaign&${timeParam}&access_token=${token}`);
    const campData = await campRes.json();
    const campaigns: Campaign[] = [];
    (campData.data||[]).forEach((ins:any) => {
      const cSpend=parseFloat(ins.spend||'0');
      const cLeads=parseInt((ins.actions||[]).find((a:any)=>['lead','offsite_conversion.fb_pixel_lead'].includes(a.action_type))?.value||'0');
      if (cSpend>0) campaigns.push({ id:ins.campaign_id, name:ins.campaign_name, status:'ACTIVE', spend:cSpend, leads_api:cLeads });
    });
    const totalLeadsFB = leadsList.filter(l=>l.utm_source&&l.utm_source.toUpperCase()==='FB').length;
    return { metrics:{ spend, impressions, clicks, ctr, leads, cpl:leads>0?spend/leads:0, cplRealTime:totalLeadsFB>0?spend/totalLeadsFB:0 }, campaigns };
  } catch (e) { console.error('[Meta]',e); return empty; }
}


export default function Dashboard() {
  const { user } = useAuth();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const { orgId, ready: orgReady } = useOrgId();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const dark = theme === 'dark';

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  useEffect(() => {
    if (!orgId) return;
    supabase.from('organizations').select('nome').eq('id', orgId).single()
      .then(({ data }) => { if (data) setNomeEmpresa((data as any).nome || ''); });
  }, [orgId]); // eslint-disable-line
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
    } catch {}
  }, []);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metaMetrics, setMetaMetrics] = useState<MetaMetrics>({ spend:0, leads:0, cpl:0, impressions:0, clicks:0, ctr:0, cplRealTime:0 });
  const [metaCampaigns, setMetaCampaigns] = useState<Campaign[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewingLead, setViewingLead] = useState<Lead|null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const check=()=>setIsMobile(window.innerWidth<768); check(); window.addEventListener('resize',check); return()=>window.removeEventListener('resize',check); }, []);
  useEffect(() => { function close(e:MouseEvent){ if(dropRef.current&&!dropRef.current.contains(e.target as Node))setShowDropdown(false); if(customRef.current&&!customRef.current.contains(e.target as Node))setShowCustom(false); } document.addEventListener('mousedown',close); return()=>document.removeEventListener('mousedown',close); }, []);

  const fetchLeads = async (): Promise<Lead[]> => { if(!orgId){setLoading(false);return[];} setLoading(true); setAllLeads([]); const{data,error}=await supabase.from('leads').select('*').order('created_at',{ascending:false}).eq('org_id',orgId); if(error)console.error('[Dashboard]',error.message); const leads=(data as Lead[])||[]; setAllLeads(leads); setLoading(false); return leads; };
  const loadMeta = async (currentLeads?: Lead[]) => { if(!metaToken||!metaAccount){setMetaError(true);setMetaLoading(false);return;} setMetaLoading(true); setMetaError(false); try { const{metrics,campaigns}=await fetchMetaData(selectedPeriod,customFrom,customTo,currentLeads||allLeads,metaToken,metaAccount); setMetaMetrics(metrics); setMetaCampaigns(campaigns); if(metrics.spend===0&&campaigns.length===0)setMetaError(true); } catch { setMetaError(true); } setMetaLoading(false); };

  useEffect(() => { if(!user||!metaReady||!orgReady||!orgId)return; fetchLeads().then(leads=>{ if(leads.length>0)loadMeta(leads); }); }, [user?.id,metaReady,orgReady,orgId]); // eslint-disable-line
  useEffect(() => { if(allLeads.length>0&&metaReady)loadMeta(); }, [selectedPeriod,customFrom,customTo,allLeads.length,metaReady]); // eslint-disable-line
  useEffect(() => { if(!orgReady||!orgId)return; const ch=supabase.channel(`dash-rt-${orgId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{setAllLeads(prev=>[p.new as Lead,...prev]);}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{setAllLeads(prev=>prev.map(l=>l.id===(p.new as Lead).id?p.new as Lead:l));}).on('postgres_changes',{event:'DELETE',schema:'public',table:'leads'},p=>{setAllLeads(prev=>prev.filter(l=>l.id!==(p.old as{id:string}).id));}).subscribe(); return()=>{supabase.removeChannel(ch);}; }, [orgId,orgReady]); // eslint-disable-line

  function selectPeriod(value: string) { if(value==='custom'){setShowDropdown(false);setShowCustom(true);return;} setSelectedPeriod(value); try { localStorage.setItem(STORAGE_KEY,value); } catch {} setShowDropdown(false); setShowCustom(false); }
  function applyCustom() { if(!customFrom||!customTo)return; setSelectedPeriod('custom'); try { localStorage.setItem(STORAGE_KEY,'custom'); localStorage.setItem(STORAGE_CUSTOM,JSON.stringify({from:customFrom,to:customTo})); } catch {} setShowCustom(false); }
  async function handleRefresh() { setIsRefreshing(true); await Promise.all([fetchLeads(),loadMeta()]); setTimeout(()=>setIsRefreshing(false),600); }

  // Navega para leads filtrados por campanha + período atual
  function goToLeads(campanhaNome: string) {
    const PERIOD_MAP: Record<string,string> = { today:'today', yesterday:'yesterday', '7days':'7days', '30days':'30days', month:'month', custom:'custom' };
    const p = PERIOD_MAP[selectedPeriod] || 'all';
    const customQ = selectedPeriod==='custom'&&customFrom&&customTo ? `&de=${customFrom}&ate=${customTo}` : '';
    navigate(`/leads?campanha=${encodeURIComponent(campanhaNome.split('|')[0].trim())}&periodo=${p}${customQ}`);
  }

  const filtered = useMemo(() => filterByPeriod(allLeads, selectedPeriod, customFrom, customTo), [allLeads, selectedPeriod, customFrom, customTo]);
  const totalLeads = filtered.length;
  // Aprovados: conta pelo dia em que o status mudou para aprovado (ultimo_status_change)
  const approved = useMemo(() => {
    const today = todayBR();
    const ok = (dateStr: string | null | undefined, from: string, to: string) => {
      const d = leadDateBR(dateStr);
      return !!d && d >= from && d <= to;
    };
    return allLeads.filter(l => {
      if (toNum(l.status) !== 3) return false;
      const changeDate = (l as any).ultimo_status_change || l.created_at;
      switch (selectedPeriod) {
        case 'today':     { const t = today; return ok(changeDate, t, t); }
        case 'yesterday': { const y = subDays(today,1); return ok(changeDate, y, y); }
        case '7days':     { return ok(changeDate, subDays(today,6), today); }
        case '30days':    { return ok(changeDate, subDays(today,29), today); }
        case 'month':     { return ok(changeDate, today.slice(0,7)+'-01', today); }
        case 'custom':    { if(!customFrom||!customTo) return true; return ok(changeDate, customFrom, customTo); }
        default: return true;
      }
    }).length;
  }, [allLeads, selectedPeriod, customFrom, customTo]);
  const convRate = totalLeads>0 ? safe((approved/totalLeads)*100).toFixed(1) : '0.0';
  const spend = metaMetrics.spend||0;
  const chartData = useMemo(() => buildChartData(filtered, selectedPeriod, customFrom, customTo), [filtered, selectedPeriod, customFrom, customTo]);
  // Funil: cada status conta pelo dia que a pessoa foi movida para aquele status
  const funnelData = useMemo(() => FUNNEL_CONFIG.map(f => {
    const today = todayBR();
    const ok = (dateStr: string|null|undefined, from: string, to: string) => {
      const d = leadDateBR(dateStr); return !!d && d >= from && d <= to;
    };
    const value = allLeads.filter(l => {
      let s = toNum(l.status); if(s===0) s=1;
      if (s !== f.statusId) return false;
      const changeDate = (l as any).ultimo_status_change || l.created_at;
      switch(selectedPeriod) {
        case 'today':     { const t=today; return ok(changeDate,t,t); }
        case 'yesterday': { const y=subDays(today,1); return ok(changeDate,y,y); }
        case '7days':     { return ok(changeDate,subDays(today,6),today); }
        case '30days':    { return ok(changeDate,subDays(today,29),today); }
        case 'month':     { return ok(changeDate,today.slice(0,7)+'-01',today); }
        case 'custom':    { if(!customFrom||!customTo) return true; return ok(changeDate,customFrom,customTo); }
        default: return true;
      }
    }).length;
    return {...f, value};
  }), [allLeads, selectedPeriod, customFrom, customTo]);
  const recentLeads = useMemo(() => [...allLeads].sort((a,b)=>parseLeadDate(b.created_at).getTime()-parseLeadDate(a.created_at).getTime()).slice(0,5), [allLeads]);
  const campRows = useMemo(() => {
    if (!metaCampaigns.length) return [];
    const withSpend = metaCampaigns.filter(c=>Number(c.spend)>0);
    if (!withSpend.length) return [];
    const maxSpend = Math.max(...withSpend.map(c=>Number(c.spend)),1);
    return withSpend.sort((a,b)=>{const pA=a.leads_api>0?a.leads_api/a.spend:0;const pB=b.leads_api>0?b.leads_api/b.spend:0;if(pA!==pB)return pB-pA;return b.spend-a.spend;}).slice(0,5).map(c=>{
      // Conta leads no CRM pela utm_campaign (mais rápido que FB API, sem delay)
      const nameLower = c.name.toLowerCase().split('|')[0].trim();
      const leadsCRM = filtered.filter(l=>{
        const la = l as any;
        const camp = (la.utm_campaign||'').toLowerCase().split('|')[0].trim();
        return camp && camp.includes(nameLower.slice(0,20));
      }).length;
      const leadsCount = leadsCRM || c.leads_api||0;
      return {
        name: c.name.length>24?c.name.slice(0,24)+'…':c.name,
        fullName: c.name,
        spend: `R$ ${Number(c.spend||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
        leads: leadsCount,
        cpl: leadsCount>0&&c.spend>0 ? `R$ ${(c.spend/leadsCount).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—',
        perf: Math.round((Number(c.spend)/maxSpend)*100),
        isCRM: leadsCRM > 0,
      };
    });
  }, [metaCampaigns, filtered]);


  const periodLabel = selectedPeriod==='custom'&&customFrom&&customTo ? `${isoToBR(customFrom)} – ${isoToBR(customTo)}` : PERIOD_FILTERS.find(p=>p.value===selectedPeriod)?.label??'Hoje';

  const bg=dark?'#090909':'#f4f4f5'; const cardBg=dark?'#111113':'#ffffff'; const border=dark?'#1e1e22':'#e5e7eb';
  const txtHi=dark?'#f4f4f5':'#111827'; const txtMid=dark?'#71717a':'#374151'; const txtLow=dark?'#52525b':'#6b7280';
  const gridLn=dark?'#1e1e22':'#f0f0f0'; const divCls=dark?'#1e1e22':'#f3f4f6'; const hov=dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)';
  const pad=isMobile?'20px 16px':'32px';
  const btnBase: React.CSSProperties = { display:'flex', alignItems:'center', gap:'6px', padding:'8px 12px', borderRadius:'10px', border:`1px solid ${border}`, background:cardBg, color:txtMid, fontSize:'13px', cursor:'pointer', transition:'all 0.12s', fontFamily:'inherit' };
  const statusClass = dark?STATUS_DARK:STATUS_LIGHT;

  return (
    <AppLayout leadCount={allLeads.length}>
      <div style={{ padding:pad, background:bg, minHeight:'100vh', overflowX:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontSize:isMobile?'20px':'26px', fontWeight:700, color:txtHi, letterSpacing:'-0.03em', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
              {getGreeting()}{primeiroNome?`, ${primeiroNome}`:''}!{' '}
              <img src="/wave.png" alt="👋" style={{ width:'26px', height:'26px', objectFit:'contain' }} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}/>
            </h1>
            <p style={{ fontSize:'13px', color:txtLow, marginTop:'4px' }}>{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ position:'relative' }} ref={dropRef}>
              <button onClick={()=>{setShowDropdown(v=>!v);setShowCustom(false);}} style={btnBase}>
                {periodLabel}
                <ChevronDown style={{ width:'14px', height:'14px', color:txtLow, transform:showDropdown?'rotate(180deg)':'', transition:'transform 0.18s' }}/>
              </button>
              {showDropdown && (
                <div style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:cardBg, border:`1px solid ${border}`, borderRadius:'12px', padding:'4px', minWidth:'168px', zIndex:50, boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 32px rgba(0,0,0,0.1)' }}>
                  {PERIOD_FILTERS.map(f=>(
                    <button key={f.value} onClick={()=>selectPeriod(f.value)} style={{ width:'100%', padding:'7px 10px', borderRadius:'8px', border:'none', background:selectedPeriod===f.value?(dark?'rgba(255,255,255,0.08)':'#eff6ff'):'transparent', color:selectedPeriod===f.value?(dark?'#60a5fa':'#2563eb'):txtMid, fontSize:'13px', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              {showCustom && (
                <div ref={customRef} style={{ position:'absolute', right:0, top:'calc(100% + 6px)', background:cardBg, border:`1px solid ${border}`, borderRadius:'14px', padding:'16px', zIndex:50, minWidth:'260px', boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 32px rgba(0,0,0,0.12)' }}>
                  <p style={{ fontSize:'11px', fontWeight:600, color:txtLow, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'12px' }}>Período personalizado</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {[{label:'Data inicial',val:customFrom,set:setCustomFrom},{label:'Data final',val:customTo,set:setCustomTo}].map(({label,val,set})=>(
                      <div key={label}>
                        <label style={{ fontSize:'11px', color:txtMid, display:'block', marginBottom:'4px' }}>{label}</label>
                        <div style={{ position:'relative' }}>
                          <input type="date" value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:`1px solid ${border}`, background:dark?'#18181b':cardBg, color:'transparent', fontSize:'13px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as any, cursor:'pointer' }}/>
                          <span style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', fontSize:'13px', color:val?txtHi:txtLow, pointerEvents:'none' }}>{val?isoToBR(val):'dd/mm/aaaa'}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                      <button onClick={applyCustom} style={{ flex:1, padding:'8px', borderRadius:'8px', background:'#2563eb', border:'none', color:'#fff', fontSize:'13px', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Aplicar</button>
                      <button onClick={()=>setShowCustom(false)} style={{ flex:1, padding:'8px', borderRadius:'8px', border:`1px solid ${border}`, background:'transparent', color:txtMid, fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleRefresh} style={btnBase}>
              <RefreshCw style={{ width:'14px', height:'14px', color:txtMid, animation:isRefreshing?'spin 1s linear infinite':'' }}/>
            </button>
            {!isMobile && (
              <button style={{ ...btnBase, background:'#2563eb', border:'none', color:'#fff', fontWeight:500 }}>
                <Download style={{ width:'14px', height:'14px' }}/> Exportar
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:isMobile?'10px':'16px', marginBottom:'16px' }}>
          {[
            { label:'Gasto Total', value:metaLoading?'…':`R$ ${spend.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, trend:'+', up:true, sub:'Meta Ads' },
            { label:'Leads', value:loading?'…':String(filtered.filter(l=>l.utm_source?.toUpperCase()==='FB').length), trend:'+', up:true, sub:'Fonte FB' },
            { label:'CPL Ads', value:metaLoading?'…':(()=>{const fb=filtered.filter(l=>l.utm_source?.toUpperCase()==='FB').length;return fb>0?`R$ ${safe(spend/fb).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`:'R$ —';})(), trend:'Real Time', up:true, sub:'Base Sistema' },
            { label:'Revendedoras', value:loading?'…':String(approved), trend:spend>0&&approved>0?`R$ ${safe(spend/approved).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`:`${convRate}%`, up:Number(convRate)>0, sub:spend>0&&approved>0?'custo/revendedora':'conversão' },
          ].map((c,i)=>(
            <div key={i} style={{ background:cardBg, borderRadius:'14px', padding:isMobile?'12px':'20px', border:`1px solid ${border}` }}>
              <p style={{ fontSize:'11px', color:txtLow, marginBottom:'4px' }}>{c.label}</p>
              <p style={{ fontSize:isMobile?'16px':'26px', fontWeight:700, color:txtHi, letterSpacing:'-0.03em', margin:'0 0 6px' }}>{c.value}</p>
              <p style={{ fontSize:'11px', display:'flex', alignItems:'center', gap:'3px', margin:0 }}>
                {c.up?<TrendingUp style={{ width:'11px', height:'11px', color:'#10b981' }}/>:<TrendingDown style={{ width:'11px', height:'11px', color:'#ef4444' }}/>}
                <span style={{ fontWeight:500, color:c.up?'#10b981':'#ef4444' }}>{c.trend}</span>
                <span style={{ color:txtLow, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'2fr 1fr', gap:'14px', marginBottom:'16px' }}>
          <div style={{ background:cardBg, borderRadius:'14px', padding:isMobile?'16px':'24px', border:`1px solid ${border}` }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <div>
                <h3 style={{ fontSize:'14px', fontWeight:600, color:txtHi, margin:0 }}>Evolução de Leads</h3>
                <p style={{ fontSize:'11px', color:txtLow, marginTop:'2px' }}>{periodLabel}</p>
              </div>
              <button style={{ padding:'4px', borderRadius:'8px', border:'none', background:'transparent', cursor:'pointer' }}>
                <MoreHorizontal style={{ width:'14px', height:'14px', color:txtLow }}/>
              </button>
            </div>
            {!isMobile && chartData.length > 0 && <div style={{ width:'100%', height:200, minHeight:120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top:10, right:10, left:-20, bottom:0 }}>
                  <defs><linearGradient id="glLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false}/>
                  <XAxis dataKey="date" tick={{ fill:txtLow, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{ fill:txtLow, fontSize:10 }} axisLine={false} tickLine={false} width={24}/>
                  <Tooltip contentStyle={{ background:cardBg, border:`1px solid ${border}`, borderRadius:'10px', fontSize:'12px', color:txtHi }}/>
                  <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} fill="url(#glLeads)" name="Leads"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>}
          </div>

          <div style={{ background:cardBg, borderRadius:'14px', padding:isMobile?'16px':'24px', border:`1px solid ${border}`, position:'relative', overflow:'hidden' }}>
            <h3 style={{ fontSize:'14px', fontWeight:600, color:txtHi, margin:'0 0 4px' }}>Funil de leads</h3>
            <p style={{ fontSize:'11px', color:txtLow, marginBottom:'16px' }}>{periodLabel}</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {funnelData.map(stage=>{
                const pct=totalLeads>0?Math.round((stage.value/Math.max(totalLeads,1))*100):0;
                return (
                  <div key={stage.stage} style={{ background:dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.01)', border:`1px solid ${border}`, borderRadius:'10px', padding:'12px 14px 14px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', left:0, top:0, bottom:0, width:'4px', background:stage.color }}/>
                    <div style={{ display:'flex', alignItems:'center', marginBottom:'14px' }}>
                      <span style={{ fontSize:'14px', fontWeight:600, color:txtHi }}>{stage.stage}</span>
                      <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:'24px' }}>
                        <span style={{ fontSize:'18px', fontWeight:700, color:txtHi }}>{loading?'…':stage.value}</span>
                        <div style={{ padding:'4px 10px', borderRadius:'8px', background:stage.color+'10', color:stage.color, fontSize:'11px', fontWeight:800, minWidth:'40px', textAlign:'center' }}>{loading?'…':`${pct}%`}</div>
                      </div>
                    </div>
                    <div style={{ width:'100%', height:'5px', background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)', borderRadius:'10px' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:stage.color, borderRadius:'10px', transition:'width 0.8s ease' }}/>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop:'4px', background:dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.01)', border:`1px solid ${border}`, borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'rgba(34,197,94,0.08)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <TrendingUp style={{ width:'18px', height:'18px', color:'#22c55e' }}/>
                  </div>
                  <div>
                    <span style={{ fontSize:'11px', color:txtLow, fontWeight:500, display:'block' }}>Taxa de conversão</span>
                    <span style={{ fontSize:'22px', fontWeight:800, color:'#22c55e' }}>{convRate}%</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'1fr 1fr', gap:'14px', minWidth:0, overflow:'hidden' }}>

          {/* Leads Recentes */}
          <div style={{ background:cardBg, borderRadius:'14px', padding:isMobile?'16px':'24px', border:`1px solid ${border}`, minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <h3 style={{ fontSize:'14px', fontWeight:600, color:txtHi, margin:0 }}>Leads Recentes</h3>
              <Link to="/leads" style={{ fontSize:'12px', color:'#2563eb', fontWeight:500, textDecoration:'none' }}>Ver todos</Link>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
              {loading?[...Array(4)].map((_,i)=><div key={i} style={{ height:'44px', borderRadius:'10px', background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)', marginBottom:'2px' }}/>)
              :recentLeads.length===0?<p style={{ fontSize:'13px', color:txtMid, textAlign:'center', padding:'20px 0' }}>Nenhum lead</p>
              :recentLeads.map((lead,idx)=>{
                const st=toNum(lead.status);
                return (
                  <div key={lead.id} onClick={()=>setViewingLead(lead)}
                    style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 8px', borderRadius:'10px', cursor:'pointer', transition:'background 0.12s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=hov}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                  >
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div className={`w-7 h-7 ${AVATAR_COLORS[idx%AVATAR_COLORS.length]} rounded-full flex items-center justify-center text-white text-xs font-semibold`}>
                        {initials(lead.nome)}
                      </div>
                      {(()=>{ const faixaLead = (lead.faixa as string) || null; return faixaLead && faixaLead !== 'vermelho' ? <div style={{ position:'absolute', top:'-2px', right:'-2px', width:'10px', height:'10px', borderRadius:'50%', background:faixaLead==='verde'?'#10b981':'#f59e0b', border:`2px solid ${dark?'#090909':'#f4f4f5'}`, boxShadow:'0 1px 3px rgba(0,0,0,0.25)', zIndex:2 }}/> : null; })()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'12.5px', fontWeight:500, color:txtHi, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lead.nome.split(' ').slice(0,2).join(' ')}</p>
                      <p style={{ fontSize:'11px', color:txtLow, margin:0 }}>{lead.cidade||'—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass[st]??''}`} style={{ fontSize:'10.5px' }}>{STATUS_LABEL[st]??'Aguardando'}</span>
                    <span style={{ fontSize:'11px', color:txtLow, flexShrink:0, minWidth:'28px', textAlign:'right' }}>{relativeTime(lead.created_at)}</span>
                    <a href={lead.whatsapp?`https://wa.me/55${lead.whatsapp.replace(/\D/g,'')}`:'#'} target="_blank" rel="noreferrer"
                      onClick={e=>e.stopPropagation()}
                      className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center transition-colors flex-shrink-0">
                      <MessageCircle className="w-3 h-3 text-white"/>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campanhas — oculto no mobile para evitar overflow */}
          {!isMobile && <div style={{ background:cardBg, borderRadius:'14px', padding:'24px', border:`1px solid ${border}`, minWidth:0, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <h3 style={{ fontSize:'14px', fontWeight:600, color:txtHi, margin:0 }}>Campanhas</h3>
                <div style={{ position:'relative', width:'7px', height:'7px' }}>
                  <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:metaError?'#ef4444':'#22c55e' }}/>
                  {!metaError&&<div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'#22c55e', animation:'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity:0.6 }}/>}
                </div>
              </div>
              <Link to="/campanhas" style={{ fontSize:'12px', color:'#2563eb', fontWeight:500, textDecoration:'none' }}>Ver todas</Link>
            </div>
            {metaLoading
              ?[...Array(3)].map((_,i)=><div key={i} style={{ height:'32px', borderRadius:'8px', background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)', marginBottom:'8px' }}/>)
              :metaError||campRows.length===0
                ?<div style={{ textAlign:'center', padding:'20px 0' }}><p style={{ fontSize:'13px', color:txtMid, margin:0 }}>{!metaToken||!metaAccount?'Configure o token do Meta Ads em Configurações':metaError?'Erro ao conectar ao Meta Ads':'Nenhuma campanha'}</p></div>
                :(
                  <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
                    <thead>
                      <tr>
                        {(['Campanha','Gasto','Leads','CPL',!isMobile&&'Perf.'] as any[]).filter(Boolean).map((h:string)=>(
                          <th key={h} style={{ textAlign:'left', fontSize:'10px', fontWeight:600, color:txtLow, paddingBottom:'8px', letterSpacing:'0.05em', textTransform:'uppercase', paddingRight:'6px', overflow:'hidden' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campRows.map((row,i)=>(
                        <tr key={i} style={{ borderTop:`1px solid ${divCls}` }}>
                          <td style={{ padding:'9px 6px 9px 0', fontSize:'12px', fontWeight:500, color:txtHi, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.name}</td>
                          <td style={{ padding:'9px 6px 9px 0', fontSize:'12px', color:txtMid, whiteSpace:'nowrap', overflow:'hidden' }}>{row.spend}</td>
                          <td style={{ padding:'9px 6px 9px 0', fontSize:'12px' }}>
                            {row.leads>0
                              ? <button onClick={()=>goToLeads(row.fullName)} style={{ background:'none', border:'none', cursor:'pointer', color:(row as any).isCRM?'#10b981':'#2563eb', fontWeight:600, fontSize:'12px', padding:0, fontFamily:'inherit', textDecoration:'underline' }} >{row.leads}</button>
                              : <span style={{ color:txtMid }}>0</span>
                            }
                          </td>
                          <td style={{ padding:'9px 6px 9px 0', fontSize:'12px', color:txtMid, whiteSpace:'nowrap', overflow:'hidden' }}>{row.cpl}</td>
                          {!isMobile&&(
                            <td style={{ padding:'9px 0' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                                <div style={{ height:'4px', width:'36px', borderRadius:'99px', background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)', overflow:'hidden', flexShrink:0 }}>
                                  <div style={{ height:'100%', width:`${row.perf}%`, background:'#2563eb', borderRadius:'99px' }}/>
                                </div>
                                <span style={{ fontSize:'11px', color:txtLow }}>{row.perf}%</span>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            }
          </div>}
        </div>
      </div>
      <LeadDrawer lead={viewingLead as any} isOpen={!!viewingLead} onClose={()=>setViewingLead(null)} onUpdate={updated=>{setAllLeads(prev=>prev.map(l=>l.id===updated.id?updated as any:l));setViewingLead(updated as any);}}/>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
      `}</style>
    </AppLayout>
  );
}
