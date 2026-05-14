import { supabase } from '@/integrations/supabase/client';

interface OpenWhatsAppParams {
  phone: string;
  name?: string | null;
  leadId?: string | null;
  orgId: string;
  navigate: (path: string) => void;
}

/**
 * Helper to open a WhatsApp conversation within the CRM or fallback to wa.me.
 * Logic:
 * 1. Check if org has active WhatsApp Cloud API integration.
 * 2. Check if there is an active 24h session for this contact.
 * 3. If session active -> Open internal CRM inbox.
 * 4. If no session/no integration -> Open wa.me with pre-filled message.
 */
export async function openWhatsAppConversation({
  phone,
  name,
  leadId,
  orgId,
  navigate,
}: OpenWhatsAppParams) {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return;
  const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;
  
  const firstName = name ? name.split(' ')[0] : 'lá';
  const defaultMessage = encodeURIComponent(`Oi ${firstName}, vi que você foi aprovada para revender nossas semijoias ✨`);
  const waMeUrl = `https://wa.me/${fullPhone}?text=${defaultMessage}`;

  try {
    // 1. Check if org has active WhatsApp Account
    const { data: waAccount } = await (supabase as any)
      .from('whatsapp_accounts')
      .select('id, status')
      .eq('org_id', orgId)
      .eq('status', 'active')
      .maybeSingle();

    if (!waAccount) {
      window.open(waMeUrl, '_blank');
      return;
    }

    // 2. Check for active session in internal conversations
    const { data: existing } = await (supabase as any)
      .from('whatsapp_conversations')
      .select('id, session_active, session_expires_at')
      .eq('org_id', orgId)
      .eq('contact_phone', fullPhone)
      .maybeSingle();

    const now = new Date();
    const isSessionActive = existing?.session_active && 
                           existing?.session_expires_at && 
                           new Date(existing.session_expires_at) > now;

    if (isSessionActive) {
      // Abre o inbox interno
      navigate(`/whatsapp?conversation=${existing.id}`);
    } else {
      // Abre wa.me se não houver sessão ativa
      window.open(waMeUrl, '_blank');
      
      // Se a conversa não existia no banco, cria ela (em modo inativo) para tracking futuro
      if (!existing) {
        await (supabase as any)
          .from('whatsapp_conversations')
          .insert({
            org_id: orgId,
            contact_phone: fullPhone,
            contact_name: name || null,
            lead_id: leadId || null,
            unread_count: 0,
            session_active: false
          });
      }
    }
  } catch (error) {
    console.error('[openWhatsApp] Unexpected error:', error);
    window.open(waMeUrl, '_blank');
  }
}
