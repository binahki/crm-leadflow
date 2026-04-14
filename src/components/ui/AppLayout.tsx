import Sidebar from '../../../components/Sidebar';
import { useTheme } from '@/hooks/useTheme';

interface AppLayoutProps {
  children: React.ReactNode;
  leadCount?: number;
}

export function AppLayout({ children, leadCount }: AppLayoutProps) {
  const { theme } = useTheme();
  return (
    <div className={theme === 'dark' ? 'dark' : ''} style={{ display:'flex', height:'100vh', overflow:'hidden', background: theme==='dark'?'#090909':'#f4f4f5' }}>
      <Sidebar darkMode={theme === 'dark'} onToggleDark={() => {}} leadCount={leadCount} />
      <main style={{ flex:1, overflowY:'auto', background: theme==='dark'?'#090909':'#f4f4f5' }}>
        {children}
      </main>
    </div>
  );
}
