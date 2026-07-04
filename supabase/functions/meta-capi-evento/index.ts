import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);
const META_BASE = 'https://graph.facebook.com/v18.0';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

async function sha256(value: string): Promise<string> {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizarTelefone(tel: string): string {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  const sem0 = digits.startsWith('0') ? digits.slice(1) : digits;
  if (sem0.length === 10 || sem0.length === 11) return `55${sem0}`;
  return sem0;
}

function gerarEventId(leadId: number, tipo: string): string {
  return `floow_${tipo}_lead${leadId}_${Date.now()}`;
}

async function dispararEventoCAPI(
  datasetId: string,
  token: string,
  evento: {
    event_name: string;
    event_time: number;
    event_id: string;
    user_data: Record<string, string>;
    custom_data?: Record<string, any>;
  }
): Promise<{ ok: boolean; erro?: string; response?: any }> {
  try {
    const url = `${META_BASE}/${datasetId}/events?access_token=${token}`;
    const payload = {
      data: [{
        event_name: evento.event_name,
        event_time: evento.event_time,
        event_id: evento.event_id,
        action_source: 'crm',
        user_data: evento.user_data,
        ...(evento.custom_data ? { custom_data: evento.custom_data } : {}),
      }],
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) return { ok: false, erro: data.error.message, response: data };
    return { ok: true, response: data };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, erro: 'POST only' }), { status: 405, headers: CORS_HEADERS });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ ok: false, erro: 'Body inv\u00e1lido' }), { status: 400, headers: CORS_HEADERS }); }

  const { lead_id, tipo, org_id, event_id } = body;
  // tipo: 'lead' | 'conversao' | 'reprovacao'
  if (!lead_id || !tipo || !org_id) {
    return new Response(JSON.stringify({ ok: false, erro: 'lead_id, tipo e org_id s\u00e3o obrigat\u00f3rios' }), { status: 400 });
  }

  const { data: org } = await db.from('organizations')
    .select('meta_capi_token, meta_capi_dataset_id, meta_capi_ativo')
    .eq('id', org_id).single();

  if (!org?.meta_capi_ativo) {
    return new Response(JSON.stringify({ ok: false, erro: 'CAPI n\u00e3o ativo' }), { status: 200 });
  }
  if (!org?.meta_capi_dataset_id || !org?.meta_capi_token) {
    return new Response(JSON.stringify({ ok: false, erro: 'Dataset ID ou token n\u00e3o configurados' }), { status: 400 });
  }

  const { data: lead } = await db.from('leads')
    .select('id, nome, whatsapp, cidade, fbclid, status_aprovado_at, capi_lead_enviado, capi_conversao_enviado, capi_reprovacao_enviado, created_at, ultimo_status_change, motivo_reprovacao')
    .eq('id', lead_id).single();

  if (!lead) {
    return new Response(JSON.stringify({ ok: false, erro: 'Lead n\u00e3o encontrado' }), { status: 404 });
  }

  // Evitar duplicatas por tipo
  if (tipo === 'lead' && lead.capi_lead_enviado) {
    return new Response(JSON.stringify({ ok: true, msg: 'Lead j\u00e1 enviado' }));
  }
  if (tipo === 'conversao' && lead.capi_conversao_enviado) {
    return new Response(JSON.stringify({ ok: true, msg: 'Convers\u00e3o j\u00e1 enviada' }));
  }
  if (tipo === 'reprovacao' && lead.capi_reprovacao_enviado) {
    return new Response(JSON.stringify({ ok: true, msg: 'Reprova\u00e7\u00e3o j\u00e1 enviada' }));
  }

  // Montar user_data hasheado
  const tel = normalizarTelefone(lead.whatsapp || '');
  const [phHash, fnHash, ctHash] = await Promise.all([
    sha256(tel),
    sha256((lead.nome || '').split(' ')[0] || ''),
    sha256(lead.cidade || ''),
  ]);

  const userData: Record<string, string> = {};
  if (phHash) userData['ph'] = phHash;
  if (fnHash) userData['fn'] = fnHash;
  if (ctHash) userData['ct'] = ctHash;
  if (lead.fbclid) userData['fbc'] = `fb.1.${Date.now()}.${lead.fbclid}`;

  const eventId = typeof event_id === 'string' && event_id.trim() ? event_id.trim() : gerarEventId(lead.id, tipo);
  let eventName: string;
  let eventTime: number;
  let customData: Record<string, any> | undefined;

  if (tipo === 'lead') {
    eventName = 'Lead';
    eventTime = Math.floor(new Date(lead.created_at).getTime() / 1000);
    customData = { content_name: 'Lead Qualificado', content_category: 'revendedora' };

  } else if (tipo === 'conversao') {
    // Aprovada = Purchase (maior valor para otimizacao)
    eventName = 'Purchase';
    eventTime = lead.status_aprovado_at
      ? Math.floor(new Date(lead.status_aprovado_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    customData = {
      content_name: 'Revendedora Aprovada',
      content_category: 'revendedora',
      currency: 'BRL',
      value: 1,
    };

  } else if (tipo === 'reprovacao') {
    // Reprovada = CustomEvent (ensina o Meta a NAO buscar esse perfil)
    // Usando nome de evento customizado para exclusao de audiencia
    eventName = 'LeadReprovado';
    const reprovadaEm = lead.ultimo_status_change
      ? Math.floor(new Date(lead.ultimo_status_change).getTime() / 1000)
      : Math.floor(Date.now() / 1000);
    eventTime = reprovadaEm;
    customData = {
      content_name: 'Lead Reprovado',
      content_category: 'revendedora',
      // Motivo ajuda a segmentar exclusoes especificas no futuro
      status: 'rejected',
      motivo: lead.motivo_reprovacao || 'nao_informado',
    };

  } else {
    return new Response(JSON.stringify({ ok: false, erro: 'tipo invalido: use lead, conversao ou reprovacao' }), { status: 400 });
  }

  const resultado = await dispararEventoCAPI(
    org.meta_capi_dataset_id,
    org.meta_capi_token,
    { event_name: eventName, event_time: eventTime, event_id: eventId, user_data: userData, custom_data: customData }
  );

  console.log(`[CAPI] org:${org_id} lead:${lead_id} tipo:${tipo} event:${eventName} ok:${resultado.ok}`, resultado.erro || '');

  if (resultado.ok) {
    const update: Record<string, any> = {};
    if (tipo === 'lead') { update.capi_lead_enviado = true; update.capi_lead_event_id = eventId; }
    else if (tipo === 'conversao') { update.capi_conversao_enviado = true; update.capi_conversao_event_id = eventId; }
    else if (tipo === 'reprovacao') { update.capi_reprovacao_enviado = true; update.capi_reprovacao_event_id = eventId; }
    await db.from('leads').update(update).eq('id', lead_id);
  }

  return new Response(
    JSON.stringify({ ok: resultado.ok, event_name: eventName, event_id: eventId, erro: resultado.erro || null }),
    { headers: CORS_HEADERS }
  );
});
