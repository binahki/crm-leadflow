import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const STRIPE_URL = 'https://buy.stripe.com/aFacN5812gQm3fQcxe87K00';
const WA_SUPORTE = 'https://wa.me/5519993929168';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

export function BloqueioAssinatura() {
  const { user, signOut } = useAuth();
  const { orgId, ready } = useOrgId();
  const [bloqueado, setBloqueado] = useState(false);

  async function checkSubscription() {
    if (!orgId) return;
    try {
      // Verifica se a org ainda existe
      const { data: org, error: orgError } = await supabase
        .from('organizations' as any)
        .select('id')
        .eq('id', orgId)
        .maybeSingle();

      // Org foi deletada — faz logout e redireciona
      if (!org || orgError) {
        await supabase.auth.signOut();
        window.location.href = '/login';
        return;
      }

      // Verifica assinatura normalmente
      const { data } = await supabase
        .from('subscriptions')
        .select('status, trial_ends_at')
        .eq('org_id', orgId)
        .maybeSingle();

      if (!data) {
        setBloqueado(false);
        return;
      }

      const ativo =
        data.status === 'active' ||
        (data.status === 'trialing' &&
          (!data.trial_ends_at || new Date(data.trial_ends_at).getTime() > Date.now() - (24 * 60 * 60 * 1000)));
      setBloqueado(!ativo);
    } catch {
      // Em caso de erro de rede, não bloqueia
    }
  }

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) return;
    if (!ready || !orgId) return;

    checkSubscription();

    const channel = supabase
      .channel(`sub-status-${orgId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'subscriptions',
        filter: `org_id=eq.${orgId}`,
      }, () => {
        checkSubscription();
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${orgId}`,
      }, async () => {
        // Org deletada — logout imediato
        await supabase.auth.signOut();
        window.location.href = '/login';
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, ready, user?.email]); // eslint-disable-line

  if (!bloqueado) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.80)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
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
        position: 'relative',
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
          }}
        >
          Regularizar pagamento
        </button>

        <p style={{ fontSize: '12.5px', color: '#52525b', margin: '0 0 6px' }}>
          Precisa de ajuda? <strong style={{ color: '#71717a' }}>(19) 99392-9168</strong>
        </p>
        <a
          href={WA_SUPORTE}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: '12.5px', color: '#22c55e', textDecoration: 'none', fontWeight: 500 }}
        >
          Abrir WhatsApp →
        </a>

        <button
          onClick={() => signOut?.()}
          style={{
            marginTop: '20px', width: '100%', padding: '10px',
            borderRadius: '10px', border: '1px solid #27272a',
            background: 'transparent', color: '#52525b',
            fontSize: '13px', cursor: 'pointer', fontFamily: FONT,
          }}
        >
          Sair da conta
        </button>
      </div>
      <style>{`@keyframes bl-up { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}