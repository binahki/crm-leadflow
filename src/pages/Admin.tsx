import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { toast } from 'sonner';
import { setAdminViewingOrg, clearAdminViewingOrg } from '@/hooks/useOrgId';
import { invalidateSubscriptionCache } from '@/components/ProtectedRoute';

const ADMIN_EMAIL = 'admin@floow.com';
const EDGE_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/criar-org';
const WEBHOOK_BASE = 'https://obguidmfvfjaekaskgob.functions.supabase.co/receber-lead';
const ATUALIZAR_USUARIO_URL = 'https://obguidmfvfjaekaskgob.functions.supabase.co/atualizar-usuario';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

const PLANOS = ['basic', 'pro'];

interface Org {
  id: string;
  nome: string;
  email_admin: string;
  plano: string;
  created_at: string;
  status?: string;
  trial_ends_at?: string;
  sub_id?: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Create modal state ────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [modalNome, setModalNome] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalSenha, setModalSenha] = useState('');
  const [modalPlano, setModalPlano] = useState('starter');
  const [modalTrialDias, setModalTrialDias] = useState(14);
  const [creating, setCreating] = useState(false);

  // ── Edit modal state ──────────────────────────────────────────
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editPlano, setEditPlano] = useState('starter');
  const [editStatus, setEditStatus] = useState('trialing');
  const [editTrialDias, setEditTrialDias] = useState(0);
  const [editEmail, setEditEmail] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Credentials modal state ───────────────────────────────────
  const [showCreds, setShowCreds] = useState(false);
  const [credsData, setCredsData] = useState<{ email: string; orgId: string; webhookUrl: string } | null>(null);
  const [credsLoading, setCredsLoading] = useState(false);

  // ── Delete modal state ────────────────────────────────────────
  const [deleteOrg, setDeleteOrg] = useState<Org | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || user.email !== ADMIN_EMAIL)) navigate('/');
  }, [user, authLoading]);

  // ── Fetch orgs ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    fetchOrgs();
  }, [user]);

  async function fetchOrgs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*, subscriptions(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const merged: Org[] = (data || []).map((org: any) => {
        const sub = org.subscriptions?.[0] || null;
        return {
          id: org.id,
          nome: org.nome || '—',
          email_admin: org.email_admin || '—',
          plano: org.plano || 'starter',
          created_at: org.created_at,
          status: sub?.status || null,
          trial_ends_at: sub?.trial_ends_at || null,
          sub_id: sub?.id || null,
        };
      });
      setOrgs(merged);
    } catch {
      toast.error('Erro ao carregar dados');
    }
    setLoading(false);
  }

  // ── Create org ────────────────────────────────────────────────
  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      // 1. Cria usuário + org via edge function
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_empresa: modalNome, email: modalEmail, senha: modalSenha }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { toast.error(data.erro || 'Erro ao criar cliente'); setCreating(false); return; }

      // 2. Busca org recém-criada pelo email
      const { data: newOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('email_admin', modalEmail)
        .single();

      if (newOrg?.id) {
        const trialEndsAt = new Date(Date.now() + modalTrialDias * 86400000).toISOString();
        // 3. Atualiza plano na org
        await supabase.from('organizations').update({ plano: modalPlano }).eq('id', newOrg.id);
        // 4. Cria/atualiza subscription
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('org_id', newOrg.id)
          .limit(1);
        if (existingSub && existingSub.length > 0) {
          await supabase.from('subscriptions').update({
            status: 'trialing',
            trial_ends_at: trialEndsAt,
          }).eq('id', existingSub[0].id);
        } else {
          await supabase.from('subscriptions').insert({
            org_id: newOrg.id,
            status: 'trialing',
            trial_ends_at: trialEndsAt,
          });
        }
      }

      toast.success(`"${modalNome}" criada! Trial de ${modalTrialDias} dias.`);
      setShowModal(false);
      setModalNome(''); setModalEmail(''); setModalSenha('');
      setModalPlano('starter'); setModalTrialDias(14);
      fetchOrgs();
    } catch { toast.error('Erro de conexão'); }
    setCreating(false);
  }

  // ── Edit org ──────────────────────────────────────────────────
  function openEdit(org: Org) {
    setEditOrg(org);
    setEditPlano(org.plano || 'starter');
    setEditStatus(org.status || 'trialing');
    setEditTrialDias(0);
    setEditEmail('');
    setEditSenha('');
  }

  async function handleVerCreds(org: Org) {
    setCredsData(null);
    setShowCreds(true);
    setCredsLoading(true);
    const { data } = await supabase
      .from('configuracoes_whatsapp')
      .select('webhook_token')
      .eq('org_id', org.id)
      .limit(1)
      .single();
    const token = (data as any)?.webhook_token || '';
    setCredsData({
      email: org.email_admin,
      orgId: org.id,
      webhookUrl: token ? `${WEBHOOK_BASE}?token=${token}` : '—',
    });
    setCredsLoading(false);
  }

  async function handleUpdateUser() {
    if (!editOrg) return;
    if (!editEmail && !editSenha) return;
    if (editSenha && editSenha.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres');
      return;
    }
    const { data: membership } = await supabase
      .from('memberships')
      .select('user_id')
      .eq('org_id', editOrg.id)
      .maybeSingle();
    if (!membership?.user_id) {
      toast.error('Usuário não encontrado para essa org');
      return;
    }
    const body: any = { user_id: membership.user_id };
    if (editEmail) body.email = editEmail;
    if (editSenha) body.password = editSenha;
    const res = await fetch(ATUALIZAR_USUARIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      toast.error(data.erro || 'Erro ao atualizar usuário');
    } else {
      toast.success('Dados de acesso atualizados!');
      if (editEmail) {
        await supabase
          .from('organizations')
          .update({ email_admin: editEmail })
          .eq('id', editOrg.id);
      }
    }
  }

  async function handleEditSave() {
    if (!editOrg) return;
    setEditSaving(true);
    try {
      // 1. Salva plano + status
      const ativo = ['active', 'trialing'].includes(editStatus);
      await supabase.from('organizations').update({ plano: editPlano, ativo }).eq('id', editOrg.id);

      let trialEndsAt: string | null = editOrg.trial_ends_at || null;
      if (editTrialDias > 0) {
        const base = new Date();
        base.setDate(base.getDate() + editTrialDias);
        trialEndsAt = base.toISOString();
      }
      const subPayload: any = { status: editStatus };
      if (editStatus === 'trialing' && trialEndsAt) subPayload.trial_ends_at = trialEndsAt;
      if (editOrg.sub_id) {
        await supabase.from('subscriptions').update(subPayload).eq('id', editOrg.sub_id);
      } else {
        await supabase.from('subscriptions').insert({ org_id: editOrg.id, ...subPayload });
      }
      invalidateSubscriptionCache();
      toast.success('Atualizado!');

      // 2. Atualiza credenciais se preenchidas
      if (editEmail || editSenha) {
        await handleUpdateUser();
      }

      fetchOrgs();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setEditSaving(false);
      setEditOrg(null);
    }
  }

  // ── Delete org ────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteOrg || deleteConfirm !== deleteOrg.nome) return;
    setDeleteLoading(true);
    try {
      await supabase.from('subscriptions').delete().eq('org_id', deleteOrg.id);
      await (supabase as any).from('ai_optimization_logs').delete().eq('org_id', deleteOrg.id);
      await supabase.from('webhook_logs').delete().eq('org_id', deleteOrg.id);
      await supabase.from('leads').delete().eq('org_id', deleteOrg.id);
      await supabase.from('configuracoes_whatsapp').delete().eq('org_id', deleteOrg.id);
      await (supabase as any).from('memberships').delete().eq('org_id', deleteOrg.id);
      await (supabase as any).from('organizations').delete().eq('id', deleteOrg.id);
      toast.success(`"${deleteOrg.nome}" excluída.`);
      setDeleteOrg(null);
      setDeleteConfirm('');
      fetchOrgs();
    } catch {
      toast.error('Erro ao excluir');
    }
    setDeleteLoading(false);
  }

  // ── Actions ───────────────────────────────────────────────────
  function handleAcessar(org: Org) {
    localStorage.setItem('admin_viewing_org',      org.id);
    localStorage.setItem('admin_viewing_org_nome', org.nome);
    window.location.href = '/'; // reload completo: todos os hooks lêem o localStorage fresco
  }

  async function handleSignOut() {
    clearAdminViewingOrg();
    await supabase.auth.signOut();
    navigate('/login');
  }

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.email !== ADMIN_EMAIL) return null;

  // ── Métricas ──────────────────────────────────────────────────
  const total = orgs.length;
  const ativas = orgs.filter(o => o.status === 'active').length;
  const trials = orgs.filter(o => o.status === 'trialing').length;
  const mrr = (ativas * 99.9).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Estilos ───────────────────────────────────────────────────
  const bg = dark ? '#090909' : '#f4f4f5';
  const card = { background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`, borderRadius: '16px', padding: '20px 24px' } as React.CSSProperties;
  const txt = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#0d0d0f' : '#f8fafc', color: txt, fontSize: '13px', outline: 'none', fontFamily: FONT, boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px' };

  function StatusBadge({ status }: { status?: string | null }) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      active: { label: 'Ativo', color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      trialing: { label: 'Trial', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      inactive: { label: 'Inativo', color: '#71717a', bg: 'rgba(113,113,122,0.12)' },
      canceled: { label: 'Cancelado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    };
    const s = map[status || ''] || { label: '—', color: '#71717a', bg: 'rgba(113,113,122,0.12)' };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '99px', background: s.bg, fontSize: '11.5px', fontWeight: 600, color: s.color }}>
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: s.color }} />
        {s.label}
      </span>
    );
  }

  function fmtDate(dateStr?: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function trialInfo(dateStr?: string | null) {
    if (!dateStr) return '—';
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    const date = new Date(dateStr).toLocaleDateString('pt-BR');
    if (diff < 0) return `Expirado (${date})`;
    return `${date} (${diff}d)`;
  }

  // ── Shared modal styles ───────────────────────────────────────
  const modalBox: React.CSSProperties = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    zIndex: 61, width: '90%', maxWidth: '400px',
    background: dark ? '#111113' : '#fff',
    border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: '18px', padding: '24px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4)', fontFamily: FONT,
    maxHeight: '90vh', overflowY: 'auto',
  };
  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 60,
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, fontFamily: FONT }}>

      {/* Header fixo */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', background: dark ? 'rgba(9,9,9,0.92)' : 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'linear-gradient(135deg, #10b981, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: txt, letterSpacing: '-0.02em' }}>Floow CRM</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '99px', marginLeft: '4px' }}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12.5px', color: txtMid }}>{user?.email}</span>
          <button onClick={handleSignOut} style={{ padding: '6px 14px', borderRadius: '8px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12.5px', cursor: 'pointer', fontFamily: FONT, transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.color = txtMid)}>
            Sair
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ paddingTop: '56px' }}>
        <div style={{ padding: '32px' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: txt, margin: 0, letterSpacing: '-0.03em' }}>Painel Admin</h1>
              <p style={{ fontSize: '13px', color: txtMid, margin: '3px 0 0' }}>Gerenciamento de clientes do Floow CRM</p>
            </div>
            <button onClick={() => setShowModal(true)}
              style={{ padding: '9px 18px', borderRadius: '10px', border: 'none', background: '#10b981', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              + Novo cliente
            </button>
          </div>

          {/* Cards métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { label: 'Total de orgs', value: String(total), color: '#3b82f6' },
              { label: 'Ativas', value: String(ativas), color: '#10b981' },
              { label: 'Em trial', value: String(trials), color: '#f59e0b' },
              { label: 'MRR estimado', value: mrr, color: '#a855f7' },
            ].map(m => (
              <div key={m.label} style={card}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>{m.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: m.color, margin: 0, letterSpacing: '-0.03em' }}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.06)'}`, background: dark ? '#18181b' : '#fafafa' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: txt }}>Clientes</span>
            </div>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: txtMid, fontSize: '13px' }}>Carregando…</div>
            ) : orgs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: txtMid, fontSize: '13px' }}>Nenhum cliente ainda</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: dark ? '#18181b' : '#f8fafc' }}>
                      {['Empresa', 'Email admin', 'Plano', 'Status', 'Trial', 'Criado em', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10.5px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org, i) => (
                      <tr key={org.id} style={{ borderTop: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.05)'}`, background: i % 2 === 0 ? 'transparent' : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)') }}>
                        <td style={{ padding: '12px 16px', color: txt, fontWeight: 500, whiteSpace: 'nowrap' }}>{org.nome}</td>
                        <td style={{ padding: '12px 16px', color: txtMid, whiteSpace: 'nowrap' }}>{org.email_admin}</td>
                        <td style={{ padding: '12px 16px', color: txtMid, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{org.plano}</td>
                        <td style={{ padding: '12px 16px' }}><StatusBadge status={org.status} /></td>
                        <td style={{ padding: '12px 16px', color: txtMid, whiteSpace: 'nowrap', fontSize: '12px' }}>{trialInfo(org.trial_ends_at)}</td>
                        <td style={{ padding: '12px 16px', color: txtMid, whiteSpace: 'nowrap', fontSize: '12px' }}>{fmtDate(org.created_at)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleVerCreds(org)}
                              style={{ padding: '5px 10px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                              Credenciais
                            </button>
                            <button onClick={() => openEdit(org)}
                              style={{ padding: '5px 10px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: FONT }}>
                              Editar
                            </button>
                            <button onClick={() => handleAcessar(org)}
                              style={{ padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                              Acessar
                            </button>
                            <button onClick={() => { setDeleteOrg(org); setDeleteConfirm(''); }}
                              style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal: Novo cliente ── */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={overlay} />
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: txt }}>Novo cliente</h3>
            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Nome da empresa</label>
                <input style={inp} type="text" required placeholder="Ex: Minha Loja" value={modalNome} onChange={e => setModalNome(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" required placeholder="admin@empresa.com" value={modalEmail} onChange={e => setModalEmail(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Senha</label>
                <input style={inp} type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={modalSenha} onChange={e => setModalSenha(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Plano</label>
                <select style={inp} value={modalPlano} onChange={e => setModalPlano(e.target.value)}>
                  {PLANOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Dias de trial</label>
                <input style={inp} type="number" min={0} max={365} value={modalTrialDias} onChange={e => setModalTrialDias(Number(e.target.value))} />
                <p style={{ fontSize: '11.5px', color: txtMid, margin: '4px 0 0' }}>
                  Trial expira em: <strong style={{ color: txt }}>{new Date(Date.now() + modalTrialDias * 86400000).toLocaleDateString('pt-BR')}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: creating ? (dark ? '#27272a' : '#e5e7eb') : '#10b981', color: creating ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: creating ? 'default' : 'pointer', fontFamily: FONT }}>
                  {creating ? 'Criando…' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── Modal: Editar org ── */}
      {editOrg && (
        <>
          <div onClick={() => setEditOrg(null)} style={overlay} />
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: txt }}>Editar cliente</h3>
            <p style={{ fontSize: '12.5px', color: txtMid, margin: '0 0 16px' }}>{editOrg.nome}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder={editOrg?.email_admin || 'email@empresa.com'} />
              </div>
              <div>
                <label style={lbl}>Nova senha <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional, mín. 8 chars)</span></label>
                <input style={inp} type="password" value={editSenha} onChange={e => setEditSenha(e.target.value)} placeholder="Deixe em branco para não alterar" autoComplete="new-password" />
              </div>
              <div>
                <label style={lbl}>Plano</label>
                <select style={inp} value={editPlano} onChange={e => setEditPlano(e.target.value)}>
                  {PLANOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Status da assinatura</label>
                <select style={inp} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="trialing">Trial</option>
                  <option value="active">Ativo</option>
                  <option value="past_due">Inadimplente</option>
                </select>
              </div>
              {editStatus === 'trialing' && (
                <div>
                  <label style={lbl}>Dias de trial (a partir de hoje)</label>
                  <input style={inp} type="number" min={0} max={365} value={editTrialDias} onChange={e => setEditTrialDias(Number(e.target.value))} placeholder="0 = mantém data atual" />
                  {editTrialDias > 0 && (
                    <p style={{ fontSize: '11.5px', color: txtMid, margin: '4px 0 0' }}>
                      Novo trial expira em: <strong style={{ color: '#10b981' }}>{(() => { const d = new Date(); d.setDate(d.getDate() + editTrialDias); return d.toLocaleDateString('pt-BR'); })()}</strong>
                    </p>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setEditOrg(null)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>
                  Cancelar
                </button>
                <button onClick={handleEditSave} disabled={editSaving}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: editSaving ? (dark ? '#27272a' : '#e5e7eb') : '#2563eb', color: editSaving ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: editSaving ? 'default' : 'pointer', fontFamily: FONT }}>
                  {editSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {/* ── Modal: Excluir org ── */}
      {deleteOrg && (
        <>
          <div onClick={() => { setDeleteOrg(null); setDeleteConfirm(''); }} style={{ ...overlay, zIndex: 62 }} />
          <div style={{ ...modalBox, zIndex: 63, maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: '#ef4444' }}>Excluir cliente</h3>
            <p style={{ fontSize: '13px', color: txtMid, margin: '0 0 16px', lineHeight: 1.6 }}>
              Esta ação é <strong style={{ color: txt }}>irreversível</strong>. Todos os dados serão apagados.<br />
              Digite <strong style={{ color: txt }}>{deleteOrg.nome}</strong> para confirmar.
            </p>
            <input
              style={inp}
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteOrg.nome}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => { setDeleteOrg(null); setDeleteConfirm(''); }}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== deleteOrg.nome || deleteLoading}
                style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: deleteConfirm !== deleteOrg.nome || deleteLoading ? (dark ? '#27272a' : '#e5e7eb') : '#ef4444', color: deleteConfirm !== deleteOrg.nome || deleteLoading ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: deleteConfirm !== deleteOrg.nome || deleteLoading ? 'default' : 'pointer', fontFamily: FONT }}
              >
                {deleteLoading ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Credenciais ── */}
      {showCreds && (
        <>
          <div onClick={() => setShowCreds(false)} style={overlay} />
          <div style={{ ...modalBox, maxWidth: '460px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: txt }}>Credenciais do cliente</h3>
            {credsLoading ? (
              <p style={{ color: txtMid, fontSize: '13px' }}>Carregando…</p>
            ) : credsData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {([
                  { label: 'Email', value: credsData.email },
                  { label: 'Org ID', value: credsData.orgId },
                  { label: 'Webhook URL', value: credsData.webhookUrl },
                ] as const).map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ ...lbl, marginBottom: '4px' }}>{label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: dark ? '#0d0d0f' : '#f8fafc', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, borderRadius: '9px', padding: '9px 12px' }}>
                      <span style={{ flex: 1, fontSize: '12.5px', color: txt, wordBreak: 'break-all', fontFamily: 'monospace' }}>{value}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(value).then(() => toast.success('Copiado!'))}
                        style={{ flexShrink: 0, padding: '4px 8px', borderRadius: '6px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '11px', cursor: 'pointer', fontFamily: FONT }}
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <button
              onClick={() => setShowCreds(false)}
              style={{ marginTop: '20px', width: '100%', padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}
            >
              Fechar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
