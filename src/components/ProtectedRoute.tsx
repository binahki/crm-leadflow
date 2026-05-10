import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BloqueioAssinatura } from './BloqueioAssinatura';

const EXEMPT_PATHS = ['/admin'];
const ADMIN_EMAIL = 'admin@floow.com';

// Mantém export para compatibilidade com Admin.tsx — BloqueioAssinatura faz query fresca a cada mount
export function invalidateSubscriptionCache() {}
export function invalidateOnboardingCache() {}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isExempt = EXEMPT_PATHS.includes(location.pathname);
  const isAdmin = user?.email === ADMIN_EMAIL;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin sem impersonation só acessa /admin
  const isImpersonating = !!localStorage.getItem('admin_viewing_org');
  if (isAdmin && !isImpersonating && !isExempt) {
    return <Navigate to="/admin" replace />;
  }

  // BloqueioAssinatura cuida do bloqueio por assinatura em todas as rotas protegidas
  return (
    <>
      <BloqueioAssinatura />
      {children}
    </>
  );
}
