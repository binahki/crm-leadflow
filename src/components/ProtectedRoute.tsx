import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Rotas que não precisam de assinatura ativa
const EXEMPT_PATHS = ['/onboarding', '/admin', '/sem-acesso'];

// Cache por sessão — evita re-query a cada troca de rota
let _cachedUserId: string | null = null;
let _cachedAllowed: boolean | null = null;

/** Invalida o cache de assinatura (use após mudança de plano). */
export function invalidateSubscriptionCache() {
  _cachedAllowed = null;
}

/** Legado — mantido para não quebrar imports existentes. */
export function invalidateOnboardingCache() {}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isExempt = EXEMPT_PATHS.includes(location.pathname);

  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    // Rota isenta ou sem usuário: pula o check de assinatura
    if (!user || isExempt) {
      setChecked(true);
      return;
    }

    // Cache hit para o mesmo usuário
    if (_cachedUserId === user.id && _cachedAllowed !== null) {
      setAllowed(_cachedAllowed);
      setChecked(true);
      return;
    }

    async function checkSubscription() {
      try {
        // 1. Busca org_id
        const { data: membership } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', user!.id)
          .single();

        if (!membership?.org_id) {
          _cachedUserId = user!.id;
          _cachedAllowed = false;
          setAllowed(false);
          setChecked(true);
          return;
        }

        // 2. Busca assinatura
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, trial_ends_at, current_period_end')
          .eq('org_id', membership.org_id)
          .single();

        // 3. Avalia status
        let ok = false;
        if (sub) {
          if (sub.status === 'active') {
            ok = true;
          } else if (sub.status === 'trialing') {
            // Trialing válido se trial_ends_at ainda não passou (ou não definido)
            ok = !sub.trial_ends_at || new Date(sub.trial_ends_at) > new Date();
          }
        }

        _cachedUserId = user!.id;
        _cachedAllowed = ok;
        setAllowed(ok);
      } catch {
        // Em caso de erro de rede, libera o acesso para não bloquear o usuário
        _cachedUserId = user!.id;
        _cachedAllowed = true;
        setAllowed(true);
      } finally {
        setChecked(true);
      }
    }

    checkSubscription();
  }, [user?.id, isExempt]);

  // Aguarda auth + check de assinatura
  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isExempt && !allowed) return <Navigate to="/sem-acesso" replace />;

  return <>{children}</>;
}
