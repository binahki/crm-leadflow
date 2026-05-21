import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrgId } from './useOrgId';

export interface Terminology {
  leadSingular: string;
  leadPlural: string;
  convertidoSingular: string;
  convertidoPlural: string;
  convertidoCurto: string;
  statusConvertidoLabel: string;
  custoConversaoSigla: string;
  custoConversaoCompleto: string;
}

export const DEFAULT_TERMINOLOGY: Terminology = {
  leadSingular: 'lead',
  leadPlural: 'leads',
  convertidoSingular: 'revendedora',
  convertidoPlural: 'revendedoras',
  convertidoCurto: 'rev',
  statusConvertidoLabel: 'Aprovada',
  custoConversaoSigla: 'CPR',
  custoConversaoCompleto: 'Custo por Revendedora',
};

export const TERMINOLOGY_PRESETS: Record<string, Terminology> = {
  revenda: DEFAULT_TERMINOLOGY,
  b2b: {
    leadSingular: 'lead',
    leadPlural: 'leads',
    convertidoSingular: 'cliente',
    convertidoPlural: 'clientes',
    convertidoCurto: 'cli',
    statusConvertidoLabel: 'Fechado',
    custoConversaoSigla: 'CAC',
    custoConversaoCompleto: 'Custo de Aquisição',
  },
  ecommerce: {
    leadSingular: 'visitante',
    leadPlural: 'visitantes',
    convertidoSingular: 'comprador',
    convertidoPlural: 'compradores',
    convertidoCurto: 'comp',
    statusConvertidoLabel: 'Comprou',
    custoConversaoSigla: 'CPA',
    custoConversaoCompleto: 'Custo por Aquisição',
  },
};

function fromDb(raw: Record<string, string>): Terminology {
  return {
    leadSingular: raw.lead_singular || DEFAULT_TERMINOLOGY.leadSingular,
    leadPlural: raw.lead_plural || DEFAULT_TERMINOLOGY.leadPlural,
    convertidoSingular: raw.convertido_singular || DEFAULT_TERMINOLOGY.convertidoSingular,
    convertidoPlural: raw.convertido_plural || DEFAULT_TERMINOLOGY.convertidoPlural,
    convertidoCurto: raw.convertido_curto || DEFAULT_TERMINOLOGY.convertidoCurto,
    statusConvertidoLabel: raw.status_convertido_label || DEFAULT_TERMINOLOGY.statusConvertidoLabel,
    custoConversaoSigla: raw.custo_conversao_sigla || DEFAULT_TERMINOLOGY.custoConversaoSigla,
    custoConversaoCompleto: raw.custo_conversao_completo || DEFAULT_TERMINOLOGY.custoConversaoCompleto,
  };
}

export function toDb(t: Terminology): Record<string, string> {
  return {
    lead_singular: t.leadSingular,
    lead_plural: t.leadPlural,
    convertido_singular: t.convertidoSingular,
    convertido_plural: t.convertidoPlural,
    convertido_curto: t.convertidoCurto,
    status_convertido_label: t.statusConvertidoLabel,
    custo_conversao_sigla: t.custoConversaoSigla,
    custo_conversao_completo: t.custoConversaoCompleto,
  };
}

// Módulo-level cache — evita re-fetch a cada re-render
const cache: Record<string, Terminology> = {};

export function useTerminology(): Terminology {
  const { orgId, ready } = useOrgId();

  const initial = orgId && cache[orgId] ? cache[orgId] : DEFAULT_TERMINOLOGY;
  const [t, setT] = useState<Terminology>(initial);

  useEffect(() => {
    if (!ready || !orgId) return;
    if (cache[orgId]) { setT(cache[orgId]); return; }

    (supabase as any)
      .from('organizations')
      .select('terminology')
      .eq('id', orgId)
      .single()
      .then(({ data }: any) => {
        const term: Terminology = data?.terminology
          ? fromDb(data.terminology as Record<string, string>)
          : DEFAULT_TERMINOLOGY;
        cache[orgId] = term;
        setT(term);
      })
      .catch(() => {
        cache[orgId] = DEFAULT_TERMINOLOGY;
        setT(DEFAULT_TERMINOLOGY);
      });
  }, [orgId, ready]);

  return t;
}

/** Retorna o label de exibição para um status numérico, usando a terminologia da org. */
export function getStatusLabel(status: number, t: Terminology): string {
  const labels: Record<number, string> = {
    0: 'Em atendimento',
    1: 'Em atendimento',
    2: 'Reunião',
    3: t.statusConvertidoLabel,
    4: 'Reprovada',
    5: 'Aguardando retorno',
  };
  return labels[status] ?? String(status);
}

/** Invalida o cache de uma org (útil após salvar nova terminologia em Settings). */
export function invalidateTerminologyCache(orgId: string) {
  delete cache[orgId];
}
