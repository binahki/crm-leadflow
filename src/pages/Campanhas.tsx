import { useState, useEffect, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Users, RefreshCw, Zap, ChevronDown, ArrowUpRight, Lightbulb, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdSet {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; leads_api: number; cpl: number;
  ads?: Ad[];
}
interface Ad {
  id: string; name: string; status: string;
  spend: number; leads_api: number; cpl: number; ctr: number; thumbnail_url: string | null;
  adset_id?: string;
}
interface BreakdownItem { label: string; leads: number; spend: number; cpl: number; }
interface InsightData {
  age: BreakdownItem[];
  gender: BreakdownItem[];
  placement: BreakdownItem[];
  device: BreakdownItem[];
}
interface Campaign {
  id: string; name: string; status: string;
  spend: number; impressions: number; clicks: number; ctr: number; cpm: number;
  leads_api: number; cpl?: number; adsets?: AdSet[]; ads?: Ad[];
}

const META_TOKEN = import.meta.env.VITE_META_TOKEN;
const META_ACCOUNT = import.meta.env.VITE_META_ACCOUNT;
const LEAD_ACTIONS = ['lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped'];

const PERIOD_OPTIONS = [
  { label: 'Hoje', value: 'today' },
  { label: 'Ontem', value: 'yesterday' },
  { label: '7 dias', value: 'last_7d' },
  { label: '30 dias', value: 'last_30d' },
  { label: 'Este mês', value: 'this_month' },
];

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtInt(n: number) { return n.toLocaleString('pt-BR'); }
function getLeads(actions: any[]) { return parseInt(actions?.find((a:any) => LEAD_ACTIONS.includes(a.action_type))?.value || '0'); }

function parseLeadDate(str?: string | null): Date {
  if (!str) return new Date(0);
  if (str.includes('T')) return new Date(str);
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) { const [, d, mo, y, h = '0', mi = '0'] = m; return new Date(Number(y), Number(mo)-1, Number(d), Number(h), Number(mi)); }
  return new Date(str);
}

function filterLeadsByPreset(leads: any[], preset: string) {
  const now = new Date();
  const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
  const te = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
  const inR = (l: any, a: Date, b: Date) => { const d = parseLeadDate(l.created_at); return d >= a && d <= b; };
  switch (preset) {
    case 'today':      return leads.filter(l => inR(l, ts, te));
    case 'yesterday':  { const ys=new Date(ts); ys.setDate(ys.getDate()-1); const ye=new Date(te); ye.setDate(ye.getDate()-1); return leads.filter(l => inR(l,ys,ye)); }
    case 'last_7d':    { const a=new Date(ts); a.setDate(a.getDate()-6); return leads.filter(l => inR(l,a,te)); }
    case 'last_30d':   { const a=new Date(ts); a.setDate(a.getDate()-29); return leads.filter(l => inR(l,a,te)); }
    case 'this_month': { const f=new Date(now.getFullYear(),now.getMonth(),1); return leads.filter(l => inR(l,f,te)); }
    default: return leads;
  }
}

