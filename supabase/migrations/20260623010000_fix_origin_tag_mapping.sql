CREATE OR REPLACE FUNCTION public.auto_apply_lead_origin_tag()
RETURNS TRIGGER AS $$
DECLARE
  v_nome_tag TEXT;
  v_cor_tag TEXT;
  v_tag_id UUID;
  v_utm_source TEXT;
  v_utm_campaign TEXT;
  v_origin_tag_names TEXT[] := ARRAY['Meta Ads', 'Indicação', 'Orgânico', 'Outros'];
BEGIN
  v_utm_source := UPPER(TRIM(COALESCE(NEW.utm_source, '')));
  v_utm_source := TRANSLATE(v_utm_source, 'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC');
  v_utm_campaign := TRIM(COALESCE(NEW.utm_campaign, ''));

  IF v_utm_source = '' THEN
    v_nome_tag := 'Outros';
  ELSIF v_utm_source IN ('FB', 'FACEBOOK', 'META', 'IG_BOOST', 'TRAFEGO PAGO', 'TRAFEGO ANTIGO', 'CAMPANHA')
    OR v_utm_source LIKE 'FB%'
    OR v_utm_source LIKE '%TRAFEGO%'
    OR v_utm_source LIKE '%PAGO%'
    OR v_utm_source LIKE '%CAMPANHA%' THEN
    v_nome_tag := 'Meta Ads';
  ELSIF v_utm_campaign <> '' AND v_utm_source IN ('IG', 'INSTAGRAM') THEN
    v_nome_tag := 'Meta Ads';
  ELSIF v_utm_source LIKE '%INDICAC%' THEN
    v_nome_tag := 'Indicação';
  ELSIF v_utm_source LIKE '%INSTAGRAM%'
    OR v_utm_source LIKE '%ORGANICO%'
    OR v_utm_source IN ('IG', 'ORGANIC', 'GOOGLE', 'DIRETO', 'SEO') THEN
    v_nome_tag := 'Orgânico';
  ELSE
    v_nome_tag := 'Outros';
  END IF;

  IF v_nome_tag = 'Meta Ads' THEN
    v_cor_tag := '#3b82f6';
  ELSIF v_nome_tag = 'Indicação' THEN
    v_cor_tag := '#10b981';
  ELSIF v_nome_tag = 'Orgânico' THEN
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
  AFTER INSERT OR UPDATE OF utm_source, utm_campaign ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_lead_origin_tag();

UPDATE public.leads
SET utm_source = utm_source
WHERE org_id IS NOT NULL;
