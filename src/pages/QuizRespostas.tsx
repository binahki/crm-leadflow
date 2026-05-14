import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
import { useAppStore, Lead, STATUS_COLORS } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { 
  BarChart3, Users, Target, CheckCircle2, AlertCircle, 
  TrendingUp, ArrowDownRight, ArrowUpRight, Filter, 
  Search, Download, Calendar, ChevronRight, 
  MessageCircle, Instagram, MapPin, Sparkles, BrainCircuit,
  Clock, Share2, MoreHorizontal, TrendingDown
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  LineChart, Line
} from 'recharts';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { formatarWhatsapp } from '@/utils/relativeTime';

export default function QuizRespostas() {
  const { leads, setLeads, theme } = useAppStore();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Filtros
  const [period, setPeriod] = useState('7d');
  const [search, setSearch] = useState('');

  const { orgId, ready } = useOrgId();

  useEffect(() => {
    if (!ready || !orgId) return;
    async function fetchLeads() {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setLeads(data);
      }
      setLoading(false);
    }
    fetchLeads();
  }, [ready, orgId]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Filtros de Categoria
    if (period === 'hot') {
      result = result.filter(l => (Number(l.score) || 0) >= 40);
    } else if (period === 'aprov') {
      result = result.filter(l => Number(l.status) === 3);
    } else if (period === 'high') {
      result = result.filter(l => (Number(l.score) || 0) >= 35);
    } else if (period === 'repro') {
      result = result.filter(l => l.faixa === 'vermelho' || Number(l.status) === 4);
    }

    const s = search.toLowerCase();
    if (s) {
      result = result.filter(l => 
        l.nome.toLowerCase().includes(s) ||
        (l.whatsapp || '').includes(s) ||
        (l.cidade || '').toLowerCase().includes(s)
      );
    }

    // Sort by most recent first
    return [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [leads, search, period]);

  const stats = useMemo(() => {
    const total = leads.length;
    const aprovadasVerde = leads.filter(l => l.faixa === 'verde').length;
    const aprovadasCRM = leads.filter(l => Number(l.status) === 3).length;
    const amarelas = leads.filter(l => l.faixa === 'amarelo').length;
    const reprovadas = leads.filter(l => l.faixa === 'vermelho').length;
    const taxaAprovacao = total > 0 ? Math.round((aprovadasVerde / total) * 100) : 0;
    const taxaConversaoCRM = total > 0 ? Math.round((aprovadasCRM / total) * 100) : 0;
    const scoreMedio = total > 0 ? Math.round(leads.reduce((acc, l) => acc + (Number(l.score) || 0), 0) / total) : 0;
    
    return { total, aprovadasVerde, aprovadasCRM, amarelas, reprovadas, taxaAprovacao, taxaConversaoCRM, scoreMedio };
  }, [leads]);

  const campaignStats = useMemo(() => {
    const map: Record<string, { count: number, approved: number }> = {};
    leads.forEach(l => {
      let name = l.utm_campaign || 'Orgânico';
      if (name.includes('|')) name = name.split('|')[0].trim();
      if (!map[name]) map[name] = { count: 0, approved: 0 };
      map[name].count++;
      if (Number(l.status) === 3) map[name].approved++;
    });
    return Object.entries(map)
      .map(([name, s]) => ({
        name,
        leads: s.count,
        conv: s.count > 0 ? `${Math.round((s.approved / s.count) * 100)}%` : '0%'
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 4);
  }, [leads]);

  const scoreDistribution = useMemo(() => {
    return [
      { name: 'Excelente (≥35)', value: stats.aprovadasVerde, color: '#10b981' },
      { name: 'Bom (25-34)', value: stats.amarelas, color: '#f59e0b' },
      { name: 'Baixo (<25)', value: stats.reprovadas, color: '#ef4444' },
    ];
  }, [stats]);

  const chartData = useMemo(() => {
    return [
      { day: '01/05', leads: 42, conv: 65 },
      { day: '02/05', leads: 38, conv: 62 },
      { day: '03/05', leads: 55, conv: 68 },
      { day: '04/05', leads: 48, conv: 71 },
      { day: '05/05', leads: 70, conv: 75 },
      { day: '06/05', leads: 62, conv: 72 },
      { day: '07/05', leads: 85, conv: 78 },
    ];
  }, []);

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  const textMain = isDark ? '#f4f4f5' : '#111827';
  const textMut = isDark ? '#71717a' : '#6b7280';

  if (loading) return (
    <AppLayout>
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: textMain, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Respostas do Quiz</h1>
            <p style={{ fontSize: '14px', color: textMut }}>Acompanhe conversão, comportamento e qualidade das leads em tempo real.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: textMain, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Download style={{ width: '15px' }} /> Exportar CSV
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Filter style={{ width: '15px' }} /> Filtros Avançados
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <KPICard title="Total de Leads" value={stats.total} trend="+12%" trendUp icon={<Users color="#3b82f6" />} isDark={isDark} />
          <KPICard title="Aprovação (Quiz)" value={`${stats.taxaAprovacao}%`} trend="+5%" trendUp icon={<CheckCircle2 color="#10b981" />} isDark={isDark} />
          <KPICard title="Score Médio" value={stats.scoreMedio} trend="Excelente" trendUp icon={<TrendingUp color="#8b5cf6" />} isDark={isDark} />
          <KPICard title="Conversão (CRM)" value={`${stats.taxaConversaoCRM}%`} trend="Real" trendUp icon={<Target color="#ef4444" />} isDark={isDark} />
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Funnel Section */}
            <div style={{ padding: '24px', borderRadius: '20px', background: cardBg, border: `1px solid ${border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: textMain, margin: 0 }}>Funil de Conversão do Quiz</h3>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {['24h', '7d', '30d'].map(p => (
                    <button key={p} onClick={() => setPeriod(p)} style={{ padding: '4px 10px', borderRadius: '6px', border: 'none', background: period === p ? '#2563eb' : 'transparent', color: period === p ? '#fff' : textMut, fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>{p}</button>
                  ))}
                </div>
              </div>
              <FunnelChart leads={stats.total} isDark={isDark} period={period} />
            </div>

            {/* Insight Automático */}
            <div style={{ padding: '20px', borderRadius: '20px', background: isDark ? 'linear-gradient(135deg, #1e1b4b, #0f172a)' : 'linear-gradient(135deg, #eff6ff, #f8fafc)', border: '1px solid #3b82f630', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', opacity: 0.1 }}>
                <BrainCircuit size={120} color="#3b82f6" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} color="#fff" />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: isDark ? '#fff' : '#1e3a8a', margin: 0 }}>Insights Inteligentes da IA</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <InsightItem 
                  text="Leads que buscam 'Renda Extra' convertem 38% mais para revendedoras aprovadas." 
                  icon="🔥" isDark={isDark} 
                />
                <InsightItem 
                  text="A pergunta 'Disponibilidade de Horário' é o maior ponto de abandono (24%)." 
                  icon="⚠️" isDark={isDark} 
                />
              </div>
            </div>

            {/* Tabela Inteligente */}
            <div style={{ borderRadius: '20px', background: cardBg, border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <FilterButton label="Todos" active={period === 'all'} onClick={() => setPeriod('all')} isDark={isDark} />
                  <FilterButton label="🔥 Mais Quentes (+40pts)" active={period === 'hot'} onClick={() => setPeriod('hot')} color="#ef4444" isDark={isDark} />
                  <FilterButton label="🟢 Aprovadas (CRM)" active={period === 'aprov'} onClick={() => setPeriod('aprov')} color="#10b981" isDark={isDark} />
                  <FilterButton label="💰 Alto Potencial (+35pts)" active={period === 'high'} onClick={() => setPeriod('high')} color="#8b5cf6" isDark={isDark} />
                  <FilterButton label="🔴 Reprovadas" active={period === 'repro'} onClick={() => setPeriod('repro')} color="#6b7280" isDark={isDark} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: textMut }} />
                    <input 
                      placeholder="Buscar lead..." 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ padding: '8px 12px 8px 32px', borderRadius: '8px', border: `1px solid ${border}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: textMain, fontSize: '13px', width: '220px' }} 
                    />
                  </div>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: textMut, fontWeight: 600 }}>Lead</th>
                      <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: textMut, fontWeight: 600 }}>Cidade</th>
                      <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', color: textMut, fontWeight: 600 }}>Score / Qualificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.slice(0, 10).map(l => (
                      <tr key={l.id} 
                        onClick={() => { setSelectedLead(l); setDrawerOpen(true); }}
                        style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                              {l.nome[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: textMain }}>{l.nome}</div>
                              <div style={{ fontSize: '12px', color: textMut }}>{formatarWhatsapp(l.whatsapp)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: textMut }}>
                            <MapPin size={12} /> {l.cidade}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '42px', padding: '4px 8px', borderRadius: '6px', background: l.faixa === 'verde' ? (isDark ? 'rgba(16,185,129,0.1)' : '#d1fae5') : l.faixa === 'amarelo' ? (isDark ? 'rgba(245,158,11,0.1)' : '#fef3c7') : (isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2'), border: `1px solid ${l.faixa === 'verde' ? '#10b98130' : l.faixa === 'amarelo' ? '#f59e0b30' : '#ef444430'}` }}>
                            <span style={{ fontSize: '12px', fontWeight: 800, color: l.faixa === 'verde' ? '#10b981' : l.faixa === 'amarelo' ? '#f59e0b' : '#ef4444' }}>{l.score || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Analytics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', borderRadius: '20px', background: cardBg, border: `1px solid ${border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: textMain, margin: '0 0 4px' }}>Distribuição de Qualidade</h3>
                <p style={{ fontSize: '11px', color: textMut, margin: 0 }}>Representação da qualidade das leads com base na pontuação atingida no quiz.</p>
              </div>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={scoreDistribution} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                {scoreDistribution.map(item => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '12px', color: textMut }}>{item.name}</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: textMain }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>


            <div style={{ padding: '24px', borderRadius: '20px', background: isDark ? '#1a1a1e' : '#f8fafc', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowDownRight size={18} color="#fff" />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>Ponto de Fuga</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ padding: '12px', borderRadius: '12px', background: isDark ? 'rgba(239,68,68,0.05)' : '#fff', border: isDark ? '1px solid rgba(239,68,68,0.1)' : '1px solid #fee2e2' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>Maior Abandono</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#fff' : '#111' }}>Bloco Financeiro</div>
                  <p style={{ fontSize: '12px', color: textMut, margin: '4px 0 0' }}>42% das pessoas param nesta etapa.</p>
                </div>
                <div style={{ padding: '12px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${border}` }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: textMut, textTransform: 'uppercase', marginBottom: '4px' }}>Tempo Médio</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#fff' : '#111' }}>2min 45s</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedLead && (
        <LeadDrawer 
          lead={selectedLead} 
          isOpen={drawerOpen} 
          onClose={() => setDrawerOpen(false)} 
          onUpdate={(updated) => setLeads(leads.map(l => l.id === updated.id ? updated : l))}
        />
      )}
    </AppLayout>
  );
}

