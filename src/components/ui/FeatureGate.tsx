import { useState } from 'react';
import { usePlanFeatures, FEATURE_REQUIRED_PLAN } from '@/hooks/usePlanFeatures';
import { UpgradeModal } from './UpgradeModal';

type FeatureKey = keyof ReturnType<typeof usePlanFeatures>['features'];

interface FeatureGateProps {
  feature: FeatureKey;
  planoNecessario?: 'Starter' | 'Pro' | 'Enterprise';
  children: React.ReactNode;
  /** Block entire interaction (no dimmed children teaser). Default false. */
  hideContent?: boolean;
}

export function FeatureGate({ feature, planoNecessario, children, hideContent = false }: FeatureGateProps) {
  const { features } = usePlanFeatures();
  const [showModal, setShowModal] = useState(false);

  const isAvailable = features[feature] as boolean;

  if (isAvailable) return <>{children}</>;

  const requiredPlan = planoNecessario ?? (FEATURE_REQUIRED_PLAN[feature] as 'Starter' | 'Pro' | 'Enterprise' | undefined) ?? 'Starter';

  if (hideContent) {
    return (
      <>
        <div
          onClick={() => setShowModal(true)}
          style={{ cursor: 'pointer', display: 'contents' }}
        >
          {/* placeholder so layout isn't disrupted */}
        </div>
        {showModal && (
          <UpgradeModal
            feature={feature}
            planoNecessario={requiredPlan}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div
        style={{ position: 'relative', display: 'block' }}
        onClick={() => setShowModal(true)}
      >
        {/* Dimmed children (teaser) */}
        <div style={{ opacity: 0.45, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>

        {/* Click-interceptor overlay */}
        <div
          style={{
            position: 'absolute', inset: 0,
            cursor: 'pointer',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            padding: '6px 8px',
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: '11px', lineHeight: 1,
              background: 'rgba(0,0,0,0.55)',
              color: '#fff',
              borderRadius: '5px',
              padding: '3px 6px',
              display: 'flex', alignItems: 'center', gap: '4px',
              backdropFilter: 'blur(4px)',
              whiteSpace: 'nowrap',
            }}
          >
            🔒 {requiredPlan}
          </span>
        </div>
      </div>

      {showModal && (
        <UpgradeModal
          feature={feature}
          planoNecessario={requiredPlan}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
