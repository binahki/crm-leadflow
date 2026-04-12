import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, Search, RefreshCw, ChevronDown, Flame,
  CheckCircle2, Users, MessageCircle, Calendar,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import { toast } from 'sonner';
import { AppLayout } from '@/components/AppLayout';
import { useAppStore, Lead, STATUS_LABELS } from '@/stores/appStore';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getRelativeTime, formatDDMM } from '@/utils/relativeTime';

const AVATAR_COLORS = [
  'bg-rose-400','bg-yellow-400','bg-emerald-400','bg-orange-400',
  'bg-cyan-400','bg-violet-400','bg-blue-400','bg-pink-400',
];
const FUNNEL_COLORS = [
  'from-blue-500 to-blue-400','from-blue-400 to-blue-300',
  'from-violet-400 to-violet-300','from-emerald-500 to-emerald-400',
];
const PERIOD_FILTERS = [
  { label: 'Hoje',          value: 'today' },
  { label: 'Ontem',         value: 'yesterday' },
  { label: '7 dias',        value: '7days' },
  { label: '30 dias',       value: '30days' },
  { label: 'Este mês',      value: 'month' },
  { label: 'Personalizado', value: 'custom' },
];
const TOTAL_SPEND = 86.56;
const STORAGE_KEY = 'dashboard_period';
const STORAGE_CUSTOM_KEY = 'dashboard_custom_range';

function avatarColor(name: string) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function initials(name: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function parseLeadDate(str?: string): Date {
  if (!str) return new Date(0);
  if (str.includes('T') || str.endsWith('Z')) return new Date(str);
  if (str.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
    const [dp, tp] = str.split(' ');
    const [d, m, y] = dp.split('/');
    const [h = '0', min = '0'] = (tp || '').split(':');
    return new Date(Number(y), Number(m)-1, Number(d), Number(h), Number(min));
  }
  return new Date(str);
}
function startOf(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function filterByPeriod(leads: Lead[], period: string, customFrom?: string, customTo?: string): Lead[] {
  const now = new Date();
  const today = startOf(now);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const inRange = (l: Lead, from: Date, to: Date) => {
    const d = parseLeadDate(l.created_at);
    return d >= from && d < to;
  };
  switch (period) {
    case 'today': return leads.filter(l => inRange(l, today, tomorrow));
    case 'yesterday': { const y = new Date(today); y.setDate(today.getDate()-1); return leads.filter(l => inRange(l, y, today)); }
    case '7days':  { const a = new Date(today); a.setDate(today.getDate()-7);  return leads.filter(l => inRange(l, a, tomorrow)); }
    case '30days': { const a = new Date(today); a.setDate(today.getDate()-30); return leads.filter(l => inRange(l, a, tomorrow)); }
    case 'month':  { const f = new Date(now.getFullYear(), now.getMonth(), 1); return leads.filter(l => inRange(l, f, tomorrow)); }
    case 'custom': {
      if (!customFrom || !customTo) return leads;
      const from = startOf(new Date(customFrom));
      const to = new Date(startOf(new Date(customTo))); to.setDate(to.getDate()+1);
      return leads.filter(l => inRange(l, from, to));
    }
    default: return leads;
  }
}
function buildChartData(leads: Lead[], period: string, customFrom?: string, customTo?: string) {
  const now = new Date();
  const today = startOf(now);
  let days = 30;
  let startDate = new Date(today); startDate.setDate(today.getDate()-29);
  if (period === 'today')     { days = 1; startDate = today; }
  else if (period === 'yesterday') { days = 1; startDate = new Date(today); startDate.setDate(today.getDate()-1); }
  else if (period === '7days')  { days = 7;  startDate = new Date(today); startDate.setDate(today.getDate()-6); }
  else if (period === '30days') { days = 30; startDate = new Date(today); startDate.setDate(today.getDate()-29); }
  else if (period === 'month')  { startDate = new Date(now.getFullYear(), now.getMonth(), 1); days = today.getDate(); }
  else if (period === 'custom' && customFrom && customTo) {
    const f = startOf(new Date(customFrom)); const t = startOf(new Date(customTo));
    days = Math.max(1, Math.round((t.getTime()-f.getTime())/86400000)+1);
    startDate = f;
  }
  const map: Record<string,number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate); d.setDate(startDate.getDate()+i);
    map[d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})] = 0;
  }
  leads.forEach(l => {
    const k = parseLeadDate(l.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
    if (k in map) map[k]++;
  });
  return Object.entries(map).map(([date,leads]) => ({date,leads}));
}

