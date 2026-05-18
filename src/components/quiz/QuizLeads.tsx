import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, TrendingUp, Search,
  CheckCircle2, RefreshCw, Zap,
  Smartphone, Monitor, Tablet, ArrowUpRight,
  ExternalLink, Filter, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuizLeadsProps {
  quizId: string;
  isDark: boolean;
  theme: 'light' | 'dark';
}

export function QuizLeads({ quizId, isDark }: QuizLeadsProps) {
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
  const [showFilters, setShowFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const textMain = isDark ? '#f4f4f5' : '#111827';
  const textMut = isDark ? '#71717a' : '#6b7280';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const cardBg = isDark ? '#141416' : '#ffffff';
  const pageBg = isDark ? '#0d0d0f' : '#f8fafc';
  const headBg = isDark ? 'rgba(255,255,255,0.02)' : '#f9fafb';

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
        const pergIds = pData.data.map((p: any) => p.id);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessoes' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [quizId]);

  const scoreMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    perguntas.forEach((p: any) => {
      const pText = p.texto.trim();
      map[pText] = {};
      opcoes.filter((o: any) => o.pergunta_id === p.id).forEach((o: any) => {
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

  const perguntasOrdenadas = useMemo(() => {
    return [...perguntas].sort((a: any, b: any) => a.ordem - b.ordem);
  }, [perguntas]);

  const filteredSessoes = useMemo(() => {
    let result = sessoes;
    const now = new Date();
    if (period === 'today') {
      result = result.filter(s => new Date(s.created_at).toDateString() === now.toDateString());
    } else if (period === '7d') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7);
      result = result.filter(s => new Date(s.created_at) >= cutoff);
    } else if (period === '30d') {
      const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30);
      result = result.filter(s => new Date(s.created_at) >= cutoff);
    }
    if (statusFilter === 'abandon') result = result.filter(s => !s.concluiu);
    else if (statusFilter === 'reprovada') result = result.filter(s => s.concluiu && !s.virou_lead);
    else if (statusFilter === 'lead') result = result.filter(s => s.virou_lead);
    if (deviceFilter !== 'all') result = result.filter(s => s.dispositivo === deviceFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(sess =>
        sess.session_id.toLowerCase().includes(q) ||
        (sess.utm_source || '').toLowerCase().includes(q) ||
        Object.values(sess.respostas || {}).some(v => String(v).toLowerCase().includes(q))
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

  // Sticky column layout (cumulative left offsets)
  const STICKY = [
    { key: '#',        width: 44,  left: 0   },
    { key: 'id',       width: 88,  left: 44  },
    { key: 'data',     width: 100, left: 132 },
    { key: 'disp',     width: 42,  left: 232 },
    { key: 'prog',     width: 90,  left: 274 },
    { key: 'status',   width: 100, left: 364 },
    { key: 'pts',      width: 52,  left: 464 },
  ];
  const LAST_STICKY_RIGHT_SHADOW = '4px 0 8px -2px rgba(0,0,0,0.12)';

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
        <KPICard label="Visitas"     value={stats.total}           icon={<Users size={14} />}         color="#3b82f6" isDark={isDark} />
        <KPICard label="Iniciaram"   value={stats.iniciaram}       icon={<Zap size={14} />}           color="#f59e0b" isDark={isDark} />
        <KPICard label="Abandonaram" value={stats.abandonaram}     icon={<TrendingDown size={14} />}  color="#ef4444" isDark={isDark} />
        <KPICard label="Concluíram"  value={stats.total - stats.abandonaram} icon={<CheckCircle2 size={14} />} color="#10b981" isDark={isDark} />
        <KPICard label="Convertidos" value={stats.convertidos}     icon={<ArrowUpRight size={14} />}  color="#8b5cf6" isDark={isDark} />
        <KPICard label="Conversão"   value={`${stats.taxaConv}%`}  icon={<TrendingUp size={14} />}   color="#6366f1" isDark={isDark} />
      </div>

      {/* Filtros — linha principal sempre visível */}
      <div style={{ padding: '0 24px 16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
        <FilterPill label="Hoje"    active={period === 'today'} onClick={() => setPeriod('today')} isDark={isDark} />
        <FilterPill label="7 dias"  active={period === '7d'}    onClick={() => setPeriod('7d')}    isDark={isDark} />
        <FilterPill label="30 dias" active={period === '30d'}   onClick={() => setPeriod('30d')}   isDark={isDark} />
        <div style={{ width: '1px', height: '20px', background: border, margin: '0 4px' }} />

        {/* Botão Filtros */}
        <button
          onClick={() => setShowFilters(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${showFilters ? '#2563eb' : border}`, background: showFilters ? 'rgba(37,99,235,0.08)' : 'transparent', color: showFilters ? '#2563eb' : textMut, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          <Filter size={13} />
          Filtros
          {(statusFilter !== 'all' || deviceFilter !== 'all') && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb', marginLeft: '2px', display: 'inline-block' }} />
          )}
        </button>

        {/* Botão Busca */}
        <button
          onClick={() => setShowSearch(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${showSearch || search ? '#2563eb' : border}`, background: showSearch || search ? 'rgba(37,99,235,0.08)' : 'transparent', color: showSearch || search ? '#2563eb' : textMut, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
        >
          <Search size={13} />
          {search ? `"${search.slice(0, 12)}${search.length > 12 ? '…' : ''}"` : 'Buscar'}
        </button>

        {/* Refresh + timestamp — pushed to right */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: textMut, fontWeight: 600 }}>
            Atualizado: {lastUpdated.toLocaleTimeString()}
          </span>
          <button onClick={fetchData} style={{ padding: '7px', borderRadius: '10px', border: `1px solid ${border}`, background: cardBg, color: textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Painel colapsável — filtros de status e dispositivo */}
      {showFilters && (
        <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${border}`, display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0, background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
          <FilterPill label="Todos"      active={statusFilter === 'all'}       onClick={() => setStatusFilter('all')}       isDark={isDark} />
          <FilterPill label="Abandonou"  active={statusFilter === 'abandon'}   onClick={() => setStatusFilter('abandon')}   color="#ef4444" isDark={isDark} />
          <FilterPill label="Reprovada"  active={statusFilter === 'reprovada'} onClick={() => setStatusFilter('reprovada')} color="#f59e0b" isDark={isDark} />
          <FilterPill label="Virou Lead" active={statusFilter === 'lead'}      onClick={() => setStatusFilter('lead')}      color="#10b981" isDark={isDark} />
          <div style={{ width: '1px', height: '20px', background: border, margin: '0 4px' }} />
          <FilterPill icon={<Monitor size={13} />}    label="Desktop" active={deviceFilter === 'desktop'} onClick={() => setDeviceFilter(deviceFilter === 'desktop' ? 'all' : 'desktop')} isDark={isDark} />
          <FilterPill icon={<Smartphone size={13} />} label="Mobile"  active={deviceFilter === 'mobile'}  onClick={() => setDeviceFilter(deviceFilter === 'mobile'  ? 'all' : 'mobile')}  isDark={isDark} />
          <FilterPill icon={<Tablet size={13} />}     label="Tablet"  active={deviceFilter === 'tablet'}  onClick={() => setDeviceFilter(deviceFilter === 'tablet'  ? 'all' : 'tablet')}  isDark={isDark} />
        </div>
      )}

      {/* Busca colapsável */}
      {showSearch && (
        <div style={{ padding: '10px 24px 14px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', color: textMut }} />
            <input
              autoFocus
              placeholder="Buscar por sessão, UTM ou resposta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 36px 8px 32px', borderRadius: '10px', border: `1px solid ${border}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: textMain, fontSize: '13px', outline: 'none' }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMut, display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions Table — scroll horizontal, perguntas como colunas */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '0 24px 24px' }}>
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${border}`, overflow: 'hidden', minWidth: 'max-content' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 'max-content' }}>
              <thead>
                <tr style={{ background: headBg, borderBottom: `1px solid ${border}` }}>
                  {/* Sticky fixed columns */}
                  <th style={{ position: 'sticky', left: STICKY[0].left, zIndex: 2, background: headBg, width: STICKY[0].width, minWidth: STICKY[0].width, padding: '10px 8px', textAlign: 'center', color: textMut, fontSize: '11px', fontWeight: 700 }}>
                    #
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[1].left, zIndex: 2, background: headBg, width: STICKY[1].width, minWidth: STICKY[1].width, padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Sessão
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[2].left, zIndex: 2, background: headBg, width: STICKY[2].width, minWidth: STICKY[2].width, padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Data
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[3].left, zIndex: 2, background: headBg, width: STICKY[3].width, minWidth: STICKY[3].width, padding: '10px 8px', textAlign: 'center', color: textMut, fontSize: '11px', fontWeight: 700 }}>
                    📱
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[4].left, zIndex: 2, background: headBg, width: STICKY[4].width, minWidth: STICKY[4].width, padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Progresso
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[5].left, zIndex: 2, background: headBg, width: STICKY[5].width, minWidth: STICKY[5].width, padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Status
                  </th>
                  <th style={{ position: 'sticky', left: STICKY[6].left, zIndex: 2, background: headBg, width: STICKY[6].width, minWidth: STICKY[6].width, padding: '10px 8px', textAlign: 'center', color: textMut, fontSize: '11px', fontWeight: 700, boxShadow: LAST_STICKY_RIGHT_SHADOW }}>
                    Pts
                  </th>

                  {/* Dynamic question columns */}
                  {perguntasOrdenadas.map((p: any) => (
                    <th
                      key={p.id}
                      title={p.texto}
                      style={{ padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '130px', maxWidth: '160px', borderLeft: `1px solid ${border}` }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                        {p.texto.length > 22 ? p.texto.slice(0, 22) + '…' : p.texto}
                      </div>
                    </th>
                  ))}

                  {/* UTM columns */}
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '90px', borderLeft: `1px solid ${border}` }}>
                    Source
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Campaign
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Conjunto
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: textMut, fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', minWidth: '130px' }}>
                    Anúncio
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSessoes.length === 0 ? (
                  <tr>
                    <td colSpan={STICKY.length + perguntasOrdenadas.length + 4} style={{ padding: '48px', textAlign: 'center', color: textMut }}>
                      Nenhuma sessão encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredSessoes.map((sess, idx) => {
                    const score = calculateSessionScore(sess.respostas);
                    const effectiveTotal = sess.total_etapas > 0 ? sess.total_etapas : (perguntas.length || 0);
                    const progressPct = effectiveTotal > 0 ? Math.round((sess.ultima_etapa / effectiveTotal) * 100) : 0;
                    const statusInfo = sess.virou_lead
                      ? { label: 'Virou Lead', color: '#10b981', bg: '#10b98115' }
                      : sess.concluiu
                      ? { label: 'Reprovada', color: '#f59e0b', bg: '#f59e0b15' }
                      : { label: 'Abandonou', color: '#ef4444', bg: '#ef444415' };
                    const rowBg = idx % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : '#fcfcfc');
                    const hoverBg = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
                    const deviceIcon = sess.dispositivo === 'mobile'
                      ? <Smartphone size={14} />
                      : sess.dispositivo === 'tablet'
                      ? <Tablet size={14} />
                      : <Monitor size={14} />;

                    return (
                      <tr
                        key={sess.id}
                        style={{ borderBottom: `1px solid ${border}`, transition: 'background 0.15s' }}
                        onMouseEnter={e => { Array.from(e.currentTarget.cells).forEach(td => (td as HTMLElement).style.background = hoverBg); }}
                        onMouseLeave={e => { Array.from(e.currentTarget.cells).forEach(td => (td as HTMLElement).style.background = ''); }}
                      >
                        {/* # */}
                        <td style={{ position: 'sticky', left: STICKY[0].left, zIndex: 1, background: cardBg, width: STICKY[0].width, padding: '12px 8px', textAlign: 'center', color: textMut, fontSize: '11px' }}>
                          {filteredSessoes.length - idx}
                        </td>
                        {/* Sessão ID */}
                        <td style={{ position: 'sticky', left: STICKY[1].left, zIndex: 1, background: cardBg, width: STICKY[1].width, padding: '12px', fontWeight: 700, color: textMain, fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {sess.session_id.substring(0, 8)}
                        </td>
                        {/* Data */}
                        <td style={{ position: 'sticky', left: STICKY[2].left, zIndex: 1, background: cardBg, width: STICKY[2].width, padding: '12px', color: textMut, whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {new Date(sess.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        {/* Dispositivo */}
                        <td style={{ position: 'sticky', left: STICKY[3].left, zIndex: 1, background: cardBg, width: STICKY[3].width, padding: '12px 8px', textAlign: 'center', color: textMut }}>
                          {deviceIcon}
                        </td>
                        {/* Progresso */}
                        <td style={{ position: 'sticky', left: STICKY[4].left, zIndex: 1, background: cardBg, width: STICKY[4].width, padding: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: textMain }}>{sess.ultima_etapa}/{effectiveTotal || '?'}</div>
                            <div style={{ width: '70px', height: '4px', background: border, borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${progressPct}%`, height: '100%', background: statusInfo.color, borderRadius: '2px' }} />
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td style={{ position: 'sticky', left: STICKY[5].left, zIndex: 1, background: cardBg, width: STICKY[5].width, padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '6px', background: statusInfo.bg, color: statusInfo.color, fontSize: '10px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                              {statusInfo.label}
                            </span>
                            {sess.virou_lead && sess.lead_id && (
                              <button
                                onClick={() => navigate(`/leads?id=${sess.lead_id}`)}
                                style={{ padding: '3px 6px', borderRadius: '6px', border: `1px solid ${statusInfo.color}40`, background: 'transparent', color: statusInfo.color, fontSize: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                              >
                                Lead <ExternalLink size={9} />
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Pts */}
                        <td style={{ position: 'sticky', left: STICKY[6].left, zIndex: 1, background: cardBg, width: STICKY[6].width, padding: '12px 8px', textAlign: 'center', fontWeight: 800, color: score > 0 ? '#8b5cf6' : textMut, boxShadow: LAST_STICKY_RIGHT_SHADOW }}>
                          {score || '—'}
                        </td>

                        {/* Dynamic question columns */}
                        {perguntasOrdenadas.map((p: any) => {
                          const resposta = sess.respostas?.[p.texto];
                          return (
                            <td key={p.id} style={{ padding: '12px', borderLeft: `1px solid ${border}`, maxWidth: '160px' }}>
                              {resposta != null && String(resposta).trim() !== '' ? (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  background: sess.virou_lead ? 'rgba(16,185,129,0.1)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                                  color: sess.virou_lead ? '#10b981' : textMain,
                                  maxWidth: '140px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {String(resposta)}
                                </span>
                              ) : (
                                <span style={{ color: textMut }}>—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* UTM Source */}
                        <td style={{ padding: '12px', color: textMut, fontSize: '11px', whiteSpace: 'nowrap', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: `1px solid ${border}` }}>
                          {sess.utm_source || '—'}
                        </td>
                        {/* UTM Campaign — nome sem ID */}
                        <td style={{ padding: '12px', color: textMut, fontSize: '11px', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sess.utm_campaign?.split('|')[0] || '—'}
                        </td>
                        {/* Conjunto (utm_medium = adset name no Meta) */}
                        <td style={{ padding: '12px', color: textMut, fontSize: '11px', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sess.utm_medium || '—'}
                        </td>
                        {/* Anúncio (utm_content = ad name no Meta) */}
                        <td style={{ padding: '12px', color: textMut, fontSize: '11px', whiteSpace: 'nowrap', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sess.utm_content || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
        </div>
      </div>

    </div>
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
        padding: '6px 12px', borderRadius: '8px',
        border: active ? `1.5px solid ${color || '#2563eb'}` : `1px solid ${border}`,
        background: active ? (color ? `${color}15` : '#2563eb15') : 'transparent',
        color: active ? (color || '#2563eb') : textMut,
        fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px'
      }}
    >
      {icon}{label}
    </button>
  );
}

function TrendingDown({ size }: any) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  );
}
