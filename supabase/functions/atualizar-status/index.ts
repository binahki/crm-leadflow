import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

async function rest(path: string, opts?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...opts });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";

    if (!token) {
      return new Response(JSON.stringify({ ok: false, erro: "token obrigatório" }), { status: 401, headers: CORS });
    }

    // Validate token against webhooks table
    const wRes = await rest(`webhooks?select=id,org_id,ativo,nome&token=eq.${encodeURIComponent(token)}&limit=1`);
    const wRows = await wRes.json();
    const webhook = wRows?.[0] ?? null;

    if (!webhook || !webhook.ativo) {
      return new Response(JSON.stringify({ ok: false, erro: "token inválido ou webhook inativo" }), { status: 403, headers: CORS });
    }

    const orgId: string = webhook.org_id;

    // Parse body
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* body vazio aceito */ }

    const leadId = body.lead_id as string | undefined;
    const telefone = body.telefone as string | undefined;
    const novoStatus = typeof body.status === "number" ? body.status : 2; // default: Reunião

    if (!leadId && !telefone) {
      return new Response(JSON.stringify({ ok: false, erro: "lead_id ou telefone obrigatório" }), { status: 422, headers: CORS });
    }

    // Find lead
    let lead: Record<string, unknown> | null = null;

    if (leadId) {
      const r = await rest(`leads?select=id,org_id&id=eq.${encodeURIComponent(leadId)}&org_id=eq.${orgId}&limit=1`);
      const rows = await r.json();
      lead = rows?.[0] ?? null;
    } else if (telefone) {
      const clean = telefone.replace(/\D/g, "");
      const r = await rest(`leads?select=id,org_id&whatsapp=eq.${encodeURIComponent(clean)}&org_id=eq.${orgId}&limit=1`);
      const rows = await r.json();
      lead = rows?.[0] ?? null;
    }

    if (!lead) {
      return new Response(JSON.stringify({ ok: false, erro: "lead não encontrado" }), { status: 404, headers: CORS });
    }

    // Update lead status
    const now = new Date().toISOString();
    const tsField: Record<number, string> = { 1: "status_atendimento_at", 2: "status_reuniao_at", 5: "status_contrato_at", 3: "status_aprovado_at", 6: "status_sem_retorno_at" };
    const patch: Record<string, unknown> = { status: novoStatus, ultimo_status_change: now };
    if (tsField[novoStatus]) patch[tsField[novoStatus]] = now;

    const upRes = await rest(`leads?id=eq.${lead.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      headers: { ...headers, Prefer: "return=minimal" },
    });

    if (!upRes.ok) {
      const err = await upRes.text();
      return new Response(JSON.stringify({ ok: false, erro: "erro ao atualizar status", detalhe: err }), { status: 500, headers: CORS });
    }

    // Find or create "Reunião" tag and apply to lead
    const tagNome = "Reunião";
    const tagRes = await rest(`tags?select=id&org_id=eq.${orgId}&nome=ilike.${encodeURIComponent(tagNome)}&limit=1`);
    const tagRows = await tagRes.json();
    let tagId: string | null = tagRows?.[0]?.id ?? null;

    if (!tagId) {
      const newTagRes = await rest("tags", {
        method: "POST",
        body: JSON.stringify({ org_id: orgId, nome: tagNome, cor: "#8b5cf6" }),
        headers: { ...headers, Prefer: "return=representation" },
      });
      const newTagRows = await newTagRes.json();
      tagId = newTagRows?.[0]?.id ?? null;
    }

    if (tagId) {
      await rest("lead_tags", {
        method: "POST",
        body: JSON.stringify({ lead_id: lead.id, tag_id: tagId }),
        headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      });
    }

    console.log(`[atualizar-status] lead=${lead.id} status=${novoStatus} tag=${tagNome} org=${orgId}`);

    return new Response(
      JSON.stringify({ ok: true, mensagem: "Status atualizado", lead_id: lead.id, status: novoStatus }),
      { status: 200, headers: CORS }
    );

  } catch (err) {
    console.error("[atualizar-status] exception", String(err));
    return new Response(JSON.stringify({ ok: false, erro: "erro interno" }), { status: 500, headers: CORS });
  }
});
