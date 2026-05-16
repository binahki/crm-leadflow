import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { TrendingUp, TrendingDown, Pause, AlertTriangle, X, DollarSign, Users, RefreshCw, Zap, ChevronDown, Lightbulb, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell, LabelList } from 'recharts';
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
  const today=todayBRCamp();
  const ok=(l:any,a:string,b:string)=>{const d=leadDateBRCamp(l.created_at);return !!d&&d>=a&&d<=b;};
  switch(preset){
    case 'today':      return leads.filter(l=>ok(l,today,today));
    case 'yesterday':  {const y=subDaysCamp(today,1);return leads.filter(l=>ok(l,y,y));}
    case 'last_7d':    return leads.filter(l=>ok(l,subDaysCamp(today,6),today));
    case 'last_30d':   return leads.filter(l=>ok(l,subDaysCamp(today,29),today));
    case 'this_month': return leads.filter(l=>ok(l,today.slice(0,7)+'-01',today));
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
  const [gestorMode, setGestorMode] = useState(false);

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
    // Busca sem filtro de created_at para capturar revendedoras aprovadas no período mas criadas antes
    void since; // since calculado mas não usado no query — filtro acontece em memória
    supabase.from('leads')
      .select('id,utm_campaign,utm_source,status,created_at,status_aprovado_at,status_reuniao_at,status_contrato_at')
      .eq('org_id',orgId).order('created_at',{ascending:false}).limit(2000)
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

  const load=async()=>{if(!metaToken||!metaAccount){setLoading(false);return;}const key=`meta_camp_${orgId}_${datePreset}`;const cached=getMetaCache(key);if(cached){setCampaigns(cached);setLoading(false);setError(false);return;}setLoading(true);setError(false);const data=await fetchCampaignsWithChildren(datePreset,metaToken,metaAccount);if(data.length>0){setMetaCache(key,data);}setCampaigns(data);setLoading(false);};
  useEffect(()=>{
    if (!metaReady || !orgReady) return;
    load();
  },[datePreset,metaToken,metaAccount,metaReady,orgReady,orgId]); // eslint-disable-line

  const filtered=useMemo(()=>{const base=statusFilter==='all'?campaigns:campaigns.filter(c=>c.status===statusFilter);return[...base].sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999)||b.spend-a.spend);},[campaigns,statusFilter]);

  // Leads do CRM filtrados pelo created_at dentro do período
  const filteredLeads = useMemo(()=>filterLeadsByPreset(allLeads,datePreset),[allLeads,datePreset]);

  // Revendedoras do CRM filtradas pelo status_aprovado_at dentro do período
  // Usa todos os allLeads (não só os criados no período) para capturar aprovações de leads mais antigos
  const filteredRevs = useMemo(()=>{
    const today=todayBRCamp();
    const ok=(ref:string|null|undefined,a:string,b:string)=>{const d=leadDateBRCamp(ref);return !!d&&d>=a&&d<=b;};
    return allLeads.filter(l=>{
      if(Number((l as any).status)!==3) return false;
      const ref=(l as any).status_aprovado_at||(l as any).created_at;
      switch(datePreset){
        case 'today':      return ok(ref,today,today);
        case 'yesterday':  {const y=subDaysCamp(today,1);return ok(ref,y,y);}
        case 'last_7d':    return ok(ref,subDaysCamp(today,6),today);
        case 'last_30d':   return ok(ref,subDaysCamp(today,29),today);
        case 'this_month': return ok(ref,today.slice(0,7)+'-01',today);
        default: return Number((l as any).status)===3;
      }
    });
  },[allLeads,datePreset]);

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
    if(!gestorMode) return filtered;
    return filtered.filter(c=>getCampPerf(c)!=='green');
  },[filtered,gestorMode,getCampLeads,avgCPL]); // eslint-disable-line

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

  // Dados por campanha para scatter plot (leads CRM + revendedoras por status_aprovado_at)
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
            {aiLog&&(
              <button onClick={()=>setShowAiPanel(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',marginTop:'7px',padding:'6px 12px',borderRadius:'99px',background:dark?'rgba(139,92,246,0.15)':'#f5f3ff',border:'1px solid rgba(139,92,246,0.3)',color:'#8b5cf6',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                <Zap style={{width:'12px',height:'12px'}}/>
                Ravena otimizou hoje
                {aiLog.acoes_executadas?.length>0&&(
                  <span style={{background:'#8b5cf6',color:'#fff',borderRadius:'99px',padding:'1px 6px',fontSize:'11px'}}>
                    {aiLog.acoes_executadas.length}
                  </span>
                )}
              </button>
            )}
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark}/>
            <FilterDropdown value={statusFilter} options={[{label:'Todas',value:'all'},{label:'Ativas',value:'ACTIVE'},{label:'Pausadas',value:'PAUSED'}]} onChange={setStatusFilter} dark={dark}/>
            <button onClick={()=>setGestorMode(v=>!v)} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:`1px solid ${gestorMode?'#f97316':'transparent'}`,background:gestorMode?(dark?'rgba(249,115,22,0.15)':'#fff7ed'):(dark?'rgba(255,255,255,0.06)':'#f3f4f6'),color:gestorMode?'#f97316':txtMid,fontSize:'13px',cursor:'pointer',fontFamily:'inherit',fontWeight:gestorMode?600:400}}>
                🎯 Gestor
              </button>
            <button onClick={()=>{ const key=`meta_camp_${orgId}_${datePreset}`; sessionStorage.removeItem(key); load(); }} disabled={loading} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>
              <RefreshCw style={{width:'14px',height:'14px',animation:loading?'spin 1s linear infinite':''}}/>
              {loading?'Carregando…':'Atualizar'}
            </button>
          </div>
        </div>

        {/* Cards: Gasto | Leads | CPL | CPR */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(4,1fr)',gap:isMobile?'10px':'14px',marginBottom:'16px'}}>
          {[
            {label:'Gasto Total',    value:loading?'…':`R$ ${fmt(totalSpend)}`,             icon:DollarSign, color:'#10b981', bgC:dark?'rgba(16,185,129,0.12)':'#ecfdf5', sub:null},
            {label:'Leads',         value:loading?'…':String(leadsCRMTotal),                icon:Users,      color:'#3b82f6', bgC:dark?'rgba(59,130,246,0.12)':'#eff6ff',  sub:`Tráfego pago · CRM`},
            {label:'Custo por Lead',value:loading?'…':(cplCard>0?`R$ ${fmt(cplCard)}`:'—'), icon:TrendingUp, color:'#10b981', bgC:dark?'rgba(16,185,129,0.12)':'#ecfdf5',  sub:`${leadsCRMTotal} leads`},
            {label:'Custo por Rev', value:loading?'…':(cprCard>0?`R$ ${fmt(cprCard)}`:'—'),icon:Zap,        color:'#a855f7', bgC:dark?'rgba(168,85,247,0.12)':'#faf5ff',  sub:`${revsCRMTotal} revendedoras via tráfego`},
          ].map((c,i)=>(
            <div key={i} style={{background:cardBg,borderRadius:'16px',padding:isMobile?'12px':'20px',border:`1px solid ${border}`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontSize:'12px',color:txtMid}}>{c.label}</span>
                <div style={{width:'30px',height:'30px',borderRadius:'8px',background:c.bgC,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <c.icon style={{width:'14px',height:'14px',color:c.color}}/>
                </div>
              </div>
              <p style={{fontSize:isMobile?'18px':'22px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:'0 0 2px'}}>{c.value}</p>
              {c.sub&&<p style={{fontSize:'11px',color:txtLow,margin:0}}>{c.sub}</p>}
            </div>
          ))}
        </div>



        {/* Card de alertas automáticos */}
        {!loading&&alerts.length>0&&(
          <div style={{background:cardBg,borderRadius:'16px',padding:'16px 20px',border:`1px solid ${border}`,marginBottom:'16px'}}>
            <p style={{fontSize:'11px',fontWeight:700,color:txtMid,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 10px',display:'flex',alignItems:'center',gap:'6px'}}>
              <span>⚡</span> O que precisa atenção agora
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {alerts.map((a,i)=>{
                const col=a.type==='red'?'#ef4444':a.type==='yellow'?'#f59e0b':'#10b981';
                const bg=a.type==='red'?(dark?'rgba(239,68,68,0.08)':'#fef2f2'):a.type==='yellow'?(dark?'rgba(245,158,11,0.08)':'#fffbeb'):(dark?'rgba(16,185,129,0.08)':'#f0fdf4');
                return(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',borderRadius:'10px',background:bg,border:`1px solid ${col}22`}}>
                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:col,flexShrink:0}}/>
                    <span style={{fontSize:'12.5px',color:a.type==='red'?(dark?'#fca5a5':'#dc2626'):a.type==='yellow'?(dark?'#fcd34d':'#b45309'):(dark?'#6ee7b7':'#059669'),lineHeight:1.4}}>{a.msg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Barras horizontais: Revendedoras (ou Leads) por campanha */}
        {!isMobile&&!loading&&chartRows.length>0&&(()=>{
          const hasRevs=chartRows.some(r=>r.rev>0);
          const valKey=hasRevs?'rev':'leads';
          const barColor=hasRevs?'#a855f7':'#10b981';
          const periodLabel=PERIOD_OPTIONS.find(p=>p.value===datePreset)?.label||datePreset;
          const topRows=chartRows.slice(0,6);
          return(
            <div style={{background:cardBg,borderRadius:'16px',padding:'16px 20px 20px',border:`1px solid ${border}`,marginBottom:'16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <div>
                  <h3 style={{fontSize:'13px',fontWeight:600,color:txtHi,margin:0}}>
                    {hasRevs?'Revendedoras por Campanha':'Leads por Campanha'}
                  </h3>
                  <p style={{fontSize:'11px',color:txtMid,margin:'2px 0 0'}}>{periodLabel}</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topRows} layout="vertical" barCategoryGap="20%" margin={{top:0,right:32,bottom:0,left:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)'} horizontal={false}/>
                  <XAxis type="number" allowDecimals={false} tick={{fill:txtMid,fontSize:9}} tickLine={false} axisLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fill:txtHi,fontSize:10}} tickLine={false} axisLine={false} width={90}/>
                  <Tooltip
                    cursor={{fill:dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)'}}
                    content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0]?.payload;
                      if(!d)return null;
                      return(
                        <div style={{background:cardBg,border:`1px solid ${border}`,borderRadius:'10px',padding:'10px 14px',fontSize:'12px',color:txtHi,lineHeight:1.7,boxShadow:'0 4px 16px rgba(0,0,0,0.12)'}}>
                          <p style={{margin:'0 0 4px',fontWeight:700,fontSize:'13px'}}>{d.fullName}</p>
                          <p style={{margin:0,color:txtMid}}>Leads: <b style={{color:'#10b981'}}>{d.leads}</b>{d.rev>0&&<> · Rev: <b style={{color:'#a855f7'}}>{d.rev}</b></>}</p>
                          {d.cpl>0&&<p style={{margin:0,color:txtMid}}>CPL: <b style={{color:txtHi}}>R$ {fmt(d.cpl)}</b></p>}
                          {d.cpr>0&&<p style={{margin:0,color:txtMid}}>CPR: <b style={{color:'#a855f7'}}>R$ {fmt(d.cpr)}</b></p>}
                          <p style={{margin:0,color:txtMid}}>Gasto: <b style={{color:txtHi}}>R$ {fmt(d.spend)}</b></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey={valKey} fill={barColor} radius={[0,4,4,0]} maxBarSize={14}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Tabs */}
        <div style={{background:cardBg,borderRadius:'16px',border:`1px solid ${border}`,overflow:'hidden'}}>
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
                return <>{gestorMode&&displayedCampaigns.length<filtered.length&&(
                  <div style={{padding:'10px 16px',background:dark?'rgba(249,115,22,0.1)':'#fff7ed',borderBottom:`1px solid rgba(249,115,22,0.2)`,display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'13px',color:'#f97316',fontWeight:600}}>🎯 Mostrando {displayedCampaigns.length} campanha{displayedCampaigns.length!==1?'s':''} que precisam de atenção</span>
                    <button onClick={()=>setGestorMode(false)} style={{marginLeft:'auto',fontSize:'11px',color:'#f97316',background:'none',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'6px',padding:'3px 8px',cursor:'pointer',fontFamily:'inherit'}}>Ver todas</button>
                  </div>
                )}{displayedCampaigns.map(c=>{
                    const isExpanded=expandedIds.has(c.id);
                    const perf=Math.round((c.spend/maxSpend)*100);
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
                                <div style={{height:'100%',width:`${perf}%`,background:perf>60?'#10b981':perf>30?'#f97316':'#3b82f6',borderRadius:'99px'}}/>
                              </div>
                              <span style={{fontSize:'11px',color:txtLow}}>{perf}%</span>
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

          {/* Tab Insights */}
          {activeTab==='insights'&&(
            <div style={{padding:isMobile?'16px':'24px'}}>
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

        {/* Mobile: gráfico simples de barras */}
        {isMobile&&!loading&&chartRows.length>0&&(
          <div style={{background:cardBg,borderRadius:'16px',padding:'16px',border:`1px solid ${border}`,marginTop:'14px'}}>
            <h3 style={{fontSize:'13px',fontWeight:600,color:txtHi,margin:'0 0 12px'}}>Leads por Campanha</h3>
            <div style={{height:'140px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} barGap={2} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false}/>
                  <XAxis dataKey="name" tick={{fill:txtMid,fontSize:9}} tickLine={false} axisLine={false}/>
                  <YAxis allowDecimals={false} tick={{fill:txtMid,fontSize:9}} tickLine={false} axisLine={false} width={20}/>
                  <Tooltip contentStyle={{background:cardBg,border:`1px solid ${border}`,borderRadius:'10px',fontSize:'11px',color:txtHi}}/>
                  <Bar dataKey="leads" fill="#10b981" radius={[4,4,0,0]} name="Leads" maxBarSize={24}/>
                  <Bar dataKey="rev"   fill="#a855f7" radius={[4,4,0,0]} name="Rev"   maxBarSize={24}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      {/* Painel IA - Refactor Premium */}
      {showAiPanel && aiLog && (
        <AIOptimizationPanel 
          log={aiLog} 
          dark={dark} 
          isMobile={isMobile} 
          allLeads={allLeads}
          onClose={() => setShowAiPanel(false)} 
        />
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

function AIOptimizationPanel({ log, dark, isMobile, allLeads, onClose }: { log: any; dark: boolean; isMobile: boolean; allLeads: any[]; onClose: () => void }) {
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
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 16px rgba(139,92,246,0.4)' }}>
                <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>R</span>
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: txtHi, margin: 0, letterSpacing: '-0.02em' }}>Ravena otimizou suas campanhas</h2>
                <p style={{ fontSize: '12px', color: txtMid, margin: '3px 0 0' }}>
                  Hoje às {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {log.campanhas_analisadas?.length > 0 && ` · ${log.campanhas_analisadas.length} campanhas analisadas`}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', padding: '8px', cursor: 'pointer', color: txtMid, borderRadius: '8px' }}>
              <X size={20} />
            </button>
          </div>

          {/* Resumo operacional */}
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: dark ? 'rgba(139,92,246,0.08)' : '#faf5ff', border: '1px solid rgba(139,92,246,0.15)', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '12.5px', color: dark ? '#c4b5fd' : '#6d28d9', fontWeight: 500 }}>
              {log.campanhas_analisadas?.length > 0
                ? log.acoes_executadas?.length > 0
                  ? `Ravena analisou ${log.campanhas_analisadas.length} campanha${log.campanhas_analisadas.length !== 1 ? 's' : ''} — ${log.acoes_executadas.length} ação${log.acoes_executadas.length !== 1 ? 'ões' : ''} executada${log.acoes_executadas.length !== 1 ? 's' : ''}`
                  : `Ravena analisou ${log.campanhas_analisadas.length} campanha${log.campanhas_analisadas.length !== 1 ? 's' : ''} — nenhuma ação necessária hoje`
                : 'Ravena analisou as campanhas — nenhuma ação necessária hoje'
              }
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.2)' }}>
              {log.acoes_executadas?.length || 0} ações executadas
            </span>
            {kpis[2].value !== '—' && (
              <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(59,130,246,0.2)' }}>
                {kpis[2].value} CPL médio
              </span>
            )}
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(245,158,11,0.2)' }}>
              {leadsEmAtendimento} leads em atendimento
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginTop: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: statusColor }}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Quick KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {kpis.map((kpi, i) => (
              <div key={i} style={{ 
                padding: '16px', borderRadius: '16px', background: cardBg, 
                border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '8px',
                transition: 'transform 0.2s ease', cursor: 'default'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${kpi.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <kpi.icon size={14} color={kpi.color} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kpi.label}</span>
                </div>
                <span style={{ fontSize: '18px', fontWeight: 800, color: txtHi }}>{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Budget Status Alert if relevant */}
          {statusBudget && (
            <div style={{ 
              padding: '12px 16px', borderRadius: '12px', 
              background: statusBudget.includes('Acima') ? 'rgba(245,158,11,0.05)' : 'rgba(16,185,129,0.05)',
              border: `1px solid ${statusBudget.includes('Acima') ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`,
              display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <AlertTriangle size={16} color={statusBudget.includes('Acima') ? '#f59e0b' : '#10b981'} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: statusBudget.includes('Acima') ? '#d97706' : '#059669' }}>
                Budget: {statusBudget}
              </span>
            </div>
          )}

          {/* Critical Alert */}
          {log.alerta && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#ef4444' }}>⚠️</span> Ponto de atenção
              </p>
              <div style={{ 
                padding: '14px', borderRadius: '14px', background: 'rgba(239,68,68,0.04)', 
                border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '13px', lineHeight: 1.5, fontWeight: 500
              }}>
                {log.alerta}
              </div>
            </div>
          )}

          {/* Top Performance (Insight fallback) */}
          {log.insights?.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#f59e0b' }}>🏆</span> Top Performance
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {log.insights.slice(0, 2).map((insight: any, i: number) => (
                  <div key={i} style={{ 
                    padding: '12px 14px', borderRadius: '12px', background: cardBg, 
                    border: `1px solid ${border}`, fontSize: '12.5px', color: txtHi, lineHeight: 1.5
                  }}>
                    {typeof insight === 'string' ? insight : insight.mensagem}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campanhas avaliadas (sem ação necessária) */}
          {(!log.acoes_executadas?.length) && log.acoes_sugeridas?.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Campanhas avaliadas hoje</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {log.acoes_sugeridas.slice(0, 5).map((s: any, i: number) => {
                  const conf = s.leads_crm_7d >= 20 ? { label: 'Alta confiança', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
                    : s.leads_crm_7d >= 10 ? { label: 'Média confiança', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
                    : { label: 'Baixa confiança', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
                  return (
                    <div key={i} style={{ padding: '11px 14px', borderRadius: '12px', background: dark ? 'rgba(255,255,255,0.02)' : '#fafafa', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', color: '#10b981', flexShrink: 0 }}>✓</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: txtHi, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.campanha_nome || s.nome || '—'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: txtMid }}>{s.motivo || 'Manter — sem ajuste necessário'}</p>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: conf.color, background: conf.bg, padding: '2px 7px', borderRadius: '99px', flexShrink: 0 }}>{conf.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ações executadas com nível de confiança */}
          {log.acoes_executadas?.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Ações Executadas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {log.acoes_executadas.map((acao: any, i: number) => {
                  // Busca dados de confiança da campanha em campanhas_analisadas
                  const campData = log.campanhas_analisadas?.find((c: any) => c.id === acao.campanha_id || c.nome === acao.campanha_nome);
                  const conf = campData?.leads_crm_7d >= 20 ? { label: 'Alta confiança', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
                    : campData?.leads_crm_7d >= 10 ? { label: 'Média confiança', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' }
                    : campData ? { label: 'Baixa confiança', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
                    : null;
                  return (
                    <div key={i}>
                      <ActionCard acao={acao} dark={dark} />
                      {conf && (
                        <div style={{ marginTop: '4px', paddingLeft: '14px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: conf.color, background: conf.bg, padding: '2px 7px', borderRadius: '99px' }}>{conf.label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Summary (Secondary) */}
          {log.resumo && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Observações</p>
              <div style={{ padding: '16px', borderRadius: '16px', border: `1px dashed ${border}`, background: 'transparent' }}>
                <p style={{ margin: 0, fontSize: '12px', color: txtMid, lineHeight: 1.6 }}>{log.resumo}</p>
              </div>
            </div>
          )}
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
