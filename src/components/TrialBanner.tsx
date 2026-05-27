import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrgId } from '@/hooks/useOrgId';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'admin@floow.com';
const STRIPE_URL = 'https://buy.stripe.com/aFacN5812gQm3fQcxe87K00';
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';
const UMA_HORA = 3600000;
const LIMITE_MENSAL = 50;
const AVISO_A_PARTIR_DE = 40; // 80% do limite

function inicioMesBR(): string {
  const br = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const y = br.getUTCFullYear();
  const m = String(br.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01T00:00:00-03:00`;
}

export function TrialBanner() {
  const { user } = useAuth();
  const { orgId, ready } = useOrgId();
  const [leadsNoMes, setLeadsNoMes] = useState<number | null>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) return;
    if (!ready || !orgId) return;

    const key = `lead_limit_banner_${orgId}`;
    const fechadoEm = sessionStorage.getItem(key);
    if (fechadoEm && Date.now() - parseInt(fechadoEm) < UMA_HORA) return;

    supabase
      .from('subscriptions')
      .select('status')
      .eq('org_id', orgId)
      .maybeSingle()
      .then(({ data: sub }) => {
        if (sub?.status === 'active') return; // plano pago — sem limite

        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', inicioMesBR())
          .then(({ count }) => {
            const total = count ?? 0;
            if (total >= AVISO_A_PARTIR_DE && total < LIMITE_MENSAL) {
              setLeadsNoMes(total);
              setVisivel(true);
            }
          });
      });
  }, [orgId, ready, user?.email]);

  function fechar() {
    if (orgId) sessionStorage.setItem(`lead_limit_banner_${orgId}`, String(Date.now()));
    setVisivel(false);
  }

  if (!visivel || leadsNoMes === null) return null;

  const restantes = LIMITE_MENSAL - leadsNoMes;

  return (
    <div style={{
      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 44px', height: '44px', flexShrink: 0,
      position: 'relative', fontFamily: FONT,
      boxShadow: '0 2px 12px rgba(245,158,11,0.35)',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#fff', textAlign: 'center', lineHeight: 1.4 }}>
        ⚠️ Você usou <strong>{leadsNoMes} dos {LIMITE_MENSAL} leads</strong> do plano gratuito este mês.{' '}
        {restantes > 0 && `Restam ${restantes}. `}
        <button
          onClick={() => window.open(STRIPE_URL, '_blank')}
          style={{
            background: 'none', border: 'none', color: '#fff',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            textDecoration: 'underline', fontFamily: FONT, padding: 0,
          }}
        >
          Fazer upgrade
        </button>
      </span>
      <button
        onClick={fechar}
        style={{
          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
          width: '22px', height: '22px', borderRadius: '50%', border: 'none',
          background: 'rgba(255,255,255,0.22)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}
      >
        <X style={{ width: '11px', height: '11px' }} />
      </button>
    </div>
  );
}
