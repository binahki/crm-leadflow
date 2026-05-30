import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];
export type { Plan };

const SUPER_ADMIN_EMAIL = 'admin@floow.com';

function getCachedPlan(orgId: string): Plan | null {
  try {
    const cached = localStorage.getItem(`floow_plan_${orgId}`);
    if (cached && KNOWN_PLANS.includes(cached as Plan)) return cached as Plan;
  } catch {}
  return null;
}

export function invalidatePlanCache(orgId: string) {
  try { localStorage.removeItem(`floow_plan_${orgId}`); } catch {}
}

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const [plano, setPlano] = useState<Plan>('gratuito');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin sem org selecionada (não está visualizando um cliente) → acesso total
    if (isSuperAdmin && !orgId) {
      setPlano('enterprise');
      setLoading(false);
      return;
    }

    if (!orgId || !ready) return;

    // Carrega do cache imediatamente para evitar flash de cadeado
    const cached = getCachedPlan(orgId);
    if (cached) {
      setPlano(cached);
      setLoading(false);
    } else {
      setLoading(true);
      setPlano('gratuito');
    }

    (supabase as any)
      .from('organizations')
      .select('plano')
      .eq('id', orgId)
      .single()
      .then(({ data, error }: any) => {
        console.log('[usePlanFeatures] orgId:', orgId, 'plano:', data?.plano, 'error:', error);
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

  // Features are always derived from the real org plan (even for admin viewing a client org)
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

  return { plano, orgId, loading, features };
}

export const FEATURE_REQUIRED_PLAN: Record<string, 'Starter' | 'Pro' | 'Enterprise'> = {
  ravena: 'Starter', whatsappOficial: 'Starter', gestorTrafego: 'Starter',
  modeloConversao: 'Starter', webhooksIlimitados: 'Starter',
  multiplosUsuarios: 'Pro', leadsIlimitados: 'Enterprise', limiteQuizzes: 'Pro',
};
