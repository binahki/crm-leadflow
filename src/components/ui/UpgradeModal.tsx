import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Inter, sans-serif';

const PLAN_COLOR: Record<string, string> = {
  Starter:    '#2563eb',
  Pro:        '#8b5cf6',
  Enterprise: '#0ea5e9',
};

const FEATURE_CONTENT: Record<string, { title: string; desc: string; benefits: string[] }> = {
  ravena: {
    title: 'IA Ravena™',
    desc: 'A IA que trabalha enquanto você dorme — analisa, otimiza e escala suas campanhas automaticamente.',
    benefits: [
      'Análise diária de todas as suas campanhas',
      'Otimização automática de budget em tempo real',
      'Alertas de performance via WhatsApp',
      'Escala revendedoras ao menor CPL possível',
    ],
  },
  whatsappOficial: {
    title: 'API WhatsApp Oficial',
    desc: 'Envio de mensagens em massa com a API oficial do WhatsApp Business.',
    benefits: [
      'Disparos automáticos para novos leads',
      'Templates de mensagens de alta conversão',
      'Integração direta com o funil de vendas',
      'Histórico completo de conversas',
    ],
  },
  gestorTrafego: {
    title: 'Gestor de Tráfego',
    desc: 'Nossa equipe especializada gerencia seus anúncios no Meta Ads por você.',
    benefits: [
      'Estratégia personalizada para seu negócio',
      'Criação e otimização de campanhas Meta Ads',
      'Relatórios semanais de performance',
      'Suporte especializado em tráfego pago',
    ],
  },
  modeloConversao: {
    title: 'Modelo de Alta Conversão',
    desc: 'Perguntas validadas com mais de 10.000 leads — prontas para copiar e colar.',
    benefits: [
      'Perguntas testadas que convertem mais',
      'Aumente a qualificação em até 3×',
      'Pronto para usar em minutos',
      'Atualizado mensalmente com novos testes',
    ],
  },
  multiplosUsuarios: {
    title: 'Múltiplos Usuários',
    desc: 'Adicione toda sua equipe ao CRM e acompanhe a performance de cada um.',
    benefits: [
      'Acesso simultâneo para toda a equipe',
      'Controle de permissões por função',
      'Acompanhe performance individual',
      'Ideal para operações que escalam',
    ],
  },
  webhooksIlimitados: {
    title: 'Webhooks Ilimitados',
    desc: 'Conecte quantas fontes de leads quiser e integre com qualquer plataforma.',
    benefits: [
      'Integrações ilimitadas de leads',
      'Roteamento avançado por fonte',
      'Logs detalhados de cada evento',
      'Compatível com qualquer plataforma',
    ],
  },
  limiteQuizzes: {
    title: '3 Quizzes Ativos',
    desc: 'Crie até 3 quizzes simultâneos para diferentes públicos e produtos.',
    benefits: [
      'Segmente leads por produto ou região',
      'A/B test de abordagens diferentes',
      'Cada quiz com modelo validado incluso',
      'Dashboards separados por quiz',
    ],
  },
};

const DEFAULT_CONTENT = {
  title: 'Funcionalidade Premium',
  desc: 'Faça upgrade para desbloquear esta funcionalidade e muito mais.',
  benefits: [
    'Acesso completo ao CRM avançado',
    'IA Ravena para otimização automática',
    'API WhatsApp oficial',
    'Suporte prioritário',
  ],
};

interface UpgradeModalProps {
  feature: string;
  planoNecessario: 'Starter' | 'Pro' | 'Enterprise';
  onClose: () => void;
}

export function UpgradeModal({ feature, planoNecessario, onClose }: UpgradeModalProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const content = FEATURE_CONTENT[feature] || DEFAULT_CONTENT;
  const planColor = PLAN_COLOR[planoNecessario] || '#2563eb';

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          zIndex: 9999,
          width: '90%', maxWidth: '400px',
          background: dark ? '#111113' : '#ffffff',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: '20px',
          padding: '32px 28px 28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
          fontFamily: FONT,
          animation: 'um-pop 0.2s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Lock icon + plan badge */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: `${planColor}18`,
            border: `1.5px solid ${planColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <span style={{ fontSize: '26px', lineHeight: 1 }}>🔒</span>
          </div>

          <span style={{
            display: 'inline-block',
            fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.07em',
            color: planColor,
            background: `${planColor}15`,
            padding: '3px 10px', borderRadius: '99px',
            marginBottom: '10px',
          }}>
            Plano {planoNecessario}
          </span>

          <h2 style={{
            fontSize: '19px', fontWeight: 700,
            color: dark ? '#f4f4f5' : '#111827',
            margin: '0 0 8px',
            letterSpacing: '-0.025em',
          }}>
            {content.title}
          </h2>
          <p style={{
            fontSize: '13px',
            color: dark ? '#71717a' : '#6b7280',
            margin: 0, lineHeight: 1.55,
          }}>
            {content.desc}
          </p>
        </div>

        {/* Benefits */}
        <div style={{
          background: dark ? 'rgba(255,255,255,0.03)' : '#f9fafb',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {content.benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: `${planColor}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '1px',
                fontSize: '10px',
              }}>
                ✓
              </span>
              <span style={{ fontSize: '13px', color: dark ? '#d4d4d8' : '#374151', lineHeight: 1.4 }}>
                {b}
              </span>
            </div>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => { onClose(); navigate('/assinatura'); }}
            style={{
              width: '100%', padding: '12px',
              borderRadius: '11px', border: 'none',
              background: planColor, color: '#fff',
              fontSize: '14px', fontWeight: 700,
              cursor: 'pointer', fontFamily: FONT,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Ver planos →
          </button>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px',
              borderRadius: '11px',
              border: `1px solid ${dark ? '#27272a' : '#e5e7eb'}`,
              background: 'transparent',
              color: dark ? '#52525b' : '#9ca3af',
              fontSize: '13px', cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Agora não
          </button>
        </div>
      </div>

      <style>{`@keyframes um-pop{from{opacity:0;transform:translate(-50%,-50%) scale(0.94)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
    </>
  );
}
