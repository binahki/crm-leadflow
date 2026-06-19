import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from './useOrgId';
import { STATUS_PRESETS } from './useTerminology';
import { STATUS_CONFIG } from '@/stores/appStore';

export interface StatusItem {
  id: number;
  label: string;
  cor: string;
  ordem: number;
  sla_horas?: number;
  sla_unidade?: string;
  tipo?: 'reuniao' | 'padrao';
}

export interface StatusConfig {
  entrada_status: number;
  convertido_status: number;
  statuses: StatusItem[];
}

const REVENDA_SEQUENCE = [1, 2, 5, 3, 6, 4];
const DEFAULT_SEQUENCE = [1, 2, 3, 4, 5, 6];

function normalizarStatuses(statuses: StatusItem[]): StatusItem[] {
  // If any status already has tipo defined, trust the existing data
  if (statuses.some(s => (s as any).tipo)) return statuses;
  // Auto-detect from label (fallback for orgs without status_config set)
  return statuses.map(s => {
    const lbl = (s.label || '').toLowerCase();
    const isReuniao =
      lbl.includes('reuni') ||
      lbl.includes('meeting') ||
      lbl.includes('onboard') ||
      lbl.includes('remarcar');
    return isReuniao ? { ...s, tipo: 'reuniao' as const } : s;
  });
}

export function getDefaultStatusConfig(modelo: string): StatusConfig {
  const preset = STATUS_PRESETS[modelo] || STATUS_PRESETS['revenda'];
  const sequence = modelo === 'revenda' ? REVENDA_SEQUENCE : DEFAULT_SEQUENCE;

  return {
    entrada_status: 1,
    convertido_status: modelo === 'revenda' ? 3 : 4,
    statuses: normalizarStatuses(
      sequence
        .filter(id => preset[id] != null)
        .map((id, idx) => ({
          id,
          label: preset[id],
          cor: STATUS_CONFIG[id]?.dot ?? '#6b7280',
          ordem: idx + 1,
        }))
    ),
  };
}

const configCache: Record<string, StatusConfig> = {};

export function useStatusConfig(modelo: string): {
  config: StatusConfig;
  loading: boolean;
  reload: () => void;
} {
  const { orgId, ready } = useOrgId();
  const defaultCfg = getDefaultStatusConfig(modelo);
  const [config, setConfig] = useState<StatusConfig>(
    orgId && configCache[orgId] ? configCache[orgId] : defaultCfg
  );
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [lastOrgId, setLastOrgId] = useState<string | null>(null);

  if (orgId !== lastOrgId) {
    setLastOrgId(orgId);
    setLoading(true);
    if (orgId && configCache[orgId]) {
      setConfig(configCache[orgId]);
    } else {
      setConfig(defaultCfg);
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase as any)
      .from('organizations')
      .select('status_config, modelo_negocio')
      .eq('id', orgId)
      .single()
      .then(({ data }: any) => {
        if (data?.status_config?.statuses?.length) {
          const normalized: StatusConfig = {
            ...data.status_config,
            statuses: normalizarStatuses(data.status_config.statuses),
          };
          configCache[orgId] = normalized;
          setConfig(normalized);
        } else {
          const def = getDefaultStatusConfig(data?.modelo_negocio || modelo);
          configCache[orgId] = def;
          setConfig(def);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [orgId, ready, tick]); // eslint-disable-line

  return { config, loading, reload: () => setTick(t => t + 1) };
}

export function invalidateStatusConfigCache(orgId: string) {
  delete configCache[orgId];
}
