-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  cidade TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  entrada TEXT,
  wa_sent BOOLEAN DEFAULT false,
  observacoes TEXT,
  quiz_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Allow anonymous webhook inserts" ON public.leads FOR INSERT WITH CHECK (user_id IS NULL);

-- Create campanhas table
CREATE TABLE public.campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_campaign_id TEXT,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  objective TEXT,
  budget NUMERIC DEFAULT 0,
  budget_type TEXT,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  leads_api INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campanhas" ON public.campanhas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create campanhas" ON public.campanhas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own campanhas" ON public.campanhas FOR UPDATE USING (auth.uid() = user_id);

-- Create criativos table
CREATE TABLE public.criativos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_creative_id TEXT,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  effective_status TEXT DEFAULT 'ACTIVE',
  adset_name TEXT,
  campaign_name TEXT,
  spend NUMERIC DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpl NUMERIC DEFAULT 0,
  leads INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.criativos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own criativos" ON public.criativos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create criativos" ON public.criativos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own criativos" ON public.criativos FOR UPDATE USING (auth.uid() = user_id);

-- Create configuracoes_whatsapp table
CREATE TABLE public.configuracoes_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT,
  instance_id TEXT,
  message_template TEXT,
  auto_send BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.configuracoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wa config" ON public.configuracoes_whatsapp FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create wa config" ON public.configuracoes_whatsapp FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own wa config" ON public.configuracoes_whatsapp FOR UPDATE USING (auth.uid() = user_id);

-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook logs" ON public.webhook_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create webhook logs" ON public.webhook_logs FOR INSERT WITH CHECK (true);

-- Enable realtime for leads and webhook_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.webhook_logs;

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_campanhas_updated_at BEFORE UPDATE ON public.campanhas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_criativos_updated_at BEFORE UPDATE ON public.criativos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wa_config_updated_at BEFORE UPDATE ON public.configuracoes_whatsapp FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();