// ── Fetch campanhas com filhos ────────────────────────────────
// Estratégia: busca campanhas + adsets + ads da conta toda de uma vez
// e agrupa no client por campaign_id — evita chamadas individuais que dão 400
async function fetchCampaignsWithChildren(datePreset: string): Promise<Campaign[]> {
  const tok = META_TOKEN;
  const base = 'https://graph.facebook.com/v18.0';
  const dp = datePreset;

  function getLeadsFromActions(actions: any[]) {
    return parseInt(actions?.find((a:any) => LEAD_ACTIONS.includes(a.action_type))?.value || '0');
  }

  try {
    // 1. Campanhas com insights embutidos via fields
    const campUrl = new URL(`${base}/act_${META_ACCOUNT}/campaigns`);
    campUrl.searchParams.set('fields', `id,name,status,insights.date_preset(${dp}){spend,impressions,clicks,ctr,cpm,actions}`);
    campUrl.searchParams.set('limit', '20');
    campUrl.searchParams.set('access_token', tok);
    const campRes = await fetch(campUrl.toString());
    const campData = await campRes.json();
    if (!campData.data?.length) return [];

    // 2. Adsets da conta com insights embutidos
    const asUrl = new URL(`${base}/act_${META_ACCOUNT}/adsets`);
    asUrl.searchParams.set('fields', `id,name,status,campaign_id,insights.date_preset(${dp}){spend,impressions,clicks,ctr,actions}`);
    asUrl.searchParams.set('limit', '50');
    asUrl.searchParams.set('access_token', tok);
    const asRes = await fetch(asUrl.toString());
    const asData = await asRes.json();

    // 3. Ads da conta com insights embutidos + thumbnail
    const adUrl = new URL(`${base}/act_${META_ACCOUNT}/ads`);
    adUrl.searchParams.set('fields', `id,name,status,campaign_id,adset_id,creative{thumbnail_url},insights.date_preset(${dp}){spend,ctr,actions}`);
    adUrl.searchParams.set('limit', '50');
    adUrl.searchParams.set('access_token', tok);
    const adRes = await fetch(adUrl.toString());
    const adData = await adRes.json();

    // Agrupa adsets por campaign_id
    const adsetsByCampaign: Record<string, AdSet[]> = {};
    for (const as of (asData.data || []) as any[]) {
      const cid = as.campaign_id;
      if (!cid) continue;
      if (!adsetsByCampaign[cid]) adsetsByCampaign[cid] = [];
      const ins = as.insights?.data?.[0];
      const spend = parseFloat(ins?.spend || '0');
      const leads = getLeadsFromActions(ins?.actions || []);
      adsetsByCampaign[cid].push({
        id: as.id, name: as.name, status: as.status,
        spend, impressions: parseInt(ins?.impressions || '0'),
        clicks: parseInt(ins?.clicks || '0'), ctr: parseFloat(ins?.ctr || '0'),
        leads_api: leads, cpl: leads > 0 ? spend / leads : 0,
      });
    }

    // Agrupa ads por campaign_id e por adset_id
    const adsByCampaign: Record<string, Ad[]> = {};
    const adsByAdset: Record<string, Ad[]> = {};
    for (const ad of (adData.data || []) as any[]) {
      const cid = ad.campaign_id;
      if (!cid) continue;
      if (!adsByCampaign[cid]) adsByCampaign[cid] = [];
      const ins = ad.insights?.data?.[0];
      const spend = parseFloat(ins?.spend || '0');
      const leads = getLeadsFromActions(ins?.actions || []);
      const adObj: Ad = {
        id: ad.id, name: ad.name, status: ad.status,
        spend, leads_api: leads, cpl: leads > 0 ? spend / leads : 0,
        ctr: parseFloat(ins?.ctr || '0'),
        thumbnail_url: ad.creative?.thumbnail_url || null,
        adset_id: ad.adset_id || undefined,
      };
      adsByCampaign[cid].push(adObj);
      // Também agrupa por adset
      const asid = ad.adset_id;
      if (asid) {
        if (!adsByAdset[asid]) adsByAdset[asid] = [];
        adsByAdset[asid].push(adObj);
      }
    }

    // Monta campanhas com filhos
    const results: Campaign[] = [];
    for (const c of campData.data as any[]) {
      const ins = c.insights?.data?.[0];
      const spend = parseFloat(ins?.spend || '0');
      const leads = getLeadsFromActions(ins?.actions || []);
      const adsets = (adsetsByCampaign[c.id] || []).map(as => ({ ...as, ads: (adsByAdset[as.id] || []).sort((a,b) => b.leads_api - a.leads_api || (a.cpl||999) - (b.cpl||999)) })).sort((a,b) => b.leads_api - a.leads_api || (a.cpl||999) - (b.cpl||999));
      const ads    = (adsByCampaign[c.id]    || []).sort((a,b) => b.leads_api - a.leads_api || (a.cpl||999) - (b.cpl||999));
      results.push({
        id: c.id, name: c.name, status: c.status,
        spend, impressions: parseInt(ins?.impressions || '0'),
        clicks: parseInt(ins?.clicks || '0'), ctr: parseFloat(ins?.ctr || '0'),
        cpm: parseFloat(ins?.cpm || '0'),
        leads_api: leads, cpl: leads > 0 ? spend / leads : 0,
        adsets, ads,
      });
    }

    return results
      .filter(c => c.spend > 0 || c.status === 'ACTIVE')
      .sort((a,b) => b.leads_api - a.leads_api || (a.cpl||999) - (b.cpl||999) || b.spend - a.spend);

  } catch (e) { console.error('[Campanhas]', e); return []; }
}

