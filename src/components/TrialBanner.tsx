import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const STRIPE_URL = 'https://billing.stripe.com';

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
        if (dias > 0 && dias <= 7) setDiasRestantes(dias);
      });
  }, [orgId, ready, user?.email]);

  if (fechado || diasRestantes === null) return null;

  const urgente = diasRestantes <= 2;
  const bg = urgente ? '#ef4444' : '#f59e0b';
  const bgHover = urgente ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';

  return (
    <div style={{
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '40px', flexShrink: 0,
      boxShadow: `0 2px 8px ${bg}55`,
      gap: '12px',
    }}>
      <span style={{
        fontSize: '13px', fontWeight: 500, color: '#fff',
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        ⏳ Seu período de teste termina em <strong>{diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}</strong>. Configure seu pagamento para continuar.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={() => window.open(STRIPE_URL, '_blank')}
          style={{
            padding: '5px 14px', borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.2)',
            color: '#fff', fontSize: '12.5px', fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.32)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        >
          Configurar pagamento
        </button>
        <button
          onClick={() => setFechado(true)}
          style={{
            width: '24px', height: '24px', borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.18)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', transition: 'background 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = bgHover)}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
        >
          <X style={{ width: '12px', height: '12px' }} />
        </button>
      </div>
    </div>
  );
}
