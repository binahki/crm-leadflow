import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { TrendingUp, DollarSign, Users, RefreshCw, Zap, ChevronDown, ArrowUpRight, Lightbulb, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface AdSet {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; leads_api: number; cpl: number;
  ads?: Ad[];
}
interface Ad {
  id: string; name: string; status: string;
  spend: number; leads_api: number; cpl: number; ctr: number; thumbnail_url: string | null;
}
interface BreakdownItem { label: string; leads: number; spend: number; cpl: number; }
interface InsightData { age: BreakdownItem[]; gender: BreakdownItem[]; placement: BreakdownItem[]; device: BreakdownItem[]; }
interface Campaign {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; cpm: number;
  leads_api: number; cpl?: number; adsets?: AdSet[]; ads?: Ad[];
}

const META_TOKEN  = import.meta.env.VITE_META_TOKEN;
const META_ACCOUNT = import.meta.env.VITE_META_ACCOUNT;
const LEAD_ACTIONS = ['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'];

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
async function fetchCampaignsWithChildren(datePreset: string): Promise<Campaign[]> {
  const tok=META_TOKEN; const base='https://graph.facebook.com/v18.0'; const dp=datePreset;
  function getLeadsFromActions(actions:any[]){return parseInt(actions?.find((a:any)=>LEAD_ACTIONS.includes(a.action_type))?.value||'0');}
  try {
    const campUrl=new URL(`${base}/act_${META_ACCOUNT}/campaigns`);
    campUrl.searchParams.set('fields',`id,name,status,insights.date_preset(${dp}){spend,impressions,clicks,ctr,cpm,actions}`);
    campUrl.searchParams.set('limit','20'); campUrl.searchParams.set('access_token',tok);
    const campData=await(await fetch(campUrl.toString())).json();
    if(!campData.data?.length) return [];

    const asUrl=new URL(`${base}/act_${META_ACCOUNT}/adsets`);
    asUrl.searchParams.set('fields',`id,name,status,campaign_id,insights.date_preset(${dp}){spend,impressions,clicks,ctr,actions}`);
    asUrl.searchParams.set('limit','50'); asUrl.searchParams.set('access_token',tok);
    const asData=await(await fetch(asUrl.toString())).json();

    const adUrl=new URL(`${base}/act_${META_ACCOUNT}/ads`);
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

// ── Fetch insights ────────────────────────────────────────────
async function fetchInsightData(datePreset:string):Promise<InsightData>{
  const base=`https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/insights`;
  const fields='spend,actions'; const token=`access_token=${META_TOKEN}`; const preset=`date_preset=${datePreset}`;
  function parseBreakdown(data:any[],labelKey:string):BreakdownItem[]{
    const map:Record<string,{leads:number;spend:number}>={};
    for(const row of data){const label=row[labelKey]||'Desconhecido';const leads=getLeads(row.actions||[]);const spend=parseFloat(row.spend||'0');if(!map[label])map[label]={leads:0,spend:0};map[label].leads+=leads;map[label].spend+=spend;}
    return Object.entries(map).map(([label,{leads,spend}])=>({label,leads,spend,cpl:leads>0?spend/leads:0})).sort((a,b)=>b.leads-a.leads||a.cpl-b.cpl).slice(0,5);
  }
  const PLACEMENT_LABELS:Record<string,string>={'feed':'Feed do Facebook','instagram_stream':'Feed do Instagram','instagram_stories':'Stories Instagram','facebook_stories':'Stories Facebook','reels':'Reels','instagram_reels':'Reels Instagram','marketplace':'Marketplace'};
  const GENDER_LABELS:Record<string,string>={male:'Homens',female:'Mulheres',unknown:'Desconhecido'};
  try{
    const[ageRes,genderRes,placementRes,deviceRes]=await Promise.all([fetch(`${base}?fields=${fields}&breakdowns=age&${preset}&${token}&limit=50`),fetch(`${base}?fields=${fields}&breakdowns=gender&${preset}&${token}&limit=10`),fetch(`${base}?fields=${fields}&breakdowns=publisher_platform,platform_position&${preset}&${token}&limit=50`),fetch(`${base}?fields=${fields}&breakdowns=device_platform&${preset}&${token}&limit=20`)]);
    const[ageData,genderData,placementData,deviceData]=await Promise.all([ageRes.json(),genderRes.json(),placementRes.json(),deviceRes.json()]);
    const age=parseBreakdown(ageData.data||[],'age');
    const gender=parseBreakdown(genderData.data||[],'gender').map(g=>({...g,label:GENDER_LABELS[g.label]||g.label}));
    const placement=parseBreakdown((placementData.data||[]).map((r:any)=>({...r,placement_key:`${r.publisher_platform}/${r.platform_position}`})),'placement_key').map(p=>({...p,label:PLACEMENT_LABELS[p.label.split('/')[1]]||PLACEMENT_LABELS[p.label]||p.label}));
    const device=parseBreakdown(deviceData.data||[],'device_platform');
    return{age,gender,placement,device};
  }catch{return{age:[],gender:[],placement:[],device:[]};}
}

function generateAnalysis(campaigns:Campaign[],insightData:InsightData,totalSpend:number,totalLeads:number,avgCPL:number):string[]{
  const insights:string[]=[]; if(!campaigns.length)return['Nenhuma campanha com dados disponíveis para análise.'];
  if(avgCPL>0&&avgCPL<=15)insights.push(`✅ CPL médio de R$ ${fmt(avgCPL)} está excelente. Escale as campanhas ativas com confiança.`);
  else if(avgCPL>0&&avgCPL<=30)insights.push(`📊 CPL médio de R$ ${fmt(avgCPL)} está aceitável. Otimize os conjuntos com CPL mais alto antes de escalar.`);
  else if(avgCPL>30)insights.push(`⚠️ CPL médio de R$ ${fmt(avgCPL)} está elevado. Revise criativos e segmentação.`);
  const withLeads=campaigns.filter(c=>c.leads_api>0);
  if(withLeads.length>0){const best=withLeads[0];insights.push(`🏆 Melhor campanha: "${best.name.slice(0,45)}" com ${best.leads_api} leads a R$ ${fmt(best.leads_api>0?best.spend/best.leads_api:0)} CPL.`);if(withLeads.length>1){const worst=[...withLeads].sort((a,b)=>(b.spend/b.leads_api)-(a.spend/a.leads_api))[0];if(worst.id!==best.id)insights.push(`📉 CPL mais caro: "${worst.name.slice(0,40)}" a R$ ${fmt(worst.spend/worst.leads_api)}. Redirecione o budget para a melhor.`);}}
  const inactive=campaigns.filter(c=>c.spend>totalSpend*0.15&&c.leads_api===0);
  if(inactive.length>0)insights.push(`🔴 "${inactive[0].name.slice(0,40)}" consumiu R$ ${fmt(inactive[0].spend)} sem gerar nenhum lead. Pause e revise.`);
  if(insightData.age.length>0){const bestAge=insightData.age[0];if(bestAge.leads>0)insights.push(`👥 Faixa etária mais eficiente: ${bestAge.label} com ${bestAge.leads} leads${bestAge.cpl>0?` (CPL R$ ${fmt(bestAge.cpl)})`:''}.`);}
  if(insightData.gender.length>0){const wG=insightData.gender.filter(g=>g.leads>0);if(wG.length>0){const bG=wG[0];const tot=wG.reduce((s,g)=>s+g.leads,0);const pct=tot>0?Math.round(bG.leads/tot*100):0;insights.push(`⚡ ${pct}% dos leads vêm de ${bG.label}${bG.cpl>0?` (CPL R$ ${fmt(bG.cpl)})`:''}.`);}}
  if(insightData.placement.length>0){const bP=insightData.placement.filter(p=>p.leads>0)[0];if(bP)insights.push(`📱 Melhor posicionamento: ${bP.label} com ${bP.leads} leads${bP.cpl>0?` (CPL R$ ${fmt(bP.cpl)})`:''}.`);}
  insights.push(`💡 Sugestões: Lookalike 1% das leads aprovadas, mulheres 25-44 interessadas em moda/beleza/empreendedorismo, retargeting de visitantes do quiz.`);
  const lowCTR=campaigns.filter(c=>c.ctr<1&&c.impressions>5000);
  if(lowCTR.length>0)insights.push(`🎯 ${lowCTR.length} campanha(s) com CTR abaixo de 1%. Teste variações de thumbnail e primeiros 3 segundos do vídeo.`);
  return insights;
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
  const dark = theme === 'dark';
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insightData, setInsightData] = useState<InsightData>({age:[],gender:[],placement:[],device:[]});
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
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
  const [showAIPanel, setShowAIPanel] = useState(false);

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check);},[]);

  // Busca leads com select('*') — garante utm_campaign, utm_source, status
  useEffect(()=>{
    supabase.from('leads').select('id,utm_campaign,utm_source,status,created_at')
      .order('created_at',{ascending:false})
      .then(({data})=>{ if(data) setAllLeads(data); });
  },[]);

  // Realtime: atualiza allLeads ao receber novos leads
  useEffect(()=>{
    const ch = supabase.channel('camp-leads-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'leads'},p=>{
        setAllLeads(prev=>[p.new as any,...prev]);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},p=>{
        setAllLeads(prev=>prev.map(l=>l.id===(p.new as any).id?p.new as any:l));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },[]);

  // Busca log de otimização da IA do dia
  useEffect(()=>{
    supabase.from('ai_optimization_logs').select('*').order('created_at',{ascending:false}).limit(1)
      .then(({data})=>{
        if(data&&data.length>0){
          const log=data[0];
          const logDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(log.created_at));
          if(logDate===todayBRCamp()) setAiLog(log);
        }
      });
  },[]);

  const load=async()=>{setLoading(true);setError(false);const data=await fetchCampaignsWithChildren(datePreset);if(!data.length)setError(true);setCampaigns(data);setLoading(false);};
  const loadInsights=async()=>{setLoadingInsights(true);const data=await fetchInsightData(datePreset);setInsightData(data);setLoadingInsights(false);};
  useEffect(()=>{load();},[datePreset]); // eslint-disable-line
  useEffect(()=>{if(activeTab==='insights')loadInsights();},[activeTab,datePreset]); // eslint-disable-line

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

  const analysis=useMemo(()=>generateAnalysis(campaigns,insightData,totalSpend,totalLeads,avgCPL),[campaigns,insightData,totalSpend,totalLeads,avgCPL]);

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
              <button onClick={()=>setShowAIPanel(true)} style={{display:'inline-flex',alignItems:'center',gap:'5px',marginTop:'7px',padding:'4px 12px',borderRadius:'20px',border:'1px solid #f59e0b55',background:'#f59e0b18',color:'#f59e0b',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit',letterSpacing:'0.01em'}}>
                <Zap style={{width:'12px',height:'12px',fill:'#f59e0b'}}/> IA rodou hoje
              </button>
            )}
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark}/>
            <FilterDropdown value={statusFilter} options={[{label:'Todas',value:'all'},{label:'Ativas',value:'ACTIVE'},{label:'Pausadas',value:'PAUSED'}]} onChange={setStatusFilter} dark={dark}/>
            <button onClick={load} disabled={loading} style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px',borderRadius:'10px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>
              <RefreshCw style={{width:'14px',height:'14px',animation:loading?'spin 1s linear infinite':''}}/>
              {loading?'Carregando…':'Atualizar'}
            </button>
          </div>
        </div>

        {/* Cards: Gasto | Leads | CPL | CPR */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:isMobile?'10px':'14px',marginBottom:'16px'}}>
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
              {loading
                ?<div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>Carregando campanhas…</div>
                :error||filtered.length===0
                  ?<div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>{error?'⚠️ Erro ao conectar ao Meta Ads.':'Nenhuma campanha encontrada.'}</div>
                  :filtered.map(c=>{
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
                              {cplVal&&<span style={{fontSize:'12px',color:'#10b981',fontWeight:500}}>CPL R$ {fmt(cplVal)}</span>}
                              {dot}
                              {/* Tag Rev — roxo */}
                              <button onClick={e=>{e.stopPropagation();navigate(`/leads?campanha=${encodeURIComponent(c.name)}&periodo=${periodo}&status=3`);}} style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11.5px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)',cursor:'pointer',fontFamily:'inherit'}}>
                                {cR} rev ↗
                              </button>
                              <span style={{fontSize:'12px',color:'#a855f7',fontWeight:500}}>CPR {cprVal?`R$ ${fmt(cprVal)}`:'—'}</span>
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
                                            {as.cpl>0&&<span style={{fontSize:'11px',color:'#10b981',fontWeight:500}}>CPL R$ {fmt(as.cpl)}</span>}
                                            {dot}
                                            {(()=>{const asRev=as.leads_api>0&&c.leads_api>0?Math.round(cR*as.leads_api/c.leads_api):0;return <><span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)'}}>{asRev} rev</span> <span style={{fontSize:'11px',color:'#a855f7',fontWeight:500}}>{asRev>0&&as.spend>0?`CPR R$ ${fmt(as.spend/asRev)}`:'CPR —'}</span></>;})()}
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
                                                  {ad.cpl>0&&<span style={{fontSize:'11px',color:'#10b981',fontWeight:500}}>CPL R$ {fmt(ad.cpl)}</span>}
                                                  {dot}
                                                  {(()=>{const adRev=ad.leads_api>0&&c.leads_api>0?Math.round(cR*ad.leads_api/c.leads_api):0;return <><span style={{display:'inline-flex',alignItems:'center',gap:'3px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:600,color:'#a855f7',background:dark?'rgba(168,85,247,0.12)':'#f3e8ff',border:'1px solid rgba(168,85,247,0.25)'}}>{adRev} rev</span> <span style={{fontSize:'11px',color:'#a855f7',fontWeight:500}}>{adRev>0&&ad.spend>0?`CPR R$ ${fmt(ad.spend/adRev)}`:'CPR —'}</span></>;})()}
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
                  })
              }
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
                  <h3 style={{margin:0,fontSize:'15px',fontWeight:600,color:txtHi}}>Análise como gestor de tráfego</h3>
                  <p style={{margin:0,fontSize:'12px',color:txtMid,marginTop:'2px'}}>Período: {PERIOD_OPTIONS.find(p=>p.value===datePreset)?.label} · Dados reais da API</p>
                </div>
              </div>
              {loading||loadingInsights
                ?<div style={{color:txtMid,fontSize:'13px',textAlign:'center',padding:'32px'}}>Analisando dados de campanhas…</div>
                :(
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {analysis.map((a,i)=>(
                      <div key={i} style={{padding:'14px 16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.03)':'#fafafa',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,display:'flex',gap:'12px',alignItems:'flex-start'}}>
                        <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#8b5cf6',flexShrink:0,marginTop:'6px'}}/>
                        <p style={{margin:0,fontSize:'13.5px',color:dark?'#d4d4d8':'#374151',lineHeight:1.65}}>{a}</p>
                      </div>
                    ))}
                    <div style={{marginTop:'4px',padding:'16px',borderRadius:'12px',background:dark?'rgba(37,99,235,0.1)':'#eff6ff',border:`1px solid ${dark?'rgba(59,130,246,0.2)':'#bfdbfe'}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                        <ArrowUpRight style={{width:'14px',height:'14px',color:'#2563eb'}}/>
                        <span style={{fontSize:'13px',fontWeight:600,color:dark?'#93c5fd':'#1e40af'}}>Resumo do Período</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:'12px'}}>
                        {[{label:'Total Investido',value:`R$ ${fmt(totalSpend)}`},{label:'Leads Gerados',value:String(totalLeads)},{label:'CPL Médio',value:avgCPL>0?`R$ ${fmt(avgCPL)}`:'—'}].map((s,i)=>(
                          <div key={i}>
                            <p style={{margin:0,fontSize:'11px',color:dark?'#93c5fd':'#3b82f6',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'2px'}}>{s.label}</p>
                            <p style={{margin:0,fontSize:'18px',fontWeight:700,color:dark?'#fff':'#1e40af'}}>{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {insightData.age.length>0&&(
                      <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                        <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Faixa etária</p>
                        {insightData.age.map((item,i)=>{const max=Math.max(...insightData.age.map(a=>a.leads),1);return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'12px',color:txtMid,width:'50px',flexShrink:0}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#8b5cf6',borderRadius:'99px'}}/></div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                            {item.cpl>0&&<span style={{fontSize:'11px',color:txtLow,flexShrink:0}}>R${fmt(item.cpl)}</span>}
                          </div>
                        );})}
                      </div>
                    )}
                    {insightData.gender.length>0&&(
                      <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                        <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Gênero</p>
                        {insightData.gender.map((item,i)=>{const max=Math.max(...insightData.gender.map(g=>g.leads),1);return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'12px',color:txtMid,width:'70px',flexShrink:0}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#3b82f6',borderRadius:'99px'}}/></div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                          </div>
                        );})}
                      </div>
                    )}
                    {insightData.placement.length>0&&(
                      <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                        <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Posicionamento</p>
                        {insightData.placement.map((item,i)=>{const max=Math.max(...insightData.placement.map(p=>p.leads),1);return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'11.5px',color:txtMid,width:'120px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#10b981',borderRadius:'99px'}}/></div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                )
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
      {/* Painel IA */}
      {showAIPanel&&aiLog&&(
        <>
          <div onClick={()=>setShowAIPanel(false)} style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,0.5)'}}/>
          <div style={{position:'fixed',top:0,right:0,width:isMobile?'100%':'420px',height:'100vh',zIndex:9001,background:cardBg,borderLeft:`1px solid ${border}`,padding:'24px',overflowY:'auto',display:'flex',flexDirection:'column',gap:'16px',boxShadow:'-8px 0 40px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <Zap style={{width:'18px',height:'18px',color:'#f59e0b',fill:'#f59e0b'}}/>
                <span style={{fontSize:'16px',fontWeight:700,color:txtHi}}>Otimizações da IA</span>
              </div>
              <button onClick={()=>setShowAIPanel(false)} style={{background:'transparent',border:'none',cursor:'pointer',color:txtMid,fontSize:'22px',lineHeight:1,padding:'0 4px'}}>×</button>
            </div>
            <p style={{fontSize:'12px',color:txtLow,margin:0}}>{new Date(aiLog.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>
            {aiLog.resumo&&(
              <div style={{background:dark?'#18181b':'#f9fafb',borderRadius:'10px',padding:'14px',fontSize:'13px',color:txtMid,lineHeight:'1.6',border:`1px solid ${border}`}}>
                {aiLog.resumo}
              </div>
            )}
            {Array.isArray(aiLog.acoes_executadas)&&aiLog.acoes_executadas.length>0&&(
              <div>
                <p style={{fontSize:'11px',fontWeight:600,color:txtLow,margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Ações Executadas</p>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {aiLog.acoes_executadas.map((a:any,i:number)=>(
                    <div key={i} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'9px 12px',background:dark?'#18181b':'#f9fafb',borderRadius:'8px',fontSize:'13px',color:txtMid,border:`1px solid ${border}`}}>
                      <span style={{color:'#10b981',flexShrink:0,marginTop:'1px'}}>✓</span>
                      <span>{typeof a==='string'?a:a.descricao||a.acao||JSON.stringify(a)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(aiLog.insights)&&aiLog.insights.length>0&&(
              <div>
                <p style={{fontSize:'11px',fontWeight:600,color:txtLow,margin:'0 0 8px',textTransform:'uppercase',letterSpacing:'0.07em'}}>Insights</p>
                <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                  {aiLog.insights.map((ins:any,i:number)=>(
                    <div key={i} style={{padding:'9px 12px',background:dark?'#18181b':'#f9fafb',borderRadius:'8px',fontSize:'13px',color:txtMid,border:`1px solid ${border}`}}>
                      {typeof ins==='string'?ins:ins.texto||ins.descricao||JSON.stringify(ins)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiLog.alerta&&(
              <div style={{padding:'12px 14px',background:'#ef444420',border:'1px solid #ef444440',borderRadius:'10px',fontSize:'13px',color:'#ef4444',lineHeight:'1.5'}}>
                ⚠️ {aiLog.alerta}
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
