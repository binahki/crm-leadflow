const UTM_RASTREADOS      = ['FB','fb','ig','IG','facebook','Facebook','Instagram','instagram'];
const UTM_MANUAL_TRAFEGO  = ['Tráfego Pago','trafego pago','Tráfego Antigo','trafego antigo','meta','Meta'];
const UTM_ORGANICO        = ['instagram_organico','organico','organic','Orgânico','orgânico','google','direto','seo'];
const ORIGIN_TAG_NAMES    = ['Meta Ads', 'Indicação', 'Orgânico', 'Outros'];

// FB/ig COM utm_campaign = rastreado pelo pixel → sem tag
// FB/ig SEM utm_campaign = inserido manualmente → 'Meta Ads'
// Retorno → 'Outros' (canal unificado)
// Sem utm_source → null (sem tag)
export function mapUtmSourceParaNomeTag(
  utmSource: string | null | undefined,
  utmCampaign: string | null | undefined,
): string | null {
  if (!utmSource || utmSource.trim() === '') return null;
  const s = utmSource.trim();

  if (UTM_RASTREADOS.includes(s)) {
    return utmCampaign && utmCampaign.trim() !== '' ? null : 'Meta Ads';
  }
  if (UTM_MANUAL_TRAFEGO.includes(s)) return 'Meta Ads';
  if (s === 'Indicação') return 'Indicação';
  if (UTM_ORGANICO.includes(s.toLowerCase())) return 'Orgânico';
  if (s === 'Retorno') return 'Outros';
  return 'Outros';
}

const CORES_ORIGENS: Record<string, string> = {
  'Meta Ads': '#3b82f6',
  'Indicação': '#10b981',
  'Orgânico': '#8b5cf6',
  'Outros': '#71717a',
};

export async function aplicarTagOrigem(
  supabase: any,
  leadId: string | number,
  orgId: string,
  utmSource: string | null | undefined,
  utmCampaign: string | null | undefined,
): Promise<void> {
  const nomeTag = mapUtmSourceParaNomeTag(utmSource, utmCampaign);
  if (!nomeTag) return;

  try {
    let tagId: string | null = null;

    const { data: tag } = await supabase
      .from('tags')
      .select('id')
      .eq('org_id', orgId)
      .eq('nome', nomeTag)
      .maybeSingle();

    if (tag) {
      tagId = tag.id;
    } else {
      const cor = CORES_ORIGENS[nomeTag] || '#8b5cf6';
      const { data: newTag, error: createErr } = await supabase
        .from('tags')
        .insert({ org_id: orgId, nome: nomeTag, cor })
        .select('id')
        .single();

      if (createErr) {
        console.error('[tagOrigem] falha ao criar tag:', nomeTag, createErr.message);
        return;
      }
      tagId = newTag.id;
    }

    const { data: tagsOrg } = await supabase
      .from('tags')
      .select('id')
      .eq('org_id', orgId)
      .in('nome', ORIGIN_TAG_NAMES);

    if (tagsOrg?.length) {
      const idsParaRemover = tagsOrg
        .map((t: any) => t.id)
        .filter((id: string) => id !== tagId);
      if (idsParaRemover.length > 0) {
        await supabase
          .from('lead_tags')
          .delete()
          .eq('lead_id', leadId)
          .in('tag_id', idsParaRemover);
      }
    }

    const { error: upsertErr } = await supabase
      .from('lead_tags')
      .upsert(
        { lead_id: leadId, tag_id: tagId },
        { onConflict: 'lead_id,tag_id', ignoreDuplicates: true },
      );
    if (upsertErr) console.error('[tagOrigem] falha ao salvar lead_tag:', upsertErr.message);
  } catch (err) {
    console.error('[tagOrigem] erro inesperado:', err);
  }
}
