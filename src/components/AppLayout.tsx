import { Sidebar } from './Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface AppLayoutProps {
  children: React.ReactNode;
  leadCount?: number;
}

export function AppLayout({ children, leadCount = 0 }: AppLayoutProps) {
  const { theme } = useTheme();

  return (
    <div
      className={theme === 'dark' ? 'dark' : ''}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}
    >
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        background: theme === 'dark' ? '#0a0a0b' : '#f5f5f7',
        overflow: 'hidden',
      }}>
        <Sidebar leadCount={leadCount} />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: theme === 'dark' ? '#0a0a0b' : '#f5f5f7',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