// ── Fetch breakdowns para insights reais ─────────────────────
async function fetchInsightData(datePreset: string): Promise<InsightData> {
  const base = `https://graph.facebook.com/v18.0/act_${META_ACCOUNT}/insights`;
  const fields = 'spend,actions';
  const token = `access_token=${META_TOKEN}`;
  const preset = `date_preset=${datePreset}`;

  function parseBreakdown(data: any[], labelKey: string): BreakdownItem[] {
    const map: Record<string, {leads:number;spend:number}> = {};
    for (const row of data) {
      const label = row[labelKey] || 'Desconhecido';
      const leads = getLeads(row.actions||[]);
      const spend = parseFloat(row.spend||'0');
      if (!map[label]) map[label] = {leads:0,spend:0};
      map[label].leads += leads;
      map[label].spend += spend;
    }
    return Object.entries(map)
      .map(([label,{leads,spend}]) => ({ label, leads, spend, cpl:leads>0?spend/leads:0 }))
      .sort((a,b) => b.leads-a.leads || a.cpl-b.cpl)
      .slice(0,5);
  }

  const PLACEMENT_LABELS: Record<string,string> = {
    'feed':'Feed do Facebook','facebook_stories':'Stories Facebook','instagram_stories':'Stories Instagram','instagram_stream':'Feed do Instagram','reels':'Reels','marketplace':'Marketplace','right_hand_column':'Coluna direita','video_feeds':'Vídeo feeds','instagram_reels':'Reels Instagram','audience_network_rewarded_video':'Audience Network',
  };
  const GENDER_LABELS: Record<string,string> = { 'male':'Homens','female':'Mulheres','unknown':'Desconhecido' };

  try {
    const [ageRes, genderRes, placementRes, deviceRes] = await Promise.all([
      fetch(`${base}?fields=${fields}&breakdowns=age&${preset}&${token}&limit=50`),
      fetch(`${base}?fields=${fields}&breakdowns=gender&${preset}&${token}&limit=10`),
      fetch(`${base}?fields=${fields}&breakdowns=publisher_platform,platform_position&${preset}&${token}&limit=50`),
      fetch(`${base}?fields=${fields}&breakdowns=device_platform&${preset}&${token}&limit=20`),
    ]);
    const [ageData, genderData, placementData, deviceData] = await Promise.all([ageRes.json(), genderRes.json(), placementRes.json(), deviceRes.json()]);

    const age = parseBreakdown(ageData.data||[], 'age');
    const gender = parseBreakdown(genderData.data||[], 'gender').map(g => ({ ...g, label: GENDER_LABELS[g.label]||g.label }));
    const placement = parseBreakdown((placementData.data||[]).map((r:any) => ({...r, placement_key:`${r.publisher_platform}/${r.platform_position}`})), 'placement_key')
      .map(p => ({ ...p, label: PLACEMENT_LABELS[p.label.split('/')[1]] || PLACEMENT_LABELS[p.label] || p.label }));
    const device = parseBreakdown(deviceData.data||[], 'device_platform');

    return { age, gender, placement, device };
  } catch {
    return { age:[], gender:[], placement:[], device:[] };
  }
}

