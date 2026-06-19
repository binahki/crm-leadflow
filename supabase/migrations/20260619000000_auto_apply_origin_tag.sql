-- Auto-apply lead origin tags function and trigger
CREATE OR REPLACE FUNCTION public.auto_apply_lead_origin_tag()
RETURNS TRIGGER AS $$
DECLARE
  v_nome_tag TEXT;
  v_cor_tag TEXT;
  v_tag_id UUID;
  v_utm_source TEXT;
  v_utm_campaign TEXT;
  v_origin_tag_names TEXT[] := ARRAY['Meta Ads', 'Indicação', 'Orgânico', 'Outros'];
  v_utm_rastreados TEXT[] := ARRAY['FB','fb','ig','IG','facebook','Facebook','Instagram','instagram'];
  v_utm_manual_trafego TEXT[] := ARRAY['Tráfego Pago','trafego pago','Tráfego Antigo','trafego antigo','meta','Meta'];
  v_utm_organico TEXT[] := ARRAY['instagram_organico','organico','organic','Orgânico','orgânico','google','direto','seo'];
BEGIN
  v_utm_source := TRIM(NEW.utm_source);
  v_utm_campaign := TRIM(NEW.utm_campaign);

  IF v_utm_source IS NULL OR v_utm_source = '' THEN
    RETURN NEW;
  END IF;

  -- Map to tag name
  IF v_utm_source = ANY(v_utm_rastreados) THEN
    IF v_utm_campaign IS NOT NULL AND v_utm_campaign <> '' THEN
      v_nome_tag := NULL;
    ELSE
      v_nome_tag := 'Meta Ads';
    END IF;
  ELSIF v_utm_source = ANY(v_utm_manual_trafego) THEN
    v_nome_tag := 'Meta Ads';
  ELSIF v_utm_source = 'Indicação' THEN
    v_nome_tag := 'Indicação';
  ELSIF LOWER(v_utm_source) = ANY(v_utm_organico) THEN
    v_nome_tag := 'Orgânico';
  ELSIF v_utm_source = 'Retorno' THEN
    v_nome_tag := 'Outros';
  ELSE
    v_nome_tag := 'Outros';
  END IF;

  IF v_nome_tag IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine tag color
  IF v_nome_tag = 'Meta Ads' THEN
    v_cor_tag := '#3b82f6';
  ELSIF v_nome_tag = 'Indicação' THEN
    v_cor_tag := '#10b981';
  ELSIF v_nome_tag = 'Orgânico' THEN
    v_cor_tag := '#8b5cf6';
  ELSE
    v_cor_tag := '#71717a';
  END IF;

  -- Ensure tag exists for organization
  SELECT id INTO v_tag_id
  FROM public.tags
  WHERE org_id = NEW.org_id AND nome = v_nome_tag
  LIMIT 1;

  IF v_tag_id IS NULL THEN
    INSERT INTO public.tags (org_id, nome, cor)
    VALUES (NEW.org_id, v_nome_tag, v_cor_tag)
    RETURNING id INTO v_tag_id;
  END IF;

  -- Remove other origin tags from lead
  DELETE FROM public.lead_tags
  WHERE lead_id = NEW.id
    AND tag_id IN (
      SELECT id FROM public.tags
      WHERE org_id = NEW.org_id AND nome = ANY(v_origin_tag_names) AND id <> v_tag_id
    );

  -- Upsert lead_tags
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
