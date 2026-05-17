import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export default function GestorPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gestor, setGestor] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading]);

  // Limpa org que estava sendo visualizada ao voltar para /gestor
  useEffect(() => {
    localStorage.removeItem('admin_viewing_org');
    localStorage.removeItem('admin_viewing_org_nome');
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchDados();
  }, [user]);

  async function fetchDados() {
    setLoading(true);
    const { data: gestorData } = await supabase
      .from('gestores')
      .select('*')
      .eq('user_id', user!.id)
      .single();
    if (!gestorData || !gestorData.ativo) { navigate('/'); return; }
    setGestor(gestorData);

    const { data: gestorOrgs } = await supabase
      .from('gestor_orgs')
      .select('org_id')
      .eq('gestor_user_id', user!.id);
    const orgIds = (gestorOrgs || []).map((x: any) => x.org_id);
    if (!orgIds.length) { setLoading(false); return; }

    const { data: orgsData } = await supabase
      .from('organizations')
      .select('id, nome, email_admin, plano, ravena_ativa, ravena_meta_revendedoras, ravena_budget_mensal')
      .in('id', orgIds);

    const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const orgsComDados = await Promise.all((orgsData || []).map(async (org: any) => {
      const { data: log } = await supabase
        .from('ai_optimization_logs')
        .select('created_at, resumo, frase_do_dia, alerta, revendedoras_mes, acoes_executadas')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count: totalLeads } = await supabase
        .from('leads').select('*', { count: 'exact', head: true }).eq('org_id', org.id);
      const { count: revsmes } = await supabase
        .from('leads').select('*', { count: 'exact', head: true })
        .eq('org_id', org.id).eq('status', 3).gte('ultimo_status_change', primeiroDiaMes);
      return { ...org, ultimo_log: log || null, total_leads: totalLeads || 0, revs_mes: revsmes || 0, tem_alerta: !!(log?.alerta) };
    }));

    orgsComDados.sort((a, b) => {
      if (a.tem_alerta && !b.tem_alerta) return -1;
      if (!a.tem_alerta && b.tem_alerta) return 1;
      return b.revs_mes - a.revs_mes;
    });

    setOrgs(orgsComDados);
    setLoading(false);
  }

  function acessarOrg(org: any) {
    localStorage.setItem('admin_viewing_org', org.id);
    localStorage.setItem('admin_viewing_org_nome', org.nome);
    window.location.href = '/';
  }

  function fmtHoras(dateStr?: string) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / (1000 * 60 * 60));
    const d = Math.floor(h / 24);
    if (d > 0) return `há ${d}d`;
    if (h > 0) return `há ${h}h`;
    return 'agora';
  }

  const bg = dark ? '#090909' : '#f4f4f5';
  const cardBg = dark ? '#111113' : '#fff';
  const border = dark ? '#1e1e22' : 'rgba(0,0,0,0.08)';
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';

  if (authLoading || loading) return (
    <div style={{ minHeight: '100vh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <p style={{ color: txtMid, fontSize: '13px' }}>Carregando…</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: FONT }}>
      {/* Header */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: dark ? 'rgba(9,9,9,0.92)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: txt, letterSpacing: '-0.02em' }}>Floow CRM</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '2px 8px', borderRadius: '99px', marginLeft: '4px' }}>Gestor</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: txtMid }}>{gestor?.nome}</span>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/login'); }}
            style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12.5px', cursor: 'pointer', fontFamily: FONT }}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ paddingTop: '56px' }}>
        <div style={{ padding: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Suas empresas</h1>
            <p style={{ fontSize: '13px', color: txtMid, margin: '3px 0 0' }}>{orgs.length} empresa{orgs.length !== 1 ? 's' : ''} sob sua gestão</p>
          </div>

          {orgs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: txtMid, fontSize: '13px' }}>
              Nenhuma empresa designada ainda. Fale com o administrador.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {orgs.map(org => {
                const progresso = org.ravena_meta_revendedoras > 0
                  ? Math.min(Math.round((org.revs_mes / org.ravena_meta_revendedoras) * 100), 100) : 0;
                const progressoCor = progresso >= 80 ? '#10b981' : progresso >= 50 ? '#f59e0b' : '#ef4444';
                const horasDesdeLog = org.ultimo_log
                  ? (Date.now() - new Date(org.ultimo_log.created_at).getTime()) / (1000 * 60 * 60) : null;
                const ravenaRecente = horasDesdeLog !== null && horasDesdeLog <= 26;

                return (
                  <div key={org.id} style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${org.tem_alerta ? 'rgba(239,68,68,0.3)' : border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: org.tem_alerta ? '0 0 0 3px rgba(239,68,68,0.08)' : 'none' }}>
                    {/* Header do card */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.nome}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: txtMid }}>{org.email_admin}</p>
                      </div>
                      {org.tem_alerta && (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: '99px', flexShrink: 0 }}>⚠️ Alerta</span>
                      )}
                    </div>

                    {/* Alerta da Ravena */}
                    {org.tem_alerta && org.ultimo_log?.alerta && (
                      <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: '12px', color: '#ef4444', lineHeight: 1.5 }}>
                        {org.ultimo_log.alerta}
                      </div>
                    )}

                    {/* Meta do mês */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', color: txtMid, fontWeight: 600 }}>META DO MÊS</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: progressoCor }}>
                          {org.revs_mes}
                          {org.ravena_meta_revendedoras > 0 && (
                            <span style={{ fontSize: '11px', color: txtMid, fontWeight: 400 }}>/{org.ravena_meta_revendedoras} rev</span>
                          )}
                        </span>
                      </div>
                      {org.ravena_meta_revendedoras > 0 && (
                        <div style={{ height: '5px', borderRadius: '99px', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progresso}%`, background: progressoCor, borderRadius: '99px', transition: 'width 1s ease' }} />
                        </div>
                      )}
                    </div>

                    {/* Métricas rápidas */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1, padding: '10px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Leads total</p>
                        <p style={{ margin: '2px 0 0', fontSize: '18px', fontWeight: 700, color: '#3b82f6' }}>{org.total_leads}</p>
                      </div>
                      <div style={{ flex: 1, padding: '10px', borderRadius: '10px', background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb', border: `1px solid ${border}` }}>
                        <p style={{ margin: 0, fontSize: '10px', color: txtMid, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ravena</p>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: 700, color: org.ravena_ativa ? '#10b981' : txtMid }}>
                          {org.ravena_ativa ? (ravenaRecente ? '✓ Otimizou hoje' : '⏳ Aguardando') : '○ Inativa'}
                        </p>
                      </div>
                    </div>

                    {/* Frase da Ravena */}
                    {org.ultimo_log?.frase_do_dia && (
                      <p style={{ margin: 0, fontSize: '12px', color: txtMid, fontStyle: 'italic', lineHeight: 1.5, borderLeft: `2px solid ${dark ? '#27272a' : '#e5e7eb'}`, paddingLeft: '10px' }}>
                        "{org.ultimo_log.frase_do_dia}"
                        <span style={{ display: 'block', fontSize: '10px', color: dark ? '#3f3f46' : '#d1d5db', marginTop: '2px', fontStyle: 'normal' }}>
                          Ravena • {fmtHoras(org.ultimo_log.created_at)}
                        </span>
                      </p>
                    )}

                    {/* Botão acessar */}
                    <button onClick={() => acessarOrg(org)}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                      Acessar painel →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
