// deno-lint-ignore-file no-explicit-any
import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const REST_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function salvarLog(event_type: string, payload: Record<string, unknown>, status: string, orgId?: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs`, {
    method: "POST",
    headers: { ...REST_HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({ event_type, payload, status, ...(orgId ? { org_id: orgId } : {}) }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    let orgId: string | null = null;
    let webhookNome = "Principal";

    // ── 1. Search webhooks table by token ──────────────────────
    if (token) {
      const wRes = await fetch(
        `${SUPABASE_URL}/rest/v1/webhooks?select=id,org_id,ativo,nome&token=eq.${encodeURIComponent(token)}&limit=1`,
        { headers: REST_HEADERS }
      );
      const wRows = await wRes.json();
      const webhook = wRows?.[0] ?? null;

      if (webhook) {
        if (!webhook.ativo) {
          await salvarLog("webhook_inativo", { token }, "error");
          return new Response(JSON.stringify({ ok: false, erro: "Webhook inativo" }), { status: 403, headers: CORS });
        }
        orgId = webhook.org_id;
        webhookNome = webhook.nome || "Webhook";
      } else {
        // Not found in webhooks — try configuracoes_whatsapp by token
        const cRes = await fetch(
          `${SUPABASE_URL}/rest/v1/configuracoes_whatsapp?select=*&webhook_token=eq.${encodeURIComponent(token)}&limit=1`,
          { headers: REST_HEADERS }
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
        { headers: REST_HEADERS }
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

    // ── 3. Extract fields ──────────────────────────────────────
    const nome = String(body.nome || "");
    const whatsapp = String(body.whatsapp || body.telefone || "").replace(/\D/g, "");
    const cidade = String(body.cidade || "");

    // Optional fields that the quiz may send
    const utm_source = body.utm_source != null ? String(body.utm_source) : undefined;
    const utm_campaign = body.utm_campaign != null ? String(body.utm_campaign) : undefined;
    const utm_medium = body.utm_medium != null ? String(body.utm_medium) : undefined;
    const utm_content = body.utm_content != null ? String(body.utm_content) : undefined;
    const utm_term = body.utm_term != null ? String(body.utm_term) : undefined;
    const score = body.score != null ? Number(body.score) : undefined;

    if (!nome && !whatsapp) {
      await salvarLog("payload_incompleto", body, "error", orgId ?? undefined);
      return new Response(JSON.stringify({ ok: false, erro: "nome ou whatsapp obrigatório" }), { status: 422, headers: CORS });
    }

    const now = new Date().toISOString();

    // ── 4. Deduplicata: busca lead existente pelo WhatsApp ─────
    if (whatsapp && orgId) {
      const findRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?select=id&whatsapp=eq.${encodeURIComponent(whatsapp)}&org_id=eq.${encodeURIComponent(orgId)}&limit=1`,
        { headers: REST_HEADERS }
      );
      const findRows = await findRes.json();
      const existing = findRows?.[0] ?? null;

      if (existing) {
        // Lead duplicado: atualiza dados do quiz + created_at = NOW()
        const updatePayload: Record<string, unknown> = { created_at: now };
        if (nome) updatePayload.nome = nome;
        if (cidade) updatePayload.cidade = cidade;
        if (utm_source !== undefined) updatePayload.utm_source = utm_source;
        if (utm_campaign !== undefined) updatePayload.utm_campaign = utm_campaign;
        if (utm_medium !== undefined) updatePayload.utm_medium = utm_medium;
        if (utm_content !== undefined) updatePayload.utm_content = utm_content;
        if (utm_term !== undefined) updatePayload.utm_term = utm_term;
        if (score !== undefined && !isNaN(score)) updatePayload.score = score;

        const upRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(existing.id)}`,
          {
            method: "PATCH",
            headers: { ...REST_HEADERS, Prefer: "return=minimal" },
            body: JSON.stringify(updatePayload),
          }
        );

        if (!upRes.ok) {
          const err = await upRes.text();
          await salvarLog("update_error", { erro: err, lead_id: existing.id }, "error", orgId);
          return new Response(JSON.stringify({ ok: false, erro: "erro ao atualizar lead" }), { status: 500, headers: CORS });
        }

        await salvarLog("lead_atualizado", { nome, whatsapp, webhook: webhookNome, lead_id: existing.id }, "success", orgId);
        return new Response(JSON.stringify({ ok: true, mensagem: "Lead atualizado com sucesso" }), { status: 200, headers: CORS });
      }
    }

    // ── 5. Limite mensal (plano gratuito = 50 leads/mês) ──────
    if (orgId) {
      const sRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=status&org_id=eq.${orgId}&limit=1`, { headers: REST_HEADERS });
      const subs = await sRes.json();
      const isPago = subs?.[0]?.status === "active";

      if (!isPago) {
        const br = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const inicioMes = `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`;
        const cntRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?select=id&org_id=eq.${orgId}&created_at=gte.${encodeURIComponent(inicioMes)}`,
          { headers: { ...REST_HEADERS, Prefer: "count=exact", Range: "0-0" } }
        );
        const cr = cntRes.headers.get("Content-Range") ?? "";
        const total = parseInt(cr.split("/")[1] ?? "0", 10) || 0;
        if (total >= 50) {
          await salvarLog("limite_atingido", { org_id: orgId, total }, "error", orgId);
          return new Response(JSON.stringify({ ok: false, erro: "Limite mensal de 50 leads atingido. Faça upgrade do seu plano." }), { status: 429, headers: CORS });
        }
      }
    }

    // ── 6. Insere lead novo ────────────────────────────────────
    const leadPayload: Record<string, unknown> = {
      nome, whatsapp, cidade,
      status: 0, wa_sent: false,
      created_at: now,
    };
    if (orgId) leadPayload.org_id = orgId;
    if (utm_source !== undefined) leadPayload.utm_source = utm_source;
    if (utm_campaign !== undefined) leadPayload.utm_campaign = utm_campaign;
    if (utm_medium !== undefined) leadPayload.utm_medium = utm_medium;
    if (utm_content !== undefined) leadPayload.utm_content = utm_content;
    if (utm_term !== undefined) leadPayload.utm_term = utm_term;
    if (score !== undefined && !isNaN(score)) leadPayload.score = score;

    const lrRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { ...REST_HEADERS, Prefer: "return=representation" },
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