export default function Dashboard() {
  const { leads, setLeads } = useAppStore();
  const { user } = useAuth();
  const firstName = user?.user_metadata?.first_name || user?.user_metadata?.full_name?.split(' ')[0] || 'Usuário';

  const savedPeriod = localStorage.getItem(STORAGE_KEY) || '30days';
  const savedCustom = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '{}'); } catch { return {}; } })();

  const [selectedPeriod,   setSelectedPeriod]   = useState(savedPeriod);
  const [customFrom,       setCustomFrom]       = useState<string>(savedCustom.from || '');
  const [customTo,         setCustomTo]         = useState<string>(savedCustom.to || '');
  const [showDropdown,     setShowDropdown]     = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [isRefreshing,     setIsRefreshing]     = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [,                 setTick]             = useState(0);
  const [recentLeads,      setRecentLeads]      = useState<Lead[]>([]);
  const [proximasAcoes,    setProximasAcoes]    = useState<Lead[]>([]);
  const [cardsLoading,     setCardsLoading]     = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 60_000);
    return () => clearInterval(id);
  }, []);

  function selectPeriod(value: string) {
    if (value === 'custom') { setShowCustomPicker(true); setShowDropdown(false); return; }
    setSelectedPeriod(value);
    localStorage.setItem(STORAGE_KEY, value);
    setShowDropdown(false);
  }

  function applyCustomPeriod() {
    if (!customFrom || !customTo) { toast.error('Selecione as duas datas'); return; }
    if (new Date(customFrom) > new Date(customTo)) { toast.error('Data inicial maior que a final'); return; }
    setSelectedPeriod('custom');
    localStorage.setItem(STORAGE_KEY, 'custom');
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify({ from: customFrom, to: customTo }));
    setShowCustomPicker(false);
  }

  const fetchCards = async () => {
    setCardsLoading(true);
    const { data, error } = await supabase.from('leads').select('id, nome, whatsapp, cidade, status, created_at');
    if (error) { console.error('[Dashboard] fetchCards:', error.message); setCardsLoading(false); return; }
    const all = (data || []) as unknown as Lead[];
    const recentes = [...all].sort((a,b) => parseLeadDate(b.created_at).getTime()-parseLeadDate(a.created_at).getTime()).slice(0,5);
    const aguardando = [...all]
      .filter(l => { const s = l.status; return s===0||s===null||s===undefined||(s as unknown as string)==='0'||(s as unknown as string)===''; })
      .sort((a,b) => parseLeadDate(a.created_at).getTime()-parseLeadDate(b.created_at).getTime())
      .slice(0,4);
    setRecentLeads(recentes);
    setProximasAcoes(aguardando);
    setCardsLoading(false);
  };

  useEffect(() => {
    const ch = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, p => {
        const nl = p.new as unknown as Lead;
        useAppStore.getState().addLead(nl);
        fetchCards();
        toast.success(`Novo lead: ${nl.nome}`, {
          action: { label: 'WhatsApp', onClick: () => window.open(`https://wa.me/${nl.whatsapp?.replace(/\D/g,'')}`, '_blank') },
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    supabase.from('leads').select('*').order('created_at',{ascending:false})
      .then(({data,error}) => {
        if (error) console.error('[Dashboard] fetchLeads:', error.message);
        if (data) setLeads(data as unknown as Lead[]);
        setLoading(false);
      }).catch(() => setLoading(false));
    fetchCards();
  }, [user?.id]); // eslint-disable-line

  async function handleRefresh() {
    setIsRefreshing(true);
    const [{data}] = await Promise.all([supabase.from('leads').select('*').order('created_at',{ascending:false}), fetchCards()]);
    if (data) setLeads(data as unknown as Lead[]);
    setTimeout(() => setIsRefreshing(false), 600);
  }

  const filtered = useMemo(() => filterByPeriod(leads, selectedPeriod, customFrom, customTo), [leads, selectedPeriod, customFrom, customTo]);
  const totalLeads = filtered.length;
  const converted  = filtered.filter(l => Number(l.status) === 3).length;
  const cpl        = totalLeads > 0 ? TOTAL_SPEND/totalLeads : 0;
  const convRate   = totalLeads > 0 ? ((converted/totalLeads)*100).toFixed(1) : '0.0';
  const leadsChartData = useMemo(() => buildChartData(filtered, selectedPeriod, customFrom, customTo), [filtered, selectedPeriod, customFrom, customTo]);
  const funnelStages = useMemo(() => [
    { stage: STATUS_LABELS[0], value: filtered.filter(l => !l.status||Number(l.status)===0).length, color: FUNNEL_COLORS[0] },
    { stage: STATUS_LABELS[1], value: filtered.filter(l => Number(l.status)===1).length,             color: FUNNEL_COLORS[1] },
    { stage: STATUS_LABELS[2], value: filtered.filter(l => Number(l.status)===2).length,             color: FUNNEL_COLORS[2] },
    { stage: STATUS_LABELS[3], value: converted,                                                      color: FUNNEL_COLORS[3] },
  ], [filtered, converted]);

  function getGreeting() { const h=new Date().getHours(); return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'; }

  const periodLabel = selectedPeriod === 'custom' && customFrom && customTo
    ? `${new Date(customFrom).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} – ${new Date(customTo).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`
    : PERIOD_FILTERS.find(p => p.value === selectedPeriod)?.label ?? '30 dias';

  return (
    <AppLayout leadCount={leads.length}>
      <div className="p-7 space-y-6">

        {/* Hero */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 rounded-2xl p-5 shadow-lg shadow-blue-600/20">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Flame className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{getGreeting()}, {firstName}! Seus resultados em tempo real 🔥</h1>
                <p className="text-xs text-blue-100 mt-0.5">{new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(v => !v)}
                  className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  {periodLabel}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown?'rotate-180':''}`} />
                </button>
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[180px] z-50">
                    {PERIOD_FILTERS.map(f => (
                      <button key={f.value} onClick={() => selectPeriod(f.value)}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${selectedPeriod===f.value?'text-blue-600 font-semibold bg-blue-50':'text-gray-700'}`}
                      >
                        {f.value==='custom' && <Calendar className="w-3.5 h-3.5" />}
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleRefresh} className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
                <RefreshCw className={`w-4 h-4 ${isRefreshing?'animate-spin':''}`} /> Atualizar
              </button>
              <div className="flex items-center gap-1.5 ml-1">
                <button className="w-10 h-10 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center transition-all"><Search className="w-5 h-5 text-white" /></button>
                <button className="relative w-10 h-10 bg-white/15 hover:bg-white/25 rounded-xl flex items-center justify-center transition-all">
                  <Bell className="w-5 h-5 text-white" />
                  {leads.length>0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-blue-500" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Custom period picker */}
        {showCustomPicker && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <p className="text-sm font-semibold text-gray-700 mb-4">Período personalizado</p>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Data inicial</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium block mb-1">Data final</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-400 transition-colors" />
              </div>
              <div className="flex gap-2">
                <Button onClick={applyCustomPeriod} size="sm" className="rounded-xl">Aplicar</Button>
                <Button onClick={() => setShowCustomPicker(false)} variant="outline" size="sm" className="rounded-xl">Cancelar</Button>
              </div>
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label:'Gasto Total',    value:`R$ ${TOTAL_SPEND.toLocaleString('pt-BR',{minimumFractionDigits:2})}`, sub:'Valor investido',                    icon:<span className="text-blue-600 font-semibold text-sm">R$</span>, bg:'bg-blue-50' },
            { label:'Leads',          value:loading?'…':String(totalLeads),                                         sub:`Período: ${periodLabel}`,             icon:<Users className="w-4 h-4 text-emerald-600" />,                  bg:'bg-emerald-50' },
            { label:'Custo por Lead', value:loading?'…':`R$ ${cpl.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`,              sub:`Baseado em ${totalLeads} leads`,          icon:<span className="text-amber-600 font-semibold text-xs">CPL</span>,bg:'bg-amber-50' },
            { label:'Aprovados',      value:loading?'…':String(converted),                                          sub:`${convRate}% taxa de conversão`,      icon:<CheckCircle2 className="w-4 h-4 text-violet-600" />,            bg:'bg-violet-50' },
          ].map((c,i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">{c.label}</span>
                <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center`}>{c.icon}</div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs mt-1 text-gray-400">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Chart + Funnel */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-8 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-5">
              <h3 className="font-semibold text-gray-900 text-base">Leads por Dia</h3>
              <p className="text-[13px] text-gray-400">{periodLabel}</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadsChartData} margin={{top:4,right:4,left:-20,bottom:0}}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{fill:'#9ca3af',fontSize:11}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{background:'#fff',border:'none',borderRadius:'12px',fontSize:'12px',boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} formatter={v => [`${v} leads`,'Leads']} />
                  <Area type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} fill="url(#colorLeads)" dot={false} activeDot={{r:4,fill:'#3b82f6'}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="font-semibold text-gray-900 text-base mb-1">Funil de Conversão</h3>
            <p className="text-[13px] text-gray-400 mb-5">{periodLabel}</p>
            <div className="space-y-4">
              {funnelStages.map((item,i) => {
                const widths=[100,75,50,30];
                return (
                  <div key={i} className="flex flex-col items-center">
                    <div className="w-full flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">{item.stage}</span>
                      <span className="text-xs font-semibold text-gray-900">{item.value}</span>
                    </div>
                    <div className={`h-10 bg-gradient-to-r ${item.color} rounded-lg relative overflow-hidden`} style={{width:`${widths[i]}%`}}>
                      <div className="absolute inset-0 bg-white/10" />
                      {item.value>0 && <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold">{item.value}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-500">Taxa de conversão</span>
              <span className="text-2xl font-bold text-blue-600">{convRate}%</span>
            </div>
          </div>
        </div>

        {/* Leads recentes + Próximas ações */}
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-7 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900 text-base">Leads Recentes</h3>
              <Link to="/leads" className="text-blue-600 text-sm font-medium hover:underline">Ver todos</Link>
            </div>
            {cardsLoading
              ? <div className="space-y-3 py-2">{[...Array(3)].map((_,i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}</div>
              : recentLeads.length===0
                ? <p className="text-sm text-gray-400 text-center py-8">Nenhum lead ainda.</p>
                : recentLeads.map(lead => {
                    const st=Number(lead.status??0);
                    const statusLabel=STATUS_LABELS[st]??'Aguardando';
                    const sc=st===0?'bg-amber-50 text-amber-600':st===3?'bg-emerald-50 text-emerald-600':'bg-blue-50 text-blue-600';
                    return (
                      <div key={lead.id} className="flex items-center gap-4 py-3.5 border-b border-gray-50 last:border-0">
                        <Avatar className={`w-10 h-10 flex-shrink-0 ${avatarColor(lead.nome)}`}>
                          <AvatarFallback className="bg-transparent text-white font-semibold text-sm">{initials(lead.nome)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate">{lead.nome||'Lead sem nome'}</p>
                          <p className="text-xs text-gray-400 truncate">{lead.cidade||'—'}</p>
                        </div>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${sc}`}>{statusLabel}</span>
                        <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{getRelativeTime(lead.created_at)}</span>
                        <button onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`, '_blank')} className="w-8 h-8 rounded-lg hover:bg-gray-50 flex items-center justify-center transition-colors flex-shrink-0">
                          <MessageCircle className="w-4 h-4 text-gray-400 hover:text-emerald-500 transition-colors" />
                        </button>
                      </div>
                    );
                  })
            }
          </div>

          <div className="col-span-5 bg-white rounded-2xl p-6 border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="mb-5">
              <h3 className="font-semibold text-gray-900 text-base">Próximas Ações</h3>
              <p className="text-[13px] text-gray-400">Leads aguardando há mais tempo</p>
            </div>
            {cardsLoading
              ? <div className="space-y-3 py-2">{[...Array(3)].map((_,i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
              : proximasAcoes.length===0
                ? <p className="text-sm text-gray-400 text-center py-8">Nenhum lead aguardando.</p>
                : proximasAcoes.map(lead => (
                    <div key={lead.id} className="flex items-center gap-3 py-4 border-b border-gray-50 last:border-0">
                      <Avatar className={`w-10 h-10 flex-shrink-0 ${avatarColor(lead.nome)}`}>
                        <AvatarFallback className="bg-transparent text-white font-semibold text-sm">{initials(lead.nome)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{lead.nome||'Lead sem nome'}</p>
                        <p className="text-xs text-gray-400 truncate">{lead.cidade||'—'}</p>
                      </div>
                      <div className="text-right mr-1 flex-shrink-0">
                        <p className="text-xs text-red-500 font-medium">Esperando</p>
                        <p className="text-xs text-gray-400">{formatDDMM(lead.created_at)}</p>
                      </div>
                      <button onClick={() => window.open(`https://wa.me/${lead.whatsapp?.replace(/\D/g,'')}`, '_blank')} className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white transition-colors flex-shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))
            }
            <Link to="/kanban">
              <Button variant="outline" className="w-full mt-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50">
                Ver todos os pendentes
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
