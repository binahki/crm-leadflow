import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Bell, RefreshCw, ChevronDown, TrendingUp, TrendingDown, Download, MoreHorizontal, MessageCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { AppLayout } from '@/components/AppLayout';

interface Lead { id: string; nome: string; cidade: string | null; whatsapp: string | null; status: string | number | null; created_at: string; utm_source?: string | null; }
interface Campaign { id: string; name: string; status: string; spend: number; leads_api: number; }
interface MetaMetrics { spend: number; leads: number; cpl: number; impressions: number; clicks: number; ctr: number; cplRealTime: number; }

const META_TOKEN   = import.meta.env.VITE_META_TOKEN;
const META_ACCOUNT = import.meta.env.VITE_META_ACCOUNT;
const STORAGE_KEY    = 'dashboard_period';
const STORAGE_CUSTOM = 'dashboard_custom_range';

const PERIOD_FILTERS = [
  { label: 'Hoje',          value: 'today'     },
  { label: 'Ontem',         value: 'yesterday' },
  { label: '7 dias',        value: '7days'     },
  { label: '30 dias',       value: '30days'    },
  { label: 'Este mês',      value: 'month'     },
  { label: 'Personalizado', value: 'custom'    },
];

const FUNNEL_CONFIG = [
  { stage: 'Aguardando',     statusId: 0, color: '#3b82f6' },
  { stage: 'Em atendimento', statusId: 1, color: '#f97316' },
  { stage: 'Reunião',        statusId: 2, color: '#a855f7' },
  { stage: 'Aprovado',       statusId: 3, color: '#22c55e' },
];

const STATUS_LABEL: Record<number,string> = { 0:'Aguardando',1:'Em atendimento',2:'Reunião',3:'Aprovado' };
const STATUS_DARK:  Record<number,string> = { 0:'bg-amber-100 text-amber-700',1:'bg-blue-100 text-blue-700',2:'bg-purple-100 text-purple-700',3:'bg-emerald-100 text-emerald-700' };
const STATUS_LIGHT: Record<number,string> = { 0:'bg-amber-100 text-amber-700',1:'bg-blue-100 text-blue-700',2:'bg-purple-100 text-purple-700',3:'bg-emerald-100 text-emerald-700' };
const AVATAR_COLORS = ['bg-rose-400','bg-yellow-400','bg-emerald-400','bg-orange-400','bg-cyan-400','bg-violet-400','bg-pink-400'];

function initials(n:string){ return (n||'').split(' ').slice(0,2).map((x:string)=>x[0]).join('').toUpperCase()||'?'; }
function getGreeting(){ const h=new Date().getHours(); if(h>=5&&h<12)return 'Bom dia'; if(h>=12&&h<18)return 'Boa tarde'; return 'Boa noite'; }
function toNum(s:any):number{ if(s===null||s===undefined||s==='')return 0; const n=Number(s); return isNaN(n)?0:n; }

function parseLeadDate(str?:string|null):Date{
  if(!str)return new Date(0);
  if(str.includes('T'))return new Date(str);
  const m=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if(m){const[,d,mo,y,h='0',mi='0']=m;return new Date(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi));}
  return new Date(str);
}

function relativeTime(str?:string|null):string{
  if(!str)return '—';
  const diff=Date.now()-parseLeadDate(str).getTime();
  const min=Math.floor(diff/60000);const h=Math.floor(min/60);const days=Math.floor(h/24);
  if(min<1)return 'agora';if(min<60)return `${min}m`;if(h<24)return `${h}h`;if(days===1)return '1d';return `${days}d`;
}

function startOfDay(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0);}
function endOfDay(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999);}

function isoToBR(iso:string):string{
  if(!iso||!iso.includes('-'))return iso||'';
  const[y,m,d]=iso.split('-');return `${d}/${m}/${y}`;
}

