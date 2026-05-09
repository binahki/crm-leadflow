import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const WA_SUPORTE = 'https://wa.me/5519993929168';
const STRIPE_URL = 'https://billing.stripe.com';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export function BloqueioAssinatura() {
  const { user } = useAuth();
  const { orgId, ready } = useOrgId();
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    // Admin nunca é bloqueado
    if (user?.email === ADMIN_EMAIL) return;
    if (!ready || !orgId) return;

    // Sempre faz fetch fresco — sem cache
    supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('org_id', orgId)
      .single()
      .then(({ data }) => {
        if (!data) return; // sem assinatura = não bloqueia (novo usuário)
        const ativo =
          data.status === 'active' ||
          (data.status === 'trialing' &&
            (!data.trial_ends_at || new Date(data.trial_ends_at) > new Date()));
        setBloqueado(!ativo);
      });
  }, [orgId, ready, user?.email]);

  if (!bloqueado) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT,
      pointerEvents: 'all',
    }}>
      <div style={{
        background: '#111113',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '36px 32px',
        width: '90%', maxWidth: '400px',
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        animation: 'bl-up 0.22s cubic-bezier(0.32,0.72,0,1)',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f4f4f5', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          Acesso suspenso
        </h2>
        <p style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 24px' }}>
          Sua assinatura está inativa. Regularize seu pagamento para continuar acessando o Floow.
        </p>
        <button
          onClick={() => window.open(STRIPE_URL, '_blank')}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: '#16a34a', color: '#fff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            marginBottom: '12px', fontFamily: FONT,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Regularizar pagamento
        </button>
        <p style={{ fontSize: '12.5px', color: '#52525b', margin: '0 0 6px' }}>
          Precisa de ajuda? Fale conosco: <strong style={{ color: '#71717a' }}>(19) 99392-9168</strong>
        </p>
        <a
          href={WA_SUPORTE}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '12.5px', color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}
        >
          Abrir WhatsApp →
        </a>
      </div>
      <style>{`@keyframes bl-up { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
