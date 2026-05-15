import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useOrgId } from '@/hooks/useOrgId';
import { useAppStore, Lead } from '@/stores/appStore';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, Target, CheckCircle2, 
  TrendingUp, ArrowDownRight, ArrowUpRight, Filter, 
  Search, Download, MapPin, Sparkles, BrainCircuit,
  Clock, RefreshCw, Zap
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { LeadDrawer } from '@/components/ui/lead-drawer';
import { formatarWhatsapp } from '@/utils/relativeTime';

export default function QuizRespostas() {
  const { leads, setLeads, theme } = useAppStore();
  const isDark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Filtros
  const [period, setPeriod] = useState('7d');
  const [search, setSearch] = useState('');

  const { orgId, ready } = useOrgId();

  const fetchData = async () => {
    if (!orgId) return;
    
    // 1. Get leads
    const { data: lData } = await supabase
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (lData) setLeads(lData);

    // 2. Get sessions
    const { data: sData } = await supabase
      .from('quiz_sessoes')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });
    
    if (sData) setSessoes(sData);
    setLoading(false);
  };

  useEffect(() => {
    if (!ready || !orgId) return;
    fetchData();

    const channel = supabase
      .channel('quiz-respostas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessoes', filter: `org_id=eq.${orgId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `org_id=eq.${orgId}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ready, orgId]);

  const stats = useMemo(() => {
    const totalVisitas = sessoes.length;
    const iniciaram = sessoes.filter(s => s.ultima_etapa > 0).length;
    const concluiram = sessoes.filter(s => s.concluiu).length;
    const aprovadasVerde = leads.filter(l => l.faixa === 'verde').length;
    const revendedoras = leads.filter(l => Number(l.status) === 3).length;
    
    const taxaAprovacao = iniciaram > 0 ? Math.round((aprovadasVerde / iniciaram) * 100) : 0;
    const scoreMedio = leads.length > 0 ? Math.round(leads.reduce((acc, l) => acc + (Number(l.score) || 0), 0) / leads.length) : 0;
    
    return { totalVisitas, iniciaram, concluiram, aprovadasVerde, revendedoras, taxaAprovacao, scoreMedio };
  }, [sessoes, leads]);

  const funnelData = useMemo(() => {
    return [
      { label: 'Visualizaram', value: stats.totalVisitas, color: '#3b82f6', opacity: 1 },
      { label: 'Iniciaram', value: stats.iniciaram, color: '#3b82f6', opacity: 0.8 },
      { label: 'Concluíram', value: stats.concluiram, color: '#3b82f6', opacity: 0.6 },
      { label: 'Aprovadas', value: stats.aprovadasVerde, color: '#10b981', opacity: 0.6 },
      { label: 'Revendedoras', value: stats.revendedoras, color: '#8b5cf6', opacity: 0.6 },
    ];
  }, [stats]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(l => l.nome.toLowerCase().includes(s) || (l.whatsapp || '').includes(s));
    }
    return result;
  }, [leads, search]);

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  const textMain = isDark ? '#f4f4f5' : '#111827';
  const textMut = isDark ? '#71717a' : '#6b7280';

  if (loading) return (
    <AppLayout>
      <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: textMut }}>
        <RefreshCw size={24} className="animate-spin" />
        <p style={{ marginTop: '12px', fontWeight: 600 }}>Carregando métricas reais...</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: textMain, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Respostas do Quiz</h1>
            <p style={{ fontSize: '14px', color: textMut }}>Dados reais sincronizados via quiz_sessoes.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: textMain, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              <Download size={15} /> Exportar
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          <KPICard title="Visualizaram" value={stats.totalVisitas} trend="Real" icon={<Users color="#3b82f6" />} isDark={isDark} />
          <KPICard title="Iniciaram" value={stats.iniciaram} trend={`${Math.round((stats.iniciaram/stats.totalVisitas)*100 || 0)}%`} icon={<Zap size={16} color="#f59e0b" />} isDark={isDark} />
          <KPICard title="Concluíram" value={stats.concluiram} trend={`${Math.round((stats.concluiram/stats.iniciaram)*100 || 0)}%`} icon={<CheckCircle2 color="#10b981" />} isDark={isDark} />
          <KPICard title="Revendedoras" value={stats.revendedoras} trend="CRM" icon={<Target color="#8b5cf6" />} isDark={isDark} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', borderRadius: '20px', background: cardBg, border: `1px solid ${border}` }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: textMain, marginBottom: '24px' }}>Funil de Conversão Real</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {funnelData.map((item, i) => {
                  const width = stats.totalVisitas > 0 ? (item.value / stats.totalVisitas) * 100 : 0;
                  return (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '120px', fontSize: '13px', color: textMut }}>{item.label}</div>
                      <div style={{ flex: 1, height: '36px', background: isDark ? '#1a1a1e' : '#f1f5f9', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ width: `${width}%`, height: '100%', background: item.color, opacity: item.opacity, transition: 'width 1s ease' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 12px', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: i === 0 ? '#fff' : (isDark ? '#fff' : '#1e293b') }}>{item.value}</span>
                          {i > 0 && funnelData[i-1].value > 0 && (
                            <span style={{ fontSize: '11px', color: textMut }}>{Math.round((item.value/funnelData[i-1].value)*100)}% conv.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabela de Leads */}
            <div style={{ borderRadius: '20px', background: cardBg, border: `1px solid ${border}`, overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: textMain }}>Últimas Leads Geradas</h3>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: textMut }} />
                  <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '6px 12px 6px 32px', borderRadius: '8px', border: `1px solid ${border}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: textMain, fontSize: '13px' }} />
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: isDark ? '#1a1a1e' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                    <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: textMut }}>Lead</th>
                    <th style={{ textAlign: 'left', padding: '12px 20px', fontSize: '12px', color: textMut }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '12px 20px', fontSize: '12px', color: textMut }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.slice(0, 10).map(l => (
                    <tr key={l.id} onClick={() => { setSelectedLead(l); setDrawerOpen(true); }} style={{ borderBottom: `1px solid ${border}`, cursor: 'pointer' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: textMain }}>{l.nome}</div>
                        <div style={{ fontSize: '12px', color: textMut }}>{formatarWhatsapp(l.whatsapp)}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ fontSize: '12px', color: l.status === 3 ? '#10b981' : textMut }}>{l.status === 3 ? 'Aprovada' : 'Pendente'}</span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', background: `${l.faixa === 'verde' ? '#10b981' : '#f59e0b'}15`, color: l.faixa === 'verde' ? '#10b981' : '#f59e0b', fontWeight: 800 }}>{l.score || 0}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ padding: '24px', borderRadius: '20px', background: cardBg, border: `1px solid ${border}` }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: textMain, marginBottom: '20px' }}>Insights IA (Real)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <InsightItem text={`Score médio de ${stats.scoreMedio} pontos detectado.`} icon="📊" isDark={isDark} />
                <InsightItem text={`${stats.taxaAprovacao}% dos usuários que iniciam são qualificados.`} icon="✅" isDark={isDark} />
              </div>
            </div>
            
            <div style={{ padding: '24px', borderRadius: '20px', background: isDark ? '#1a1a1e' : '#f8fafc', border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <BrainCircuit size={18} color="#2563eb" />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: textMain, margin: 0 }}>Análise de Dispositivos</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['mobile', 'desktop', 'tablet'].map(d => {
                  const count = sessoes.filter(s => s.dispositivo === d).length;
                  const pct = sessoes.length > 0 ? Math.round((count / sessoes.length) * 100) : 0;
                  return (
                    <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: textMut, textTransform: 'capitalize' }}>{d}</span>
                      <span style={{ fontWeight: 700, color: textMain }}>{pct}%</span>
                    </div>
                  );
                })}
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
          onUpdate={fetchData}
        />
      )}
    </AppLayout>
  );
}

function KPICard({ title, value, trend, icon, isDark }: any) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  return (
    <div style={{ padding: '20px', borderRadius: '18px', background: cardBg, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: isDark ? '#1e1e24' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>{trend}</div>
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: isDark ? '#fff' : '#111' }}>{value}</div>
      <div style={{ fontSize: '12px', color: isDark ? '#71717a' : '#6b7280' }}>{title}</div>
    </div>
  );
}

function InsightItem({ text, icon, isDark }: any) {
  return (
    <div style={{ padding: '12px', borderRadius: '12px', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
      <span>{icon}</span>
      <p style={{ margin: 0, fontSize: '12px', color: isDark ? '#d4d4d8' : '#334155', lineHeight: 1.4 }}>{text}</p>
    </div>
  );
}
