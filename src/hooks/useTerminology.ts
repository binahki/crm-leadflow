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
  corretor: {
    leadSingular: 'lead',
    leadPlural: 'leads',
    convertidoSingular: 'cliente',
    convertidoPlural: 'clientes',
    convertidoCurto: 'cli',
    statusConvertidoLabel: 'Contrato',
    custoConversaoSigla: 'CPC',
    custoConversaoCompleto: 'Custo por Contrato',
  },
  outro: {
    leadSingular: 'lead',
    leadPlural: 'leads',
    convertidoSingular: 'cliente',
    convertidoPlural: 'clientes',
    convertidoCurto: 'cli',
    statusConvertidoLabel: 'Convertido',
    custoConversaoSigla: 'CAC',
    custoConversaoCompleto: 'Custo de Aquisição',
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

/** Labels de status por modelo de negócio. */
export const STATUS_PRESETS: Record<string, Record<number, string>> = {
  revenda:   { 1: 'Em atendimento', 2: 'Reunião', 3: 'Aprovada',    4: 'Reprovado',  5: 'Contrato/App', 6: 'Sem Retorno' },
  corretor:  { 1: 'Em atendimento', 2: 'Visita',  3: 'Simulação',   4: 'Fechamento', 5: 'Sem Retorno',  6: 'Reprovado'   },
  b2b:       { 1: 'Em atendimento', 2: 'Reunião', 3: 'Proposta',    4: 'Fechado',    5: 'Sem Retorno',  6: 'Reprovado'   },
  outro:     { 1: 'Em atendimento', 2: 'Reunião', 3: 'Negociação',  4: 'Concluído',  5: 'Sem Retorno',  6: 'Reprovado'   },
  ecommerce: { 1: 'Em atendimento', 2: 'Reunião', 3: 'Carrinho',    4: 'Comprou',    5: 'Sem Retorno',  6: 'Reprovado'   },
};

/** Retorna o label de exibição para um status numérico. */
export function getStatusLabel(status: number, t: Terminology, modelo?: string): string {
  if (modelo && STATUS_PRESETS[modelo]) return STATUS_PRESETS[modelo][status] ?? String(status);
  const labels: Record<number, string> = {
    0: 'Aguardando',
    1: 'Em atendimento',
    2: 'Reunião',
    3: t.statusConvertidoLabel,
    4: 'Reprovado',
    5: 'Contrato/App',
    6: 'Sem Retorno',
  };
  return labels[status] ?? String(status);
}

// ── Modelo de negócio ───────────────────────────────────────────────────────
const modeloCache: Record<string, string> = {};

export function useModeloNegocio(): string {
  const { orgId, ready } = useOrgId();
  const [modelo, setModelo] = useState(orgId && modeloCache[orgId] ? modeloCache[orgId] : 'revenda');

  useEffect(() => {
    if (!ready || !orgId) return;
    if (modeloCache[orgId]) { setModelo(modeloCache[orgId]); return; }
    (supabase as any)
      .from('organizations')
      .select('modelo_negocio')
      .eq('id', orgId)
      .single()
      .then(({ data }: any) => {
        const m = data?.modelo_negocio || 'revenda';
        modeloCache[orgId] = m;
        setModelo(m);
      })
      .catch(() => { modeloCache[orgId] = 'revenda'; setModelo('revenda'); });
  }, [orgId, ready]);

  return modelo;
}

export function invalidateModeloCache(orgId: string) {
  delete modeloCache[orgId];
}

/** Invalida o cache de terminologia de uma org. */
export function invalidateTerminologyCache(orgId: string) {
  delete cache[orgId];
}

/** Retorna os IDs dos status intermediários entre entrada e conversão (exclusive ambos). */
export function getPotenciaisStatus(statusConfig: {
  statuses: Array<{ id: number; ordem: number }>;
  convertido_status: number;
  entrada_status: number;
}): number[] {
  const sorted = [...statusConfig.statuses].sort((a, b) => a.ordem - b.ordem);
  const convertidoIdx = sorted.findIndex(s => s.id === statusConfig.convertido_status);
  if (convertidoIdx <= 0) return [];
  return sorted.slice(1, convertidoIdx).map(s => s.id);
}