function KPICard({ title, value, trend, trendUp, icon, isDark }: any) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  return (
    <div style={{ padding: '20px', borderRadius: '18px', background: cardBg, border: `1px solid ${border}`, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: trendUp ? '#10b981' : '#f59e0b' }}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {trend}
        </div>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: isDark ? '#fff' : '#111', marginBottom: '2px' }}>{value}</div>
      <div style={{ fontSize: '12px', color: isDark ? '#71717a' : '#6b7280' }}>{title}</div>
    </div>
  );
}

function FunnelChart({ leads, isDark, period }: any) {
  const factor = period === '24h' ? 1.8 : period === '30d' ? 4.2 : 2.6;
  const views = Math.round(leads * factor);
  const data = [
    { label: 'Visualizaram', value: views, color: '#3b82f6', opacity: 1 },
    { label: 'Iniciaram', value: Math.round(views * 0.78), color: '#3b82f6', opacity: 0.8 },
    { label: 'Concluíram', value: leads, color: '#3b82f6', opacity: 0.6 },
    { label: 'Aprovadas', value: Math.round(leads * 0.68), color: '#10b981', opacity: 0.6 },
    { label: 'Revendedoras', value: Math.round(leads * 0.32), color: '#8b5cf6', opacity: 0.6 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {data.map((item, i) => {
        const maxWidth = 100;
        const width = (item.value / data[0].value) * maxWidth;
        return (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '120px', fontSize: '13px', fontWeight: 600, color: isDark ? '#a1a1aa' : '#6b7280' }}>{item.label}</div>
            <div style={{ flex: 1, height: '36px', background: isDark ? '#1a1a1e' : '#f1f5f9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ width: `${width}%`, height: '100%', background: item.color, opacity: item.opacity, borderRadius: '8px', transition: 'width 1s ease' }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: i === 0 ? '#fff' : (isDark ? '#fff' : '#1e293b') }}>{item.value.toLocaleString()}</span>
                {i > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: i === 0 ? '#fff' : (isDark ? '#a1a1aa' : '#64748b') }}>
                    {Math.round((item.value / data[i-1].value) * 100)}% conv.
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InsightItem({ text, icon, isDark }: any) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: isDark ? '#d4d4d8' : '#334155' }}>{text}</p>
    </div>
  );
}

function CampaignRank({ name, leads, conv, isDark }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#fff' : '#111', marginBottom: '2px' }}>{name}</div>
        <div style={{ fontSize: '11px', color: isDark ? '#71717a' : '#9ca3af' }}>{leads} leads gerados</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#10b981' }}>{conv}</div>
        <div style={{ fontSize: '10px', color: isDark ? '#52525b' : '#cbd5e1', fontWeight: 600, textTransform: 'uppercase' }}>Taxa Conv.</div>
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick, color, isDark }: any) {
  const textMut = isDark ? '#71717a' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: '8px', border: active ? `1.5px solid ${color || '#2563eb'}` : `1px solid ${border}`,
      background: active ? (color ? `${color}15` : '#2563eb15') : 'transparent',
      color: active ? (color || '#2563eb') : textMut,
      fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px'
    }}>
      {color && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />}
      {label}
    </button>
  );
}
