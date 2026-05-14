import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(supabaseUrl, supabaseKey)

  try {
    const url = new URL(req.url)
    
    // 1. Verificação do Webhook (GET)
    if (req.method === 'GET') {
      console.log('[Webhook Verify] Request received')
      const mode = url.searchParams.get('hub.mode')
      const token = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      console.log(`[Webhook Verify] Mode: ${mode}, Token: ${token}`)

      if (mode === 'subscribe' && token) {
        const { data: acc } = await db.from('whatsapp_accounts').select('webhook_verify_token').eq('webhook_verify_token', token).maybeSingle()
        if (acc || token === 'floow_verify_token') {
          console.log('[Webhook Verify] Success!')
          return new Response(challenge, { status: 200 })
        } else {
          console.error('[Webhook Verify] Token mismatch or not found')
        }
      }
      return new Response('Forbidden', { status: 403 })
    }

    // 2. Recebimento de Mensagens/Status (POST)
    const body = await req.json()
    
    // LOG DE DEBUG PARA O USUÁRIO VER NO PAINEL DO SUPABASE
    console.log('--------------------------------------------------')
    console.log('WEBHOOK RECEIVED AT:', new Date().toISOString())
    console.log('PAYLOAD:', JSON.stringify(body, null, 2))
    console.log('--------------------------------------------------')

    // Ação interna do CRM: Enviar Mensagem
    if (url.searchParams.get('action') === 'send') {
      const { org_id, conversation_id, text } = body
      console.log(`[Action Send] Org: ${org_id}, Conv: ${conversation_id}`)
      
      const { data: account, error: accErr } = await db.from('whatsapp_accounts').select('phone_number_id, token').eq('org_id', org_id).single()
      if (!account || accErr) {
        console.error('[Action Send] Account error:', accErr)
        return new Response(JSON.stringify({ error: 'Conta não configurada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: conv, error: convErr } = await db.from('whatsapp_conversations').select('contact_phone, session_active, session_expires_at').eq('id', conversation_id).single()
      if (!conv || convErr) {
        console.error('[Action Send] Conv error:', convErr)
        return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const metaRes = await fetch(`https://graph.facebook.com/v18.0/${account.phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${account.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: conv.contact_phone,
          type: 'text',
          text: { body: text }
        })
      })

      const metaJson = await metaRes.json()
      if (!metaRes.ok) {
        console.error('[Action Send] Meta Error:', metaJson)
        return new Response(JSON.stringify({ error: metaJson }), { status: metaRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const wamid = metaJson.messages?.[0]?.id
      const { data: newMsg } = await db.from('whatsapp_messages').insert({
        conversation_id,
        org_id,
        direction: 'outbound',
        content: text,
        wamid,
        status: 'sent'
      }).select().single()

      return new Response(JSON.stringify({ message: newMsg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Processamento de Webhook da Meta (Incoming)
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    
    if (!value) {
      console.log('[Webhook] No value field in change')
      return new Response('ok', { status: 200, headers: corsHeaders })
    }

    const metadata = value?.metadata
    const phoneNumberId = metadata?.phone_number_id
    console.log(`[Webhook] Incoming for Phone ID: ${phoneNumberId}`)

    if (value?.messages) {
      console.log(`[Webhook] Processing ${value.messages.length} messages`)
      
      const { data: account, error: accErr } = await db.from('whatsapp_accounts').select('org_id').eq('phone_number_id', phoneNumberId).maybeSingle()
      
      if (!account || accErr) {
        console.error(`[Webhook] Account mapping not found for ${phoneNumberId}. Error:`, accErr)
        return new Response('Account Mapping Missing', { status: 200 })
      }

      for (const msg of value.messages) {
        const contactPhone = msg.from
        const contactName = value.contacts?.[0]?.profile?.name || contactPhone
        const content = msg.text?.body || `[${msg.type}]`
        const wamid = msg.id

        console.log(`[Webhook] New Msg from ${contactPhone}: "${content}"`)

        // Busca Lead por sufixo (os 8 ou 9 últimos dígitos são mais seguros)
        const phoneSuffix = contactPhone.slice(-8)
        const { data: lead } = await db.from('leads').select('id').ilike('whatsapp', `%${phoneSuffix}`).maybeSingle()
        if (lead) console.log(`[Webhook] Lead linked: ${lead.id}`)

        // Upsert Conversa
        const { data: conv, error: convError } = await db.from('whatsapp_conversations').upsert({
          org_id: account.org_id,
          contact_phone: contactPhone,
          contact_name: contactName,
          lead_id: lead?.id || null,
          last_message: content,
          last_message_at: new Date().toISOString(),
          session_active: true,
          session_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: 'open'
        }, { onConflict: 'org_id,contact_phone' }).select().single()

        if (convError) {
          console.error('[Webhook] Error upserting conversation:', convError)
          continue
        }

        // Inserir Mensagem
        const { error: msgError } = await db.from('whatsapp_messages').insert({
          conversation_id: conv.id,
          org_id: account.org_id,
          direction: 'inbound',
          content,
          wamid,
          raw_payload: msg,
          status: 'delivered'
        })

        if (msgError) console.error('[Webhook] Error inserting message:', msgError)
        else console.log('[Webhook] Message saved successfully')
      }
    } else if (value?.statuses) {
      console.log(`[Webhook] Processing ${value.statuses.length} status updates`)
      for (const status of value.statuses) {
        const { error: stError } = await db.from('whatsapp_messages')
          .update({ status: status.status })
          .eq('wamid', status.id)
        if (stError) console.error(`[Webhook] Error updating status for ${status.id}:`, stError)
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders })
  } catch (error) {
    console.error('--- CRITICAL WEBHOOK ERROR ---')
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
