const TAG_META = 'Meta Ads';
const TAG_INDICACAO = 'Indica\u00e7\u00e3o';
const TAG_ORGANICO = 'Org\u00e2nico';
const TAG_OUTROS = 'Outros';

const ORIGIN_TAG_NAMES = [TAG_META, TAG_INDICACAO, TAG_ORGANICO, TAG_OUTROS];

function normalizeOrigin(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

export function mapUtmSourceParaNomeTag(
  utmSource: string | null | undefined,
  utmCampaign: string | null | undefined,
): string | null {
  const s = normalizeOrigin(utmSource);
  const hasTrackedCampaign = !!utmCampaign?.trim();

  // Leads com UTM de campanha não recebem tag — a origem deles é rastreada via UTM
  if (!s || hasTrackedCampaign) return null;
  // Leads com utm_source reconhecido como tráfego de anúncio (sem campaign) também sem tag
  const adSources = ['FB', 'FACEBOOK', 'IG', 'INSTAGRAM', 'META', 'IG_BOOST'];
  if (adSources.includes(s) || s.startsWith('FB') || s.includes('FBCLID')) return null;

  if (s.includes('INDICAC')) return TAG_INDICACAO;
  if (s === 'TRAFEGO PAGO' || s === 'TRAFEGO ANTIGO' || s.includes('TRAFEGO') || s.includes('PAGO')) return TAG_META;
  if (s === 'INSTAGRAM ORGANICO' || s === 'INSTAGRAM_ORGANICO' || s === 'ORGANICO' || s === 'ORGANIC' || s === 'GOOGLE' || s === 'DIRETO' || s === 'SEO') return TAG_ORGANICO;
  return TAG_OUTROS;
}

const CORES_ORIGENS: Record<string, string> = {
  [TAG_META]: '#3b82f6',
  [TAG_INDICACAO]: '#10b981',
  [TAG_ORGANICO]: '#8b5cf6',
  [TAG_OUTROS]: '#71717a',
};

export async function aplicarTagOrigem(
  supabase: any,
  leadId: string | number,
  orgId: string,
  utmSource: string | null | undefined,
  utmCampaign: string | null | undefined,
): Promise<void> {
  const nomeTag = mapUtmSourceParaNomeTag(utmSource, utmCampaign);

  try {
    const { data: tagsOrg } = await supabase
      .from('tags')
      .select('id')
      .eq('org_id', orgId)
      .in('nome', ORIGIN_TAG_NAMES);

    if (!nomeTag) {
      if (tagsOrg?.length) {
        await supabase
          .from('lead_tags')
          .delete()
          .eq('lead_id', leadId)
          .in('tag_id', tagsOrg.map((t: any) => t.id));
      }
      return;
    }

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
