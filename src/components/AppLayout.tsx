import { Sidebar } from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface AppLayoutProps {
  children: React.ReactNode;
  leadCount?: number; // mantido por compatibilidade mas não usado na sidebar
}

export function AppLayout({ children }: AppLayoutProps) {
  const { theme } = useTheme();
  return (
    <div className={theme === 'dark' ? 'dark' : ''} style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: theme === 'dark' ? '#090909' : '#f4f4f5' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowY: 'auto', background: theme === 'dark' ? '#090909' : '#f4f4f5' }}>
        {children}
      </main>
    </div>
  );
}