function filterByPeriod(leads:Lead[],period:string,from?:string,to?:string):Lead[]{
  const now=new Date();const ts=startOfDay(now);const te=endOfDay(now);
  function inR(l:Lead,a:Date,b:Date){const d=parseLeadDate(l.created_at);return d>=a&&d<=b;}
  switch(period){
    case 'today':return leads.filter(l=>inR(l,ts,te));
    case 'yesterday':{const ys=new Date(ts);ys.setDate(ys.getDate()-1);const ye=new Date(te);ye.setDate(ye.getDate()-1);return leads.filter(l=>inR(l,ys,ye));}
    case '7days':{const a=new Date(ts);a.setDate(a.getDate()-6);return leads.filter(l=>inR(l,a,te));}
    case '30days':{const a=new Date(ts);a.setDate(a.getDate()-29);return leads.filter(l=>inR(l,a,te));}
    case 'month':{const f=new Date(now.getFullYear(),now.getMonth(),1,0,0,0,0);return leads.filter(l=>inR(l,f,te));}
    case 'custom':{if(!from||!to)return leads;const f=startOfDay(new Date(from+'T00:00:00'));const t=endOfDay(new Date(to+'T00:00:00'));if(isNaN(f.getTime())||isNaN(t.getTime()))return leads;return leads.filter(l=>inR(l,f,t));}
    default:return leads;
  }
}

function buildChartData(leads:Lead[],period:string,from?:string,to?:string){
  const now=new Date();const ts=startOfDay(now);
  let days=30;let startDate=new Date(ts);startDate.setDate(ts.getDate()-29);
  if(period==='today'){days=1;startDate=new Date(ts);}
  else if(period==='yesterday'){days=1;startDate=new Date(ts);startDate.setDate(startDate.getDate()-1);}
  else if(period==='7days'){days=7;startDate=new Date(ts);startDate.setDate(startDate.getDate()-6);}
  else if(period==='month'){startDate=new Date(now.getFullYear(),now.getMonth(),1);days=now.getDate();}
  else if(period==='custom'&&from&&to){const f=startOfDay(new Date(from+'T00:00:00'));const t=startOfDay(new Date(to+'T00:00:00'));if(!isNaN(f.getTime())&&!isNaN(t.getTime())){days=Math.max(1,Math.round((t.getTime()-f.getTime())/86400000)+1);startDate=f;}}
  if(days===1){
    const slots:Record<string,number>={};
    for(let h=0;h<24;h+=2)slots[`${String(h).padStart(2,'0')}h`]=0;
    const ds=startOfDay(startDate);const de=endOfDay(startDate);
    leads.forEach(l=>{const d=parseLeadDate(l.created_at);if(d>=ds&&d<=de){const sh=Math.floor(d.getHours()/2)*2;const k=`${String(sh).padStart(2,'0')}h`;if(k in slots)slots[k]++;}});
    return Object.entries(slots).map(([date,cnt])=>({date,leads:cnt}));
  }
  const map:Record<string,number>={};
  for(let i=0;i<days;i++){const d=new Date(startDate);d.setDate(startDate.getDate()+i);map[d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})]=0;}
  leads.forEach(l=>{const k=parseLeadDate(l.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});if(k in map)map[k]++;});
  return Object.entries(map).map(([date,cnt])=>({date,leads:cnt}));
}

