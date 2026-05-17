import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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

  const [gestorAtivo, setGestorAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user || isAdmin) { setGestorAtivo(false); return; }
    supabase
      .from('gestores')
      .select('id, ativo')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setGestorAtivo(data?.ativo === true ? true : false));
  }, [user?.id]);

  // Timeout de segurança: se loading não resolver em 5s, o refresh_token provavelmente
  // está inválido/expirado e o Supabase ficou travado. Força logout.
  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(async () => {
      await supabase.auth.signOut();
      localStorage.clear();
      window.location.href = '/login';
    }, 5000);
    return () => clearTimeout(timeout);
  }, [loading]);

  if (loading || gestorAtivo === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Gestor ativo — redireciona para /gestor (exceto se já estiver lá)
  if (gestorAtivo && location.pathname !== '/gestor') {
    return <Navigate to="/gestor" replace />;
  }

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
