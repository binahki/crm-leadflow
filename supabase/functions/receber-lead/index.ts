import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

async function salvarLog(
  event_type: string,
  payload: Record<string, unknown>,
  status: string
) {
  await fetch(`${SUPABASE_URL}/rest/v1/webhook_logs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ event_type, payload, status }),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // ── Lê token da query string ──────────────────────────────
    const url = new URL(req.url);
    const token = url.searchParams.get("token") || "";

    // ── Busca configuração do banco ───────────────────────────
    const configRes = await fetch(
      `${SUPABASE_URL}/rest/v1/configuracoes_whatsapp?select=*&limit=1`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const configs = await configRes.json();
    const config = configs?.[0] || null;

    // ── Valida token apenas se webhook_token estiver configurado
    if (config?.webhook_token && token !== config.webhook_token) {
      await salvarLog("token_invalido", { token_recebido: token }, "error");
      return new Response(
        JSON.stringify({ ok: false, erro: "token inválido" }),
        { status: 401, headers: CORS }
      );
    }

    // ── Lê body ───────────────────────────────────────────────
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      await salvarLog("parse_error", {}, "error");
      return new Response(
        JSON.stringify({ ok: false, erro: "body inválido" }),
        { status: 400, headers: CORS }
      );
    }

    const nome = (body.nome as string) || "";
    const whatsapp = (body.whatsapp as string) || (body.telefone as string) || "";
    const cidade = (body.cidade as string) || "";

    if (!nome && !whatsapp) {
      await salvarLog("payload_incompleto", body, "error");
      return new Response(
        JSON.stringify({ ok: false, erro: "nome ou whatsapp obrigatório" }),
        { status: 422, headers: CORS }
      );
    }

    // ── Verifica limite mensal de leads (plano gratuito = 50/mês) ──
    const orgId = config?.org_id ?? null;
    if (orgId) {
      // Só bloqueia se não tiver plano ativo (pago)
      const subRes = await fetch(
        `${SUPABASE_URL}/rest/v1/subscriptions?select=status&org_id=eq.${orgId}&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const subs = await subRes.json();
      const isPago = subs?.[0]?.status === "active";

      if (!isPago) {
        const br = new Date(Date.now() - 3 * 60 * 60 * 1000);
        const inicioMes = `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00-03:00`;

        const countRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?select=id&org_id=eq.${orgId}&created_at=gte.${encodeURIComponent(inicioMes)}`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              Prefer: "count=exact",
              Range: "0-0",
            },
          }
        );
        const contentRange = countRes.headers.get("Content-Range") ?? "";
        const total = parseInt(contentRange.split("/")[1] ?? "0", 10) || 0;

        if (total >= 50) {
          await salvarLog("limite_atingido", { org_id: orgId, total }, "error");
          return new Response(
            JSON.stringify({ ok: false, erro: "Limite mensal de 50 leads atingido. Faça upgrade do seu plano." }),
            { status: 429, headers: CORS }
          );
        }
      }
    }

    // ── Insere lead ───────────────────────────────────────────
    const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        nome,
        whatsapp,
        cidade,
        status: 0,
        wa_sent: false,
        created_at: new Date().toISOString(),
      }),
    });

    if (!leadRes.ok) {
      const err = await leadRes.text();
      await salvarLog("insert_error", { erro: err, payload: body }, "error");
      return new Response(
        JSON.stringify({ ok: false, erro: "erro ao salvar lead" }),
        { status: 500, headers: CORS }
      );
    }

    await salvarLog("lead_recebido", { nome, whatsapp, cidade }, "success");

    return new Response(
      JSON.stringify({ ok: true, mensagem: "Lead recebido com sucesso" }),
      { status: 200, headers: CORS }
    );
  } catch (err) {
    await salvarLog("exception", { erro: String(err) }, "error").catch(() => {});
    return new Response(
      JSON.stringify({ ok: false, erro: "erro interno" }),
      { status: 500, headers: CORS }
    );
  }
});
