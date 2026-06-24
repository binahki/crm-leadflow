CREATE OR REPLACE FUNCTION public.auto_apply_lead_origin_tag()
RETURNS TRIGGER AS $$
DECLARE
  v_nome_tag TEXT;
  v_cor_tag TEXT;
  v_tag_id UUID;
  v_utm_source TEXT;
  v_has_tracked_utm BOOLEAN;
  v_origin_tag_names TEXT[] := ARRAY['Meta Ads', U&'Indica\00E7\00E3o', U&'Org\00E2nico', 'Outros'];
BEGIN
  v_utm_source := UPPER(TRIM(COALESCE(NEW.utm_source, '')));
  v_utm_source := TRANSLATE(
    v_utm_source,
    U&'\00C1\00C0\00C3\00C2\00C4\00C9\00C8\00CA\00CB\00CD\00CC\00CE\00CF\00D3\00D2\00D5\00D4\00D6\00DA\00D9\00DB\00DC\00C7',
    'AAAAAEEEEIIIIOOOOOUUUUC'
  );
  v_has_tracked_utm :=
    TRIM(COALESCE(NEW.utm_campaign, '')) <> ''
    OR TRIM(COALESCE(NEW.utm_medium, '')) <> ''
    OR TRIM(COALESCE(NEW.utm_content, '')) <> ''
    OR TRIM(COALESCE(NEW.utm_term, '')) <> '';

  IF v_utm_source = '' OR v_has_tracked_utm THEN
    DELETE FROM public.lead_tags
    WHERE lead_id = NEW.id
      AND tag_id IN (
        SELECT id FROM public.tags
        WHERE org_id = NEW.org_id AND nome = ANY(v_origin_tag_names)
      );
    RETURN NEW;
  END IF;

  IF v_utm_source IN ('TRAFEGO PAGO', 'TRAFEGO ANTIGO') THEN
    v_nome_tag := 'Meta Ads';
  ELSIF v_utm_source LIKE '%INDICAC%' THEN
    v_nome_tag := U&'Indica\00E7\00E3o';
  ELSIF v_utm_source IN ('INSTAGRAM ORGANICO', 'INSTAGRAM_ORGANICO', 'ORGANICO', 'ORGANIC', 'GOOGLE', 'DIRETO', 'SEO') THEN
    v_nome_tag := U&'Org\00E2nico';
  ELSIF v_utm_source IN ('RETORNO', 'MANUAL', 'OUTRO') THEN
    v_nome_tag := 'Outros';
  ELSE
    v_nome_tag := 'Outros';
  END IF;

  IF v_nome_tag = 'Meta Ads' THEN
    v_cor_tag := '#3b82f6';
  ELSIF v_nome_tag = U&'Indica\00E7\00E3o' THEN
    v_cor_tag := '#10b981';
  ELSIF v_nome_tag = U&'Org\00E2nico' THEN
    v_cor_tag := '#8b5cf6';
  ELSE
    v_cor_tag := '#71717a';
  END IF;

  SELECT id INTO v_tag_id
  FROM public.tags
  WHERE org_id = NEW.org_id AND nome = v_nome_tag
  LIMIT 1;

  IF v_tag_id IS NULL THEN
    INSERT INTO public.tags (org_id, nome, cor)
    VALUES (NEW.org_id, v_nome_tag, v_cor_tag)
    RETURNING id INTO v_tag_id;
  END IF;

  DELETE FROM public.lead_tags
  WHERE lead_id = NEW.id
    AND tag_id IN (
      SELECT id FROM public.tags
      WHERE org_id = NEW.org_id AND nome = ANY(v_origin_tag_names) AND id <> v_tag_id
    );

  INSERT INTO public.lead_tags (lead_id, tag_id)
  VALUES (NEW.id, v_tag_id)
  ON CONFLICT (lead_id, tag_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_apply_lead_origin_tag ON public.leads;
CREATE TRIGGER trigger_auto_apply_lead_origin_tag
  AFTER INSERT OR UPDATE OF utm_source, utm_campaign, utm_medium, utm_content, utm_term ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_lead_origin_tag();

UPDATE public.leads
SET utm_source = utm_source
WHERE org_id IS NOT NULL;
