import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { TrendingUp, TrendingDown, Pause, AlertTriangle, X, DollarSign, Users, RefreshCw, Zap, ChevronDown, Lightbulb, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getMetaCache, setMetaCache } from '@/lib/metaCache';

interface AdSet {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; leads_api: number; cpl: number;
  ads?: Ad[];
}
interface Ad {
  id: string; name: string; status: string;
  spend: number; leads_api: number; cpl: number; ctr: number; thumbnail_url: string | null;
}
interface Campaign {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; cpm: number;
  leads_api: number; cpl?: number; adsets?: AdSet[]; ads?: Ad[];
}


const LEAD_ACTIONS = ['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'];
const BECKER_ORG_ID = '81b1ba7b-5c03-45c5-a74a-6ea8eb3432ae';

// ── Score inteligente por campanha (0-100) ────────────────────
function calcScore(
  r: { id: string; leads: number; rev: number; cpl: number; cpr: number; spend: number },
  allRows: { id: string; leads: number; rev: number; cpl: number; cpr: number; spend: number }[],
  allCampLeadsMap: Map<string, any[]>,
  _campRevsMap: Map<string, any[]>,
  _datePreset: string
): number {
  // Usa allCampLeadsMap (todos os leads, sem filtro de período) para calcular idade real
  const campLeads = allCampLeadsMap.get(r.id) || [];
  const oldest = campLeads.length > 0
    ? Math.min(...campLeads.map(l => new Date((l as any).created_at || Date.now()).getTime()))
    : Date.now();
  const ageDays = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
  const isNew = ageDays < 3;
  const potenciais = campLeads.filter(l => [2, 5].includes(Number((l as any).status))).length;

  const maxRevs = Math.max(...allRows.map(x => x.rev), 1);
  const comCPR = allRows.filter(x => x.cpr > 0);
  const mediaCPR = comCPR.length > 0 ? comCPR.reduce((s, x) => s + x.cpr, 0) / comCPR.length : 0;
  const comCPL = allRows.filter(x => x.cpl > 0);
  const mediaCPL = comCPL.length > 0 ? comCPL.reduce((s, x) => s + x.cpl, 0) / comCPL.length : 0;

  let score = 0;

  // BLOCO 1: Revendedoras — peso 45
  score += Math.round((r.rev / maxRevs) * 45);

  // BLOCO 2: CPR — peso 35
  if (r.cpr > 0 && mediaCPR > 0) {
    const ratio = r.cpr / mediaCPR;
    if (ratio <= 0.5)       score += 35;
    else if (ratio <= 0.7)  score += 28;
    else if (ratio <= 0.9)  score += 21;
    else if (ratio <= 1.1)  score += 14;
    else if (ratio <= 1.4)  score += 5;
    else if (ratio <= 1.8)  score -= 4;
    else                    score -= 10;
  } else if (r.rev === 0 && !isNew) {
    score -= 10; // penalidade campanha antiga sem revendedoras
  }

  // BLOCO 3: CPL — peso 10
  if (mediaCPL > 0 && r.cpl > 0) {
    const ratio = r.cpl / mediaCPL;
    if (ratio <= 0.7)      score += 10;
    else if (ratio <= 1.0) score += 6;
    else if (ratio <= 1.3) score += 2;
    else if (ratio > 1.5)  score -= 2;
  }

  // BLOCO 4: Potenciais — peso 8
  score += Math.min(potenciais * 2, 8);

  // BLOCO 5: Volume de leads — peso 5
  const maxLeads = Math.max(...allRows.map(x => x.leads), 1);
  score += Math.round((r.leads / maxLeads) * 5);

  // Campanha nova: congela score entre 35-50
  if (isNew) {
    const newBase = 35 + Math.min(potenciais * 3, 10) + (r.leads >= 5 ? 5 : 0);
    return Math.min(50, Math.max(35, newBase));
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score: number): string {
  if (score >= 88) return '#059669';
  if (score >= 75) return '#10b981';
  if (score >= 62) return '#34d399';
  if (score >= 50) return '#fbbf24';
  if (score >= 38) return '#f97316';
  if (score >= 25) return '#ef4444';
  return '#b91c1c';
}

function scoreColorSolid(score: number): string {
  if (score >= 90) return '#059669';
  if (score >= 75) return '#10b981';
  if (score >= 62) return '#34d399';
  if (score >= 50) return '#fbbf24';
  if (score >= 38) return '#f97316';
  if (score >= 25) return '#ef4444';
  return '#b91c1c';
}

function scoreLabel(score: number, isNew?: boolean): string {
  if (isNew) return 'Aguardando dados';
  if (score >= 75) return 'Escalar';
  if (score >= 50) return 'Monitorar';
  if (score >= 38) return 'Otimizar';
  return 'Atenção';
}

type ScoreCriterio = { icon: string; label: string; detalhe: string; pts: number };

function gerarCriterios(
  r: { id: string; leads: number; rev: number; cpl: number; cpr: number; spend: number },
  allRows: { id: string; leads: number; rev: number; cpl: number; cpr: number; spend: number }[],
  mediaCPR: number,
  mediaCPL: number,
  isNew: boolean,
  potenciais: number
): ScoreCriterio[] {
  const crit: ScoreCriterio[] = [];
  const maxRevs = Math.max(...allRows.map(x => x.rev), 1);

  // Revendedoras
  const revsScore = Math.round((r.rev / maxRevs) * 45);
  const revsLabel = revsScore < 15 ? 'Baixo' : revsScore < 32 ? 'Médio' : 'Excelente';
  crit.push({ icon: '👑', label: 'Revendedoras', detalhe: `${r.rev} rev — ${revsLabel}`, pts: revsScore });

  // CPR
  let cprScore = 0; let cprDetalhe = '—';
  if (r.cpr > 0 && mediaCPR > 0) {
    const ratio = r.cpr / mediaCPR;
    if (ratio <= 0.5)      { cprScore = 35; cprDetalhe = `R$ ${Math.round(r.cpr)} — 50%+ abaixo da média`; }
    else if (ratio <= 0.7) { cprScore = 28; cprDetalhe = `R$ ${Math.round(r.cpr)} — muito abaixo da média`; }
    else if (ratio <= 0.9) { cprScore = 21; cprDetalhe = `R$ ${Math.round(r.cpr)} — abaixo da média`; }
    else if (ratio <= 1.1) { cprScore = 14; cprDetalhe = `R$ ${Math.round(r.cpr)} — na média (R$ ${Math.round(mediaCPR)})`; }
    else if (ratio <= 1.4) { cprScore = 5;  cprDetalhe = `R$ ${Math.round(r.cpr)} — acima da média`; }
    else if (ratio <= 1.8) { cprScore = -4; cprDetalhe = `R$ ${Math.round(r.cpr)} — 40%+ acima da média`; }
    else                   { cprScore = -10; cprDetalhe = `R$ ${Math.round(r.cpr)} — muito acima da média`; }
  } else if (r.rev === 0 && !isNew) {
    cprScore = -10; cprDetalhe = 'Sem revendedoras no período';
  } else {
    cprDetalhe = isNew ? 'Aguardando dados' : 'Sem conversões';
  }
  crit.push({ icon: '💰', label: 'Custo por Rev (CPR)', detalhe: cprDetalhe, pts: cprScore });

  // CPL
  let cplScore = 0; let cplDetalhe = '—';
  if (mediaCPL > 0 && r.cpl > 0) {
    const ratio = r.cpl / mediaCPL;
    if (ratio <= 0.7)      { cplScore = 10; cplDetalhe = `R$ ${Math.round(r.cpl)} — ótimo`; }
    else if (ratio <= 1.0) { cplScore = 6;  cplDetalhe = `R$ ${Math.round(r.cpl)} — bom`; }
    else if (ratio <= 1.3) { cplScore = 2;  cplDetalhe = `R$ ${Math.round(r.cpl)} — acima da média`; }
    else                   { cplScore = -2; cplDetalhe = `R$ ${Math.round(r.cpl)} — alto`; }
  }
  crit.push({ icon: '📊', label: 'Custo por Lead (CPL)', detalhe: cplDetalhe, pts: cplScore });

  // Potenciais
  const potScore = Math.min(potenciais * 2, 8);
  crit.push({ icon: '⭐', label: 'Leads potenciais', detalhe: `${potenciais} lead${potenciais !== 1 ? 's' : ''} em triagem/reunião`, pts: potScore });

  // Volume
  const maxLeads = Math.max(...allRows.map(x => x.leads), 1);
  const volScore = Math.round((r.leads / maxLeads) * 5);
  crit.push({ icon: '📈', label: 'Volume de leads', detalhe: `${r.leads} leads no período`, pts: volScore });

  if (isNew) {
    crit.push({ icon: '🆕', label: 'Campanha nova', detalhe: 'Score congelado — menos de 3 dias de dados', pts: 0 });
  }

  return crit;
}

const PERIOD_OPTIONS = [
  { label:'Hoje',      value:'today' },
  { label:'Ontem',     value:'yesterday' },
  { label:'7 dias',   value:'last_7d' },
  { label:'30 dias',  value:'last_30d' },
  { label:'Este mês', value:'this_month' },
];

const PERIOD_MAP: Record<string,string> = {
  today:'today', yesterday:'yesterday', last_7d:'7days', last_30d:'30days', this_month:'month',
};


function fmt(n: number) { return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtInt(n: number) { return n.toLocaleString('pt-BR'); }
function getLeads(actions: any[]) { return parseInt(actions?.find((a:any)=>LEAD_ACTIONS.includes(a.action_type))?.value||'0'); }

// ── Datas Brasília ────────────────────────────────────────────
function parseLeadDateCamp(str?: string|null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) return new Date(str);
  if (/^\d{4}-\d{2}-\d{2} /.test(str)) return new Date(str.replace(' ','T').replace('+00:00','Z').replace('+00','Z'));
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) { const [, d, mo, y, h='0', mi='0'] = m; return new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${mi.padStart(2,'0')}:00-03:00`); }
  return new Date(str);
}
function leadDateBRCamp(str?: string|null): string {
  try {
    const d=parseLeadDateCamp(str);
    if(d.getTime()===0)return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return ''; }
}
function todayBRCamp(): string {
  try {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return new Date().toISOString().split('T')[0]; }
}
function subDaysCamp(s:string,n:number): string {
  try { const d=new Date(s+'T12:00:00Z'); if(isNaN(d.getTime()))return s; d.setUTCDate(d.getUTCDate()-n); return d.toISOString().slice(0,10); } catch { return s; }
}
function filterLeadsByPreset(leads: any[], preset: string) {
  const today = todayBRCamp();
  const ok = (l: any, a: string, b: string) => {
    // Leads: usa created_at — quando o lead ENTROU via tráfego
    const ref = l.created_at;
    const d = leadDateBRCamp(ref);
    return !!d && d >= a && d <= b;
  };
  switch(preset) {
    case 'today':      return leads.filter(l => ok(l, today, today));
    case 'yesterday':  { const y = subDaysCamp(today, 1); return leads.filter(l => ok(l, y, y)); }
    case 'last_7d':    return leads.filter(l => ok(l, subDaysCamp(today, 6), today));
    case 'last_30d':   return leads.filter(l => ok(l, subDaysCamp(today, 29), today));
    case 'this_month': return leads.filter(l => ok(l, today.slice(0,7)+'-01', today));
    default: return leads;
  }
}

// ── Fetch campanhas ───────────────────────────────────────────
async function fetchCampaignsWithChildren(datePreset: string, token: string, account: string): Promise<Campaign[]> {
  const tok=token; const base='https://graph.facebook.com/v18.0'; const dp=datePreset;
  if (!tok || !account) return [];
  function getLeadsFromActions(actions:any[]){return parseInt(actions?.find((a:any)=>LEAD_ACTIONS.includes(a.action_type))?.value||'0');}
  try {
    const campUrl=new URL(`${base}/act_${account}/campaigns`);
    campUrl.searchParams.set('fields',`id,name,status,insights.date_preset(${dp}){spend,impressions,clicks,ctr,cpm,actions}`);
    campUrl.searchParams.set('limit','20'); campUrl.searchParams.set('access_token',tok);
    const campData=await(await fetch(campUrl.toString())).json();
    if(!campData.data?.length) return [];

    const asUrl=new URL(`${base}/act_${account}/adsets`);
    asUrl.searchParams.set('fields',`id,name,status,campaign_id,insights.date_preset(${dp}){spend,impressions,clicks,ctr,actions}`);
    asUrl.searchParams.set('limit','50'); asUrl.searchParams.set('access_token',tok);
    const asData=await(await fetch(asUrl.toString())).json();

    const adUrl=new URL(`${base}/act_${account}/ads`);
    adUrl.searchParams.set('fields',`id,name,status,campaign_id,adset_id,creative{thumbnail_url},insights.date_preset(${dp}){spend,ctr,actions}`);
    adUrl.searchParams.set('limit','50'); adUrl.searchParams.set('access_token',tok);
    const adData=await(await fetch(adUrl.toString())).json();

    const adsetsByCampaign:Record<string,AdSet[]>={};
    for(const as of(asData.data||[])as any[]){
      const cid=as.campaign_id; if(!cid)continue;
      if(!adsetsByCampaign[cid])adsetsByCampaign[cid]=[];
      const ins=as.insights?.data?.[0];
      const spend=parseFloat(ins?.spend||'0'); const leads=getLeadsFromActions(ins?.actions||[]);
      adsetsByCampaign[cid].push({id:as.id,name:as.name,status:as.status,spend,impressions:parseInt(ins?.impressions||'0'),clicks:parseInt(ins?.clicks||'0'),ctr:parseFloat(ins?.ctr||'0'),leads_api:leads,cpl:leads>0?spend/leads:0});
    }

    const adsByCampaign:Record<string,Ad[]>={}; const adsByAdset:Record<string,Ad[]>={};
    for(const ad of(adData.data||[])as any[]){
      const cid=ad.campaign_id; if(!cid)continue;
      if(!adsByCampaign[cid])adsByCampaign[cid]=[];
      const ins=ad.insights?.data?.[0]; const spend=parseFloat(ins?.spend||'0'); const leads=getLeadsFromActions(ins?.actions||[]);
      const adObj:Ad={id:ad.id,name:ad.name,status:ad.status,spend,leads_api:leads,cpl:leads>0?spend/leads:0,ctr:parseFloat(ins?.ctr||'0'),thumbnail_url:ad.creative?.thumbnail_url||null};
      adsByCampaign[cid].push(adObj);
      const asid=ad.adset_id; if(asid){if(!adsByAdset[asid])adsByAdset[asid]=[];adsByAdset[asid].push(adObj);}
    }

    const results:Campaign[]=[];
    for(const c of campData.data as any[]){
      const ins=c.insights?.data?.[0]; const spend=parseFloat(ins?.spend||'0'); const leads=getLeadsFromActions(ins?.actions||[]);
      const adsets=(adsetsByCampaign[c.id]||[]).map(as=>({...as,ads:(adsByAdset[as.id]||[]).sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999))})).sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999));
      const ads=(adsByCampaign[c.id]||[]).sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999));
      results.push({id:c.id,name:c.name,status:c.status,spend,impressions:parseInt(ins?.impressions||'0'),clicks:parseInt(ins?.clicks||'0'),ctr:parseFloat(ins?.ctr||'0'),cpm:parseFloat(ins?.cpm||'0'),leads_api:leads,cpl:leads>0?spend/leads:0,adsets,ads});
    }
    return results.filter(c=>c.spend>0||c.status==='ACTIVE').sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999)||b.spend-a.spend);
  } catch(e){console.error('[Campanhas]',e);return [];}
}


function FilterDropdown({value,options,onChange,dark}:{value:string;options:{label:string;value:string}[];onChange:(v:string)=>void;dark:boolean}){
  const[open,setOpen]=useState(false);const[pos,setPos]=useState({top:0,left:0,width:180});const btnRef=useRef<HTMLButtonElement>(null);const sel=options.find(o=>o.value===value);
  function handleOpen(){if(btnRef.current){const r=btnRef.current.getBoundingClientRect();const mw=180;let left=r.right-mw;if(left<8)left=8;if(left+mw>window.innerWidth-8)left=window.innerWidth-mw-8;setPos({top:r.bottom+6,left,width:mw});}setOpen(v=>!v);}
  return(<div style={{position:'relative'}}><button ref={btnRef} onClick={handleOpen} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,background:dark?'#111113':'#fff',color:dark?'#d4d4d8':'#374151',fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>{sel?.label}<ChevronDown style={{width:'14px',height:'14px',transform:open?'rotate(180deg)':'',transition:'transform 0.18s'}}/></button>{open&&(<><div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:9998}}/><div style={{position:'fixed',top:pos.top,left:pos.left,width:pos.width,background:dark?'#111113':'#fff',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,borderRadius:'10px',padding:'4px',zIndex:9999,boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 24px rgba(0,0,0,0.1)'}}>{options.map(o=>(<button key={o.value} onClick={()=>{onChange(o.value);setOpen(false);}} style={{width:'100%',padding:'7px 10px',borderRadius:'7px',border:'none',background:value===o.value?(dark?'rgba(255,255,255,0.08)':'#eff6ff'):'transparent',color:value===o.value?(dark?'#60a5fa':'#2563eb'):(dark?'#a1a1aa':'#374151'),fontSize:'13px',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>{o.label}</button>))}</div></>)}</div>);
}

function Thumbnail({url,name,size=36}:{url:string|null;name:string;size?:number}){
  const[err,setErr]=useState(false);const initials=name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';const colors=['#3b82f6','#8b5cf6','#f97316','#10b981','#f59e0b','#ec4899'];const color=colors[name.charCodeAt(0)%colors.length];
  if(!url||err)return<div style={{width:size,height:size,borderRadius:'6px',background:color+'22',border:`1px solid ${color}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size>40?'12px':'9px',fontWeight:700,color,flexShrink:0}}>{initials}</div>;
  return<img src={url} alt={name} onError={()=>setErr(true)} style={{width:size,height:size,borderRadius:'6px',objectFit:'cover',flexShrink:0,border:'1px solid rgba(0,0,0,0.08)'}}/>;
}

