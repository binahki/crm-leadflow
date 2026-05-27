import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

async function salvarLog(event_type: string, payload: Record<string, unknown>, status: string, orgId?: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ event_type, payload, status, ...(orgId ? { org_id: orgId } : {}) }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    let orgId: string | null = null;
    let tipo = "receber_lead";
    let webhookNome = "Principal";

    // ── 1. Search webhooks table by token ──────────────────────
    if (token) {
      const wRes = await fetch(
        `${SUPABASE_URL}/rest/v1/webhooks?select=id,org_id,ativo,tipo,nome&token=eq.${encodeURIComponent(token)}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const wRows = await wRes.json();
      const webhook = wRows?.[0] ?? null;

      if (webhook) {
        if (!webhook.ativo) {
          await salvarLog("webhook_inativo", { token }, "error");
          return new Response(JSON.stringify({ ok: false, erro: "Webhook inativo" }), { status: 403, headers: CORS });
        }
        orgId = webhook.org_id;
        tipo = webhook.tipo || "receber_lead";
        webhookNome = webhook.nome || "Webhook";
      } else {
        // Not found in webhooks — try configuracoes_whatsapp by token
        const cRes = await fetch(
          `${SUPABASE_URL}/rest/v1/configuracoes_whatsapp?select=*&webhook_token=eq.${encodeURIComponent(token)}&limit=1`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const cRows = await cRes.json();
        const config = cRows?.[0] ?? null;

        if (!config) {
          await salvarLog("token_invalido", { token_recebido: token }, "error");
          return new Response(JSON.stringify({ ok: false, erro: "token inválido" }), { status: 401, headers: CORS });
        }
        orgId = config.org_id ?? null;
      }
    } else {
      // No token — backward compat: accept if first config has no token set
      const cRes = await fetch(
        `${SUPABASE_URL}/rest/v1/configuracoes_whatsapp?select=*&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const cRows = await cRes.json();
      const config = cRows?.[0] ?? null;

      if (config?.webhook_token) {
        await salvarLog("token_invalido", { token_recebido: "" }, "error");
        return new Response(JSON.stringify({ ok: false, erro: "token inválido" }), { status: 401, headers: CORS });
      }
      orgId = config?.org_id ?? null;
    }

    // ── 2. Parse body ──────────────────────────────────────────
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      await salvarLog("parse_error", {}, "error", orgId ?? undefined);
      return new Response(JSON.stringify({ ok: false, erro: "body inválido" }), { status: 400, headers: CORS });
    }

    // ── 3. tipo: atualizar_status ──────────────────────────────
    if (tipo === "atualizar_status") {
      const whatsapp = String(body.phone || body.whatsapp || body.celular || body.Phone || "");
      if (!whatsapp) {
        await salvarLog("payload_incompleto", body, "error", orgId ?? undefined);
        return new Response(JSON.stringify({ ok: false, erro: "campo de telefone não encontrado no payload" }), { status: 422, headers: CORS });
      }
      if (!orgId) return new Response(JSON.stringify({ ok: false, erro: "org_id não encontrado" }), { status: 500, headers: CORS });

      const sufixo = whatsapp.replace(/\D/g, "").slice(-8);
      const lRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?select=id,status&org_id=eq.${orgId}&whatsapp=ilike.*${sufixo}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const lRows = await lRes.json();
      const lead = lRows?.[0] ?? null;

      if (lead) {
        const now = new Date().toISOString();
        await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`, {
          method: "PATCH",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: 3, status_contrato_at: now, ultimo_status_change: now }),
        });
        await salvarLog("status_atualizado", { whatsapp, lead_id: lead.id, webhook: webhookNome }, "success", orgId);
        return new Response(JSON.stringify({ ok: true, mensagem: "Status atualizado para contrato" }), { status: 200, headers: CORS });
      } else {
        await salvarLog("lead_nao_encontrado", { whatsapp, sufixo, webhook: webhookNome }, "error", orgId);
        return new Response(JSON.stringify({ ok: false, erro: "Lead não encontrado pelo WhatsApp" }), { status: 404, headers: CORS });
      }
    }

    // ── 4. tipo: receber_lead ──────────────────────────────────
    const nome = String(body.nome || "");
    const whatsapp = String(body.whatsapp || body.telefone || "");
    const cidade = String(body.cidade || "");

    if (!nome && !whatsapp) {
      await salvarLog("payload_incompleto", body, "error", orgId ?? undefined);
      return new Response(JSON.stringify({ ok: false, erro: "nome ou whatsapp obrigatório" }), { status: 422, headers: CORS });
    }

    // Limite mensal (plano gratuito = 50 leads/mês)
    if (orgId) {
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=status&org_id=eq.${orgId}&limit=1`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
      const subs = await sRes.json();
      const isPago = subs?.[0]?.status === "active";

      if (!isPago) {
        const br = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const inicioMes = `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`;
        const cntRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?select=id&org_id=eq.${orgId}&created_at=gte.${encodeURIComponent(inicioMes)}`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "count=exact", Range: "0-0" } }
        );
        const cr = cntRes.headers.get("Content-Range") ?? "";
        const total = parseInt(cr.split("/")[1] ?? "0", 10) || 0;
        if (total >= 50) {
          await salvarLog("limite_atingido", { org_id: orgId, total }, "error", orgId);
          return new Response(JSON.stringify({ ok: false, erro: "Limite mensal de 50 leads atingido. Faça upgrade do seu plano." }), { status: 429, headers: CORS });
        }
      }
    }

    // Insere lead
    const leadPayload: Record<string, unknown> = { nome, whatsapp, cidade, status: 0, wa_sent: false, created_at: new Date().toISOString() };
    if (orgId) leadPayload.org_id = orgId;

    const lrRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(leadPayload),
    });

    if (!lrRes.ok) {
      const err = await lrRes.text();
      await salvarLog("insert_error", { erro: err, payload: body }, "error", orgId ?? undefined);
      return new Response(JSON.stringify({ ok: false, erro: "erro ao salvar lead" }), { status: 500, headers: CORS });
    }

    await salvarLog("lead_recebido", { nome, whatsapp, cidade, webhook: webhookNome }, "success", orgId ?? undefined);
    return new Response(JSON.stringify({ ok: true, mensagem: "Lead recebido com sucesso" }), { status: 200, headers: CORS });

  } catch (err) {
    await salvarLog("exception", { erro: String(err) }, "error").catch(() => {});
    return new Response(JSON.stringify({ ok: false, erro: "erro interno" }), { status: 500, headers: CORS });
  }
});
