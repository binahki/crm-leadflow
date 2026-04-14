import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, Megaphone, Image as ImageIcon,
  Webhook, MessageCircle, Settings, LogOut, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

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
  { icon: Settings, label: 'Configurações', href: '/configuracoes', badge: false },
];

const COLLAPSE_KEY = 'sidebar_collapsed';

interface SidebarProps { leadCount?: number; }

export function Sidebar({ leadCount = 0 }: SidebarProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, String(next)); } catch { }
  }

  function isActive(href: string) {
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
  }

  // User info — primeiro e segundo nome
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const firstName = user?.user_metadata?.first_name || '';
  const nameParts = (fullName || firstName).trim().split(/\s+/);
  const displayName = nameParts.length >= 2
    ? `${nameParts[0]} ${nameParts[1]}`
    : nameParts[0] || 'Usuário';
  const userEmail = user?.email || '';
  const userInitial = displayName[0]?.toUpperCase() || 'U';

  const sideBg = isDark ? '#0f0f11' : '#ffffff';
  const sideBdr = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const lblClr = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.36)';
  const mutClr = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.58)';
  const hovBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  function NavGroup({ label, items }: { label: string; items: typeof NAV_MAIN }) {
    return (
      <div style={{ marginBottom: '18px' }}>
        {!collapsed && (
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
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: '10px',
                  padding: collapsed ? '10px 0' : '9px 12px',
                  borderRadius: '8px',
                  fontSize: '13.5px', fontWeight: active ? 600 : 500,
                  textDecoration: 'none',
                  transition: 'background 0.12s, color 0.12s',
                  background: active ? '#2563eb' : 'transparent',
                  color: active ? '#ffffff' : mutClr,
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = hovBg;
                    (e.currentTarget as HTMLElement).style.color = isDark ? '#fff' : '#111';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = mutClr;
                  }
                }}
              >
                <item.icon style={{ width: '16px', height: '16px', flexShrink: 0, strokeWidth: active ? 2.2 : 1.7 }} />
                {!collapsed && (
                  <>
                    <span style={{ flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
                    {item.badge && leadCount > 0 && (
                      <span style={{
                        fontSize: '11px', fontWeight: 600,
                        padding: '1px 7px', borderRadius: '20px',
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
      width: collapsed ? '60px' : '228px',
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: sideBg,
      borderRight: `1px solid ${sideBdr}`,
      height: '100vh',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
    }}>

      {/* ── Header / Logo ── */}
      <div style={{
        height: '60px',
        padding: collapsed ? '0' : '0 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: `1px solid ${sideBdr}`,
        flexShrink: 0,
      }}>
        {collapsed ? (
          /* FL badge quando recolhido — cor #2a2c2b */
          <button onClick={toggle} title="Expandir sidebar" style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: '#2a2c2b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.12s, box-shadow 0.12s',
            boxShadow: '0 0 0 0 rgba(42,44,43,0)',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#3a3c3b';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(42,44,43,0.18)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#2a2c2b';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 0 rgba(42,44,43,0)';
            }}
          >
            <span style={{
              fontSize: '11px', fontWeight: 800, letterSpacing: '-0.03em',
              color: '#ffffff',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            }}>FL</span>
          </button>
        ) : (
          <>
            {/* Logo centralizada, 80% do tamanho anterior */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img
                src={isDark ? '/logo-light.png' : '/logo-dark.png'}
                alt="floow"
                style={{ height: '26px', width: 'auto', objectFit: 'contain', display: 'block' }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              {/* Fallback */}
              <span style={{
                display: 'none', fontSize: '17px', fontWeight: 700,
                letterSpacing: '-0.04em', color: isDark ? '#fff' : '#111',
              }}>floow</span>
            </div>

            {/* Botão recolher — mesmo lugar, mais evidente */}
            <button onClick={toggle} style={{
              width: '26px', height: '26px', borderRadius: '7px',
              background: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s, border-color 0.12s',
              flexShrink: 0,
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
              }}
              title="Recolher sidebar"
            >
              <ChevronLeft style={{ width: '13px', height: '13px', color: mutClr }} />
            </button>
          </>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '14px 6px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        <NavGroup label="Principal" items={NAV_MAIN} />
        <NavGroup label="Meta Ads" items={NAV_META} />
        <NavGroup label="Integrações" items={NAV_INT} />
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '6px', borderTop: `1px solid ${sideBdr}`, flexShrink: 0 }}>

        {/* Dark mode toggle */}
        <div
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '10px 0' : '9px 12px',
            borderRadius: '8px', cursor: 'pointer',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = hovBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {!collapsed && (
            <span style={{ fontSize: '13.5px', fontWeight: 500, color: mutClr }}>
              {isDark ? 'Modo claro' : 'Modo escuro'}
            </span>
          )}
          {/* Toggle switch */}
          <div style={{
            width: '34px', height: '18px', borderRadius: '99px',
            background: isDark ? '#2563eb' : '#d1d5db',
            position: 'relative', flexShrink: 0,
            transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: '2px',
              left: isDark ? '16px' : '2px',
              width: '14px', height: '14px', borderRadius: '50%',
              background: '#ffffff',
              transition: 'left 0.2s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
            }} />
          </div>
        </div>

        {/* User info */}
        {!collapsed && (
          <div style={{
            padding: '10px 12px 2px',
            borderTop: `1px solid ${sideBdr}`,
            marginTop: '4px',
          }}>
            <p style={{
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: '8px',
              color: lblClr, opacity: 0.8
            }}>
              Conta do Usuário
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
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
              <LogOut style={{ width: '15px', height: '15px', strokeWidth: 1.8 }} />
              Sair
            </button>
          </div>
        )}

        {/* Collapsed: só sair */}
        {collapsed && (
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
    </aside>
  );
}
