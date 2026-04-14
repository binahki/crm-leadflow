import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, Megaphone, Image as ImageIcon,
  Webhook, MessageCircle, Settings, Sun, Moon, LogOut,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

const NAV_MAIN = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: Users,           label: 'Leads',     href: '/leads' },
  { icon: BarChart3,       label: 'Funil CRM', href: '/kanban' },
];
const NAV_META = [
  { icon: Megaphone, label: 'Campanhas', href: '/campanhas' },
  { icon: ImageIcon, label: 'Criativos', href: '/criativos' },
];
const NAV_INT = [
  { icon: Webhook,       label: 'Webhook',      href: '/webhook' },
  { icon: MessageCircle, label: 'WhatsApp',      href: '/whatsapp' },
  { icon: Settings,      label: 'Configurações', href: '/configuracoes' },
];

interface SidebarProps {
  leadCount?: number;
}

export function Sidebar({ leadCount = 0 }: SidebarProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === 'dark';

  function isActive(href: string) {
    return href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);
  }

  function NavGroup({ label, items }: { label: string; items: typeof NAV_MAIN }) {
    return (
      <div style={{ marginBottom: '24px' }}>
        <p style={{
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '0 12px',
          marginBottom: '6px',
          color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
        }}>
          {label}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {items.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: active ? 600 : 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  background: active
                    ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
                    : 'transparent',
                  color: active
                    ? isDark ? '#fff' : '#000'
                    : isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                    (e.currentTarget as HTMLElement).style.color = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)';
                  }
                }}
              >
                <item.icon style={{ width: '16px', height: '16px', flexShrink: 0, strokeWidth: active ? 2.2 : 1.8 }} />
                <span style={{ flex: 1, letterSpacing: '-0.01em' }}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: isDark ? '#0f0f11' : '#f5f5f7',
      borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
      height: '100vh',
    }}>

      {/* Logo */}
      <div style={{ padding: '24px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: isDark ? '#fff' : '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 9 C3 5.5 5.5 3 9 3 C11.5 3 13.5 4.5 14.5 6.5"
                stroke={isDark ? '#000' : '#fff'} strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="9" cy="9" r="2" fill={isDark ? '#000' : '#fff'}/>
              <path d="M9 11 C9 11 6 13 6 15"
                stroke={isDark ? '#000' : '#fff'} strokeWidth="2" strokeLinecap="round"/>
              <path d="M9 11 C9 11 12 13 12 15"
                stroke={isDark ? '#000' : '#fff'} strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0px' }}>
            <span style={{
              fontSize: '19px', fontWeight: 700, letterSpacing: '-0.04em',
              color: isDark ? '#fff' : '#000',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              lineHeight: 1,
            }}>fl</span>
            <svg width="22" height="16" viewBox="0 0 22 14" style={{ marginBottom: '1px' }}>
              <ellipse cx="6"  cy="7" rx="5" ry="5" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="2.2"/>
              <ellipse cx="16" cy="7" rx="5" ry="5" fill="none" stroke={isDark ? '#fff' : '#000'} strokeWidth="2.2"/>
              <line x1="11" y1="4" x2="11" y2="10" stroke={isDark ? '#0f0f11' : '#f5f5f7'} strokeWidth="1.5"/>
            </svg>
            <span style={{
              fontSize: '19px', fontWeight: 700, letterSpacing: '-0.04em',
              color: isDark ? '#fff' : '#000',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
              lineHeight: 1,
            }}>w</span>
          </div>
        </div>
        <p style={{
          fontSize: '11px',
          color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
          marginTop: '6px', paddingLeft: '42px', letterSpacing: '0.01em',
        }}>
          CRM Intelligence
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 8px', overflowY: 'auto' }}>
        <NavGroup label="Principal"   items={NAV_MAIN} />
        <NavGroup label="Meta Ads"    items={NAV_META} />
        <NavGroup label="Integrações" items={NAV_INT}  />
      </nav>

      {/* Bottom */}
      <div style={{
        padding: '12px 8px',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {[
          { icon: isDark ? Sun : Moon, label: isDark ? 'Modo claro' : 'Modo escuro', onClick: toggleTheme, danger: false },
          { icon: LogOut, label: 'Sair', onClick: signOut, danger: true },
        ].map((item, i) => (
          <button key={i} onClick={item.onClick} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 12px', borderRadius: '10px', fontSize: '13.5px', fontWeight: 500,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: item.danger
              ? isDark ? 'rgba(255,80,80,0.7)' : 'rgba(200,0,0,0.5)'
              : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
            transition: 'all 0.15s ease', textAlign: 'left', letterSpacing: '-0.01em',
          }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = item.danger
                ? isDark ? 'rgba(255,50,50,0.08)' : 'rgba(200,0,0,0.05)'
                : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
              (e.currentTarget as HTMLElement).style.color = item.danger
                ? isDark ? 'rgba(255,80,80,1)' : 'rgba(200,0,0,0.8)'
                : isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = item.danger
                ? isDark ? 'rgba(255,80,80,0.7)' : 'rgba(200,0,0,0.5)'
                : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
            }}
          >
            <item.icon style={{ width: '16px', height: '16px', strokeWidth: 1.8, flexShrink: 0 }} />
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
