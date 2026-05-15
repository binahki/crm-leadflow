-- Add 'ativo' column to configuracoes_whatsapp
ALTER TABLE public.configuracoes_whatsapp ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Also add it to whatsapp_accounts if that's what's used in the inbox
ALTER TABLE public.whatsapp_accounts ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
