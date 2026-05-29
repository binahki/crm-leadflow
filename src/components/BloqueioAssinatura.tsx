import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const STRIPE_URL = 'https://buy.stripe.com/aFacN5812gQm3fQcxe87K00';
const WA_SUPORTE = 'https://wa.me/5519993929168';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const LIMITE_MENSAL = 50;

function inicioMesBR(): string {
  const br = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = br.getUTCFullYear();
  const m = String(br.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01T00:00:00-03:00`;
}

type EstadoBloqueio = 'limite' | 'inativo' | false;

export function BloqueioAssinatura() {
  const { user, signOut } = useAuth();
  const { orgId, ready } = useOrgId();
  const [bloqueado, setBloqueado] = useState<EstadoBloqueio>(false);

  async function checkStatus() {
    if (!orgId) return;
    try {
      // Verifica se a org ainda existe + lê status e plano
      const { data: org, error: orgError } = await supabase
        .from('organizations' as any)
        .select('id, status, plano, ativo')
        .eq('id', orgId)
        .maybeSingle();

      if (!org || orgError) {
        await supabase.auth.signOut();
        window.location.href = '/login';
        return;
      }

      const orgStatus: string = (org as any).status || ((org as any).ativo !== false ? 'ativo' : 'suspenso');
      const orgPlano: string  = (org as any).plano  || 'gratuito';

      // Bloqueio total: suspenso, cancelado, inadimplente
      if (['suspenso', 'cancelado', 'inadimplente'].includes(orgStatus)) {
        setBloqueado('inativo');
        return;
      }

      // Plano pago ativo — sem restrição
      if (orgStatus === 'ativo' && orgPlano !== 'gratuito') {
        setBloqueado(false);
        return;
      }

      // Plano gratuito ativo — verificar limite mensal de leads
      const { count } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', inicioMesBR());

      setBloqueado((count ?? 0) >= LIMITE_MENSAL ? 'limite' : false);
    } catch {
      // Erro de rede — não bloqueia para evitar falso positivo
    }
  }

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) return;
    if (!ready || !orgId) return;

    checkStatus();

    const channel = supabase
      .channel(`org-status-${orgId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${orgId}`,
      }, () => { checkStatus(); })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'leads',
        filter: `org_id=eq.${orgId}`,
      }, () => { checkStatus(); })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${orgId}`,
      }, async () => {
        await supabase.auth.signOut();
        window.location.href = '/login';
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, ready, user?.email]); // eslint-disable-line

  if (!bloqueado) return null;

  const isLimite = bloqueado === 'limite';

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
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>
          {isLimite ? '📊' : '🔒'}
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f4f4f5', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
          {isLimite ? 'Limite mensal atingido' : 'Acesso suspenso'}
        </h2>
        <p style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 24px' }}>
          {isLimite
            ? `Você atingiu o limite de ${LIMITE_MENSAL} leads do plano gratuito este mês. Faça upgrade para continuar captando leads.`
            : 'Sua assinatura está inativa. Regularize seu pagamento para continuar acessando o Floow.'}
        </p>

        <button
          onClick={() => window.open(STRIPE_URL, '_blank')}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: isLimite ? '#2563eb' : '#16a34a', color: '#fff',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            marginBottom: '12px', fontFamily: FONT,
          }}
        >
          {isLimite ? 'Fazer upgrade do plano' : 'Regularizar pagamento'}
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
