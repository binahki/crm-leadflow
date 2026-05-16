// ── FONTE DA VERDADE — regras globais de métricas ───────────────
// Leads     = filtrar por created_at  (quando o lead entrou no funil)
// Revendedoras = filtrar por status_aprovado_at (quando foi aprovada)
// Reuniões  = filtrar por status_reuniao_at
// Contratos = filtrar por status_contrato_at

function parseDate(str?: string | null): Date {
  if (!str) return new Date(0);
  try {
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date(0) : d;
  } catch { return new Date(0); }
}

/** Leads que ENTRARAM no funil dentro do intervalo (usa created_at) */
export function filtrarLeadsPorPeriodo(leads: any[], inicio: Date, fim: Date): any[] {
  return leads.filter(l => {
    const d = parseDate(l.created_at);
    return d >= inicio && d <= fim;
  });
}

/** Revendedoras aprovadas dentro do intervalo (usa status_aprovado_at) */
export function filtrarRevendedorasPorPeriodo(leads: any[], inicio: Date, fim: Date): any[] {
  return leads.filter(l => {
    if (Number(l.status) !== 3) return false;
    const ref = l.status_aprovado_at || l.updated_at || l.created_at;
    const d = parseDate(ref);
    return d >= inicio && d <= fim;
  });
}

/** Leads num status específico, filtrados pelo timestamp do status */
export function filtrarStatusPorPeriodo(
  leads: any[],
  status: number,
  inicio: Date,
  fim: Date
): any[] {
  const campoData: Record<number, string> = {
    0: 'status_atendimento_at',
    1: 'status_atendimento_at',
    2: 'status_reuniao_at',
    5: 'status_contrato_at',
    3: 'status_aprovado_at',
  };
  return leads.filter(l => {
    if (Number(l.status) !== status) return false;
    const campo = campoData[status];
    const ref = (campo && l[campo]) ? l[campo] : (l.updated_at || l.created_at);
    const d = parseDate(ref);
    return d >= inicio && d <= fim;
  });
}

/** Converte um preset de período no intervalo { inicio, fim } em datas absolutas */
export function getPeriodoRange(preset: string, customFrom?: string, customTo?: string): { inicio: Date; fim: Date } {
  if (preset === 'custom' && customFrom && customTo) {
    return {
      inicio: new Date(customFrom + 'T00:00:00'),
      fim: new Date(customTo + 'T23:59:59.999'),
    };
  }

  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date();

  switch (preset) {
    case 'today':
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      inicio.setDate(inicio.getDate() - 1);
      inicio.setHours(0, 0, 0, 0);
      fim.setDate(fim.getDate() - 1);
      fim.setHours(23, 59, 59, 999);
      break;
    case '7days':
    case 'last_7d':
      inicio.setDate(inicio.getDate() - 6);
      inicio.setHours(0, 0, 0, 0);
      break;
    case '30days':
    case 'last_30d':
      inicio.setDate(inicio.getDate() - 29);
      inicio.setHours(0, 0, 0, 0);
      break;
    case 'month':
    case 'this_month':
    default:
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      break;
  }

  return { inicio, fim };
}

/** Mapa de campo de timestamp por status */
export const STATUS_TIMESTAMP_FIELD: Record<number, string> = {
  0: 'status_atendimento_at',
  1: 'status_atendimento_at',
  2: 'status_reuniao_at',
  5: 'status_contrato_at',
  3: 'status_aprovado_at',
};

/** Retorna o patch de timestamp a ser salvo junto com uma mudança de status */
export function getStatusTimestampPatch(newStatus: number): Record<string, string> {
  const campo = STATUS_TIMESTAMP_FIELD[newStatus];
  if (!campo) return {};
  return { [campo]: new Date().toISOString() };
}
