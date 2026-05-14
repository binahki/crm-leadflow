import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEDIA_TYPES = ['image', 'audio', 'video', 'document', 'sticker'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === 'GET') {
    // Proxy de mídia
    if (url.searchParams.get('action') === 'media') {
      const mediaId = url.searchParams.get('media_id');
      const orgId = url.searchParams.get('org_id');
      if (!mediaId || !orgId) return new Response('Missing params', { status: 400, headers: corsHeaders });

      const { data: acc } = await db.from('whatsapp_accounts').select('token').eq('org_id', orgId).maybeSingle();
      if (!acc?.token) return new Response('Account not found', { status: 404, headers: corsHeaders });

      const infoRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${acc.token}` }
      });
      if (!infoRes.ok) return new Response('Media not found', { status: 404, headers: corsHeaders });
      
      const info = await infoRes.json();
      if (!info.url) return new Response('No URL', { status: 404, headers: corsHeaders });

      const mediaRes = await fetch(info.url, {
        headers: { Authorization: `Bearer ${acc.token}` }
      });
      if (!mediaRes.ok) return new Response('Failed to fetch media', { status: mediaRes.status, headers: corsHeaders });

      const buffer = await mediaRes.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': info.mime_type || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' }
      });
    }

    // Verificação do webhook
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token) {
      const { data } = await db.from('whatsapp_accounts').select('id').eq('webhook_verify_token', token).maybeSingle();
      if (data || token === 'floow_verify_token') {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  if (req.method === 'POST') {
    const body = await req.json();

    // Enviar mensagem
    if (url.searchParams.get('action') === 'send') {
      const { org_id, conversation_id, text } = body;
      const { data: acc } = await db.from('whatsapp_accounts').select('phone_number_id, token').eq('org_id', org_id).maybeSingle();
      if (!acc) return new Response(JSON.stringify({ error: 'Conta não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: conv } = await db.from('whatsapp_conversations').select('contact_phone').eq('id', conversation_id).maybeSingle();
      if (!conv) return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const metaRes = await fetch(`https://graph.facebook.com/v18.0/${acc.phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${acc.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: conv.contact_phone, type: 'text', text: { body: text } })
      });
      const metaJson = await metaRes.json();
      if (!metaRes.ok) return new Response(JSON.stringify(metaJson), { status: metaRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const wamid = metaJson?.messages?.[0]?.id || null;
      const now = new Date().toISOString();
      const { data: newMsg } = await db.from('whatsapp_messages').insert({ org_id, conversation_id, wamid, direction: 'outbound', type: 'text', content: text, status: 'sent', created_at: now }).select().single();
      await db.from('whatsapp_conversations').update({ last_message: text, last_message_at: now }).eq('id', conversation_id);
      return new Response(JSON.stringify({ message: newMsg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Webhook da Meta
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value) return new Response('ok', { status: 200, headers: corsHeaders });

    const phoneNumberId = value.metadata?.phone_number_id;
    const { data: account } = await db.from('whatsapp_accounts').select('*').eq('phone_number_id', phoneNumberId).maybeSingle();
    if (!account) return new Response('ok', { status: 200, headers: corsHeaders });

    const orgId = account.org_id;

    for (const msg of (value.messages || [])) {
      const contactPhone = msg.from;
      const contactName = value.contacts?.[0]?.profile?.name || contactPhone;
      const msgType = msg.type || 'text';
      const wamid = msg.id;
      const now = new Date().toISOString();
      const msgTimestamp = msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000).toISOString() : now;
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      let content = msgType === 'text' ? msg.text?.body :
        msgType === 'document' ? `[Documento${msg.document?.filename ? ': ' + msg.document.filename : ''}]` :
        msgType === 'image' ? '[Imagem]' :
        msgType === 'audio' ? '[Áudio]' :
        msgType === 'video' ? '[Vídeo]' :
        msgType === 'sticker' ? '[Figurinha]' :
        msgType === 'reaction' ? (msg.reaction?.emoji || '❤️') :
        msgType === 'contacts' ? (msg.contacts?.map((c: any) => c.name?.formatted_name || 'Contato').join(', ')) :
        `[${msgType}]`;

      let mediaId: string | null = null;
      let mediaMimeType: string | null = null;

      if (MEDIA_TYPES.includes(msgType)) {
        const mediaObj = msg[msgType];
        if (mediaObj?.id) {
          mediaId = mediaObj.id;
          mediaMimeType = mediaObj.mime_type || null;
        }
      }

      // Busca conversa existente
      const { data: existingConv } = await db.from('whatsapp_conversations')
        .select('id, unread_count, lead_id')
        .eq('org_id', orgId)
        .eq('contact_phone', contactPhone)
        .maybeSingle();

      let convId: string;

      if (existingConv) {
        convId = existingConv.id;
        await db.from('whatsapp_conversations').update({
          contact_name: contactName,
          last_message: content,
          last_message_at: now,
          unread_count: (existingConv.unread_count || 0) + 1,
          session_active: true,
          session_expires_at: sessionExpires,
        }).eq('id', convId);
      } else {
        const { data: newConv, error: convErr } = await db.from('whatsapp_conversations').insert({
          org_id: orgId,
          contact_phone: contactPhone,
          contact_name: contactName,
          last_message: content,
          last_message_at: now,
          unread_count: 1,
          session_active: true,
          session_expires_at: sessionExpires,
        }).select('id, lead_id').single();
        if (convErr || !newConv) { console.error('[webhook] Erro ao criar conversa:', convErr); continue; }
        convId = newConv.id;
      }

      // Evita duplicata
      const { data: existingMsg } = await db.from('whatsapp_messages').select('id').eq('wamid', wamid).maybeSingle();
      if (!existingMsg) {
        const { error: msgErr } = await db.from('whatsapp_messages').insert({
          org_id: orgId,
          conversation_id: convId,
          wamid,
          direction: 'inbound',
          type: msgType,
          content,
          status: 'received',
          created_at: msgTimestamp,
          media_id: mediaId,
          media_mime_type: mediaMimeType,
        });
        if (msgErr) console.error('[webhook] Erro ao salvar mensagem:', msgErr);
      }

      // Vincula lead
      const { data: convAtual } = await db.from('whatsapp_conversations').select('lead_id').eq('id', convId).single();
      if (!convAtual?.lead_id) {
        const digits = contactPhone.replace(/\D/g, '');
        let lead = null;
        const { data: byLast9 } = await db.from('leads').select('id').eq('org_id', orgId).ilike('whatsapp', `%${digits.slice(-9)}`).maybeSingle();
        if (byLast9) lead = byLast9;
        if (!lead) {
          const { data: byLast8 } = await db.from('leads').select('id').eq('org_id', orgId).ilike('whatsapp', `%${digits.slice(-8)}`).maybeSingle();
          if (byLast8) lead = byLast8;
        }
        if (lead) await db.from('whatsapp_conversations').update({ lead_id: lead.id }).eq('id', convId);
      }
    }

    for (const st of (value.statuses || [])) {
      await db.from('whatsapp_messages').update({ status: st.status }).eq('wamid', st.id);
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
