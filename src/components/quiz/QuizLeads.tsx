import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, TrendingUp, Search, Clock, ChevronRight,
  CheckCircle2, RefreshCw, HelpCircle, Zap,
  Smartphone, Monitor, Tablet, ArrowUpRight,
  ChevronDown, ExternalLink, Filter, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuizLeadsProps {
  quizId: string;
  isDark: boolean;
  theme: 'light' | 'dark';
}

export function QuizLeads({ quizId, isDark, theme }: QuizLeadsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<any>(null);
  const [sessoes, setSessoes] = useState<any[]>([]);
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [opcoes, setOpcoes] = useState<any[]>([]);

  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('7d');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const textMain = isDark ? '#f4f4f5' : '#111827';
  const textMut = isDark ? '#71717a' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  const pageBg = isDark ? '#0d0d0f' : '#f8fafc';

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: qData } = await supabase.from('quizzes').select('slug, id, org_id').eq('id', quizId).single();
      if (!qData) return;
      setQuiz(qData);

      const [pData, sData] = await Promise.all([
        supabase.from('quiz_perguntas').select('*').eq('quiz_id', quizId).order('ordem'),
        supabase.from('quiz_sessoes').select('*').eq('quiz_slug', qData.slug).order('updated_at', { ascending: false }),
      ]);

      if (pData.data) {
        setPerguntas(pData.data);
        const pergIds = pData.data.map(p => p.id);
        const { data: oData } = await supabase.from('quiz_opcoes').select('*').in('pergunta_id', pergIds);
        if (oData) setOpcoes(oData);
      }
      
      if (sData.data) setSessoes(sData.data);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`quiz-sessoes-full-${quizId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessoes' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [quizId]);

  // Score Calculation Map
  const scoreMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    perguntas.forEach(p => {
      const pText = p.texto.trim();
      map[pText] = {};
      opcoes.filter(o => o.pergunta_id === p.id).forEach(o => {
        map[pText][o.texto.trim()] = o.pontos || 0;
      });
    });
    return map;
  }, [perguntas, opcoes]);

  const calculateSessionScore = (respostas: any) => {
    if (!respostas || typeof respostas !== 'object') return 0;
    let total = 0;
    Object.entries(respostas).forEach(([pText, oText]) => {
      const points = scoreMap[pText.trim()]?.[String(oText).trim()];
      if (points) total += points;
    });
    return total;
  };

  const filteredSessoes = useMemo(() => {
    let result = sessoes;

    // Period Filter
    const now = new Date();
    if (period === 'today') {
      result = result.filter(s => new Date(s.created_at).toDateString() === now.toDateString());
    } else if (period === '7d') {
      const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
      result = result.filter(s => new Date(s.created_at) >= sevenDaysAgo);
    } else if (period === '30d') {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      result = result.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
    }

    // Status Filter
    if (statusFilter === 'abandon') {
      result = result.filter(s => !s.concluiu);
    } else if (statusFilter === 'concluiu') {
      result = result.filter(s => s.concluiu && !s.virou_lead);
    } else if (statusFilter === 'lead') {
      result = result.filter(s => s.virou_lead);
    }

    // Device Filter
    if (deviceFilter !== 'all') {
      result = result.filter(s => s.dispositivo === deviceFilter);
    }

    // Search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(sess => 
        sess.session_id.toLowerCase().includes(s) ||
        (sess.utm_source || '').toLowerCase().includes(s) ||
        Object.values(sess.respostas || {}).some(v => String(v).toLowerCase().includes(s))
      );
    }

    return result;
  }, [sessoes, period, statusFilter, deviceFilter, search]);

  const stats = useMemo(() => {
    const total = filteredSessoes.length;
    const iniciaram = filteredSessoes.filter(s => s.ultima_etapa > 0).length;
    const convertidos = filteredSessoes.filter(s => s.virou_lead).length;
    const concluidos = filteredSessoes.filter(s => s.concluiu).length;
    const abandonaram = total - concluidos;
    
    const taxaConv = total > 0 ? Math.round((convertidos / total) * 100) : 0;
    const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    
    return { total, iniciaram, convertidos, abandonaram, taxaConv, taxaConclusao };
  }, [filteredSessoes]);

  if (loading && sessoes.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: textMut }}>
      <RefreshCw size={24} className="animate-spin" />
      <span style={{ marginLeft: '12px', fontWeight: 600 }}>Carregando sessões...</span>
    </div>
  );

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: pageBg, color: textMain }}>
      
      {/* KPI Cards */}
      <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '16px', flexShrink: 0 }}>
        <KPICard label="Visitas" value={stats.total} icon={<Users size={14} />} color="#3b82f6" isDark={isDark} />
        <KPICard label="Iniciaram" value={stats.iniciaram} icon={<Zap size={14} />} color="#f59e0b" isDark={isDark} />
        <KPICard label="Abandonaram" value={stats.abandonaram} icon={<TrendingDown size={14} />} color="#ef4444" isDark={isDark} />
        <KPICard label="Concluíram" value={stats.total - stats.abandonaram} icon={<CheckCircle2 size={14} />} color="#10b981" isDark={isDark} />
        <KPICard label="Convertidos" value={stats.convertidos} icon={<ArrowUpRight size={14} />} color="#8b5cf6" isDark={isDark} />
        <KPICard label="Conversão" value={`${stats.taxaConv}%`} icon={<TrendingUp size={14} />} color="#6366f1" isDark={isDark} />
      </div>

      {/* Header & Filters */}
      <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FilterPill label="Hoje" active={period === 'today'} onClick={() => setPeriod('today')} isDark={isDark} />
            <FilterPill label="7 dias" active={period === '7d'} onClick={() => setPeriod('7d')} isDark={isDark} />
            <FilterPill label="30 dias" active={period === '30d'} onClick={() => setPeriod('30d')} isDark={isDark} />
            <div style={{ width: '1px', background: border, margin: '0 8px' }} />
            <FilterPill label="Todos" active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} isDark={isDark} />
            <FilterPill label="Abandonou" active={statusFilter === 'abandon'} onClick={() => setStatusFilter('abandon')} color="#ef4444" isDark={isDark} />
            <FilterPill label="Concluiu" active={statusFilter === 'concluiu'} onClick={() => setStatusFilter('concluiu')} color="#3b82f6" isDark={isDark} />
            <FilterPill label="Lead" active={statusFilter === 'lead'} onClick={() => setStatusFilter('lead')} color="#10b981" isDark={isDark} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '11px', color: textMut, fontWeight: 600 }}>
              Atualizado em: {lastUpdated.toLocaleTimeString()}
            </div>
            <button 
              onClick={fetchData}
              style={{ padding: '8px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <FilterPill icon={<Monitor size={14} />} label="Desktop" active={deviceFilter === 'desktop'} onClick={() => setDeviceFilter('desktop')} isDark={isDark} />
            <FilterPill icon={<Smartphone size={14} />} label="Mobile" active={deviceFilter === 'mobile'} onClick={() => setDeviceFilter('mobile')} isDark={isDark} />
            <FilterPill icon={<Tablet size={14} />} label="Tablet" active={deviceFilter === 'tablet'} onClick={() => setDeviceFilter('tablet')} isDark={isDark} />
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: textMut }} />
            <input 
              placeholder="Buscar por sessão, UTM ou resposta..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 12px 8px 32px', borderRadius: '10px', border: `1px solid ${border}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: textMain, fontSize: '13px', width: '320px' }} 
            />
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb', borderBottom: `1px solid ${border}` }}>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: textMut, width: '40px' }}>#</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: textMut }}>Sessão</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: textMut }}>Entrada</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: textMut }}>Disp.</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: textMut }}>Progresso</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: textMut }}>Última Resposta</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: textMut }}>Pts</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: textMut }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: textMut }}>UTM</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessoes.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: textMut }}>
                    Nenhuma sessão encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredSessoes.map((sess, idx) => (
                  <SessionRow
                    key={sess.id}
                    index={filteredSessoes.length - idx}
                    session={sess}
                    isDark={isDark}
                    isExpanded={expandedSessionId === sess.id}
                    onToggle={() => setExpandedSessionId(expandedSessionId === sess.id ? null : sess.id)}
                    onViewLead={(leadId: string | number) => navigate(`/leads?id=${leadId}`)}
                    calculateScore={calculateSessionScore}
                    totalPerguntas={perguntas.length}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function SessionRow({ index, session, isDark, isExpanded, onToggle, onViewLead, calculateScore, totalPerguntas }: any) {
  const textMain = isDark ? '#f4f4f5' : '#111827';
  const textMut = isDark ? '#71717a' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const score = calculateScore(session.respostas);
  // Usa total_etapas da sessão; se for 0, usa totalPerguntas do banco como fallback
  const effectiveTotal = session.total_etapas > 0 ? session.total_etapas : (totalPerguntas || 0);
  const progressPct = effectiveTotal > 0 ? Math.round((session.ultima_etapa / effectiveTotal) * 100) : 0;
  
  const lastAnswer = useMemo(() => {
    if (!session.respostas) return '—';
    const entries = Object.entries(session.respostas);
    if (entries.length === 0) return '—';
    return String(entries[entries.length - 1][1]);
  }, [session.respostas]);

  const statusInfo = useMemo(() => {
    if (session.virou_lead) return { label: 'Virou Lead', color: '#10b981', bg: '#10b98115' };
    if (session.concluiu) return { label: 'Concluiu', color: '#3b82f6', bg: '#3b82f615' };
    return { label: 'Abandonou', color: '#ef4444', bg: '#ef444415' };
  }, [session]);

  const deviceIcon = useMemo(() => {
    if (session.dispositivo === 'mobile') return <Smartphone size={14} />;
    if (session.dispositivo === 'tablet') return <Tablet size={14} />;
    return <Monitor size={14} />;
  }, [session.dispositivo]);

  return (
    <>
      <tr 
        onClick={onToggle}
        style={{ 
          background: index % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc'),
          borderBottom: `1px solid ${border}`,
          cursor: 'pointer',
          transition: 'background 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc')}
      >
        <td style={{ padding: '14px 16px', textAlign: 'center', color: textMut, fontSize: '11px' }}>{index}</td>
        <td style={{ padding: '14px 16px', fontWeight: 700, color: textMain, fontFamily: 'monospace' }}>
          {session.session_id.substring(0, 8)}
        </td>
        <td style={{ padding: '14px 16px', color: textMut }}>
          {new Date(session.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </td>
        <td style={{ padding: '14px 16px', textAlign: 'center', color: textMut }}>
          {deviceIcon}
        </td>
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600 }}>{session.ultima_etapa}/{effectiveTotal || '?'}</div>
            <div style={{ width: '80px', height: '4px', background: border, borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: statusInfo.color }} />
            </div>
          </div>
        </td>
        <td style={{ padding: '14px 16px', color: textMain, maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {lastAnswer}
        </td>
        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: score > 0 ? '#8b5cf6' : textMut }}>
          {score || '—'}
        </td>
        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ padding: '4px 8px', borderRadius: '6px', background: statusInfo.bg, color: statusInfo.color, fontSize: '10px', fontWeight: 800, display: 'inline-block' }}>
            {statusInfo.label}
          </div>
        </td>
        <td style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ color: textMut, fontSize: '11px' }}>{session.utm_source || 'Direto'}</span>
            {session.virou_lead && (
              <button 
                onClick={(e) => { e.stopPropagation(); onViewLead(session.lead_id); }}
                style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${statusInfo.color}40`, background: 'transparent', color: statusInfo.color, fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Lead <ExternalLink size={10} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} style={{ padding: '0', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9fafb' }}>
            <div style={{ padding: '20px 48px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: `1px solid ${border}` }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: textMain, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <MessageSquare size={14} /> Detalhes das Respostas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {session.respostas && Object.keys(session.respostas).length > 0 ? (
                  Object.entries(session.respostas).map(([perg, resp]: any) => (
                    <div key={perg} style={{ padding: '10px', borderRadius: '8px', background: isDark ? 'rgba(255,255,255,0.03)' : '#fff', border: `1px solid ${border}` }}>
                      <div style={{ fontSize: '11px', color: textMut, marginBottom: '2px' }}>{perg}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: textMain }}>{String(resp)}</div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: textMut, fontSize: '12px' }}>Nenhuma resposta registrada.</div>
                )}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '20px', fontSize: '11px', color: textMut }}>
                <span><b>Navegador:</b> {session.user_agent?.substring(0, 50)}...</span>
                <span><b>Campanha:</b> {session.utm_campaign || 'N/A'}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function KPICard({ label, value, icon, color, isDark }: any) {
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  return (
    <div style={{ padding: '16px', borderRadius: '16px', background: cardBg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}15`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '20px', fontWeight: 800, color: isDark ? '#fff' : '#111' }}>{value}</div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: isDark ? '#71717a' : '#64748b', textTransform: 'uppercase' }}>{label}</div>
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick, color, icon, isDark }: any) {
  const textMut = isDark ? '#71717a' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  return (
    <button 
      onClick={onClick}
      style={{
        padding: '6px 12px', borderRadius: '8px', border: active ? `1.5px solid ${color || '#2563eb'}` : `1px solid ${border}`,
        background: active ? (color ? `${color}15` : '#2563eb15') : 'transparent',
        color: active ? (color || '#2563eb') : textMut,
        fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px'
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function TrendingDown({ size, color }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  );
}

function MessageSquare({ size, color }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