async function fetchMetaData(period:string,from?:string,to?:string, leadsList: Lead[] = []):Promise<{metrics:MetaMetrics;campaigns:Campaign[]}>{
  const empty={metrics:{spend:0,leads:0,cpl:0,impressions:0,clicks:0,ctr:0,cplRealTime:0},campaigns:[]};
  try{
    const presetMap:Record<string,string>={today:'today',yesterday:'yesterday','7days':'last_7d','30days':'last_30d',month:'this_month'};
    const timeParam=period in presetMap?`date_preset=${presetMap[period]}`:period==='custom'&&from&&to?`time_range=%7B%22since%22%3A%22${from}%22%2C%22until%22%3A%22${to}%22%7D`:'date_preset=this_month';
    const insRes=await fetch(`https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/insights?fields=spend,impressions,clicks,ctr,actions&${timeParam}&access_token=${META_TOKEN}`);
    const insData=await insRes.json();
    let spend=0,impressions=0,clicks=0,ctr=0,leads=0;
    if(insData.data?.length){const d=insData.data[0];spend=parseFloat(d.spend||'0');impressions=parseInt(d.impressions||'0');clicks=parseInt(d.clicks||'0');ctr=parseFloat(d.ctr||'0');const la=(d.actions||[]).find((a:any)=>['lead','offsite_conversion.fb_pixel_lead'].includes(a.action_type));leads=la?parseInt(la.value||'0'):0;}
    const campRes=await fetch(`https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/campaigns?fields=name,status&limit=20&access_token=${META_TOKEN}`);
    const campData=await campRes.json();
    const campaigns:Campaign[]=[];
    await Promise.all((campData.data||[]).slice(0,20).map(async(c:any)=>{
      try{const r=await fetch(`https://graph.facebook.com/v18.0/${c.id}/insights?fields=spend,actions&${timeParam}&access_token=${META_TOKEN}`);const d=await r.json();const ins=d.data?.[0];const cSpend=parseFloat(ins?.spend||'0');const cLeads=parseInt((ins?.actions||[]).find((a:any)=>['lead','offsite_conversion.fb_pixel_lead'].includes(a.action_type))?.value||'0');if(cSpend>0)campaigns.push({id:c.id,name:c.name,status:c.status,spend:cSpend,leads_api:cLeads});}catch{}
    }));
    const totalLeadsFB = leadsList.filter(l => l.utm_source && l.utm_source.toUpperCase() === 'FB').length;
    const cplRealTime = totalLeadsFB > 0 ? spend / totalLeadsFB : 0;
    return{metrics:{spend,impressions,clicks,ctr,leads,cpl:leads>0?spend/leads:0,cplRealTime},campaigns};
  }catch(e){console.error('[Meta]',e);return empty;}
}

