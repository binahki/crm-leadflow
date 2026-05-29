import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];

export type { Plan };

const ADMIN_EMAIL = 'admin@floow.com';

// Module-level cache avoids redundant fetches when multiple components use this hook
const planCache = new Map<string, Plan>();

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();

  const isAdminOrGestor =
    user?.email === ADMIN_EMAIL || !!localStorage.getItem('admin_viewing_org');

  const [plano, setPlano] = useState<Plan>(() => {
    if (isAdminOrGestor) return 'enterprise';
    return (orgId && planCache.get(orgId)) || 'gratuito';
  });

  useEffect(() => {
    if (isAdminOrGestor) { setPlano('enterprise'); return; }
    if (!orgId || !ready) return;
    if (planCache.has(orgId)) { setPlano(planCache.get(orgId)!); return; }

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
        planCache.set(orgId, p);
        setPlano(p);
      })
      .catch(() => {});
  }, [orgId, ready, isAdminOrGestor]); // eslint-disable-line

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

  return { plano, features };
}

// Feature → minimum plan required (for display in UpgradeModal)
export const FEATURE_REQUIRED_PLAN: Record<string, 'Starter' | 'Pro' | 'Enterprise'> = {
  ravena:             'Starter',
  whatsappOficial:    'Starter',
  gestorTrafego:      'Starter',
  modeloConversao:    'Starter',
  webhooksIlimitados: 'Starter',
  multiplosUsuarios:  'Pro',
  leadsIlimitados:    'Enterprise',
  limiteQuizzes:      'Pro',
};
