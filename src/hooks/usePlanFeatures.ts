import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from '@/hooks/useOrgId';
import { useAuth } from '@/hooks/useAuth';

const KNOWN_PLANS = ['gratuito', 'starter', 'pro', 'enterprise'] as const;
type Plan = typeof KNOWN_PLANS[number];
export type { Plan };

const SUPER_ADMIN_EMAIL = 'admin@floow.com';

export function usePlanFeatures() {
  const { orgId, ready } = useOrgId();
  const { user } = useAuth();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const [plano, setPlano] = useState<Plan>('gratuito');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[usePlanFeatures] user:', user?.email, 'orgId:', orgId, 'ready:', ready, 'isSuperAdmin:', isSuperAdmin);

    if (isSuperAdmin) {
      setPlano('enterprise');
      setLoading(false);
      return;
    }

    if (!orgId || !ready) return;

    setLoading(true);
    setPlano('gratuito'); // reset before fetch

    (supabase as any)
      .from('organizations')
      .select('plano')
      .eq('id', orgId)
      .single()
      .then(({ data, error }: any) => {
        console.log('[usePlanFeatures] DB result:', { data, error, orgId });
        const p: Plan =
          data?.plano && KNOWN_PLANS.includes(data.plano as Plan)
            ? (data.plano as Plan)
            : 'gratuito';
        setPlano(p);
        setLoading(false);
      })
      .catch((err: any) => {
        console.error('[usePlanFeatures] erro:', err);
        setPlano('gratuito');
        setLoading(false);
      });
  }, [orgId, ready, isSuperAdmin]); // eslint-disable-line

  const features = isSuperAdmin ? {
    ravena: true, whatsappOficial: true, gestorTrafego: true,
    modeloConversao: true, multiplosUsuarios: true, webhooksIlimitados: true,
    leadsIlimitados: true, limiteLeads: Infinity, limiteQuizzes: Infinity,
  } : {
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

  return { plano: isSuperAdmin ? 'enterprise' as Plan : plano, orgId, loading, features };
}

export const FEATURE_REQUIRED_PLAN: Record<string, 'Starter' | 'Pro' | 'Enterprise'> = {
  ravena: 'Starter', whatsappOficial: 'Starter', gestorTrafego: 'Starter',
  modeloConversao: 'Starter', webhooksIlimitados: 'Starter',
  multiplosUsuarios: 'Pro', leadsIlimitados: 'Enterprise', limiteQuizzes: 'Pro',
};
