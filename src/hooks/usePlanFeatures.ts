import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];

export type { Plan };

const ADMIN_EMAIL = 'admin@floow.com';

// Module-level cache — avoids redundant DB fetches per session
const planCache = new Map<string, Plan>();

const ALL_FEATURES_UNLOCKED = {
  ravena: true,
  whatsappOficial: true,
  gestorTrafego: true,
  modeloConversao: true,
  multiplosUsuarios: true,
  webhooksIlimitados: true,
  leadsIlimitados: true,
  limiteLeads: Infinity,
  limiteQuizzes: Infinity,
};

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();

  // isAdmin: only the master admin email — NOT based on localStorage
  // (localStorage.getItem('admin_viewing_org') can be stale from any previous session
  // and would incorrectly bypass plan checks for regular users)
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Check if user is an active gestor (async, accurate)
  const [isGestor, setIsGestor] = useState(false);
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    (supabase as any)
      .from('gestores')
      .select('id')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .then(({ data }: any) => { if (data?.length > 0) setIsGestor(true); })
      .catch(() => {});
  }, [user?.id, isAdmin]); // eslint-disable-line

  const bypass = isAdmin || isGestor;

  const [plano, setPlano] = useState<Plan>(() =>
    (!bypass && orgId && planCache.get(orgId)) || 'gratuito'
  );

  useEffect(() => {
    if (bypass) return;
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
  }, [orgId, ready, bypass]); // eslint-disable-line

  if (bypass) {
    return { plano: 'enterprise' as Plan, features: ALL_FEATURES_UNLOCKED };
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
