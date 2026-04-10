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
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 w-[240px] bg-card border-r border-border flex flex-col z-50 transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-base font-display">
            L
          </div>
          <div>
            <div className="font-display font-bold text-sm tracking-tight">LeadFlow</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">CRM Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {navItems.map((group) => (
            <div key={group.group}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mt-5 mb-2 font-semibold">
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
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm mb-0.5 transition-all relative',
                      isActive
                        ? 'bg-secondary text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                    {item.href === '/leads' && leadCount > 0 && (
                      <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {leadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all w-full"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-[240px] min-h-screen flex flex-col">
        {/* Mobile header */}
        <div className="lg:hidden h-14 border-b border-border flex items-center px-4 bg-card sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-muted-foreground">
            <Menu className="w-5 h-5" />
          </button>
          <span className="ml-3 font-display font-bold text-sm">LeadFlow</span>
        </div>
        {children}
      </main>
    </div>
  );
}