// ── Gera análise textual como gestor de tráfego ──────────────
function generateAnalysis(campaigns: Campaign[], insightData: InsightData, totalSpend: number, totalLeads: number, avgCPL: number): string[] {
  const insights: string[] = [];
  if (!campaigns.length) return ['Nenhuma campanha com dados disponíveis para análise.'];

  // Performance geral
  if (avgCPL > 0 && avgCPL <= 15) insights.push(`✅ CPL médio de R$ ${fmt(avgCPL)} está excelente. Escale as campanhas ativas com confiança — aumentar o orçamento em até 30% ao dia sem quebrar o aprendizado.`);
  else if (avgCPL > 0 && avgCPL <= 30) insights.push(`📊 CPL médio de R$ ${fmt(avgCPL)} está aceitável. Foque em otimizar os conjuntos com CPL mais alto antes de escalar.`);
  else if (avgCPL > 30) insights.push(`⚠️ CPL médio de R$ ${fmt(avgCPL)} está elevado. Revise os criativos e a segmentação — o problema provavelmente está no público ou na página de destino.`);

  // Melhor e pior campanha
  const withLeads = campaigns.filter(c => c.leads_api > 0);
  if (withLeads.length > 0) {
    const best = withLeads[0];
    insights.push(`🏆 Melhor campanha: "${best.name.slice(0,45)}" com ${best.leads_api} leads a R$ ${fmt(best.leads_api>0?best.spend/best.leads_api:0)} CPL. Essa é a campanha para duplicar e testar variações.`);
    if (withLeads.length > 1) {
      const worst = [...withLeads].sort((a,b) => (b.spend/b.leads_api)-(a.spend/a.leads_api))[0];
      if (worst.id !== best.id) insights.push(`📉 Campanha com CPL mais caro: "${worst.name.slice(0,40)}" a R$ ${fmt(worst.spend/worst.leads_api)}. Considere pausar e redirecionar o budget para a melhor.`);
    }
  }

  const inactive = campaigns.filter(c => c.spend > totalSpend * 0.15 && c.leads_api === 0);
  if (inactive.length > 0) insights.push(`🔴 "${inactive[0].name.slice(0,40)}" consumiu R$ ${fmt(inactive[0].spend)} sem gerar nenhum lead. Pause imediatamente e revise o criativo ou o público.`);

  // Análise de idade
  if (insightData.age.length > 0) {
    const bestAge = insightData.age[0];
    const agesWithLeads = insightData.age.filter(a => a.leads > 0);
    if (bestAge.leads > 0) {
      insights.push(`👥 Faixa etária mais eficiente: ${bestAge.label} com ${bestAge.leads} leads${bestAge.cpl>0?` (CPL R$ ${fmt(bestAge.cpl)})`:''}. Concentre a verba nessa faixa.`);
    }
    if (agesWithLeads.length > 1) {
      const second = agesWithLeads[1];
      insights.push(`📌 Segunda melhor faixa etária: ${second.label} com ${second.leads} leads. Juntas, essas duas faixas representam seu público principal — ajuste a segmentação para priorizar.`);
    }
    const badAge = insightData.age.find(a => a.spend > totalSpend*0.1 && a.leads === 0);
    if (badAge) insights.push(`🚫 A faixa ${badAge.label} consumiu R$ ${fmt(badAge.spend)} sem converter. Exclua essa faixa etária dos próximos conjuntos para reduzir desperdício.`);
  }

  // Análise de gênero
  if (insightData.gender.length > 0) {
    const withGLeads = insightData.gender.filter(g => g.leads > 0);
    if (withGLeads.length > 0) {
      const bestG = withGLeads[0];
      const totalGLeads = withGLeads.reduce((s,g) => s+g.leads, 0);
      const pct = totalGLeads > 0 ? Math.round(bestG.leads/totalGLeads*100) : 0;
      insights.push(`⚡ ${pct}% dos leads vêm de ${bestG.label}${bestG.cpl>0?` com CPL de R$ ${fmt(bestG.cpl)}`:''}. ${pct > 70 ? 'Segmente exclusivamente para esse gênero para reduzir CPL.' : 'Público equilibrado — mantenha segmentação aberta.'}`);
    }
  }

  // Análise de posicionamento
  if (insightData.placement.length > 0) {
    const bestP = insightData.placement.filter(p => p.leads > 0)[0];
    const worstP = insightData.placement.find(p => p.spend > 20 && p.leads === 0);
    if (bestP) insights.push(`📱 Melhor posicionamento: ${bestP.label} com ${bestP.leads} leads${bestP.cpl>0?` (CPL R$ ${fmt(bestP.cpl)})`:''}. Crie campanhas segmentadas por posicionamento para isolar e escalar esse canal.`);
    if (worstP) insights.push(`❌ Posicionamento ${worstP.label} gastou R$ ${fmt(worstP.spend)} sem leads. Remova manualmente dos conjuntos ativos em Posicionamentos Manuais.`);
  }

  // Análise de device
  if (insightData.device.length > 0) {
    const bestD = insightData.device.filter(d => d.leads > 0)[0];
    if (bestD) insights.push(`📲 ${bestD.label} é o dispositivo que mais converte${bestD.cpl>0?` (CPL R$ ${fmt(bestD.cpl)})`:''}. Garanta que a landing page esteja 100% otimizada para esse device.`);
  }

  // Públicos potenciais para testar
  insights.push(`💡 Sugestões de públicos para testar: Lookalike 1% das leads aprovadas, mulheres 25-44 interessadas em moda/beleza/empreendedorismo, retargeting de quem visitou a página do quiz mas não completou.`);

  // CTR
  const lowCTR = campaigns.filter(c => c.ctr < 1 && c.impressions > 5000);
  if (lowCTR.length > 0) insights.push(`🎯 ${lowCTR.length} campanha(s) com CTR abaixo de 1% e alto volume de impressões. O hook dos criativos não está chamando atenção. Teste variações de thumbnail e primeiros 3 segundos do vídeo.`);

  return insights;
}