export default function CampanhasPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const { metaToken, metaAccount, ready: metaReady } = useMetaConfig();
  const { orgId, ready: orgReady } = useOrgId();
  const dark = theme === 'dark';
  const semToken = metaReady && (!metaToken || !metaAccount);
  const navigate = useNavigate();
  const _initCampKey = orgId ? `meta_camp_${orgId}_today` : null;
  const _initCampCached = _initCampKey ? getMetaCache(_initCampKey) : null;
  const [campaigns, setCampaigns] = useState<Campaign[]>(_initCampCached || []);
  const [loading, setLoading] = useState(!_initCampCached && !!metaToken);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'campanhas'|'insights'>('campanhas');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedAdsetIds, setExpandedAdsetIds] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  // Leads direto do Supabase com select('*') para garantir utm_campaign
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [aiLog, setAiLog] = useState<any>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [metaRevsOrg, setMetaRevsOrg] = useState(0);
  const [gestorMode, setGestorMode] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState<{
    r: { id: string; name: string; fullName: string; leads: number; rev: number; cpl: number; cpr: number; spend: number; score: number };
    isNew: boolean; potenciais: number; ageDays: number;
    criteria: ScoreCriterio[];
  } | null>(null);

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check);},[]);

  // Busca leads filtrados pelo período selecionado — garante cruzamento correto
  useEffect(()=>{
    if (!orgReady || !orgId) return;
    setAllLeads([]);
    const today=todayBRCamp();
    let since:string|null=null;
    switch(datePreset){
      case 'today':     since=today+'T00:00:00-03:00'; break;
      case 'yesterday': since=subDaysCamp(today,1)+'T00:00:00-03:00'; break;
      case 'last_7d':   since=subDaysCamp(today,6)+'T00:00:00-03:00'; break;
      case 'last_30d':  since=subDaysCamp(today,29)+'T00:00:00-03:00'; break;
      case 'this_month':since=today.slice(0,7)+'-01T00:00:00-03:00'; break;
    }
    supabase.from('leads')
      .select('id,utm_campaign,utm_source,status,created_at,status_aprovado_at,status_reuniao_at,status_contrato_at,ultimo_status_change')
      .eq('org_id',orgId).order('ultimo_status_change',{ascending:false}).limit(3000)
      .then(({data}:any)=>{ if(data) setAllLeads(data); });
  },[orgId, orgReady, datePreset]); // eslint-disable-line

  // Realtime: atualiza allLeads ao receber novos leads (filtrado por org)
  useEffect(()=>{
    if (!orgReady || !orgId) return;
    const ch = supabase.channel(`camp-leads-rt-${orgId}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{
        setAllLeads(prev=>[p.new as any,...prev]);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads',filter:`org_id=eq.${orgId}`},p=>{
        setAllLeads(prev=>prev.map(l=>l.id===(p.new as any).id?p.new as any:l));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },[orgId, orgReady]); // eslint-disable-line

  // Busca log de otimização da IA — mostra se for das últimas 24h (evita problema de fuso)
  useEffect(()=>{
    if (!orgReady || !orgId) return;
    (supabase as any).from('ai_optimization_logs').select('*')
      .eq('org_id', orgId)
      .order('created_at',{ascending:false})
      .limit(1)
      .then(({data})=>{
        if(data&&data.length>0){
          const log=data[0];
          const horas=(Date.now()-new Date(log.created_at).getTime())/(1000*60*60);
          if(horas<=24) setAiLog(log);
        }
      });
  },[orgId, orgReady]); // eslint-disable-line

  // Busca meta de revendedoras da org para barra de progresso do painel Ravena
  useEffect(()=>{
    if (!orgReady || !orgId) return;
    supabase.from('organizations')
      .select('ravena_meta_revendedoras')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        if (data) setMetaRevsOrg(Number((data as any).ravena_meta_revendedoras) || 0);
      });
  },[orgId, orgReady]); // eslint-disable-line

  const load=async()=>{if(!metaToken||!metaAccount){setLoading(false);return;}const key=`meta_camp_${orgId}_${datePreset}`;const cached=getMetaCache(key);if(cached){setCampaigns(cached);setLoading(false);setError(false);return;}setLoading(true);setError(false);const data=await fetchCampaignsWithChildren(datePreset,metaToken,metaAccount);if(data.length>0){setMetaCache(key,data);}setCampaigns(data);setLoading(false);};
  useEffect(()=>{
    if (!metaReady || !orgReady) return;
    load();
  },[datePreset,metaToken,metaAccount,metaReady,orgReady,orgId]); // eslint-disable-line

  const filtered=useMemo(()=>{const base=statusFilter==='all'?campaigns:campaigns.filter(c=>c.status===statusFilter);return[...base].sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999)||b.spend-a.spend);},[campaigns,statusFilter]);

  // Leads do CRM filtrados pelo created_at dentro do período
  const filteredLeads = useMemo(()=>filterLeadsByPreset(allLeads,datePreset),[allLeads,datePreset]);

  const filteredRevs = useMemo(() => {
    const today = todayBRCamp();
    const ok = (ref: string | null | undefined, a: string, b: string) => {
      const d = leadDateBRCamp(ref);
      return !!d && d >= a && d <= b;
    };
    return allLeads.filter(l => {
      if (Number((l as any).status) !== 3) return false;
      // usa ultimo_status_change como fonte principal
      const ref = (l as any).ultimo_status_change || (l as any).created_at;
      switch(datePreset) {
        case 'today':      return ok(ref, today, today);
        case 'yesterday':  { const y = subDaysCamp(today, 1); return ok(ref, y, y); }
        case 'last_7d':    return ok(ref, subDaysCamp(today, 6), today);
        case 'last_30d':   return ok(ref, subDaysCamp(today, 29), today);
        case 'this_month': return ok(ref, today.slice(0,7)+'-01', today);
        default: return Number((l as any).status) === 3;
      }
    });
  }, [allLeads, datePreset]);

  // ── Mapeamento Único: Garante que um lead pertença a apenas 1 campanha
  const campLeadsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    campaigns.forEach(c => map.set(c.id, []));

    for (const l of filteredLeads) {
      const la = l as any;
      const utmRaw = (la.utm_campaign || '').trim();
      if (!utmRaw) continue;

      const utm = utmRaw.toLowerCase().split('|')[0].trim();
      let bestMatch: string | null = null;
      let maxMatchLen = 0;

      for (const c of campaigns) {
        if (utm === c.id) { bestMatch = c.id; break; }
        const cn = c.name.toLowerCase().split('|')[0].trim();
        if (!cn || cn.length < 3) continue;
        if (utm === cn) { bestMatch = c.id; break; }

        if (utm.includes(cn.slice(0, 20))) {
          // Em caso de nomes similares (ex: "Vendas", "Vendas V2"),
          // atribui à campanha com o nome mais longo (mais específico)
          if (cn.length > maxMatchLen) {
            maxMatchLen = cn.length;
            bestMatch = c.id;
          }
        }
      }

      if (bestMatch) {
        const arr = map.get(bestMatch) || [];
        arr.push(l);
        map.set(bestMatch, arr);
      }
    }
    return map;
  }, [filteredLeads, campaigns]);

  // Mapeamento de revendedoras por campanha (usa filteredRevs → status_aprovado_at)
  const campRevsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    campaigns.forEach(c => map.set(c.id, []));
    for (const l of filteredRevs) {
      const la = l as any;
      const utmRaw = (la.utm_campaign || '').trim();
      if (!utmRaw) continue;
      const utm = utmRaw.toLowerCase().split('|')[0].trim();
      let bestMatch: string | null = null;
      let maxMatchLen = 0;
      for (const c of campaigns) {
        if (utm === c.id) { bestMatch = c.id; break; }
        const cn = c.name.toLowerCase().split('|')[0].trim();
        if (!cn || cn.length < 3) continue;
        if (utm === cn) { bestMatch = c.id; break; }
        if (utm.includes(cn.slice(0, 20))) {
          if (cn.length > maxMatchLen) { maxMatchLen = cn.length; bestMatch = c.id; }
        }
      }
      if (bestMatch) {
        const arr = map.get(bestMatch) || [];
        arr.push(l);
        map.set(bestMatch, arr);
      }
    }
    return map;
  }, [filteredRevs, campaigns]);

  // Todos os leads (sem filtro de período) mapeados por campanha — para calcular idade real (isNew)
  const allCampLeadsMap = useMemo(() => {
    const map = new Map<string, any[]>();
    campaigns.forEach(c => map.set(c.id, []));
    for (const l of allLeads) {
      const la = l as any;
      const utmRaw = (la.utm_campaign || '').trim();
      if (!utmRaw) continue;
      const utm = utmRaw.toLowerCase().split('|')[0].trim();
      let bestMatch: string | null = null;
      let maxMatchLen = 0;
      for (const c of campaigns) {
        if (utm === c.id) { bestMatch = c.id; break; }
        const cn = c.name.toLowerCase().split('|')[0].trim();
        if (!cn || cn.length < 3) continue;
        if (utm === cn) { bestMatch = c.id; break; }
        if (utm.includes(cn.slice(0, 20))) {
          if (cn.length > maxMatchLen) { maxMatchLen = cn.length; bestMatch = c.id; }
        }
      }
      if (bestMatch) {
        const arr = map.get(bestMatch) || [];
        arr.push(l);
        map.set(bestMatch, arr);
      }
    }
    return map;
  }, [allLeads, campaigns]);

  const getCampLeads = useCallback((campName: string, campId: string) => {
    return campLeadsMap.get(campId) || [];
  }, [campLeadsMap]);

  const getCampRevs = useCallback((_campName: string, campId: string) => {
    return campRevsMap.get(campId) || [];
  }, [campRevsMap]);

  const totalSpend = campaigns.reduce((s,c)=>s+c.spend,0);
  const totalLeads = campaigns.reduce((s,c)=>s+c.leads_api,0);
  const avgCPL = totalLeads>0?totalSpend/totalLeads:0;
  const maxSpend = Math.max(...campaigns.map(c=>c.spend),1);

  // Dados por campanha (leads CRM + revendedoras)
  const chartRows = useMemo(()=>{
    return filtered.slice(0,10).map(c=>{
      const campLeads = getCampLeads(c.name, c.id);
      const campRevs  = getCampRevs(c.name, c.id);
      const l = campLeads.length > 0 ? campLeads.length : c.leads_api;
      const r = campRevs.length;
      return {
        name: c.name.length>16?c.name.slice(0,16)+'…':c.name,
        fullName: c.name,
        leads: l,
        rev:   r,
        cpl:   l>0&&c.spend>0 ? Math.round(c.spend/l) : 0,
        cpr:   r>0&&c.spend>0 ? Math.round(c.spend/r) : 0,
        spend: c.spend,
        id: c.id,
      };
    });
  },[filtered, getCampLeads, getCampRevs]); // eslint-disable-line

  const mediaCPR = useMemo(() => {
    const comCPR = chartRows.filter(r => r.cpr > 0);
    return comCPR.length > 0
      ? comCPR.reduce((s, r) => s + r.cpr, 0) / comCPR.length
      : 0;
  }, [chartRows]);

  // Scores por campanha — usa allCampLeadsMap para idade real
  const campScores = useMemo(() => {
    const map = new Map<string, number>();
    chartRows.forEach(r => {
      map.set(r.id, calcScore(r, chartRows, allCampLeadsMap, campRevsMap, datePreset));
    });
    return map;
  }, [chartRows, allCampLeadsMap, campRevsMap, datePreset]);

  // Top 5 por score para o ranking lateral
  const rankedRows = useMemo(() => {
    return [...chartRows]
      .map(r => ({ ...r, score: calcScore(r, chartRows, allCampLeadsMap, campRevsMap, datePreset) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [chartRows, allCampLeadsMap, campRevsMap, datePreset]);

  // ── Performance badge por campanha ───────────────────────────
  function getCampPerf(c: Campaign): 'green'|'yellow'|'red' {
    const cl=getCampLeads(c.name,c.id);
    const cL=cl.length>0?cl.length:c.leads_api;
    const cR=getCampRevs(c.name,c.id).length;
    const cpl=cL>0&&c.spend>0?c.spend/cL:0;
    if(avgCPL>0&&cpl>0&&cpl>avgCPL*1.5) return 'red';
    if(cpl>0&&avgCPL>0&&cpl<=avgCPL&&cR>0) return 'green';
    return 'yellow';
  }

  // ── Modo Gestor: exibe só campanhas que precisam atenção ──────
  const displayedCampaigns = useMemo(()=>{
    const base = gestorMode ? filtered.filter(c=>getCampPerf(c)!=='green') : filtered;
    return [...base].sort((a, b) => {
      const sA = campScores.get(a.id) ?? 0;
      const sB = campScores.get(b.id) ?? 0;
      return sB - sA;
    });
  },[filtered, gestorMode, campScores, getCampLeads, avgCPL]); // eslint-disable-line

  // ── Alertas automáticos ───────────────────────────────────────
  const alerts = useMemo(()=>{
    if(!filtered.length||loading) return [];
    const items:{type:'red'|'yellow'|'green';msg:string}[]=[];
    const trunc=(s:string)=>s.length>35?s.slice(0,35)+'…':s;
    for(const c of filtered){
      const cl=getCampLeads(c.name,c.id);
      const cL=cl.length>0?cl.length:c.leads_api;
      const cR=getCampRevs(c.name,c.id).length;
      const cpl=cL>0&&c.spend>0?c.spend/cL:0;
      const cpr=cR>0&&c.spend>0?c.spend/cR:0;
      if(avgCPL>0&&cpl>avgCPL*1.3&&c.spend>20&&items.length<5)
        items.push({type:'red',msg:`${trunc(c.name)} — CPL R$ ${fmt(cpl)} está ${Math.round((cpl/avgCPL-1)*100)}% acima da média`});
      else if(cL>5&&cR===0&&items.length<5)
        items.push({type:'red',msg:`${trunc(c.name)} — ${cL} leads sem nenhuma revendedora`});
      if(c.ctr<1.5&&c.impressions>1000&&items.length<5)
        items.push({type:'yellow',msg:`${trunc(c.name)} — CTR ${c.ctr.toFixed(2)}% abaixo de 1.5%`});
      if(cR>0&&cpr>200&&items.length<5)
        items.push({type:'yellow',msg:`${trunc(c.name)} — CPR R$ ${fmt(cpr)} acima de R$ 200`});
      if(avgCPL>0&&cpl>0&&cpl<avgCPL&&c.spend>20&&items.length<5)
        items.push({type:'green',msg:`${trunc(c.name)} — CPL R$ ${fmt(cpl)} abaixo da média da conta`});
      if(cL>=5&&cR/cL>0.1&&items.length<5)
        items.push({type:'green',msg:`${trunc(c.name)} — ${Math.round(cR/cL*100)}% de aprovação (${cR} rev de ${cL} leads)`});
    }
    return items.sort((a,b)=>{const o={red:0,yellow:1,green:2};return o[a.type]-o[b.type];}).slice(0,5);
  },[filtered,getCampLeads,avgCPL,loading]); // eslint-disable-line

  // Cards: leads criados no período (created_at) via Meta Ads
  const leadsCRMTotal = useMemo(()=>
    filteredLeads.filter(l=>{
      const la=l as any;
      return (la.utm_source||'').toUpperCase()==='FB' || (la.utm_campaign||'').trim().length>0;
    }).length
  ,[filteredLeads]);
  // Revendedoras aprovadas no período (status_aprovado_at) via Meta Ads
  const revsCRMTotal = useMemo(()=>
    filteredRevs.filter(l=>{
      const la=l as any;
      return (la.utm_source||'').toUpperCase()==='FB' || (la.utm_campaign||'').trim().length>0;
    }).length
  ,[filteredRevs]);
  const cplCard = leadsCRMTotal>0&&totalSpend>0 ? totalSpend/leadsCRMTotal : 0;
  const cprCard = revsCRMTotal>0&&totalSpend>0  ? totalSpend/revsCRMTotal  : 0;

  const avgCTR = useMemo(() => {
    const ativas = campaigns.filter(c => c.impressions > 0);
    if (!ativas.length) return 0;
    const totalImpressions = ativas.reduce((s,c) => s + c.impressions, 0);
    const totalClicks = ativas.reduce((s,c) => s + c.clicks, 0);
    return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  }, [campaigns]);

  const bg=dark?'#090909':'#f4f4f5'; const cardBg=dark?'#111113':'#ffffff'; const border=dark?'#1e1e22':'#e5e7eb';
  const txtHi=dark?'#f4f4f5':'#111827'; const txtMid=dark?'#71717a':'#6b7280'; const txtLow=dark?'#52525b':'#9ca3af';
  const divCls=dark?'#1e1e22':'#f3f4f6'; const gridLn=dark?'#1e1e22':'#f0f0f0';
  const pad=isMobile?'16px':'32px';
  const dot=<span style={{fontSize:'11px',color:txtLow,margin:'0 2px'}}>·</span>;

  function toggleExpand(id:string){setExpandedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}
  function toggleExpandAdset(id:string){setExpandedAdsetIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});}

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{padding:pad,background:bg,minHeight:'100vh'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{fontSize:isMobile?'20px':'24px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:0}}>Campanhas Meta Ads</h1>
            <p style={{fontSize:'13px',color:txtMid,marginTop:'4px'}}>Dados em tempo real via API do Facebook</p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark}/>
            <FilterDropdown value={statusFilter} options={[{label:'Todas',value:'all'},{label:'Ativas',value:'ACTIVE'},{label:'Pausadas',value:'PAUSED'}]} onChange={setStatusFilter} dark={dark}/>
            <button onClick={()=>{ const key=`meta_camp_${orgId}_${datePreset}`; sessionStorage.removeItem(key); load(); }} disabled={loading} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>
              <RefreshCw style={{width:'14px',height:'14px',animation:loading?'spin 1s linear infinite':''}}/>
              {loading?'Carregando…':'Atualizar'}
            </button>
          </div>
        </div>

        {/* Cards: Gasto | Leads+CPL | Revs+CPR | CTR */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(4,1fr)',gap:isMobile?'12px':'16px',marginBottom:'16px'}}>

          {/* Card 1: GASTO */}
          <div style={{background:cardBg,borderRadius:'16px',padding:isMobile?'12px':'20px',border:`1px solid ${border}`}}>
            <p style={{fontSize:'12px',color:txtMid,margin:'0 0 4px'}}>Gasto Total</p>
            <p style={{fontSize:isMobile?'18px':'22px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:'0 0 6px'}}>
              {loading ? '…' : `R$ ${fmt(totalSpend)}`}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <TrendingUp style={{width:'11px',height:'11px',color:'#10b981'}}/>
              <span style={{fontSize:'11px',color:txtLow}}>Meta Ads</span>
            </div>
          </div>

          {/* Card 2: LEADS + CPL */}
          <div style={{background:cardBg,borderRadius:'16px',padding:isMobile?'12px':'20px',border:`1px solid ${border}`}}>
            <p style={{fontSize:'12px',color:txtMid,margin:'0 0 4px'}}>Leads</p>
            <p style={{fontSize:isMobile?'18px':'22px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:'0 0 6px'}}>
              {loading ? '…' : fmtInt(leadsCRMTotal)}
            </p>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'11px',color:txtLow}}>Tráfego pago · CRM</span>
              {cplCard > 0 && (
                <span style={{fontSize:'12px',fontWeight:700,color:'#3b82f6'}}>
                  CPL R$ {fmt(cplCard)}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: REVENDEDORAS + CPR */}
          <div style={{background:cardBg,borderRadius:'16px',padding:isMobile?'12px':'20px',border:`1px solid ${border}`}}>
            <p style={{fontSize:'12px',color:txtMid,margin:'0 0 4px'}}>Revendedoras</p>
            <p style={{fontSize:isMobile?'18px':'22px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:'0 0 6px'}}>
              {loading ? '…' : fmtInt(revsCRMTotal)}
            </p>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'11px',color:txtLow}}>via tráfego</span>
              {cprCard > 0 && (
                <span style={{fontSize:'12px',fontWeight:700,color:'#a855f7'}}>
                  CPR R$ {fmt(cprCard)}
                </span>
              )}
            </div>
          </div>

          {/* Card 4: CTR MÉDIO */}
          <div style={{background:cardBg,borderRadius:'16px',padding:isMobile?'12px':'20px',border:`1px solid ${border}`}}>
            <p style={{fontSize:'12px',color:txtMid,margin:'0 0 4px'}}>CTR Médio</p>
            <p style={{fontSize:isMobile?'18px':'22px',fontWeight:700,letterSpacing:'-0.03em',margin:'0 0 6px',
              color: avgCTR >= 3 ? '#10b981' : avgCTR >= 1.5 ? txtHi : '#ef4444'}}>
              {loading ? '…' : `${avgCTR.toFixed(2)}%`}
            </p>
            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
              <span style={{fontSize:'11px',color: avgCTR >= 3 ? '#10b981' : avgCTR >= 1.5 ? txtLow : '#ef4444'}}>
                {avgCTR >= 3 ? '↑ Excelente' : avgCTR >= 1.5 ? '→ Normal' : '↓ Baixo'}
              </span>
              <span style={{fontSize:'11px',color:txtLow}}>· média das campanhas</span>
            </div>
          </div>

        </div>

        {/* Banner Ravena */}
        {aiLog && (
          <div
            onClick={() => setShowAiPanel(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 20px', borderRadius: '14px',
              background: dark
                ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.08))'
                : 'linear-gradient(135deg, #faf5ff, #eff6ff)',
              border: `1px solid ${dark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)'}`,
              cursor: 'pointer', marginTop: '12px', marginBottom: '4px',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {/* Avatar Ravena */}
            <img src="/ravena.png" alt="Ravena" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 12px rgba(139,92,246,0.4)' }} />
            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: dark ? '#c4b5fd' : '#6d28d9' }}>
                Ravena analisou suas campanhas hoje
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: dark ? '#8b5cf6' : '#7c3aed', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {aiLog.frase_do_dia || aiLog.resumo || 'Clique para ver a análise completa'}
              </p>
            </div>
            {/* Seta + badge ações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {aiLog.acoes_executadas?.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', background: '#8b5cf6', padding: '2px 8px', borderRadius: '99px' }}>
                  {aiLog.acoes_executadas.length} ação{aiLog.acoes_executadas.length !== 1 ? 'ões' : ''}
                </span>
              )}
              <span style={{ fontSize: '18px', color: dark ? '#8b5cf6' : '#7c3aed' }}>→</span>
            </div>
          </div>
        )}
        {!aiLog && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', borderRadius: '10px', marginTop: '12px', marginBottom: '4px',
            background: dark ? 'rgba(139,92,246,0.06)' : '#faf5ff',
            border: `1px solid ${dark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.15)'}`,
          }}>
            <img src="/ravena.png" alt="Ravena" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '12px', color: dark ? '#8b5cf6' : '#7c3aed' }}>
              Ravena ainda não analisou hoje — próxima análise automática às 08h
            </p>
          </div>
        )}

        {/* Leads × Revendedoras por Campanha — Bar Chart */}
        {!loading && chartRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 260px', gap: '16px', marginTop: '24px' }}>

            {/* GRÁFICO */}
            <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: txtHi, margin: 0 }}>Leads × Revendedoras por Campanha</h3>
                <p style={{ fontSize: '12px', color: txtMid, margin: '4px 0 0' }}>Comparativo de captação e conversão no período selecionado</p>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={rankedRows.map(r => {
                    const campLeadsList = campLeadsMap.get(r.id) || [];
                    const potenciais = campLeadsList.filter(l => [2, 5].includes(Number((l as any).status))).length;
                    const raw = r.fullName.replace(/\s*-\s*\[CBO\]/gi,'').replace(/\s*-\s*\[ABO\]/gi,'').replace(/\[LEADS?\]/gi,'').trim();
                    return {
                      name: raw.length > 14 ? raw.slice(0, 14) + '…' : raw,
                      fullName: r.fullName,
                      leads: r.leads,
                      revs: r.rev,
                      cpl: r.cpl,
                      cpr: r.cpr > 0 ? Math.round(r.cpr) : 0,
                      spend: r.spend,
                      potenciais,
                      id: r.id,
                    };
                  })}
                  margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
                  barCategoryGap="30%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: txtMid }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={40}
                  />
                  <YAxis tick={{ fontSize: 11, fill: txtMid }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    cursor={{ fill: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', radius: 8 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div style={{ background: dark ? '#1a1a1e' : '#fff', border: `1px solid ${border}`, borderRadius: '12px', padding: '14px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: '210px' }}>
                          <p style={{ fontWeight: 700, fontSize: '13px', color: txtHi, margin: '0 0 12px', lineHeight: 1.4 }}>{d.fullName}</p>
                          {/* Seção Leads */}
                          <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${border}` }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Leads</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>Total</span><span style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{d.leads}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>CPL</span><span style={{ fontSize: '12px', fontWeight: 600, color: txtHi }}>{d.cpl > 0 ? `R$ ${d.cpl}` : '—'}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>Investido</span><span style={{ fontSize: '12px', fontWeight: 600, color: txtHi }}>R$ {fmt(d.spend)}</span></div>
                            </div>
                          </div>
                          {/* Seção Revendedoras */}
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>Revendedoras</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>Total</span><span style={{ fontSize: '12px', fontWeight: 700, color: '#a855f7' }}>{d.revs}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>CPR</span><span style={{ fontSize: '12px', fontWeight: 600, color: txtHi }}>{d.cpr > 0 ? `R$ ${d.cpr}` : '—'}</span></div>
                              {d.potenciais > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}><span style={{ fontSize: '12px', color: txtMid }}>Em potencial</span><span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>+{d.potenciais}</span></div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="leads" name="Leads" fill="#10b981" radius={[6,6,0,0]} maxBarSize={40} animationDuration={800} animationEasing="ease-out">
                    <LabelList dataKey="leads" position="top" style={{ fontSize: '11px', fontWeight: 700, fill: '#10b981' }} />
                  </Bar>
                  <Bar dataKey="revs" name="Revendedoras" fill="#a855f7" radius={[6,6,0,0]} maxBarSize={40} animationDuration={800} animationEasing="ease-out">
                    <LabelList dataKey="revs" position="top" style={{ fontSize: '11px', fontWeight: 700, fill: '#a855f7' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', marginTop: '8px' }}>
                {[{ color: '#10b981', label: 'Leads' }, { color: '#a855f7', label: 'Revendedoras' }].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color }} />
                    <span style={{ fontSize: '12px', color: txtMid, fontWeight: 500 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RANKING LATERAL — Top 5 por Score */}
            <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: txtHi, margin: '0 0 2px' }}>Top Campanhas</h3>
              {rankedRows.map((r, i) => {
                const color = scoreColor(r.score);
                // usa allCampLeadsMap para idade real (não filtrada por período)
                const allLeadsList = allCampLeadsMap.get(r.id) || [];
                const oldest = allLeadsList.length > 0
                  ? Math.min(...allLeadsList.map(l => new Date((l as any).created_at || Date.now()).getTime()))
                  : Date.now();
                const ageDays = Math.floor((Date.now() - oldest) / (1000*60*60*24));
                const isNew = ageDays < 3;
                // potenciais: usa campLeadsMap (filtrado por período) para exibição
                const periodLeadsList = campLeadsMap.get(r.id) || [];
                const potenciais = periodLeadsList.filter(l => [2,5].includes(Number((l as any).status))).length;
                const comCPR = chartRows.filter(x => x.cpr > 0);
                const mCPR = comCPR.length > 0 ? comCPR.reduce((s, x) => s + x.cpr, 0) / comCPR.length : 0;
                const comCPL = chartRows.filter(x => x.cpl > 0);
                const mCPL = comCPL.length > 0 ? comCPL.reduce((s, x) => s + x.cpl, 0) / comCPL.length : 0;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedCamp({
                      r,
                      isNew,
                      potenciais,
                      ageDays,
                      criteria: gerarCriterios(r, chartRows, mCPR, mCPL, isNew, potenciais),
                    })}
                    style={{ padding: '12px 14px', borderRadius: '12px', border: `1px solid ${border}`, background: dark ? 'rgba(255,255,255,0.02)' : '#fafafa', cursor: 'pointer', overflow: 'hidden', maxWidth: '100%' }}
                  >
                    {/* Posição + nome */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color, background: `${color}18`, padding: '2px 7px', borderRadius: '99px', flexShrink: 0 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, maxWidth: '160px' }}>
                        {r.name}
                      </span>
                      {isNew && (
                        <span style={{ fontSize: '9px', color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>nova</span>
                      )}
                    </div>
                    {/* Métricas */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#a855f7' }}>{r.rev} rev</span>
                      {potenciais > 0 && (
                        <span style={{ fontSize: '11px', color: txtMid }}>+{potenciais} pot</span>
                      )}
                      <span style={{ fontSize: '11px', color: txtMid, marginLeft: 'auto' }}>
                        {r.cpr > 0 ? `CPR R$${Math.round(r.cpr)}` : r.leads > 0 ? `${r.leads} leads` : '—'}
                      </span>
                    </div>
                    {/* Barra de score — cor sólida baseada no score */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ height: '6px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${r.score}%`,
                          borderRadius: '99px',
                          background: scoreColorSolid(r.score),
                          transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: txtMid }}>{scoreLabel(r.score, isNew)}</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: scoreColorSolid(r.score) }}>{r.score}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{background:cardBg,borderRadius:'16px',border:`1px solid ${border}`,overflow:'hidden', marginTop:'24px'}}>
          <div style={{display:'flex',borderBottom:`1px solid ${border}`,overflowX:'auto'}}>
            {[{key:'campanhas',label:'Campanhas',icon:TrendingUp},{key:'insights',label:'Insights',icon:Lightbulb}].map(tab=>(
              <button key={tab.key} onClick={()=>setActiveTab(tab.key as any)} style={{display:'flex',alignItems:'center',gap:'7px',padding:'14px 16px',border:'none',cursor:'pointer',background:activeTab===tab.key?cardBg:'transparent',color:activeTab===tab.key?txtHi:txtMid,fontSize:'13px',fontWeight:activeTab===tab.key?600:400,borderBottom:activeTab===tab.key?'2px solid #2563eb':'2px solid transparent',transition:'all 0.15s',fontFamily:'inherit',marginBottom:'-1px',whiteSpace:'nowrap'}}>
                <tab.icon style={{width:'14px',height:'14px'}}/>{tab.label}
              </button>
            ))}
          </div>

          {/* Tab Campanhas */}
          {activeTab==='campanhas'&&(
            <div>
              {(()=>{
                const mostrarSemToken=metaReady&&orgReady&&(!metaToken||!metaAccount);
                const mostrarLoading=loading&&campaigns.length===0;
                const mostrarVazio=!loading&&!mostrarSemToken&&campaigns.length===0&&metaReady&&orgReady;
                if(mostrarLoading) return <div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>Carregando campanhas…</div>;
                if(mostrarSemToken) return (
                  <div style={{padding:'48px 32px',textAlign:'center'}}>
                    <div style={{fontSize:'32px',marginBottom:'12px'}}>📊</div>
                    <p style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:'0 0 6px'}}>Meta Ads não configurado</p>
                    <p style={{fontSize:'13px',color:txtMid,margin:'0 0 20px',lineHeight:1.6}}>Configure seu token do Facebook para ver campanhas e métricas aqui.</p>
                    <Link to="/meta-ads" style={{display:'inline-flex',alignItems:'center',gap:'6px',padding:'10px 20px',borderRadius:'10px',background:'#2563eb',color:'#fff',textDecoration:'none',fontSize:'13px',fontWeight:600}}>Configurar Meta Ads →</Link>
                  </div>
                );
                if(mostrarVazio) return <div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>Nenhuma campanha com gasto no período selecionado.</div>;
                return <>{displayedCampaigns.map(c=>{
                    const isExpanded=expandedIds.has(c.id);
                    const campScore = campScores.get(c.id) ?? 50;
                    const scoreCol = scoreColor(campScore);
                    const periodo=PERIOD_MAP[datePreset]||'all';
                    const campCRMLeads = getCampLeads(c.name, c.id);
                    const campRevsList = getCampRevs(c.name, c.id);
                    const cL = campCRMLeads.length > 0 ? campCRMLeads.length : c.leads_api;
                    const cR = campRevsList.length;
                    const leadsDisplay = cL;
                    const cplVal = leadsDisplay>0&&c.spend>0 ? c.spend/leadsDisplay : null;
                    const cprVal = cR>0&&c.spend>0 ? c.spend/cR : null;
                    return(
                      <div key={c.id} style={{borderBottom:`1px solid ${divCls}`}}>
                        <div onClick={()=>toggleExpand(c.id)} style={{display:'flex',alignItems:'center',gap:'10px',padding:isMobile?'14px':'12px 16px',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTapHighlightColor:'transparent'}}>
                          <ChevronRight style={{width:'14px',height:'14px',color:txtLow,transform:isExpanded?'rotate(90deg)':'',transition:'transform 0.18s',flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            {/* Nome + status indicator */}
                            <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                              {c.status==='ACTIVE'&&(
                                <div style={{position:'relative',width:'6px',height:'6px',flexShrink:0}}>
                                  <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#10b981'}}/>
                                  <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#10b981',animation:'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',opacity:0.5}}/>
                                </div>
                              )}
                              <span style={{fontSize:'13.5px',fontWeight:600,color:txtHi,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:isMobile?'160px':'300px'}}>{c.name}</span>
                              {c.status!=='ACTIVE'&&(
                                <span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 7px',borderRadius:'99px',fontSize:'11px',fontWeight:500,background:dark?'rgba(255,255,255,0.06)':'#f3f4f6',color:txtMid,flexShrink:0}}>
                                  <span style={{width:'4px',height:'4px',borderRadius:'50%',background:txtLow}}/>Pausada
                                </span>
                              )}
                            </div>
                            {/* Métricas */}
                            <div style={{display:'flex',gap:'4px',marginTop:'5px',alignItems:'center',flexWrap:'wrap'}}>
                              <span style={{fontSize:'12px',color:txtMid}}>R$ {fmt(c.spend)}</span>
                              {!isMobile&&<>{dot}<span style={{fontSize:'12px',color:txtMid}}>{fmtInt(c.impressions)} imp</span>{dot}<span style={{fontSize:'12px',color:txtMid}}>{(c.ctr||0).toFixed(2)}% CTR</span></>}
                              {dot}
                              {/* Tag Leads — verde */}
                              <button onClick={e=>{e.stopPropagation();navigate(`/leads?campanha=${encodeURIComponent(c.name)}&periodo=${periodo}`);}} style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11.5px',fontWeight:600,color:'#10b981',background:dark?'rgba(16,185,129,0.12)':'#dcfce7',border:'1px solid rgba(16,185,129,0.25)',cursor:'pointer',fontFamily:'inherit'}}>
                                {leadsDisplay} leads ↗
                              </button>
                              {cplVal&&<span style={{fontSize:'12px',color:'#10b981',fontWeight:500}}>R$ {fmt(cplVal)}</span>}
                              {dot}
                              {/* Tag Rev — roxo */}
                              <button onClick={e=>{e.stopPropagation();navigate(`/leads?campanha=${encodeURIComponent(c.name)}&periodo=${periodo}&status=3`);}} style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11.5px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)',cursor:'pointer',fontFamily:'inherit'}}>
                                {cR} rev ↗
                              </button>
                              <span style={{fontSize:'12px',color:'#a855f7',fontWeight:500}}>{cprVal?`R$ ${fmt(cprVal)}`:'—'}</span>
                            </div>
                          </div>
                          {!isMobile&&(
                            <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                              <div style={{height:'4px',width:'60px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                                <div style={{height:'100%',width:`${campScore}%`,background:scoreColorSolid(campScore),borderRadius:'99px'}}/>
                              </div>
                              <span style={{fontSize:'11px',color:scoreColorSolid(campScore),fontWeight:700}}>{campScore}%</span>
                            </div>
                          )}
                        </div>

                        {/* Conjuntos */}
                        {isExpanded&&(
                          <div style={{background:dark?'rgba(255,255,255,0.012)':'rgba(0,0,0,0.012)',borderTop:`1px solid ${divCls}`}}>
                            {c.adsets&&c.adsets.length>0&&(
                              <div style={{padding:isMobile?'8px 12px':'8px 16px'}}>
                                <p style={{fontSize:'10px',fontWeight:700,color:txtLow,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 6px',paddingLeft:'20px'}}>Conjuntos</p>
                                {c.adsets.map(as=>{
                                  const asEx=expandedAdsetIds.has(as.id);
                                  return(
                                    <div key={as.id} style={{marginBottom:'4px',borderRadius:'10px',border:`1px solid ${divCls}`,overflow:'hidden'}}>
                                      <div onClick={()=>toggleExpandAdset(as.id)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px 10px 9px 20px',background:dark?'rgba(255,255,255,0.015)':'rgba(0,0,0,0.01)',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTapHighlightColor:'transparent'}}>
                                        <ChevronRight style={{width:'12px',height:'12px',color:txtLow,transform:asEx?'rotate(90deg)':'',transition:'transform 0.18s',flexShrink:0}}/>
                                        <div style={{width:'6px',height:'6px',borderRadius:'50%',background:as.status==='ACTIVE'?'#10b981':txtLow,flexShrink:0}}/>
                                        <div style={{flex:1,minWidth:0}}>
                                          <p style={{margin:0,fontSize:'12.5px',fontWeight:500,color:txtHi,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{as.name}</p>
                                          <div style={{display:'flex',gap:'4px',marginTop:'2px',flexWrap:'wrap',alignItems:'center'}}>
                                            <span style={{fontSize:'11px',color:txtMid}}>R$ {fmt(as.spend)}</span>
                                            {dot}
                                            <span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#10b981',background:dark?'rgba(16,185,129,0.12)':'#dcfce7',border:'1px solid rgba(16,185,129,0.25)'}}>{as.leads_api} leads</span>
                                            {as.cpl>0&&<span style={{fontSize:'11px',color:'#10b981',fontWeight:500}}>R$ {fmt(as.cpl)}</span>}
                                            {dot}
                                            {(()=>{const asRev=as.leads_api>0&&c.leads_api>0?Math.round(cR*as.leads_api/c.leads_api):0;return <><span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)'}}>{asRev} rev</span> <span style={{fontSize:'11px',color:'#a855f7',fontWeight:500}}>{asRev>0&&as.spend>0?`R$ ${fmt(as.spend/asRev)}`:'—'}</span></>;})()}
                                            {dot}
                                            <span style={{fontSize:'11px',color:txtMid}}>{(as.ctr||0).toFixed(2)}% CTR</span>
                                          </div>
                                        </div>
                                      </div>
                                      {/* Anúncios */}
                                      {asEx&&as.ads&&as.ads.length>0&&(
                                        <div style={{background:dark?'rgba(255,255,255,0.008)':'rgba(0,0,0,0.015)',borderTop:`1px solid ${divCls}`,padding:'6px 10px 8px 34px'}}>
                                          <p style={{fontSize:'10px',fontWeight:700,color:txtLow,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 6px'}}>Anúncios</p>
                                          {as.ads!.map(ad=>(
                                            <div key={ad.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 8px',borderRadius:'8px',marginBottom:'3px',background:dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)'}}>
                                              <Thumbnail url={ad.thumbnail_url} name={ad.name} size={32}/>
                                              <div style={{flex:1,minWidth:0}}>
                                                <p style={{margin:0,fontSize:'12px',fontWeight:500,color:txtHi,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ad.name}</p>
                                                <div style={{display:'flex',gap:'4px',marginTop:'2px',flexWrap:'wrap',alignItems:'center'}}>
                                                  <span style={{fontSize:'11px',color:ad.status==='ACTIVE'?'#10b981':txtMid}}>{ad.status==='ACTIVE'?'● Ativo':'○ Pausado'}</span>
                                                  {dot}
                                                  <span style={{fontSize:'11px',color:txtMid}}>R$ {fmt(ad.spend)}</span>
                                                  {dot}
                                                  <span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#10b981',background:dark?'rgba(16,185,129,0.12)':'#dcfce7',border:'1px solid rgba(16,185,129,0.25)'}}>{ad.leads_api} leads</span>
                                                  {ad.cpl>0&&<span style={{fontSize:'11px',color:'#10b981',fontWeight:500}}>R$ {fmt(ad.cpl)}</span>}
                                                  {dot}
                                                  {(()=>{const adRev=ad.leads_api>0&&c.leads_api>0?Math.round(cR*ad.leads_api/c.leads_api):0;return <><span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)'}}>{adRev} rev</span> <span style={{fontSize:'11px',color:'#a855f7',fontWeight:500}}>{adRev>0&&ad.spend>0?`R$ ${fmt(ad.spend/adRev)}`:'—'}</span></>;})()}
                                                  {dot}
                                                  <span style={{fontSize:'11px',color:txtMid}}>{(ad.ctr||0).toFixed(2)}% CTR</span>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}</>;
              })()}
            </div>
          )}

        {/* Tab Insights continua embaixo, e remove o chartMobile. Mobile já mostra as cards responsivas */}
        {activeTab==='insights'&&(
          <div style={{background:cardBg,borderRadius:'16px',border:`1px solid ${border}`,padding:isMobile?'16px':'24px', marginTop:'24px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'10px',background:dark?'rgba(139,92,246,0.15)':'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Lightbulb style={{width:'16px',height:'16px',color:'#8b5cf6'}}/>
              </div>
              <div>
                <h3 style={{margin:0,fontSize:'15px',fontWeight:600,color:txtHi}}>⚡ Análise de hoje</h3>
                <p style={{margin:0,fontSize:'12px',color:txtMid,marginTop:'2px'}}>Gerado pela Ravena com base nos dados reais</p>
              </div>
            </div>
            {loading
              ?<div style={{color:txtMid,fontSize:'13px',textAlign:'center',padding:'32px'}}>Carregando…</div>
              :aiLog?.insights?.length>0
                ?<div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {aiLog.insights.map((insight:any,i:number)=>(
                    <div key={i} style={{padding:'13px 16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.03)':'#fafafa',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,display:'flex',gap:'12px',alignItems:'flex-start'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#8b5cf6',flexShrink:0,marginTop:'6px'}}/>
                      <p style={{margin:0,fontSize:'13px',color:dark?'#d4d4d8':'#374151',lineHeight:1.65}}>{typeof insight==='string'?insight:insight.mensagem}</p>
                    </div>
                  ))}
                </div>
                :<div style={{padding:'40px 0',textAlign:'center'}}>
                  <p style={{margin:0,fontSize:'13px',color:txtMid,lineHeight:1.6}}>Nenhum insight gerado hoje.<br/>A Ravena só gera insights quando identifica algo realmente importante.</p>
                </div>
            }
          </div>
        )}
      </div>
    </div>
    {/* Painel IA - Refactor Premium */}
    {showAiPanel && aiLog && (
        <AIOptimizationPanel
          log={aiLog}
          dark={dark}
          isMobile={isMobile}
          allLeads={allLeads}
          onClose={() => setShowAiPanel(false)}
          metaRevs={metaRevsOrg}
        />
      )}

    {/* Modal de detalhes de campanha */}
    {selectedCamp && (
      <div
        onClick={() => setSelectedCamp(null)}
        style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: dark ? '#161619' : '#fff', borderRadius: '20px', border: `1px solid ${border}`, width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
        >
          {/* Header do modal */}
          <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 4px' }}>Análise de campanha</p>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: txtHi, margin: 0, lineHeight: 1.3, wordBreak: 'break-word' }}>{selectedCamp.r.fullName}</h2>
            </div>
            <button
              onClick={() => setSelectedCamp(null)}
              style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '99px', border: 'none', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: txtMid, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </div>

          {/* Score visual */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: `${scoreColorSolid(selectedCamp.r.score)}18`, border: `3px solid ${scoreColorSolid(selectedCamp.r.score)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color: scoreColorSolid(selectedCamp.r.score) }}>{selectedCamp.r.score}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: txtHi }}>{scoreLabel(selectedCamp.r.score, selectedCamp.isNew)}</p>
                <div style={{ height: '8px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${selectedCamp.r.score}%`, background: scoreColorSolid(selectedCamp.r.score), borderRadius: '99px', transition: 'width 0.8s ease' }} />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: txtLow }}>
                  {selectedCamp.isNew ? `Nova campanha — ${selectedCamp.ageDays}d de dados` : `${selectedCamp.ageDays} dias ativo`}
                </p>
              </div>
            </div>
          </div>

          {/* Critérios */}
          <div style={{ padding: '0 20px 16px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Critérios de avaliação</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedCamp.criteria.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{c.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: txtHi }}>{c.label}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '11px', color: txtMid }}>{c.detalhe}</p>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: c.pts > 0 ? '#10b981' : c.pts < 0 ? '#ef4444' : txtLow, flexShrink: 0 }}>
                    {c.pts > 0 ? `+${c.pts}` : c.pts === 0 ? '—' : c.pts}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Métricas 2 colunas */}
          <div style={{ padding: '0 20px 20px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: txtLow, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Métricas do período</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Leads', value: String(selectedCamp.r.leads), color: '#10b981' },
                { label: 'Revendedoras', value: String(selectedCamp.r.rev), color: '#a855f7' },
                { label: 'CPL', value: selectedCamp.r.cpl > 0 ? `R$ ${Math.round(selectedCamp.r.cpl)}` : '—', color: txtHi },
                { label: 'CPR', value: selectedCamp.r.cpr > 0 ? `R$ ${Math.round(selectedCamp.r.cpr)}` : '—', color: txtHi },
                { label: 'Investido', value: `R$ ${fmt(selectedCamp.r.spend)}`, color: txtHi },
                { label: 'Em potencial', value: String(selectedCamp.potenciais), color: '#f59e0b' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
                  <p style={{ margin: '0 0 2px', fontSize: '10px', color: txtLow }}>{m.label}</p>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </AppLayout>
  );
}

// ── Componentes do Painel de Otimização IA ───────────────────────────────────

function AIOptimizationPanel({ log, dark, isMobile, allLeads, onClose, metaRevs = 0 }: { log: any; dark: boolean; isMobile: boolean; allLeads: any[]; onClose: () => void; metaRevs?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const border = dark ? '#1e1e22' : '#e5e7eb';
  const cardBg = dark ? '#161619' : '#fff';

  const leadsEmAtendimento = allLeads.filter(l => Number(l.status) === 1).length;

  // Formata valor monetário para exibição
  const fmtMoeda = (n: number) => n > 0 ? `R$ ${n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';

  // Parser fallback para extrair métricas do campo resumo (texto legado)
  const parseMetric = (label: string) => {
    const regex = new RegExp(`${label}:?\\s*([^|\\n\\.]+)(\\.|\\||\\n|$)`, 'i');
    const match = log.resumo?.match(regex);
    return match ? match[1].trim() : null;
  };

  const kpis = [
    { label: 'Investimento', value: (log.total_gasto != null && log.total_gasto > 0) ? fmtMoeda(log.total_gasto) : '—', icon: DollarSign, color: '#10b981' },
    { label: 'Leads', value: (log.total_leads != null && log.total_leads > 0) ? String(log.total_leads) : '—', icon: Users, color: '#3b82f6' },
    { label: 'CPL médio', value: (log.cpl_medio != null && log.cpl_medio > 0) ? fmtMoeda(log.cpl_medio) : '—', icon: TrendingUp, color: '#10b981' },
    { label: 'Projeção', value: (log.ritmo_mensal != null && log.ritmo_mensal > 0) ? fmtMoeda(log.ritmo_mensal) : '—', icon: BarChart, color: '#a855f7' },
  ];

  const statusBudget = parseMetric('Status do budget');
  const hasAlert = !!log.alerta;
  const isCritical = hasAlert && (log.alerta.toLowerCase().includes('crítico') || log.alerta.toLowerCase().includes('meta'));
  
  const statusColor = isCritical ? '#ef4444' : (hasAlert || (statusBudget?.includes('Acima'))) ? '#f59e0b' : '#10b981';
  const statusLabel = isCritical ? 'CPL fora da meta' : (hasAlert || (statusBudget?.includes('Acima'))) ? 'Atenção ao budget' : 'Ravena estável';

  return (
    <>
      <div 
        onClick={onClose} 
        style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', 
          backdropFilter: 'blur(4px)', zIndex: 1000,
          opacity: mounted ? 1 : 0, transition: 'opacity 0.3s ease'
        }} 
      />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : '440px',
        background: dark ? '#0d0d0f' : '#f8fafc',
        borderLeft: `1px solid ${border}`,
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-20px 0 50px rgba(0,0,0,0.15)',
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header Section */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${border}`, background: cardBg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Avatar Ravena */}
              <img src="/ravena.png" alt="Ravena" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 0 16px rgba(139,92,246,0.4)' }} />
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: txtHi, margin: 0, letterSpacing: '-0.02em' }}>Ravena otimizou suas campanhas</h2>
                <p style={{ fontSize: '12px', color: txtMid, margin: '3px 0 0' }}>
                  Hoje às {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: txtMid, borderRadius: '8px' }}>
              <X size={20} />
            </button>
          </div>

        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Frase do dia */}
          {log.frase_do_dia && (
            <p style={{ fontSize: '15px', fontWeight: 500, color: txtHi, lineHeight: 1.6, margin: 0, padding: '20px 24px', borderBottom: `1px solid ${border}` }}>
              "{log.frase_do_dia}"
            </p>
          )}

          {/* Barra de progresso do mês */}
          {(() => {
            const revsAtual = log.revendedoras_mes || 0;
            const progressoPct = metaRevs > 0 ? Math.min(Math.round((revsAtual / metaRevs) * 100), 100) : 0;
            const diasRestantes = log.dias_restantes || 0;
            const gastoTotal = log.total_gasto || 0;
            const progressoCor = progressoPct >= 80 ? '#10b981' : progressoPct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div style={{ padding: '16px 24px', borderBottom: `1px solid ${border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 2px' }}>
                      Meta do mês
                    </p>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: txtHi, margin: 0 }}>
                      {revsAtual}
                      <span style={{ fontSize: '14px', fontWeight: 500, color: txtMid }}>
                        {metaRevs > 0 ? ` / ${metaRevs} revendedoras` : ' revendedoras'}
                      </span>
                    </p>
                  </div>
                  {metaRevs > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '20px', fontWeight: 700, color: progressoCor, margin: 0 }}>{progressoPct}%</p>
                      <p style={{ fontSize: '11px', color: txtMid, margin: 0 }}>{diasRestantes}d restantes</p>
                    </div>
                  )}
                </div>
                {metaRevs > 0 && (
                  <div style={{ height: '6px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progressoPct}%`, borderRadius: '99px', background: progressoCor, transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
                  </div>
                )}

              </div>
            );
          })()}

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* O que eu fiz hoje */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>O que eu fiz hoje</p>
              {log.acoes_executadas?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {log.acoes_executadas.map((acao: any, i: number) => (
                    <ActionCard key={i} acao={acao} dark={dark} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
                  <p style={{ fontSize: '13px', color: txtMid, margin: 0 }}>
                    ✋ {log.resumo || 'Nenhuma ação necessária hoje.'}
                  </p>
                </div>
              )}
            </div>

            {/* Insight do dia */}
            {log.insight_do_dia && (
              <div style={{ padding: '14px 16px', borderRadius: '12px', background: dark ? 'rgba(139,92,246,0.08)' : '#faf5ff', border: '1px solid rgba(139,92,246,0.2)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
                  💡 Observação do dia
                </p>
                <p style={{ fontSize: '13px', color: dark ? '#c4b5fd' : '#6d28d9', margin: 0, lineHeight: 1.6 }}>
                  {log.insight_do_dia}
                </p>
              </div>
            )}

            {/* Campanhas analisadas */}
            {log.insights?.length > 0 && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>O que analisei hoje</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {log.insights.map((item: any, i: number) => (
                    <div key={i} style={{ padding: '12px 14px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.02)' : '#fafafa', border: `1px solid ${border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                          color: item.decisao === 'escalar' ? '#10b981' : item.decisao === 'pausar' ? '#ef4444' : item.decisao === 'aguardar' ? '#3b82f6' : '#f59e0b',
                          background: item.decisao === 'escalar' ? 'rgba(16,185,129,0.1)' : item.decisao === 'pausar' ? 'rgba(239,68,68,0.1)' : item.decisao === 'aguardar' ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
                        }}>
                          {item.decisao === 'escalar' ? '⭐ Escalar' : item.decisao === 'pausar' ? '⏸ Pausar' : item.decisao === 'aguardar' ? '⏳ Aguardar' : '👀 Manter'}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {item.campanha_nome}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: txtMid, margin: '0 0 4px', lineHeight: 1.5 }}>
                        {item.porque}
                      </p>
                      {item.proximo_passo && (
                        <p style={{ fontSize: '11px', color: dark ? '#52525b' : '#9ca3af', margin: 0, fontStyle: 'italic' }}>
                          → {item.proximo_passo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alerta */}
            {log.alerta && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#ef4444' }}>⚠️</span> Ponto de atenção
                </p>
                <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '13px', lineHeight: 1.5, fontWeight: 500 }}>
                  {log.alerta}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer info */}
        <div style={{ padding: '16px 24px', borderTop: `1px solid ${border}`, background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
          <p style={{ fontSize: '11px', color: txtMid, margin: 0, textAlign: 'center' }}>
            As decisões da IA são baseadas na performance dos últimos 7 dias.
          </p>
        </div>
      </div>
    </>
  );
}

function ActionCard({ acao, dark }: { acao: any; dark: boolean }) {
  const isBudget = acao.tipo === 'ajustar_budget_campanha' || acao.tipo === 'ajustar_budget_adset';
  const isUp = isBudget && acao.direcao === 'aumento';
  const isDown = isBudget && acao.direcao === 'reducao';
  const isPause = typeof acao.tipo === 'string' && acao.tipo.startsWith('pausar_');
  const hasError = acao.ok === false;

  const color = isUp ? '#10b981' : isDown ? '#ef4444' : isPause ? '#71717a' : '#3b82f6';
  const bg = isUp ? 'rgba(16,185,129,0.05)' : isDown ? 'rgba(239,68,68,0.05)' : 'rgba(113,113,122,0.05)';
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : isPause ? Pause : Zap;

  const txtHi = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const border = dark ? '#1e1e22' : '#e5e7eb';

  return (
    <div style={{ 
      padding: '14px', borderRadius: '16px', background: dark ? '#161619' : '#fff', 
      border: `1px solid ${border}`, display: 'flex', gap: '14px', alignItems: 'flex-start',
      transition: 'all 0.2s ease', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ 
        width: '36px', height: '36px', borderRadius: '10px', background: bg, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
      }}>
        <Icon size={18} color={color} />
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {isUp ? 'Budget aumentado' : isDown ? 'Budget reduzido' : isPause ? 'Pausado' : 'Ação IA'}
          </span>
          {hasError && (
            <span style={{ fontSize: '9px', fontWeight: 900, background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>ERRO</span>
          )}
        </div>
        
        <p style={{ fontSize: '13.5px', fontWeight: 700, color: txtHi, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {acao.nome || acao.campanha_nome || '—'}
        </p>

        {isBudget && acao.novo_budget != null && (
          <p style={{ fontSize: '13px', fontWeight: 600, color: txtHi, margin: '4px 0 6px' }}>
            <span style={{ color: txtMid, fontWeight: 400 }}>R$ {acao.antigo_budget || '??'}</span>
            <span style={{ margin: '0 8px', color: txtMid }}>→</span>
            <span style={{ color }}>R$ {acao.novo_budget}/dia</span>
          </p>
        )}

        {acao.motivo && (
          <p style={{ margin: 0, fontSize: '11.5px', color: txtMid, lineHeight: 1.5 }}>
            {acao.motivo}
          </p>
        )}
      </div>
    </div>
  );
}
