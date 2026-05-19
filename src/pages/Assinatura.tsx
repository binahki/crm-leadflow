import { AppLayout } from '@/components/AppLayout';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/hooks/useTheme';
import { Check } from 'lucide-react';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

const WA_CONSULTA = 'https://wa.me/5519993929168?text=Olá!%20Preciso%20de%20um%20plano%20personalizado%20para%20minha%20operação.';

const FEATURES = [
  { label: 'Leads/mês',              gratuito: '50',   starter: '250',  pro: '600'  },
  { label: 'Quizzes ativos',         gratuito: '1',    starter: '1',    pro: '3'    },
  { label: 'Modelo alta conversão',  gratuito: false,  starter: true,   pro: true   },
  { label: 'CRM completo',           gratuito: true,   starter: true,   pro: true   },
  { label: 'Dashboard Meta Ads',     gratuito: true,   starter: true,   pro: true   },
  { label: 'IA Ravena™',             gratuito: false,  starter: true,   pro: true   },
  { label: 'Gestor de tráfego',      gratuito: false,  starter: true,   pro: true   },
  { label: 'API WhatsApp oficial',   gratuito: false,  starter: false,  pro: true   },
  { label: 'Inbox profissional',     gratuito: false,  starter: false,  pro: true   },
  { label: 'Múltiplos usuários',     gratuito: false,  starter: false,  pro: true   },
  { label: 'Suporte prioritário',    gratuito: false,  starter: false,  pro: true   },
];

const PLANS = [
  {
    key: 'gratuito' as const,
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para conhecer a plataforma e dar os primeiros passos.',
    color: '#6b7280',
    cta: 'Plano atual',
    current: true,
    popular: false,
  },
  {
    key: 'starter' as const,
    name: 'Starter',
    price: 'R$ 497',
    period: '/mês',
    description: 'CRM completo + IA Ravena + Gestor de tráfego incluído.',
    color: '#2563eb',
    cta: 'Assinar Starter',
    current: false,
    popular: false,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: 'R$ 997',
    period: '/mês',
    description: 'Para quem escala e precisa de mais volume e recursos.',
    color: '#8b5cf6',
    cta: 'Assinar Pro',
    current: false,
    popular: true,
  },
];

export default function AssinaturaPage() {
  const { leads } = useAppStore();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const txt    = dark ? '#f4f4f5' : '#111827';
  const txtMid = dark ? '#a1a1aa' : '#6b7280';
  const bdr    = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const cardBg = dark ? '#111113' : '#ffffff';

  return (
    <AppLayout leadCount={leads.length}>
      <div style={{ padding: '32px', fontFamily: FONT, maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: txt, margin: 0, letterSpacing: '-0.04em' }}>
            Planos & Assinatura
          </h1>
          <p style={{ fontSize: '15px', color: txtMid, marginTop: '8px' }}>
            Escolha o plano ideal para sua operação.
          </p>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
          {PLANS.map(plan => (
            <div key={plan.key} style={{
              background: cardBg,
              border: `2px solid ${plan.popular ? plan.color : bdr}`,
              borderRadius: '20px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: plan.popular ? `0 8px 32px ${plan.color}20` : 'none',
            }}>
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: '-12px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: plan.color, color: '#fff',
                  padding: '4px 14px', borderRadius: '99px',
                  fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  Mais popular
                </div>
              )}

              <h3 style={{ fontSize: '13px', fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                {plan.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '10px' }}>
                <span style={{ fontSize: '30px', fontWeight: 800, color: txt }}>{plan.price}</span>
                <span style={{ fontSize: '13px', color: txtMid }}>{plan.period}</span>
              </div>
              <p style={{ fontSize: '13px', color: txtMid, lineHeight: 1.5, margin: '0 0 24px', flex: 1 }}>
                {plan.description}
              </p>
              <button style={{
                width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                background: plan.current ? (dark ? '#27272a' : '#f1f5f9') : plan.color,
                color: plan.current ? txtMid : '#fff',
                fontSize: '14px', fontWeight: 700,
                cursor: plan.current ? 'default' : 'pointer',
                fontFamily: FONT,
              }}>
                {plan.current ? 'Plano atual' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div style={{ background: cardBg, borderRadius: '16px', border: `1px solid ${bdr}`, overflow: 'hidden', marginBottom: '32px' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderBottom: `1px solid ${bdr}` }}>
            <div style={{ padding: '16px 20px' }} />
            {PLANS.map(plan => (
              <div key={plan.key} style={{ padding: '16px 20px', textAlign: 'center', borderLeft: `1px solid ${bdr}` }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: plan.color }}>{plan.name}</span>
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {FEATURES.map((f, i) => (
            <div key={f.label} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              borderBottom: i < FEATURES.length - 1 ? `1px solid ${bdr}` : 'none',
              background: i % 2 === 0 ? 'transparent' : (dark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'),
            }}>
              <div style={{ padding: '13px 20px', fontSize: '13px', color: txt, fontWeight: 500 }}>
                {f.label}
              </div>
              {(['gratuito', 'starter', 'pro'] as const).map(planKey => {
                const val = f[planKey];
                return (
                  <div key={planKey} style={{
                    padding: '13px 20px', textAlign: 'center',
                    borderLeft: `1px solid ${bdr}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {typeof val === 'boolean' ? (
                      val ? (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'rgba(16,185,129,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check size={12} color="#10b981" strokeWidth={3} />
                        </div>
                      ) : (
                        <div style={{
                          width: '16px', height: '2px', borderRadius: '1px',
                          background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                        }} />
                      )
                    ) : (
                      <span style={{ fontSize: '13px', fontWeight: 600, color: txt }}>{val}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Consultation CTA */}
        <div style={{ textAlign: 'center', padding: '8px 0 32px' }}>
          <p style={{ fontSize: '13px', color: txtMid, margin: '0 0 12px' }}>
            Precisa de mais volume ou recursos personalizados?
          </p>
          <a
            href={WA_CONSULTA}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '10px',
              border: `1px solid ${bdr}`, background: 'transparent',
              color: txtMid, fontSize: '13px', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#25d366';
              e.currentTarget.style.color = '#25d366';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = bdr;
              e.currentTarget.style.color = txtMid;
            }}
          >
            💬 Falar com especialista → WhatsApp
          </a>
        </div>

      </div>
    </AppLayout>
  );
}