// ── FilterDropdown com position fixed ────────────────────────
function FilterDropdown({ value, options, onChange, dark }: { value:string; options:{label:string;value:string}[]; onChange:(v:string)=>void; dark:boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top:0, left:0, width:180 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const sel = options.find(o => o.value === value);
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const mw = 180;
      let left = r.right - mw;
      if (left < 8) left = 8;
      if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
      setPos({ top: r.bottom + 6, left, width: mw });
    }
    setOpen(v => !v);
  }
  return (
    <div style={{ position:'relative' }}>
      <button ref={btnRef} onClick={handleOpen} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'10px', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, background:dark?'#111113':'#fff', color:dark?'#d4d4d8':'#374151', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
        {sel?.label}<ChevronDown style={{ width:'14px', height:'14px', transform:open?'rotate(180deg)':'', transition:'transform 0.18s' }}/>
      </button>
      {open && (<>
        <div onClick={()=>setOpen(false)} style={{ position:'fixed', inset:0, zIndex:9998 }}/>
        <div style={{ position:'fixed', top:pos.top, left:pos.left, width:pos.width, background:dark?'#111113':'#fff', border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`, borderRadius:'10px', padding:'4px', zIndex:9999, boxShadow:dark?'0 8px 32px rgba(0,0,0,0.5)':'0 8px 24px rgba(0,0,0,0.1)' }}>
          {options.map(o => (<button key={o.value} onClick={()=>{ onChange(o.value); setOpen(false); }} style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', border:'none', background:value===o.value?(dark?'rgba(255,255,255,0.08)':'#eff6ff'):'transparent', color:value===o.value?(dark?'#60a5fa':'#2563eb'):(dark?'#a1a1aa':'#374151'), fontSize:'13px', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>{o.label}</button>))}
        </div>
      </>)}
    </div>
  );
}

function Thumbnail({ url, name, size=36 }: { url:string|null; name:string; size?:number }) {
  const [err, setErr] = useState(false);
  const initials = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
  const colors = ['#3b82f6','#8b5cf6','#f97316','#10b981','#f59e0b','#ec4899'];
  const color = colors[name.charCodeAt(0)%colors.length];
  if (!url||err) return <div style={{ width:size, height:size, borderRadius:'6px', background:color+'22', border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size>40?'12px':'9px', fontWeight:700, color, flexShrink:0 }}>{initials}</div>;
  return <img src={url} alt={name} onError={()=>setErr(true)} style={{ width:size, height:size, borderRadius:'6px', objectFit:'cover', flexShrink:0, border:'1px solid rgba(0,0,0,0.08)' }}/>;
}



export default function CampanhasPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [insightData, setInsightData] = useState<InsightData>({ age:[], gender:[], placement:[], device:[] });
  const [loading, setLoading] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState(false);
  const [datePreset, setDatePreset] = useState('today');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<'campanhas'|'insights'>('campanhas');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [expandedAdsetIds, setExpandedAdsetIds] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => { const check=()=>setIsMobile(window.innerWidth<768); check(); window.addEventListener('resize',check); return()=>window.removeEventListener('resize',check); }, []);

  const load = async () => {
    setLoading(true); setError(false);
    const data = await fetchCampaignsWithChildren(datePreset);
    if (!data.length) setError(true);
    setCampaigns(data);
    setLoading(false);
  };

  const loadInsights = async () => {
    setLoadingInsights(true);
    const data = await fetchInsightData(datePreset);
    setInsightData(data);
    setLoadingInsights(false);
  };

  useEffect(() => { load(); }, [datePreset]); // eslint-disable-line

  useEffect(() => {
    if (activeTab === 'insights') loadInsights();
  }, [activeTab, datePreset]); // eslint-disable-line

  const filtered = useMemo(() => {
    const base = statusFilter==='all'?campaigns:campaigns.filter(c=>c.status===statusFilter);
    return [...base].sort((a,b)=>b.leads_api-a.leads_api||(a.cpl||999)-(b.cpl||999)||b.spend-a.spend);
  }, [campaigns, statusFilter]);

  const totalSpend = campaigns.reduce((s,c)=>s+c.spend,0);
  const totalLeads = campaigns.reduce((s,c)=>s+c.leads_api,0);
  const avgCPL = totalLeads>0?totalSpend/totalLeads:0;
  const maxSpend = Math.max(...campaigns.map(c=>c.spend),1);
  const avgPerf = campaigns.length>0?campaigns.reduce((s,c)=>s+(c.spend/maxSpend)*100,0)/campaigns.length:0;
  const filteredLeads = useMemo(()=>filterLeadsByPreset(leads,datePreset),[leads,datePreset]);
  const leadsFBCount = filteredLeads.filter(l=>l.utm_source?.toUpperCase()==='FB').length;
  const cplRealTime = leadsFBCount>0?totalSpend/leadsFBCount:0;
  const chartData = filtered.slice(0,8).map(c=>({ name:c.name.length>14?c.name.slice(0,14)+'…':c.name, gasto:c.spend, leads:c.leads_api }));
  const analysis = useMemo(()=>generateAnalysis(campaigns,insightData,totalSpend,totalLeads,avgCPL),[campaigns,insightData,totalSpend,totalLeads,avgCPL]);

  const bg = dark?'#090909':'#f4f4f5';
  const cardBg = dark?'#111113':'#ffffff';
  const border = dark?'#1e1e22':'#e5e7eb';
  const txtHi = dark?'#f4f4f5':'#111827';
  const txtMid = dark?'#71717a':'#6b7280';
  const txtLow = dark?'#52525b':'#9ca3af';
  const divCls = dark?'#1e1e22':'#f3f4f6';
  const gridLn = dark?'#1e1e22':'#f0f0f0';
  const pad = isMobile?'16px':'32px';

  function toggleExpand(id: string) { setExpandedIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function toggleExpandAdset(id: string) { setExpandedAdsetIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding:pad, background:bg, minHeight:'100vh' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontSize:isMobile?'20px':'24px', fontWeight:700, color:txtHi, letterSpacing:'-0.03em', margin:0 }}>Campanhas Meta Ads</h1>
            <p style={{ fontSize:'13px', color:txtMid, marginTop:'4px' }}>Dados em tempo real via API do Facebook</p>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <FilterDropdown value={datePreset} options={PERIOD_OPTIONS} onChange={setDatePreset} dark={dark}/>
            <FilterDropdown value={statusFilter} options={[{label:'Todas',value:'all'},{label:'Ativas',value:'ACTIVE'},{label:'Pausadas',value:'PAUSED'}]} onChange={setStatusFilter} dark={dark}/>
            <button onClick={load} disabled={loading} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', borderRadius:'10px', border:`1px solid ${border}`, background:cardBg, color:txtMid, fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
              <RefreshCw style={{ width:'14px', height:'14px', animation:loading?'spin 1s linear infinite':'' }}/>
              {loading?'Carregando…':'Atualizar'}
            </button>
          </div>
        </div>

        {/* Cards */}
        <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)', gap:isMobile?'10px':'14px', marginBottom:'16px' }}>
          {[
            { label:'Gasto Total', value:loading?'…':`R$ ${fmt(totalSpend)}`, icon:DollarSign, color:'#10b981', bgC:dark?'rgba(16,185,129,0.12)':'#ecfdf5' },
            { label:'Leads (FB)', value:loading?'…':String(leadsFBCount), icon:Users, color:'#3b82f6', bgC:dark?'rgba(59,130,246,0.12)':'#eff6ff' },
            { label:'CPL Real', value:loading?'…':(cplRealTime>0?`R$ ${fmt(cplRealTime)}`:'R$ —'), icon:TrendingUp, color:'#f97316', bgC:dark?'rgba(249,115,22,0.12)':'#fff7ed' },
            { label:'Performance', value:loading?'…':`${avgPerf.toFixed(0)}%`, icon:Zap, color:'#8b5cf6', bgC:dark?'rgba(139,92,246,0.12)':'#f5f3ff' },
          ].map((c,i)=>(
            <div key={i} style={{ background:cardBg, borderRadius:'16px', padding:isMobile?'12px':'20px', border:`1px solid ${border}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                <span style={{ fontSize:'12px', color:txtMid }}>{c.label}</span>
                <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:c.bgC, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <c.icon style={{ width:'14px', height:'14px', color:c.color }}/>
                </div>
              </div>
              <p style={{ fontSize:isMobile?'20px':'24px', fontWeight:700, color:txtHi, letterSpacing:'-0.03em', margin:0 }}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Chart desktop */}
        {!isMobile && (
          <div style={{ background:cardBg, borderRadius:'16px', padding:'20px', border:`1px solid ${border}`, marginBottom:'16px' }}>
            <h3 style={{ fontSize:'14px', fontWeight:600, color:txtHi, margin:'0 0 16px' }}>Desempenho por Campanha</h3>
            <div style={{ height:'180px' }}>
              {loading?<div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:txtMid, fontSize:'13px' }}>Carregando…</div>
              :chartData.length>0?(
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridLn} vertical={false}/>
                    <XAxis dataKey="name" tick={{fill:txtMid,fontSize:10}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fill:txtMid,fontSize:10}} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{background:cardBg,border:`1px solid ${border}`,borderRadius:'12px',fontSize:'12px',color:txtHi}}/>
                    <Bar dataKey="gasto" fill="#3b82f6" radius={[6,6,0,0]} name="Gasto (R$)"/>
                    <Bar dataKey="leads" fill="#10b981" radius={[6,6,0,0]} name="Leads"/>
                  </BarChart>
                </ResponsiveContainer>
              ):<div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:txtMid, fontSize:'13px' }}>Nenhum dado</div>}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ background:cardBg, borderRadius:'16px', border:`1px solid ${border}`, overflow:'hidden' }}>
          <div style={{ display:'flex', borderBottom:`1px solid ${border}`, overflowX:'auto' }}>
            {[{key:'campanhas',label:'Campanhas',icon:TrendingUp},{key:'insights',label:'Insights',icon:Lightbulb}].map(tab=>(
              <button key={tab.key} onClick={()=>setActiveTab(tab.key as any)} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'14px 16px', border:'none', cursor:'pointer', background:activeTab===tab.key?cardBg:'transparent', color:activeTab===tab.key?txtHi:txtMid, fontSize:'13px', fontWeight:activeTab===tab.key?600:400, borderBottom:activeTab===tab.key?'2px solid #2563eb':'2px solid transparent', transition:'all 0.15s', fontFamily:'inherit', marginBottom:'-1px', whiteSpace:'nowrap' }}>
                <tab.icon style={{width:'14px',height:'14px'}}/>{tab.label}
              </button>
            ))}
          </div>

          {/* Tab Campanhas */}
          {activeTab==='campanhas' && (
            <div>
              {loading?<div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>Carregando campanhas…</div>
              :error||filtered.length===0?<div style={{padding:'40px',textAlign:'center',color:txtMid,fontSize:'13px'}}>{error?'⚠️ Erro ao conectar ao Meta Ads.':'Nenhuma campanha encontrada.'}</div>
              :filtered.map(c=>{
                const isExpanded=expandedIds.has(c.id);
                const perf=Math.round((c.spend/maxSpend)*100);
                return(
                  <div key={c.id} style={{borderBottom:`1px solid ${divCls}`}}>
                    {/* Campanha */}
                    <div onClick={()=>toggleExpand(c.id)} style={{display:'flex',alignItems:'center',gap:'10px',padding:isMobile?'14px':'12px 16px',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTapHighlightColor:'transparent'}}>
                      <ChevronRight style={{width:'14px',height:'14px',color:txtLow,transform:isExpanded?'rotate(90deg)':'',transition:'transform 0.18s',flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                          <span style={{fontSize:'13.5px',fontWeight:600,color:txtHi,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:isMobile?'170px':'320px'}}>{c.name}</span>
                          <span style={{display:'inline-flex',alignItems:'center',gap:'4px',padding:'2px 8px',borderRadius:'99px',fontSize:'11px',fontWeight:500,background:c.status==='ACTIVE'?(dark?'rgba(16,185,129,0.15)':'#d1fae5'):(dark?'rgba(255,255,255,0.06)':'#f3f4f6'),color:c.status==='ACTIVE'?'#10b981':txtMid,flexShrink:0}}>
                            <span style={{width:'4px',height:'4px',borderRadius:'50%',background:c.status==='ACTIVE'?'#10b981':txtLow}}/>{c.status==='ACTIVE'?'Ativa':'Pausada'}
                          </span>
                        </div>
                        {isMobile?(
                          <div style={{display:'flex',gap:'10px',marginTop:'4px',flexWrap:'wrap'}}>
                            <span style={{fontSize:'12px',color:txtMid}}>R$ {fmt(c.spend)}</span>
                            {c.leads_api>0?<button onClick={e=>{e.stopPropagation();const periodMap:Record<string,string>={'today':'today','yesterday':'yesterday','last_7d':'7days','last_30d':'30days','this_month':'month'}; navigate(`/leads?campanha=${encodeURIComponent(c.name)}&periodo=${periodMap[datePreset]||'all'}`);}} style={{fontSize:'12px',color:'#10b981',fontWeight:700,background:'none',border:'none',cursor:'pointer',padding:0,fontFamily:'inherit'}}>{c.leads_api} leads ↗</button>:<span style={{fontSize:'12px',color:txtMid}}>0 leads</span>}
                            {c.cpl&&c.cpl>0&&<span style={{fontSize:'12px',color:txtMid}}>CPL R$ {fmt(c.cpl)}</span>}
                          </div>
                        ):(
                          <div style={{display:'flex',gap:'16px',marginTop:'4px',alignItems:'center'}}>
                            <span style={{fontSize:'12px',color:txtMid}}>R$ {fmt(c.spend)}</span>
                            <span style={{fontSize:'12px',color:txtMid}}>{fmtInt(c.impressions)} imp</span>
                            <span style={{fontSize:'12px',color:txtMid}}>{c.ctr.toFixed(2)}% CTR</span>
                            {c.leads_api>0?<button onClick={e=>{e.stopPropagation();const periodMap:Record<string,string>={'today':'today','yesterday':'yesterday','last_7d':'7days','last_30d':'30days','this_month':'month'}; navigate(`/leads?campanha=${encodeURIComponent(c.name)}&periodo=${periodMap[datePreset]||'all'}`);}} style={{fontSize:'12px',color:'#10b981',fontWeight:700,background:dark?'rgba(16,185,129,0.1)':'#f0fdf4',border:'1px solid rgba(16,185,129,0.25)',borderRadius:'6px',cursor:'pointer',padding:'2px 8px',fontFamily:'inherit'}}>{c.leads_api} leads ↗</button>:<span style={{fontSize:'12px',color:txtMid}}>0 leads</span>}
                            {c.cpl&&c.cpl>0&&<span style={{fontSize:'12px',color:txtMid}}>CPL R$ {fmt(c.cpl)}</span>}
                          </div>
                        )}
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
                                      <div style={{display:'flex',gap:'8px',marginTop:'2px',flexWrap:'wrap'}}>
                                        <span style={{fontSize:'11px',color:txtMid}}>R$ {fmt(as.spend)}</span>
                                        <span style={{fontSize:'11px',color:as.leads_api>0?'#10b981':txtMid,fontWeight:as.leads_api>0?600:400}}>{as.leads_api} leads</span>
                                        {as.cpl>0&&<span style={{fontSize:'11px',color:txtMid}}>CPL R$ {fmt(as.cpl)}</span>}
                                        <span style={{fontSize:'11px',color:txtMid}}>{as.ctr.toFixed(2)}% CTR</span>
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
                                            <div style={{display:'flex',gap:'8px',marginTop:'2px',flexWrap:'wrap'}}>
                                              <span style={{fontSize:'11px',color:ad.status==='ACTIVE'?'#10b981':txtMid}}>{ad.status==='ACTIVE'?'● Ativo':'○ Pausado'}</span>
                                              <span style={{fontSize:'11px',color:txtMid}}>R$ {fmt(ad.spend)}</span>
                                              <span style={{fontSize:'11px',color:ad.leads_api>0?'#10b981':txtMid,fontWeight:ad.leads_api>0?600:400}}>{ad.leads_api} leads</span>
                                              {ad.cpl>0&&<span style={{fontSize:'11px',color:txtMid}}>CPL R$ {fmt(ad.cpl)}</span>}
                                              <span style={{fontSize:'11px',color:txtMid}}>{ad.ctr.toFixed(2)}% CTR</span>
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
              })}
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
              {loading||loadingInsights?<div style={{color:txtMid,fontSize:'13px',textAlign:'center',padding:'32px'}}>Analisando dados de campanhas…</div>:(
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {analysis.map((a,i)=>(
                    <div key={i} style={{padding:'14px 16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.03)':'#fafafa',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`,display:'flex',gap:'12px',alignItems:'flex-start'}}>
                      <div style={{width:'7px',height:'7px',borderRadius:'50%',background:'#8b5cf6',flexShrink:0,marginTop:'6px'}}/>
                      <p style={{margin:0,fontSize:'13.5px',color:dark?'#d4d4d8':'#374151',lineHeight:1.65}}>{a}</p>
                    </div>
                  ))}

                  {/* Resumo numérico */}
                  <div style={{marginTop:'4px',padding:'16px',borderRadius:'12px',background:dark?'rgba(37,99,235,0.1)':'#eff6ff',border:`1px solid ${dark?'rgba(59,130,246,0.2)':'#bfdbfe'}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                      <ArrowUpRight style={{width:'14px',height:'14px',color:'#2563eb'}}/>
                      <span style={{fontSize:'13px',fontWeight:600,color:dark?'#93c5fd':'#1e40af'}}>Resumo do Período</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(3,1fr)',gap:'12px'}}>
                      {[
                        {label:'Total Investido',value:`R$ ${fmt(totalSpend)}`},
                        {label:'Leads Gerados',value:String(totalLeads)},
                        {label:'CPL Médio',value:avgCPL>0?`R$ ${fmt(avgCPL)}`:'—'},
                      ].map((s,i)=>(
                        <div key={i}>
                          <p style={{margin:0,fontSize:'11px',color:dark?'#93c5fd':'#3b82f6',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'2px'}}>{s.label}</p>
                          <p style={{margin:0,fontSize:'18px',fontWeight:700,color:dark?'#fff':'#1e40af'}}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Breakdowns visuais */}
                  {insightData.age.length>0&&(
                    <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                      <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Faixa etária</p>
                      {insightData.age.map((item,i)=>{
                        const max=Math.max(...insightData.age.map(a=>a.leads),1);
                        return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'12px',color:txtMid,width:'50px',flexShrink:0}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#8b5cf6',borderRadius:'99px'}}/>
                            </div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                            {item.cpl>0&&<span style={{fontSize:'11px',color:txtLow,flexShrink:0}}>R${fmt(item.cpl)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {insightData.gender.length>0&&(
                    <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                      <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Gênero</p>
                      {insightData.gender.map((item,i)=>{
                        const max=Math.max(...insightData.gender.map(g=>g.leads),1);
                        return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'12px',color:txtMid,width:'70px',flexShrink:0}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#3b82f6',borderRadius:'99px'}}/>
                            </div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {insightData.placement.length>0&&(
                    <div style={{padding:'16px',borderRadius:'12px',background:dark?'rgba(255,255,255,0.02)':'#f9fafb',border:`1px solid ${dark?'#1e1e22':'#e5e7eb'}`}}>
                      <p style={{margin:'0 0 10px',fontSize:'12px',fontWeight:600,color:txtMid,textTransform:'uppercase',letterSpacing:'0.06em'}}>Posicionamento</p>
                      {insightData.placement.map((item,i)=>{
                        const max=Math.max(...insightData.placement.map(p=>p.leads),1);
                        return(
                          <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}>
                            <span style={{fontSize:'11.5px',color:txtMid,width:'120px',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>
                            <div style={{flex:1,height:'6px',borderRadius:'99px',background:dark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                              <div style={{height:'100%',width:`${(item.leads/max)*100}%`,background:'#10b981',borderRadius:'99px'}}/>
                            </div>
                            <span style={{fontSize:'11px',color:txtMid,width:'60px',textAlign:'right',flexShrink:0}}>{item.leads} leads</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </AppLayout>
  );
}
