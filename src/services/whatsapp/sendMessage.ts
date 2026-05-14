import { supabase } from '@/integrations/supabase/client';

interface SendMessageParams {
  orgId: string;
  conversationId: string;
  text: string;
}

export async function sendWhatsAppMessage({ orgId, conversationId, text }: SendMessageParams) {
  try {
    const projectUrl = 'obguidmfvfjaekaskgob'; // ID do projeto Supabase
    const webhookUrl = `https://${projectUrl}.supabase.co/functions/v1/whatsapp-webhook?action=send`;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        org_id: orgId,
        conversation_id: conversationId,
        text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Erro ao enviar mensagem',
        requiresInitiation: response.status === 403 && data.requiresInitiation
      };
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error: any) {
    console.error('[WhatsApp Service] Send error:', error);
    return {
      success: false,
      error: error.message || 'Erro inesperado ao enviar mensagem'
    };
  }
}
