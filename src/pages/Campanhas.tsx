import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { useMetaConfig } from '@/hooks/useMetaConfig';
import { useOrgId } from '@/hooks/useOrgId';
import { TrendingUp, TrendingDown, Pause, AlertTriangle, X, DollarSign, Users, RefreshCw, Zap, ChevronDown, Lightbulb, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  try { const d=parseLeadDateCamp(str); if(d.getTime()===0)return ''; return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(d); } catch { return ''; }
}
function todayBRCamp(): string { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date()); }
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
  const isBecker = orgId === BECKER_ORG_ID;
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

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check);},[]);

  // Busca leads com select('*') — garante utm_campaign, utm_source, status
  useEffect(()=>{
    if (!orgReady || !orgId) return;
    setAllLeads([]);
    supabase.from('leads').select('id,utm_campaign,utm_source,status,created_at')
      .order('created_at',{ascending:false}).eq('org_id', orgId).limit(500)
      .then(({data})=>{ if(data) setAllLeads(data); });
  },[orgId, orgReady]);

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
    if (!isBecker || !orgReady || !orgId) return;
    (supabase as any).from('ai_optimization_logs').select('*')
      .eq('org_id', BECKER_ORG_ID)
      .order('created_at',{ascending:false})
      .limit(1)
      .then(({data})=>{
        if(data&&data.length>0){
          const log=data[0];
          const horas=(Date.now()-new Date(log.created_at).getTime())/(1000*60*60);
          if(horas<=24) setAiLog(log);
        }
      });
  },[isBecker, orgId, orgReady]); // eslint-disable-line

  const load=async()=>{if(!metaToken||!metaAccount){setLoading(false);return;}const key=`meta_camp_${orgId}_${datePreset}`;const cached=getMetaCache(key);if(cached){setCampaigns(cached);setLoading(false);setError(false);return;}setLoading(true);setError(false);const data=await fetchCampaignsWithChildren(datePreset,metaToken,metaAccount);if(data.length>0){setMetaCache(key,data);}setCampaigns(data);setLoading(false);};
  useEffect(()=>{
    if (!metaReady || !orgReady) return;
    load();
  },[datePreset,metaToken,metaAccount,metaReady,orgReady,orgId]); // eslint-disable-line

  const filtered=useMemo(()=>{const base=statusFilter==='all'?campaigns:campaigns.filter(c=>c.status===statusFilter);return[...base].sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999)||b.spend-a.spend);},[campaigns,statusFilter]);

  // Leads do CRM filtrados pelo período
  // usa allLeads (select * direto) para ter utm_campaign garantido
  const filteredLeads = useMemo(()=>filterLeadsByPreset(allLeads,datePreset),[allLeads,datePreset]);

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

  const getCampLeads = useCallback((campName: string, campId: string) => {
    return campLeadsMap.get(campId) || [];
  }, [campLeadsMap]);

  const totalSpend = campaigns.reduce((s,c)=>s+c.spend,0);
  const totalLeads = campaigns.reduce((s,c)=>s+c.leads_api,0);
  const avgCPL = totalLeads>0?totalSpend/totalLeads:0;
  const maxSpend = Math.max(...campaigns.map(c=>c.spend),1);

  // Cards: filtrando leads CRM do FB
  const leadsCRMTotal = useMemo(()=>
    filteredLeads.filter(l=>{
      const la=l as any;
      return (la.utm_source||'').toUpperCase()==='FB' || (la.utm_campaign||'').trim().length>0;
    }).length
  ,[filteredLeads]);
  const revsCRMTotal = useMemo(()=>
    filteredLeads.filter(l=>{
      const la=l as any;
      return ((la.utm_source||'').toUpperCase()==='FB' || (la.utm_campaign||'').trim().length>0)
        && Number(la.status)===3;
    }).length
  ,[filteredLeads]);
  const cplCard = leadsCRMTotal>0&&totalSpend>0 ? totalSpend/leadsCRMTotal : 0;
  const cprCard = revsCRMTotal>0&&totalSpend>0  ? totalSpend/revsCRMTotal  : 0;

  // Gráfico: barras horizontais com dados CRM por campanha
  const chartRows = useMemo(()=>{
    return filtered.slice(0,8).map(c=>{
      const campLeads = getCampLeads(c.name, c.id);
      const l = campLeads.length > 0 ? campLeads.length : c.leads_api;
      const r = campLeads.filter(x => Number((x as any).status) === 3).length;
      return {
        name: c.name.length>16?c.name.slice(0,16)+'…':c.name,
        leads: l,
        rev:   r,
        cpl:   l>0&&c.spend>0 ? Math.round(c.spend/l) : 0,
        cpr:   r>0&&c.spend>0 ? Math.round(c.spend/r) : 0,
      };
    });
  },[filtered, getCampLeads]); // eslint-disable-line

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
            {isBecker&&aiLog&&(
              <button onClick={()=>setShowAiPanel(true)} style={{display:'inline-flex',alignItems:'center',gap:'6px',marginTop:'7px',padding:'6px 12px',borderRadius:'99px',background:dark?'rgba(139,92,246,0.15)':'#f5f3ff',border:'1px solid rgba(139,92,246,0.3)',color:'#8b5cf6',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                <Zap style={{width:'12px',height:'12px'}}/>
                IA otimizou hoje
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
            {label:'Leads',         value:loading?'…':String(leadsCRMTotal),                icon:Users,      color:'#3b82f6', bgC:dark?'rgba(59,130,246,0.12)':'#eff6ff',  sub:`período · CRM`},
            {label:'Custo por Lead',value:loading?'…':(cplCard>0?`R$ ${fmt(cplCard)}`:'—'), icon:TrendingUp, color:'#10b981', bgC:dark?'rgba(16,185,129,0.12)':'#ecfdf5',  sub:`${leadsCRMTotal} leads`},
            {label:'Custo por Rev', value:loading?'…':(cprCard>0?`R$ ${fmt(cprCard)}`:'—'),icon:Zap,        color:'#a855f7', bgC:dark?'rgba(168,85,247,0.12)':'#faf5ff',  sub:`${revsCRMTotal} aprovadas`},
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



        {/* Gráfico horizontal — barras por campanha */}
        {!isMobile&&(
          <div style={{background:cardBg,borderRadius:'16px',padding:'20px',border:`1px solid ${border}`,marginBottom:'16px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px',flexWrap:'wrap',gap:'8px'}}>
              <h3 style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:0}}>Desempenho por Campanha</h3>
              <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
                {[{color:'#10b981',label:'Leads'},{color:'#a855f7',label:'Rev'},{color:'#3b82f6',label:'CPL (R$)'},{color:'#f97316',label:'CPR (R$)'}].map(({color,label})=>(
                  <div key={label} style={{display:'flex',alignItems:'center',gap:'5px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'2px',background:color}}/>
                    <span style={{fontSize:'11px',color:txtMid}}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            {loading
              ?<div style={{height:'60px',display:'flex',alignItems:'center',justifyContent:'center',color:txtMid,fontSize:'13px'}}>Carregando…</div>
              :chartRows.length===0
                ?<div style={{height:'60px',display:'flex',alignItems:'center',justifyContent:'center',color:txtMid,fontSize:'13px'}}>Nenhum dado</div>
                :(()=>{
                  const maxLeads=Math.max(...chartRows.map(r=>r.leads),1);
                  const maxCpl=Math.max(...chartRows.map(r=>r.cpl),1);
                  const maxCpr=Math.max(...chartRows.map(r=>r.cpr),1);
                  return(
                    <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>
                      {chartRows.map((row,i)=>(
                        <div key={i} style={{
                          display:'grid',
                          gridTemplateColumns:'130px 1fr',
                          gap:'12px',
                          alignItems:'center',
                          paddingBottom:'16px',
                          borderBottom:i<chartRows.length-1?`1px solid ${divCls}`:'none',
                        }}>
                          {/* Nome da campanha */}
                          <span style={{
                            fontSize:'12px',fontWeight:600,color:txtHi,
                            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                            textAlign:'right',paddingRight:'12px',lineHeight:1.3,
                          }}>{row.name}</span>
                          {/* 4 barras com labels */}
                          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                            {[
                              {val:row.leads, max:maxLeads, color:'#10b981', label:'Leads', valFmt:(v:number)=>String(v)},
                              {val:row.rev,   max:maxLeads, color:'#a855f7', label:'Rev',   valFmt:(v:number)=>String(v)},
                              {val:row.cpl,   max:maxCpl,   color:'#3b82f6', label:'CPL',   valFmt:(v:number)=>v>0?`R$${v}`:'-'},
                              {val:row.cpr,   max:maxCpr,   color:'#f97316', label:'CPR',   valFmt:(v:number)=>v>0?`R$${v}`:'-'},
                            ].map(({val,max,color,label,valFmt},j)=>(
                              <div key={j} style={{display:'flex',alignItems:'center',gap:'8px'}}>
                                <span style={{fontSize:'10px',color:txtLow,width:'28px',textAlign:'right',flexShrink:0}}>{label}</span>
                                <div style={{flex:1,height:'10px',background:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.05)',borderRadius:'99px',overflow:'hidden'}}>
                                  <div style={{height:'100%',width:max>0?`${(val/max)*100}%`:'0%',background:color,borderRadius:'99px',transition:'width 0.7s ease'}}/>
                                </div>
                                <span style={{fontSize:'11px',color,fontWeight:700,width:'52px',textAlign:'right',flexShrink:0}}>{valFmt(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
            }
          </div>
        )}

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
                return <>{filtered.map(c=>{
                    const isExpanded=expandedIds.has(c.id);
                    const perf=Math.round((c.spend/maxSpend)*100);
                    const periodo=PERIOD_MAP[datePreset]||'all';
                    const campCRMLeads = getCampLeads(c.name, c.id);
                    const cL = campCRMLeads.length > 0 ? campCRMLeads.length : c.leads_api;
                    const cR = campCRMLeads.filter(x => Number((x as any).status) === 3).length;
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
                  <p style={{margin:0,fontSize:'12px',color:txtMid,marginTop:'2px'}}>Gerado pela IA com base nos dados reais</p>
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
                    <p style={{margin:0,fontSize:'13px',color:txtMid,lineHeight:1.6}}>Nenhum insight gerado hoje.<br/>A IA só gera insights quando identifica algo realmente importante.</p>
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
      {/* Painel IA — apenas Becker */}
      {isBecker&&showAiPanel&&aiLog&&(
        <>
          <div onClick={()=>setShowAiPanel(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:100}}/>
          <div style={{position:'fixed',right:0,top:0,bottom:0,width:isMobile?'100vw':'min(420px, 100vw)',background:dark?'#111113':'#fff',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,zIndex:101,overflowY:'auto',padding:'20px',boxShadow:'-8px 0 32px rgba(0,0,0,0.2)',boxSizing:'border-box'}}>
            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
              <span style={{fontSize:'14px',fontWeight:600,color:dark?'#f4f4f5':'#111827'}}>
                IA • hoje às {new Date(aiLog.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
              </span>
              <button onClick={()=>setShowAiPanel(false)} style={{background:'none',border:'none',cursor:'pointer',color:dark?'#71717a':'#6b7280',padding:'4px',display:'flex',borderRadius:'6px'}}>
                <X style={{width:'16px',height:'16px'}}/>
              </button>
            </div>
            {/* Resumo */}
            {aiLog.resumo&&(
              <p style={{margin:'0 0 14px',fontSize:'13px',color:dark?'#a1a1aa':'#6b7280',lineHeight:1.6}}>{aiLog.resumo}</p>
            )}
            {/* Alerta */}
            {aiLog.alerta&&(
              <div style={{padding:'10px 12px',borderRadius:'8px',marginBottom:'14px',background:dark?'rgba(239,68,68,0.1)':'#fef2f2',border:'1px solid rgba(239,68,68,0.25)'}}>
                <p style={{margin:0,fontSize:'12.5px',color:'#ef4444',lineHeight:1.5}}>{aiLog.alerta}</p>
              </div>
            )}
            {/* Ações executadas */}
            {aiLog.acoes_executadas?.length>0&&(
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                {aiLog.acoes_executadas.map((acao:any,i:number)=>{
                  const isUp=acao.acao==='aumentar_budget';
                  const isDown=acao.acao==='diminuir_budget';
                  const isPause=acao.acao==='pausar';
                  const color=isUp?'#10b981':isDown?'#f97316':'#ef4444';
                  const bgColor=isUp?(dark?'rgba(16,185,129,0.08)':'#f0fdf4'):isDown?(dark?'rgba(249,115,22,0.08)':'#fff7ed'):(dark?'rgba(239,68,68,0.08)':'#fef2f2');
                  const borderColor=isUp?'rgba(16,185,129,0.2)':isDown?'rgba(249,115,22,0.2)':'rgba(239,68,68,0.2)';
                  return(
                    <div key={i} style={{padding:'11px 14px',borderRadius:'10px',background:bgColor,border:`1px solid ${borderColor}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:acao.motivo?'5px':'0'}}>
                        {isUp&&<TrendingUp style={{width:'14px',height:'14px',color,flexShrink:0}}/>}
                        {isDown&&<TrendingDown style={{width:'14px',height:'14px',color,flexShrink:0}}/>}
                        {isPause&&<Pause style={{width:'14px',height:'14px',color,flexShrink:0}}/>}
                        <span style={{fontSize:'13px',fontWeight:700,color:dark?'#f4f4f5':'#111827'}}>{acao.campanha_nome}</span>
                      </div>
                      {acao.novo_budget&&(
                        <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:600,color,paddingLeft:'22px'}}>R$ {acao.novo_budget}/dia</p>
                      )}
                      {isPause&&(
                        <p style={{margin:'0 0 4px',fontSize:'13px',fontWeight:600,color,paddingLeft:'22px'}}>pausada</p>
                      )}
                      {acao.motivo&&(
                        <p style={{margin:0,fontSize:'12px',color:dark?'#71717a':'#6b7280',lineHeight:1.5,paddingLeft:'22px'}}>{acao.motivo}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>
    </AppLayout>
  );
}
