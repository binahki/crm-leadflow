import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];

export type { Plan };

// Only the Floow master admin sees everything unlocked.
// Gestores and regular users always see the real plan of the active org.
const ADMIN_EMAIL = 'admin@floow.com';

// Module-level cache — avoids redundant DB fetches per session
const planCache = new Map<string, Plan>();

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();

  const isAdmin = user?.email === ADMIN_EMAIL;

  const [plano, setPlano] = useState<Plan>(() =>
    (orgId && planCache.get(orgId)) || 'gratuito'
  );

  useEffect(() => {
    // Master admin: skip plan check, they see all features
    if (isAdmin) return;
    if (!orgId || !ready) return;
    if (planCache.has(orgId)) {
      setPlano(planCache.get(orgId)!);
      return;
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
        planCache.set(orgId, p);
        setPlano(p);
        console.log('[usePlanFeatures] plano:', p, 'orgId:', orgId);
      })
      .catch(() => {});
  }, [orgId, ready, isAdmin]); // eslint-disable-line

  if (isAdmin) {
    return {
      plano: 'enterprise' as Plan,
      features: {
        ravena: true, whatsappOficial: true, gestorTrafego: true, modeloConversao: true,
        multiplosUsuarios: true, webhooksIlimitados: true, leadsIlimitados: true,
        limiteLeads: Infinity, limiteQuizzes: Infinity,
      },
    };
  }

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
