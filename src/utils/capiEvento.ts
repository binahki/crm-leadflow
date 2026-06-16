// Fire-and-forget: dispara evento CAPI server-side para o Meta Ads.
// Nunca bloqueia a UI — erros são apenas logados no console.
export function dispararCapiConversao(leadId: number | string, orgId: string): void {
  fetch('https://obguidmfvfjaekaskgob.functions.supabase.co/meta-capi-evento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: leadId, tipo: 'conversao', org_id: orgId }),
  }).catch(err => console.warn('[CAPI] Erro ao disparar conversão:', err));
}
