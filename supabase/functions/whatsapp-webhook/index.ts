import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token) {
      const { data } = await db
        .from('whatsapp_accounts')
        .select('id')
        .eq('webhook_verify_token', token)
        .single();
      if (data) return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'POST') {
    const body = await req.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    if (!value) return new Response('ok', { status: 200 });

    const phoneNumberId = value.metadata?.phone_number_id;
    const { data: account } = await db
      .from('whatsapp_accounts')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .single();
    if (!account) return new Response('ok', { status: 200 });

    const orgId = account.org_id;

    for (const msg of (value.messages || [])) {
      const contactPhone = msg.from;
      const contactName = value.contacts?.[0]?.profile?.name || contactPhone;
      const content = msg.text?.body || msg.type || '';
      const wamid = msg.id;

      const { data: conv } = await db
        .from('whatsapp_conversations')
        .upsert(
          {
            org_id: orgId,
            contact_phone: contactPhone,
            contact_name: contactName,
            last_message: content,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,contact_phone' }
        )
        .select()
        .single();

      if (conv) {
        await db
          .from('whatsapp_conversations')
          .update({ unread_count: (conv.unread_count || 0) + 1 })
          .eq('id', conv.id);

        await db
          .from('whatsapp_messages')
          .upsert(
            {
              org_id: orgId,
              conversation_id: conv.id,
              wamid,
              direction: 'inbound',
              type: msg.type || 'text',
              content,
              status: 'received',
              created_at: new Date(parseInt(msg.timestamp) * 1000).toISOString(),
            },
            { onConflict: 'wamid', ignoreDuplicates: true }
          );

        // Vincula lead automaticamente
        const digits = contactPhone.slice(-9);
        const { data: lead } = await db
          .from('leads')
          .select('id')
          .ilike('whatsapp', `%${digits}`)
          .limit(1)
          .single();
        if (lead && !conv.lead_id) {
          await db
            .from('whatsapp_conversations')
            .update({ lead_id: lead.id })
            .eq('id', conv.id);
        }
      }
    }

    for (const st of (value.statuses || [])) {
      await db
        .from('whatsapp_messages')
        .update({ status: st.status })
        .eq('wamid', st.id);
    }

    return new Response('ok', { status: 200 });
  }

  return new Response('Method not allowed', { status: 405 });
});
