import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface AppLayoutProps {
  children: React.ReactNode;
  leadCount?: number;
}

export function AppLayout({ children, leadCount = 0 }: AppLayoutProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fecha gaveta ao mudar de rota
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const bg = isDark ? '#090909' : '#f4f4f5';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: bg, position: 'relative' }}>

      {/* Desktop sidebar */}
      {!isMobile && <Sidebar leadCount={leadCount} />}

      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.18s ease',
          }}
        />
      )}

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          zIndex: 61, width: '260px',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
          willChange: 'transform',
        }}>
          <Sidebar leadCount={leadCount} onMobileClose={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <main style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        background: bg,
        paddingTop: isMobile ? '56px' : '0',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
            background: isDark ? '#0f0f11' : '#ffffff',
            borderBottom: `1px solid ${isDark ? '#1e1e22' : 'rgba(0,0,0,0.08)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', zIndex: 50,
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Botão hamburguer — abre E fecha a gaveta */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Menu style={{ width: '18px', height: '18px', color: isDark ? '#fff' : '#111' }} />
            </button>

            {/* Logo clicável → dashboard */}
            <img
              src={isDark ? '/logo-light.png' : '/logo-dark.png'}
              alt="floow"
              onClick={() => navigate('/')}
              style={{ height: '22px', width: 'auto', objectFit: 'contain', cursor: 'pointer' }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />

            <div style={{ width: '36px' }} />
          </div>
        )}

        {children}
      </main>

      <style>{`@keyframes fadeIn { from{opacity:0} to{opacity:1} }`}</style>
    </div>
  );
}
