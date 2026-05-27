import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      return new Response(JSON.stringify({ ok: false, erro: "token obrigatório" }), { status: 401, headers: CORS });
    }

    // Validate token against webhooks table
    const wRes = await fetch(
      `${SUPABASE_URL}/rest/v1/webhooks?select=id,org_id,ativo,nome&token=eq.${encodeURIComponent(token)}&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const wRows = await wRes.json();
    const webhook = wRows?.[0] ?? null;

    if (!webhook) {
      return new Response(JSON.stringify({ ok: false, erro: "token inválido" }), { status: 403, headers: CORS });
    }

    if (!webhook.ativo) {
      return new Response(JSON.stringify({ ok: false, erro: "Webhook inativo" }), { status: 403, headers: CORS });
    }

    // Parse body
    let payload: Record<string, unknown> = {};
    try {
      payload = await req.json();
    } catch {
      // body vazio ou não-JSON é aceito
    }

    console.log(`[webhook] ${webhook.nome} | org=${webhook.org_id}`, JSON.stringify(payload));

    return new Response(
      JSON.stringify({ ok: true, mensagem: "Webhook recebido", payload }),
      { status: 200, headers: CORS }
    );

  } catch (err) {
    console.error("[webhook] exception", String(err));
    return new Response(JSON.stringify({ ok: false, erro: "erro interno" }), { status: 500, headers: CORS });
  }
});
