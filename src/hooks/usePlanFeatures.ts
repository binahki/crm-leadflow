import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];
export type { Plan };

const SUPER_ADMIN_EMAIL = 'admin@floow.com';

export function invalidatePlanCache(orgId: string) {
  try { localStorage.removeItem(`floow_plan_${orgId}`); } catch {}
}

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const getCached = (id: string | null): Plan | null => {
    if (!id) return null;
    try {
      const v = localStorage.getItem(`floow_plan_${id}`);
      if (v && KNOWN_PLANS.includes(v as Plan)) return v as Plan;
    } catch {}
    return null;
  };

  const [plano, setPlano] = useState<Plan>(() => getCached(orgId) ?? 'gratuito');
  const [loading, setLoading] = useState<boolean>(() => {
    if (isSuperAdmin && !orgId) return false;   // admin sem org → enterprise imediato
    if (orgId && getCached(orgId)) return false; // cache hit → sem loading
    return true;                                  // sem cache/orgId → loading até o fetch
  });

  useEffect(() => {
    if (isSuperAdmin && !orgId) {
      setPlano('enterprise');
      setLoading(false);
      return;
    }

    if (!orgId || !ready) return;

    const cached = getCached(orgId);
    if (cached) {
      setPlano(cached);
      setLoading(false);
    } else {
      setLoading(true); // sem cache: só libera loading quando o banco responder
    }

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
        setPlano(p);
        setLoading(false);
        try { localStorage.setItem(`floow_plan_${orgId}`, p); } catch {}
      })
      .catch(() => {
        setPlano('gratuito');
        setLoading(false);
      });
  }, [orgId, ready, isSuperAdmin]); // eslint-disable-line

  const features = {
    ravena:             ['starter','pro','enterprise'].includes(plano),
    whatsappOficial:    ['starter','pro','enterprise'].includes(plano),
    gestorTrafego:      ['starter','pro','enterprise'].includes(plano),
    modeloConversao:    ['starter','pro','enterprise'].includes(plano),
    multiplosUsuarios:  ['pro','enterprise'].includes(plano),
    webhooksIlimitados: ['starter','pro','enterprise'].includes(plano),
    leadsIlimitados:    plano === 'enterprise',
    limiteLeads:        plano === 'gratuito' ? 50 : plano === 'starter' ? 250 : plano === 'pro' ? 600 : Infinity,
    limiteQuizzes:      (plano === 'gratuito' || plano === 'starter') ? 1 : 3,
  };

  // Admin sem org visualizada sempre enxerga enterprise
  const planoFinal: Plan = isSuperAdmin && !orgId ? 'enterprise' : plano;

  return { plano: planoFinal, orgId, loading, features };
}

export const FEATURE_REQUIRED_PLAN: Record<string, 'Starter' | 'Pro' | 'Enterprise'> = {
  ravena: 'Starter', whatsappOficial: 'Starter', gestorTrafego: 'Starter',
  modeloConversao: 'Starter', webhooksIlimitados: 'Starter',
  multiplosUsuarios: 'Pro', leadsIlimitados: 'Enterprise', limiteQuizzes: 'Pro',
};
