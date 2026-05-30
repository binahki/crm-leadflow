import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];
export type { Plan };

const SUPER_ADMIN_EMAIL = 'admin@floow.com';

type PlanState = { plano: Plan; loading: boolean };

export function invalidatePlanCache(orgId: string) {
  try { localStorage.removeItem(`floow_plan_${orgId}`); } catch {}
}

function getCached(id: string | null): Plan | null {
  if (!id) return null;
  try {
    const v = localStorage.getItem(`floow_plan_${id}`);
    if (v && KNOWN_PLANS.includes(v as Plan)) return v as Plan;
  } catch {}
  return null;
}

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Estado combinado — plano e loading mudam juntos, sem render intermediário
  const [state, setState] = useState<PlanState>(() => {
    if (isSuperAdmin && !orgId) return { plano: 'enterprise', loading: false };
    const cached = getCached(orgId);
    if (cached) return { plano: cached, loading: false };
    return { plano: 'gratuito', loading: true };
  });

  useEffect(() => {
    if (isSuperAdmin && !orgId) {
      setState({ plano: 'enterprise', loading: false });
      return;
    }

    if (!orgId || !ready) return;

    const cached = getCached(orgId);

    if (cached) {
      // Cache hit: libera imediatamente sem loading, busca banco em background
      setState({ plano: cached, loading: false });

      (supabase as any)
        .from('organizations')
        .select('plano')
        .eq('id', orgId)
        .single()
        .then(({ data }: any) => {
          const p: Plan =
            data?.plano && KNOWN_PLANS.includes(data.plano as Plan)
              ? (data.plano as Plan)
              : 'gratuito';
          if (p !== cached) setState({ plano: p, loading: false });
          try { localStorage.setItem(`floow_plan_${orgId}`, p); } catch {}
        })
        .catch(() => {});
      return;
    }

    // Sem cache: mantém loading=true até o banco responder
    setState({ plano: 'gratuito', loading: true });

    (supabase as any)
      .from('organizations')
      .select('plano')
      .eq('id', orgId)
      .single()
      .then(({ data }: any) => {
        const p: Plan =
          data?.plano && KNOWN_PLANS.includes(data.plano as Plan)
            ? (data.plano as Plan)
            : 'gratuito';
        setState({ plano: p, loading: false }); // uma só chamada — sem render intermediário
        try { localStorage.setItem(`floow_plan_${orgId}`, p); } catch {}
      })
      .catch(() => {
        setState({ plano: 'gratuito', loading: false });
      });
  }, [orgId, ready, isSuperAdmin]); // eslint-disable-line

  const planoFinal: Plan = isSuperAdmin && !orgId ? 'enterprise' : state.plano;

  const features = {
    ravena:             ['starter','pro','enterprise'].includes(state.plano),
    whatsappOficial:    ['starter','pro','enterprise'].includes(state.plano),
    gestorTrafego:      ['starter','pro','enterprise'].includes(state.plano),
    modeloConversao:    ['starter','pro','enterprise'].includes(state.plano),
    multiplosUsuarios:  ['pro','enterprise'].includes(state.plano),
    webhooksIlimitados: ['starter','pro','enterprise'].includes(state.plano),
    leadsIlimitados:    state.plano === 'enterprise',
    limiteLeads:        state.plano === 'gratuito' ? 50 : state.plano === 'starter' ? 250 : state.plano === 'pro' ? 600 : Infinity,
    limiteQuizzes:      (state.plano === 'gratuito' || state.plano === 'starter') ? 1 : 3,
  };

  return { plano: planoFinal, orgId, loading: state.loading, features };
}

export const FEATURE_REQUIRED_PLAN: Record<string, 'Starter' | 'Pro' | 'Enterprise'> = {
  ravena: 'Starter', whatsappOficial: 'Starter', gestorTrafego: 'Starter',
  modeloConversao: 'Starter', webhooksIlimitados: 'Starter',
  multiplosUsuarios: 'Pro', leadsIlimitados: 'Enterprise', limiteQuizzes: 'Pro',
};
