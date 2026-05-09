import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, Megaphone, Image as ImageIcon,
  Webhook, MessageCircle, Settings, LogOut, ChevronLeft, Building2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const NAV_MAIN = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/', badge: false },
  { icon: Users, label: 'Leads', href: '/leads', badge: true },
  { icon: BarChart3, label: 'Funil CRM', href: '/kanban', badge: false },
];
const NAV_META = [
  { icon: Megaphone, label: 'Campanhas', href: '/campanhas', badge: false },
  { icon: ImageIcon, label: 'Criativos', href: '/criativos', badge: false },
];
const NAV_INT = [
  { icon: Webhook, label: 'Webhook', href: '/webhook', badge: false },
  { icon: MessageCircle, label: 'WhatsApp', href: '/whatsapp', badge: false },
  { icon: BarChart3, label: 'Meta Ads', href: '/meta-ads', badge: false },
];
const NAV_CONTA = [
  { icon: Settings, label: 'Configurações', href: '/configuracoes', badge: false },
];

const COLLAPSE_KEY = 'sidebar_collapsed';

interface SidebarProps {
  leadCount?: number;
  onMobileClose?: () => void; // chamado pela gaveta mobile para fechar
}

export function Sidebar({ leadCount = 0, onMobileClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { orgId } = useOrgId();
  const isDark = theme === 'dark';

  const [alertBadges, setAlertBadges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!orgId) return;
    async function fetchBadges() {
      const [{ data: wh }, { data: org }, { count }] = await Promise.all([
        supabase.from('configuracoes_whatsapp').select('instance_id, webhook_token').eq('org_id', orgId!).maybeSingle(),
        supabase.from('organizations').select('meta_token').eq('id', orgId!).single(),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId!),
      ]);
      setAlertBadges({
        '/whatsapp': !((wh as any)?.instance_id),
        '/webhook': (count ?? 0) === 0,
        '/meta-ads': !((org as any)?.meta_token),
      });
    }
    fetchBadges();
  }, [orgId, location.pathname]);

  // collapsed só funciona no desktop
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
  });

  const [showProfile, setShowProfile] = useState(false);
  const [profName, setProfName] = useState('');
  const [profEmail, setProfEmail] = useState('');
  const [profPass, setProfPass] = useState('');
  const [profLoading, setProfLoading] = useState(false);

  function openProfile() {
    setProfName(displayName);
    setProfEmail(userEmail);
    setProfPass('');
    setShowProfile(true);
  }

  async function handleUpdateProfile() {
    if (!user) return;
    setProfLoading(true);
    try {
      const updates: any = {};
      if (profName !== displayName) updates.data = { full_name: profName };
      if (profEmail !== userEmail) updates.email = profEmail;
      if (profPass.trim()) updates.password = profPass.trim();

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
      setShowProfile(false);
    } catch (err: any) {
      toast.error(`Erro ao atualizar: ${err.message}`);
    }
    setProfLoading(false);
  }


  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { }
  }

  function isActive(href: string) {
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
  }

  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const firstNameMeta = user?.user_metadata?.first_name || '';
  const nameParts = (fullName || firstNameMeta).trim().split(/\s+/);
  const displayName = nameParts.length >= 2 ? `${nameParts[0]} ${nameParts[1]}` : nameParts[0] || 'Usuário';
  const userEmail = user?.email || '';
  const userInitial = displayName[0]?.toUpperCase() || 'U';

  const isMobileDrawer = !!onMobileClose; // se tem onMobileClose, está em modo gaveta mobile

  const sideBg = isDark ? '#0f0f11' : '#ffffff';
  const sideBdr = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const lblClr = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.36)';
  const mutClr = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.58)';
  const hovBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  // Em mobile sempre expandido (sem collapsed)
  const isCollapsed = isMobileDrawer ? false : collapsed;

  function NavGroup({ label, items }: { label: string; items: typeof NAV_MAIN }) {
    return (
      <div style={{ marginBottom: '18px' }}>
        {!isCollapsed && (
          <p style={{
            fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '0 12px', marginBottom: '4px',
            color: lblClr,
          }}>
            {label}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {items.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={isCollapsed ? item.label : undefined}
                onClick={isMobileDrawer ? onMobileClose : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: '10px', padding: isCollapsed ? '10px 0' : '9px 12px',
                  borderRadius: '8px', fontSize: '13.5px', fontWeight: active ? 600 : 500,
                  textDecoration: 'none', transition: 'background 0.12s, color 0.12s',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : mutClr,
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = hovBg; (e.currentTarget as HTMLElement).style.color = isDark ? '#fff' : '#111'; } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = mutClr; } }}
              >
                <item.icon style={{ width: '16px', height: '16px', flexShrink: 0, strokeWidth: active ? 2.2 : 1.7 }} />
                {!isCollapsed && (
                  <>
                    <span style={{ flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
                    {alertBadges[item.href] && (
                      <span style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: '#ef4444', flexShrink: 0,
                        boxShadow: '0 0 4px rgba(239,68,68,0.5)',
                      }} />
                    )}
                    {item.badge && leadCount > 0 && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '20px',
                        background: active ? 'rgba(255,255,255,0.22)' : (isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'),
                        color: active ? '#fff' : (isDark ? 'rgba(255,255,255,0.8)' : '#374151'),
                        minWidth: '22px', textAlign: 'center',
                      }}>
                        {leadCount}
                      </span>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside style={{
      width: isCollapsed ? '60px' : '228px',
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: sideBg,
      borderRight: `1px solid ${sideBdr}`,
      height: '100vh',
      transition: isMobileDrawer ? 'none' : 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        height: '60px',
        padding: isCollapsed ? '0' : '0 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: `1px solid ${sideBdr}`,
        flexShrink: 0,
      }}>
        {isCollapsed ? (
          /* Badge FL desktop collapsed — fundo escuro no light, claro no dark */
          <button onClick={toggle} title="Expandir" style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: isDark ? '#ffffff' : '#2a2c2b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.12s, box-shadow 0.12s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(42,44,43,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            <span style={{
              fontSize: '11px', fontWeight: 800,
              color: isDark ? '#090909' : '#ffffff',
              letterSpacing: '-0.03em',
            }}>FL</span>
          </button>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={isDark ? '/logo-light.png' : '/logo-dark.png'}
                alt="floow"
                onClick={() => { navigate('/'); if (isMobileDrawer) onMobileClose?.(); }}
                style={{ height: '26px', width: 'auto', objectFit: 'contain', cursor: 'pointer' }}
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            {/* Botão recolher — só aparece no desktop */}
            {!isMobileDrawer && (
              <button onClick={toggle} style={{
                width: '26px', height: '26px', borderRadius: '7px',
                background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.12s', flexShrink: 0,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'; }}
                title="Recolher sidebar"
              >
                <ChevronLeft style={{ width: '13px', height: '13px', color: mutClr }} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '14px 6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        <NavGroup label="Principal" items={NAV_MAIN} />
        <NavGroup label="Meta Ads" items={NAV_META} />
        <NavGroup label="Integrações" items={NAV_INT} />
        <NavGroup label="Conta" items={NAV_CONTA} />
      </nav>

      {/* Footer */}
      <div style={{ padding: '6px', borderTop: `1px solid ${sideBdr}`, flexShrink: 0 }}>

        {/* Dark mode toggle */}
        <div onClick={toggleTheme} style={{
          display: 'flex', alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          padding: isCollapsed ? '10px 0' : '9px 12px',
          borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = hovBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {!isCollapsed && (
            <span style={{ fontSize: '13.5px', fontWeight: 500, color: mutClr }}>
              {isDark ? 'Modo claro' : 'Modo escuro'}
            </span>
          )}
          <div style={{
            width: '34px', height: '18px', borderRadius: '99px',
            background: isDark ? '#2563eb' : '#d1d5db',
            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: '2px',
              left: isDark ? '16px' : '2px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#fff',
              transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
            }} />
          </div>
        </div>

        {/* User info — expandido */}
        {!isCollapsed && (
          <div style={{ padding: '4px 8px', borderTop: `1px solid ${sideBdr}`, marginTop: '4px' }}>
            <div
              onClick={openProfile}
              style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '6px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', marginBottom: '4px' }}
              onMouseEnter={e => (e.currentTarget.style.background = hovBg)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '13px', fontWeight: 700, flexShrink: 0,
              }}>
                {userInitial}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: isDark ? '#f4f4f5' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: mutClr, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userEmail}
                </p>
              </div>
            </div>

            <button onClick={signOut} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '7px 4px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isDark ? 'rgba(255,80,80,0.75)' : 'rgba(200,0,0,0.6)',
              transition: 'all 0.12s', textAlign: 'left', fontFamily: 'inherit',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,50,50,0.08)' : 'rgba(200,0,0,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut style={{ width: '15px', height: '15px', strokeWidth: 1.8 }} /> Sair
            </button>
          </div>
        )}

        {/* Collapsed — só ícone sair */}
        {isCollapsed && (
          <button onClick={signOut} title="Sair" style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '10px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: isDark ? 'rgba(255,80,80,0.75)' : 'rgba(200,0,0,0.6)',
            transition: 'background 0.12s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,50,50,0.08)' : 'rgba(200,0,0,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut style={{ width: '16px', height: '16px', strokeWidth: 1.8 }} />
          </button>
        )}
      </div>

      {/* Profile Modal */}
      {showProfile && (
        <>
          <div onClick={() => setShowProfile(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)', zIndex: 1000 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: isDark ? '#111113' : '#ffffff', border: `1px solid ${isDark ? '#27272a' : '#e5e7eb'}`,
            borderRadius: '16px', padding: '24px', zIndex: 1001, width: '90%', maxWidth: '360px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)', fontFamily: 'inherit'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: isDark ? '#fff' : '#111' }}>Editar Perfil</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '12px', color: mutClr, fontWeight: 500, marginBottom: '4px', display: 'block' }}>Nome</label>
                <input
                  type="text" value={profName} onChange={e => setProfName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${sideBdr}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: isDark ? '#fff' : '#111', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: mutClr, fontWeight: 500, marginBottom: '4px', display: 'block' }}>Email</label>
                <input
                  type="email" value={profEmail} onChange={e => setProfEmail(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${sideBdr}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: isDark ? '#fff' : '#111', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: mutClr, fontWeight: 500, marginBottom: '4px', display: 'block' }}>Nova Senha (opcional)</label>
                <input
                  type="password" value={profPass} onChange={e => setProfPass(e.target.value)} placeholder="Deixe em branco para não alterar"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${sideBdr}`, background: isDark ? '#1a1a1e' : '#f9fafb', color: isDark ? '#fff' : '#111', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowProfile(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${sideBdr}`, background: 'transparent', color: isDark ? '#fff' : '#111', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateProfile} disabled={profLoading}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 500, cursor: profLoading ? 'default' : 'pointer', opacity: profLoading ? 0.7 : 1 }}
              >
                {profLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

