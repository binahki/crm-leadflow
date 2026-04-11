import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Megaphone,
  Image,
  Webhook,
  MessageCircle,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  {
    group: 'Principal',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/kanban', label: 'Funil CRM', icon: Kanban },
    ],
  },
  {
    group: 'Meta Ads',
    items: [
      { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
      { href: '/criativos', label: 'Criativos', icon: Image },
    ],
  },
  {
    group: 'Integrações',
    items: [
      { href: '/webhook', label: 'Webhook', icon: Webhook },
      { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
  leadCount?: number;
}

export function AppLayout({ children, leadCount = 0 }: AppLayoutProps) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[280px] bg-white border-r border-gray-200 flex flex-col z-50 transition-transform duration-200 shadow-sm',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="px-6 py-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              L
            </div>
            <div>
              <div className="font-bold text-lg text-gray-900">LeadFlow</div>
              <div className="text-xs text-gray-500 font-medium">CRM Intelligence</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          {navItems.map((group) => (
            <div key={group.group}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mt-6 mb-3">
                {group.group}
              </div>
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium mb-1 transition-all relative',
                      isActive
                        ? 'bg-blue-50 text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                    {item.href === '/leads' && leadCount > 0 && (
                      <span className="ml-auto bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center shadow-sm">
                        {leadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all w-full"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all w-full"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-[280px] min-h-screen">
        {/* Mobile header */}
        <div className="lg:hidden h-16 border-b border-gray-200 flex items-center px-4 bg-white sticky top-0 z-30 shadow-sm">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-4 font-bold text-lg text-gray-900">LeadFlow</span>
        </div>
        {children}
      </main>
    </div>
  );
}
