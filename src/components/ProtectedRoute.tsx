import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Module-level cache — avoids re-query a cada troca de rota
let _cachedUserId: string | null = null;
let _cachedNeedsOnboarding: boolean | null = null;

/** Chame após concluir o onboarding para não redirecionar novamente. */
export function invalidateOnboardingCache() {
  _cachedNeedsOnboarding = false;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isOnboarding = location.pathname === '/onboarding';

  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Se não há usuário ou já estamos no onboarding, pula o check
    if (!user || isOnboarding) {
      setChecked(true);
      return;
    }

    // Cache hit — mesmo usuário, resultado já conhecido
    if (_cachedUserId === user.id && _cachedNeedsOnboarding !== null) {
      setNeedsOnboarding(_cachedNeedsOnboarding);
      setChecked(true);
      return;
    }

    // Faz a consulta ao banco
    async function runCheck() {
      try {
        const { data: membership } = await supabase
          .from('memberships')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!membership?.org_id) {
          // Sem org → precisa de onboarding
          _cachedUserId = user.id;
          _cachedNeedsOnboarding = true;
          setNeedsOnboarding(true);
          setChecked(true);
          return;
        }

        const { data: configs } = await supabase
          .from('configuracoes_whatsapp')
          .select('id')
          .eq('org_id', membership.org_id)
          .limit(1);

        // Só redireciona se não existe NENHUM registro para o org
        const needs = !configs || configs.length === 0;
        _cachedUserId = user.id;
        _cachedNeedsOnboarding = needs;
        setNeedsOnboarding(needs);
      } catch {
        // Em caso de erro de rede/permissão, deixa passar para não bloquear
        _cachedUserId = user.id;
        _cachedNeedsOnboarding = false;
      } finally {
        setChecked(true);
      }
    }
    runCheck();
  }, [user?.id, isOnboarding]);

  // Aguarda auth + check de onboarding
  if (loading || !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isOnboarding && needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}
