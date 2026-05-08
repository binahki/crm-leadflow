import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/hooks/useTheme';
import { AppLayout } from '@/components/AppLayout';
import { toast } from 'sonner';

const ADMIN_EMAIL = 'murilosilvestredias@gmail.com';
const EDGE_URL    = 'https://obguidmfvfjaekaskgob.functions.supabase.co/criar-org';
const FONT        = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

interface Org {
  id: string;
  nome: string;
  email_admin: string;
  plano: string;
  created_at: string;
  status?: string;
  trial_ends_at?: string;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const navigate = useNavigate();

  const [orgs, setOrgs]           = useState<Org[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalNome, setModalNome] = useState('');
  const [modalEmail, setModalEmail] = useState('');
  const [modalSenha, setModalSenha] = useState('');
  const [creating, setCreating]   = useState(false);

  // ── Guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && (!user || user.email !== ADMIN_EMAIL)) {
      navigate('/');
    }
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
          id:            org.id,
          nome:          org.nome          || '—',
          email_admin:   org.email_admin   || '—',
          plano:         org.plano         || '—',
          created_at:    org.created_at,
          status:        sub?.status       || null,
          trial_ends_at: sub?.trial_ends_at || null,
        };
      });

      setOrgs(merged);
    } catch {
      toast.error('Erro ao carregar dados');
    }
    setLoading(false);
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res  = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_empresa: modalNome, email: modalEmail, senha: modalSenha }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { toast.error(data.erro || 'Erro ao criar cliente'); }
      else {
        toast.success(`Org "${modalNome}" criada!`);
        setShowModal(false); setModalNome(''); setModalEmail(''); setModalSenha('');
        fetchOrgs();
      }
    } catch { toast.error('Erro de conexão'); }
    setCreating(false);
  }

  if (authLoading || (!user && !authLoading)) return null;
  if (user?.email !== ADMIN_EMAIL) return null;

  // ── Métricas ──────────────────────────────────────────────────
  const total  = orgs.length;
  const ativas = orgs.filter(o => o.status === 'active').length;
  const trials = orgs.filter(o => o.status === 'trialing').length;
  const mrr    = (ativas * 99.9).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ── Estilos base ──────────────────────────────────────────────
  const bg      = dark ? '#090909' : '#f4f4f5';
  const card    = { background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`, borderRadius: '16px', padding: '20px 24px' } as React.CSSProperties;
  const txt     = dark ? '#f4f4f5' : '#111827';
  const txtMid  = dark ? '#a1a1aa' : '#6b7280';
  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: dark ? '#0d0d0f' : '#f8fafc', color: txt, fontSize: '13px', outline: 'none', fontFamily: FONT, boxSizing: 'border-box' };

  function StatusBadge({ status }: { status?: string | null }) {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      active:   { label: 'Ativo',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
      trialing: { label: 'Trial',     color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
      inactive: { label: 'Inativo',   color: '#71717a', bg: 'rgba(113,113,122,0.12)' },
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

  return (
    <AppLayout leadCount={0}>
      <div style={{ padding: '32px', background: bg, minHeight: '100vh', fontFamily: FONT }}>

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
            { label: 'Total de orgs', value: String(total),  color: '#3b82f6' },
            { label: 'Ativas',        value: String(ativas), color: '#10b981' },
            { label: 'Em trial',      value: String(trials), color: '#f59e0b' },
            { label: 'MRR estimado',  value: mrr,            color: '#a855f7' },
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
                        <button onClick={() => toast.info(`org_id: ${org.id}`)}
                          style={{ padding: '5px 12px', borderRadius: '7px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '12px', cursor: 'pointer', fontFamily: FONT }}>
                          Acessar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal novo cliente */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, width: '90%', maxWidth: '380px', background: dark ? '#111113' : '#fff', border: `1px solid ${dark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`, borderRadius: '18px', padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', fontFamily: FONT }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: txt }}>Novo cliente</h3>
            <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px' }}>Nome da empresa</label>
                <input style={inp} type="text" required placeholder="Ex: Minha Loja" value={modalNome} onChange={e => setModalNome(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px' }}>Email</label>
                <input style={inp} type="email" required placeholder="admin@empresa.com" value={modalEmail} onChange={e => setModalEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: txtMid, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '5px' }}>Senha</label>
                <input style={inp} type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={modalSenha} onChange={e => setModalSenha(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`, background: 'transparent', color: txtMid, fontSize: '13px', cursor: 'pointer', fontFamily: FONT }}>
                  Cancelar
                </button>
                <button type="submit" disabled={creating}
                  style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: creating ? '#27272a' : '#10b981', color: creating ? txtMid : '#fff', fontSize: '13px', fontWeight: 600, cursor: creating ? 'default' : 'pointer', fontFamily: FONT }}>
                  {creating ? 'Criando…' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </AppLayout>
  );
}
