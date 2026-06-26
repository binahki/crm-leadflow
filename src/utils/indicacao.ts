function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function isIndicacaoSource(value: unknown): boolean {
  return normalizeText(value).includes('INDICAC');
}

export function hasIndicacaoCost(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

export function precisaCustoIndicacaoParaConversao(lead: any, newStatus: number, convertidoStatus: number): boolean {
  return Number(newStatus) === Number(convertidoStatus)
    && isIndicacaoSource(lead?.utm_source)
    && !hasIndicacaoCost(lead?.custo_indicacao);
}

export function pedirCustoIndicacao(lead: any): number | null {
  const nome = lead?.nome ? ` para ${lead.nome}` : '';
  const atual = Number(lead?.custo_indicacao);
  const raw = window.prompt(`Esta indicação${nome} está sendo aprovada sem valor. Qual foi o valor real da indicação?`, Number.isFinite(atual) && atual > 0 ? String(atual) : '');
  if (raw === null) return null;
  const value = Number(raw.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
