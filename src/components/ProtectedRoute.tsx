import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const EXEMPT_PATHS = ['/onboarding', '/admin', '/sem-acesso', '/cadastro'];
const ADMIN_EMAIL = 'admin@floow.com';

let _cachedUserId: string | null = null;
let _cachedAllowed: boolean | null = null;

export function invalidateSubscriptionCache() {
  _cachedAllowed = null;
}

export function invalidateOnboardingCache() { }

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isExempt = EXEMPT_PATHS.includes(location.pathname);
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    // Admin tem acesso irrestrito — não verifica assinatura
    if (isAdmin) {
      setChecked(true);
      setAllowed(true);
      return;
    }

    if (!user || isExempt) {
      setChecked(true);
      return;
    }

    if (_cachedUserId === user.id && _cachedAllowed !== null) {
      setAllowed(_cachedAllowed);
      setChecked(true);
      return;
    }

    async function checkSubscription() {
      try {
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

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('status, trial_ends_at, current_period_end')
          .eq('org_id', membership.org_id)
          .single();

        let ok = false;
        if (sub) {
          if (sub.status === 'active') {
            ok = true;
          } else if (sub.status === 'trialing') {
            ok = !sub.trial_ends_at || new Date(sub.trial_ends_at) > new Date();
          }
        }

        _cachedUserId = user!.id;
        _cachedAllowed = ok;
        setAllowed(ok);
      } catch {
        _cachedUserId = user!.id;
        _cachedAllowed = true;
        setAllowed(true);
      } finally {
        setChecked(true);
      }
    }

    checkSubscription();
  }, [user?.id, isExempt, isAdmin]);

  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin sem impersonation: só pode acessar rotas isentas (/admin, /sem-acesso…)
  // Quando está impersonando, deixa acessar o CRM normalmente.
  const isImpersonating = !!localStorage.getItem('admin_viewing_org');
  if (isAdmin && !isImpersonating && !isExempt) {
    return <Navigate to="/admin" replace />;
  }

  if (!isExempt && !allowed) return <Navigate to="/sem-acesso" replace />;

  return <>{children}</>;
}