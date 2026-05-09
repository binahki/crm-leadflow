import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const STRIPE_URL = 'https://buy.stripe.com/test_4gMaEX6Nh8xde521NX8EM00';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export function TrialBanner() {
  const { user } = useAuth();
  const { orgId, ready } = useOrgId();
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) return;
    if (!ready || !orgId) return;

    supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('org_id', orgId)
      .single()
      .then(({ data }) => {
        if (!data || data.status !== 'trialing' || !data.trial_ends_at) return;
        const dias = Math.ceil(
          (new Date(data.trial_ends_at).getTime() - Date.now()) / 86400000
        );
        if (dias >= 0 && dias <= 7) setDiasRestantes(dias);
      });
  }, [orgId, ready, user?.email]);

  if (fechado || diasRestantes === null) return null;

  const urgente = diasRestantes <= 2;

  return (
    <div style={{
      background: urgente
        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
        : 'linear-gradient(90deg, #f59e0b, #d97706)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 16px', height: '44px', flexShrink: 0, gap: '16px',
      position: 'relative', fontFamily: FONT,
      boxShadow: urgente ? '0 2px 12px rgba(239,68,68,0.4)' : '0 2px 12px rgba(245,158,11,0.4)',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff', textAlign: 'center' }}>
        ⏳ Teste termina em{' '}
        <strong>{diasRestantes === 0 ? 'hoje' : `${diasRestantes}d`}</strong>
        {' · '}
        <button
          onClick={() => window.open(STRIPE_URL, '_blank')}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontFamily: FONT, padding: 0 }}
        >
          Regularizar pagamento
        </button>
      </span>
      <button
        onClick={() => setFechado(true)}
        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
      >
        <X style={{ width: '11px', height: '11px' }} />
      </button>
    </div>
  );
}