export default function Dashboard() {
  const { user }=useAuth();
  const { theme }=useTheme();
  const dark=theme==='dark';

  const firstName=user?.user_metadata?.first_name||user?.user_metadata?.full_name?.split(' ')[0]||'';
  // Padrão: hoje. Mantém o que estava salvo se já foi setado
  const savedPeriod=localStorage.getItem(STORAGE_KEY)||'today';
  const savedCustom=(()=>{try{return JSON.parse(localStorage.getItem(STORAGE_CUSTOM)||'{}');}catch{return{};}})();

  const [allLeads,setAllLeads]=useState<Lead[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedPeriod,setSelectedPeriod]=useState(savedPeriod);
  const [customFrom,setCustomFrom]=useState<string>(savedCustom.from||'');
  const [customTo,setCustomTo]=useState<string>(savedCustom.to||'');
  const [showDropdown,setShowDropdown]=useState(false);
  const [showCustom,setShowCustom]=useState(false);
  const [isRefreshing,setIsRefreshing]=useState(false);
  const [metaMetrics,setMetaMetrics]=useState<MetaMetrics>({spend:0,leads:0,cpl:0,impressions:0,clicks:0,ctr:0,cplRealTime:0});
  const [metaCampaigns,setMetaCampaigns]=useState<Campaign[]>([]);
  const [metaLoading,setMetaLoading]=useState(true);
  const [metaError,setMetaError]=useState(false);
  const [isMobile,setIsMobile]=useState(false);

  const dropRef=useRef<HTMLDivElement>(null);
  const customRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{const check=()=>setIsMobile(window.innerWidth<768);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check);},[]);
  useEffect(()=>{function close(e:MouseEvent){if(dropRef.current&&!dropRef.current.contains(e.target as Node))setShowDropdown(false);if(customRef.current&&!customRef.current.contains(e.target as Node))setShowCustom(false);}document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[]);

  const fetchLeads=async()=>{setLoading(true);const{data,error}=await supabase.from('leads').select('id,nome,cidade,whatsapp,status,created_at,utm_source').order('created_at',{ascending:false});if(error)console.error('[Dashboard]',error.message);else if(data)setAllLeads(data as Lead[]);setLoading(false);};
  const loadMeta=async(currentLeads?: Lead[])=>{setMetaLoading(true);setMetaError(false);try{const{metrics,campaigns}=await fetchMetaData(selectedPeriod,customFrom,customTo, currentLeads || allLeads);setMetaMetrics(metrics);setMetaCampaigns(campaigns);if(metrics.spend===0&&campaigns.length===0)setMetaError(true);}catch{setMetaError(true);}setMetaLoading(false);};

  useEffect(()=>{if(!user)return;fetchLeads().then((leads) => loadMeta());},[user?.id]); // eslint-disable-line
  useEffect(()=>{if(allLeads.length > 0) loadMeta();},[selectedPeriod,customFrom,customTo,allLeads.length]); // eslint-disable-line
  useEffect(()=>{const ch=supabase.channel('dash-rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'leads'},p=>{setAllLeads(prev=>[p.new as Lead,...prev]);}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'leads'},p=>{setAllLeads(prev=>prev.map(l=>l.id===(p.new as Lead).id?p.new as Lead:l));}).on('postgres_changes',{event:'DELETE',schema:'public',table:'leads'},p=>{setAllLeads(prev=>prev.filter(l=>l.id!==(p.old as{id:string}).id));}).subscribe();return()=>{supabase.removeChannel(ch);};},[]);

  function selectPeriod(value:string){if(value==='custom'){setShowDropdown(false);setShowCustom(true);return;}setSelectedPeriod(value);localStorage.setItem(STORAGE_KEY,value);setShowDropdown(false);setShowCustom(false);}
  function applyCustom(){if(!customFrom||!customTo)return;setSelectedPeriod('custom');localStorage.setItem(STORAGE_KEY,'custom');localStorage.setItem(STORAGE_CUSTOM,JSON.stringify({from:customFrom,to:customTo}));setShowCustom(false);}
  async function handleRefresh(){setIsRefreshing(true);await Promise.all([fetchLeads(),loadMeta()]);setTimeout(()=>setIsRefreshing(false),600);}

  const filtered=useMemo(()=>filterByPeriod(allLeads,selectedPeriod,customFrom,customTo),[allLeads,selectedPeriod,customFrom,customTo]);
  const totalLeads=filtered.length;
  const approved=filtered.filter(l=>toNum(l.status)===3).length;
  const convRate=totalLeads>0?((approved/totalLeads)*100).toFixed(1):'0.0';
  const spend=metaMetrics.spend||0;
  const cplMeta=metaMetrics.cpl||0;
  const chartData=useMemo(()=>buildChartData(filtered,selectedPeriod,customFrom,customTo),[filtered,selectedPeriod,customFrom,customTo]);
  const funnelData=useMemo(()=>FUNNEL_CONFIG.map(f=>({...f,value:filtered.filter(l=>toNum(l.status)===f.statusId).length})),[filtered]);
  const recentLeads=useMemo(()=>[...allLeads].sort((a,b)=>parseLeadDate(b.created_at).getTime()-parseLeadDate(a.created_at).getTime()).slice(0,5),[allLeads]);
  const campRows=useMemo(()=>{
    if(!metaCampaigns.length)return[];
    const withSpend=metaCampaigns.filter(c=>Number(c.spend)>0);
    if(!withSpend.length)return[];
    const maxSpend=Math.max(...withSpend.map(c=>Number(c.spend)),1);
    return withSpend.sort((a,b)=>{const pA=a.leads_api>0?a.leads_api/a.spend:0;const pB=b.leads_api>0?b.leads_api/b.spend:0;if(pA!==pB)return pB-pA;return b.spend-a.spend;}).slice(0,5).map(c=>({
      name:c.name.length>24?c.name.slice(0,24)+'…':c.name,
      spend:`R$ ${Number(c.spend||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`,
      leads:c.leads_api||0,
      cpl:c.leads_api>0&&c.spend>0?`R$ ${(c.spend/c.leads_api).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'—',
      perf:Math.round((Number(c.spend)/maxSpend)*100),
    }));
  },[metaCampaigns]);

  const periodLabel=selectedPeriod==='custom'&&customFrom&&customTo?`${isoToBR(customFrom)} – ${isoToBR(customTo)}`:PERIOD_FILTERS.find(p=>p.value===selectedPeriod)?.label??'Hoje';

  const bg=dark?'#090909':'#f4f4f5';
  const cardBg=dark?'#111113':'#ffffff';
  const border=dark?'#1e1e22':'#e5e7eb';
  const txtHi=dark?'#f4f4f5':'#111827';
  const txtMid=dark?'#71717a':'#6b7280';
  const txtLow=dark?'#52525b':'#9ca3af';
  const gridLn=dark?'#1e1e22':'#f0f0f0';
  const divCls=dark?'#1e1e22':'#f3f4f6';
  const hov=dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)';
  // Mobile: padding lateral maior para não colar nas bordas
  const pad=isMobile?'20px 16px':'32px';
  const btnBase:React.CSSProperties={display:'flex',alignItems:'center',gap:'6px',padding:'8px 12px',borderRadius:'10px',border:`1px solid ${border}`,background:cardBg,color:txtMid,fontSize:'13px',cursor:'pointer',transition:'all 0.12s',fontFamily:'inherit'};
  const statusClass=dark?STATUS_DARK:STATUS_LIGHT;

  return(
    <AppLayout leadCount={allLeads.length}>
      <div style={{padding:pad,background:bg,minHeight:'100vh'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{fontSize:isMobile?'20px':'26px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:0,display:'flex',alignItems:'center',gap:'8px'}}>
              {getGreeting()}{firstName?`, ${firstName}`:''}!{' '}
              <img src="/wave.png" alt="👋" style={{width:'26px',height:'26px',objectFit:'contain'}}
                onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none';}}
              />
            </h1>
            <p style={{fontSize:'13px',color:txtMid,marginTop:'4px'}}>
              {new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}
            </p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
            <div style={{position:'relative'}} ref={dropRef}>
              <button onClick={()=>{setShowDropdown(v=>!v);setShowCustom(false);}} style={btnBase}>
                {periodLabel}
                <ChevronDown style={{width:'14px',height:'14px',color:txtLow,transform:showDropdown?'rotate(180deg)':'',transition:'transform 0.18s'}}/>
              </button>
              {showDropdown&&(
                <div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:cardBg,border:`1px solid ${border}`,borderRadius:'12px',padding:'4px',minWidth:'168px',zIndex:50,boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 32px rgba(0,0,0,0.1)'}}>
                  {PERIOD_FILTERS.map(f=>(
                    <button key={f.value} onClick={()=>selectPeriod(f.value)} style={{width:'100%',padding:'7px 10px',borderRadius:'8px',border:'none',background:selectedPeriod===f.value?(dark?'rgba(255,255,255,0.08)':'#eff6ff'):'transparent',color:selectedPeriod===f.value?(dark?'#60a5fa':'#2563eb'):txtMid,fontSize:'13px',cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
              {showCustom&&(
                <div ref={customRef} style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:cardBg,border:`1px solid ${border}`,borderRadius:'14px',padding:'16px',zIndex:50,minWidth:'260px',boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 32px rgba(0,0,0,0.12)'}}>
                  <p style={{fontSize:'11px',fontWeight:600,color:txtLow,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:'12px'}}>Período personalizado</p>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {[{label:'Data inicial',val:customFrom,set:setCustomFrom},{label:'Data final',val:customTo,set:setCustomTo}].map(({label,val,set})=>(
                      <div key={label}>
                        <label style={{fontSize:'11px',color:txtMid,display:'block',marginBottom:'4px'}}>{label}</label>
                        <div style={{position:'relative'}}>
                          <input type="date" value={val} onChange={e=>set(e.target.value)} style={{width:'100%',padding:'8px 10px',borderRadius:'8px',border:`1px solid ${border}`,background:dark?'#18181b':cardBg,color:'transparent',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box' as any,cursor:'pointer'}}/>
                          <span style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',fontSize:'13px',color:val?txtHi:txtLow,pointerEvents:'none'}}>{val?isoToBR(val):'dd/mm/aaaa'}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{display:'flex',gap:'8px',marginTop:'4px'}}>
                      <button onClick={applyCustom} style={{flex:1,padding:'8px',borderRadius:'8px',background:'#2563eb',border:'none',color:'#fff',fontSize:'13px',fontWeight:500,cursor:'pointer',fontFamily:'inherit'}}>Aplicar</button>
                      <button onClick={()=>setShowCustom(false)} style={{flex:1,padding:'8px',borderRadius:'8px',border:`1px solid ${border}`,background:'transparent',color:txtMid,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleRefresh} style={btnBase}>
              <RefreshCw style={{width:'14px',height:'14px',color:txtMid,animation:isRefreshing?'spin 1s linear infinite':''}}/>
            </button>
            {!isMobile&&(
              <button style={{...btnBase,background:'#2563eb',border:'none',color:'#fff',fontWeight:500}}>
                <Download style={{width:'14px',height:'14px'}}/> Exportar
              </button>
            )}
          </div>
        </div>

        {/* Metric Cards — 1 col mobile, 4 col desktop */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'repeat(4,1fr)',gap:isMobile?'10px':'16px',marginBottom:'16px'}}>
          {[
            {label:'Gasto Total',    value:metaLoading?'…':`R$ ${spend.toLocaleString('pt-BR',{minimumFractionDigits:2})}`,        trend:'+',     up:true, sub:'Meta Ads'},
            {label:'Leads',          value:loading?'…':String(filtered.filter(l => l.utm_source?.toUpperCase() === 'FB').length),   trend:'+',     up:true, sub:'Fonte FB'},
            {label:'CPL Ads',        value:metaLoading?'…':(filtered.filter(l => l.utm_source?.toUpperCase() === 'FB').length > 0 ? `R$ ${(spend / filtered.filter(l => l.utm_source?.toUpperCase() === 'FB').length).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}` : 'R$ —'), trend:'Real Time', up:true, sub:'Base Sistema'},
            {label:'Aprovados',      value:loading?'…':String(approved),                                                             trend:`${convRate}%`,up:Number(convRate)>0,sub:'conversão'},
          ].map((c,i)=>(
            <div key={i} style={{background:cardBg,borderRadius:'14px',padding:isMobile?'14px':'20px',border:`1px solid ${border}`}}>
              <p style={{fontSize:'12px',color:txtMid,marginBottom:'4px'}}>{c.label}</p>
              <p style={{fontSize:isMobile?'22px':'26px',fontWeight:700,color:txtHi,letterSpacing:'-0.03em',margin:'0 0 6px'}}>{c.value}</p>
              <p style={{fontSize:'11px',display:'flex',alignItems:'center',gap:'3px',margin:0}}>
                {c.up?<TrendingUp style={{width:'11px',height:'11px',color:'#10b981'}}/>:<TrendingDown style={{width:'11px',height:'11px',color:'#ef4444'}}/>}
                <span style={{fontWeight:500,color:c.up?'#10b981':'#ef4444'}}>{c.trend}</span>
                <span style={{color:txtLow,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'2fr 1fr',gap:'14px',marginBottom:'16px'}}>
          <div style={{background:cardBg,borderRadius:'14px',padding:isMobile?'16px':'24px',border:`1px solid ${border}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
              <div>
                <h3 style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:0}}>Evolução de Leads</h3>
                <p style={{fontSize:'11px',color:txtMid,marginTop:'2px'}}>{periodLabel}</p>
              </div>
              <button style={{padding:'4px',borderRadius:'8px',border:'none',background:'transparent',cursor:'pointer'}}>
                <MoreHorizontal style={{width:'14px',height:'14px',color:txtLow}}/>
              </button>
            </div>
            <div style={{height:isMobile?'160px':'200px'}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData.length?chartData:[{date:'—',leads:0}]} margin={{top:10,right:10,left:-20,bottom:0}}>
                  <defs><linearGradient id="glLeads" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:txtMid,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis allowDecimals={false} tick={{fill:txtMid,fontSize:10}} axisLine={false} tickLine={false} width={24}/>
                  <Tooltip contentStyle={{background:cardBg,border:`1px solid ${border}`,borderRadius:'10px',fontSize:'12px',color:txtHi}}/>
                  <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} fill="url(#glLeads)" name="Leads"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{background:cardBg,borderRadius:'14px',padding:isMobile?'16px':'24px',border:`1px solid ${border}`}}>
            <h3 style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:'0 0 4px'}}>Funil</h3>
            <p style={{fontSize:'11px',color:txtMid,marginBottom:'14px'}}>{periodLabel}</p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {funnelData.map(stage=>{
                const pct=totalLeads>0?Math.round((stage.value/Math.max(totalLeads,1))*100):0;
                return(
                  <div key={stage.stage}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'3px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                        <div style={{width:'5px',height:'5px',borderRadius:'50%',background:stage.color}}/>
                        <span style={{fontSize:'11.5px',color:txtMid}}>{stage.stage}</span>
                      </div>
                      <span style={{fontSize:'12px',fontWeight:500,color:txtHi}}>{loading?'…':stage.value}</span>
                    </div>
                    <div style={{height:'4px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${loading?0:pct}%`,background:stage.color,borderRadius:'99px',transition:'width 0.5s ease'}}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{marginTop:'14px',paddingTop:'12px',borderTop:`1px solid ${divCls}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'12px',color:txtMid}}>Conversão</span>
              <span style={{fontSize:'15px',fontWeight:600,color:'#2563eb'}}>{convRate}%</span>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:'14px'}}>

          {/* Leads Recentes */}
          <div style={{background:cardBg,borderRadius:'14px',padding:isMobile?'16px':'24px',border:`1px solid ${border}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
              <h3 style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:0}}>Leads Recentes</h3>
              <Link to="/leads" style={{fontSize:'12px',color:'#2563eb',fontWeight:500,textDecoration:'none'}}>Ver todos</Link>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
              {loading?[...Array(4)].map((_,i)=><div key={i} style={{height:'44px',borderRadius:'10px',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',marginBottom:'2px'}}/>)
              :recentLeads.length===0?<p style={{fontSize:'13px',color:txtMid,textAlign:'center',padding:'20px 0'}}>Nenhum lead</p>
              :recentLeads.map((lead,idx)=>{
                const st=toNum(lead.status);
                return(
                  <div key={lead.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'10px',cursor:'pointer',transition:'background 0.12s'}}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=hov}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                  >
                    <div className={`w-7 h-7 ${AVATAR_COLORS[idx%AVATAR_COLORS.length]} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
                      {initials(lead.nome)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:'12.5px',fontWeight:500,color:txtHi,margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lead.nome.split(' ').slice(0, 2).join(' ')}</p>
                      <p style={{fontSize:'11px',color:txtLow,margin:0}}>{lead.cidade||'—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass[st]??''}`} style={{fontSize:'10.5px'}}>{STATUS_LABEL[st]??'Aguardando'}</span>
                    <span style={{fontSize:'11px',color:txtLow,flexShrink:0,minWidth:'28px',textAlign:'right'}}>{relativeTime(lead.created_at)}</span>
                    <a href={lead.whatsapp?`https://wa.me/55${lead.whatsapp.replace(/\D/g,'')}`:'#'} target="_blank" rel="noreferrer"
                      className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center transition-colors flex-shrink-0">
                      <MessageCircle className="w-3 h-3 text-white"/>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Campanhas — com todas as métricas visíveis */}
          <div style={{background:cardBg,borderRadius:'14px',padding:isMobile?'16px':'24px',border:`1px solid ${border}`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <h3 style={{fontSize:'14px',fontWeight:600,color:txtHi,margin:0}}>Campanhas</h3>
                <div style={{position:'relative',width:'7px',height:'7px'}}>
                  <div style={{width:'7px',height:'7px',borderRadius:'50%',background:metaError?'#ef4444':'#22c55e'}}/>
                  {!metaError&&<div style={{position:'absolute',inset:0,borderRadius:'50%',background:'#22c55e',animation:'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',opacity:0.6}}/>}
                </div>
              </div>
              <Link to="/campanhas" style={{fontSize:'12px',color:'#2563eb',fontWeight:500,textDecoration:'none'}}>Ver todas</Link>
            </div>

            {metaLoading
              ?[...Array(3)].map((_,i)=><div key={i} style={{height:'32px',borderRadius:'8px',background:dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.04)',marginBottom:'8px'}}/>)
              :metaError||campRows.length===0
                ?<div style={{textAlign:'center',padding:'20px 0'}}><p style={{fontSize:'13px',color:txtMid,margin:0}}>{metaError?'Erro ao conectar ao Meta Ads':'Nenhuma campanha'}</p></div>
                :(
                  /* Tabela compacta com todas as métricas */
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',minWidth:isMobile?'0':'auto'}}>
                      <thead>
                        <tr>
                          {['Campanha','Gasto','Leads','CPL', !isMobile && 'Perf.'].filter(Boolean).map(h=>(
                            <th key={h as string} style={{textAlign:'left',fontSize:'10px',fontWeight:600,color:txtLow,paddingBottom:'8px',letterSpacing:'0.05em',textTransform:'uppercase',whiteSpace:'nowrap',paddingRight:'8px'}}>{h as string}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {campRows.map((row,i)=>(
                          <tr key={i} style={{borderTop:`1px solid ${divCls}`}}>
                            <td style={{padding:'9px 8px 9px 0',fontSize:'12px',fontWeight:500,color:txtHi,maxWidth:'110px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.name}</td>
                            <td style={{padding:'9px 8px 9px 0',fontSize:'12px',color:txtMid,whiteSpace:'nowrap'}}>{row.spend}</td>
                            <td style={{padding:'9px 8px 9px 0',fontSize:'12px',color:txtMid}}>{row.leads}</td>
                            <td style={{padding:'9px 8px 9px 0',fontSize:'12px',color:txtMid,whiteSpace:'nowrap'}}>{row.cpl}</td>
                            {!isMobile && (
                              <td style={{padding:'9px 0'}}>
                                <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                                  <div style={{height:'4px',width:'36px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.07)',overflow:'hidden',flexShrink:0}}>
                                    <div style={{height:'100%',width:`${row.perf}%`,background:'#2563eb',borderRadius:'99px'}}/>
                                  </div>
                                  <span style={{fontSize:'11px',color:txtLow}}>{row.perf}%</span>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            }
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes ping{75%,100%{transform:scale(2.2);opacity:0}}
      `}</style>
    </AppLayout>
  );
}
