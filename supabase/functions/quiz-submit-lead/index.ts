// deno-lint-ignore-file no-explicit-any
import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const REST = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const leadData: Record<string, any> = await req.json();
    const { org_id, nome, whatsapp } = leadData;

    if (!org_id || (!nome && !whatsapp)) {
      return new Response(JSON.stringify({ ok: false, erro: "org_id e nome/whatsapp obrigatórios" }), { status: 400, headers: CORS });
    }

    const cleanWa: string = String(whatsapp ?? "").replace(/\D/g, "");
    const now = new Date().toISOString();

    // Resolve UTMs: se fbclid presente mas sem utm_source, infere origem Facebook
    const fbclid = leadData.fbclid || "";
    const resolvedUtmSource = leadData.utm_source || (fbclid ? "Facebook" : "");
    const resolvedUtmMedium = leadData.utm_medium || (fbclid && !leadData.utm_source ? "paid" : "");
    const resolvedUtmCampaign = leadData.utm_campaign || "";
    const resolvedUtmContent = leadData.utm_content || "";
    const resolvedUtmTerm = leadData.utm_term || "";

    // ── 1. Dedup: busca lead existente pelo WhatsApp ───────────────────────────
    if (cleanWa && org_id) {
      const findRes = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?select=id,status&whatsapp=eq.${encodeURIComponent(cleanWa)}&org_id=eq.${encodeURIComponent(org_id)}&limit=1`,
        { headers: REST }
      );
      const findRows = await findRes.json();
      const existing = findRows?.[0] ?? null;

      if (existing) {
        // Atualiza lead duplicado: atualiza dados do quiz + sobe created_at para o topo
        // Preserva status do kanban (a menos que esteja reprovado → reset)
        const resetReprovado = String(existing.status) === "4";
        const updatePayload: Record<string, unknown> = { created_at: now };

        if (nome) updatePayload.nome = nome;
        if (leadData.cidade) updatePayload.cidade = leadData.cidade;
        if (leadData.instagram) updatePayload.instagram = leadData.instagram;
        if (leadData.quiz_respostas != null) updatePayload.quiz_respostas = leadData.quiz_respostas;
        if (leadData.score != null && !isNaN(Number(leadData.score))) updatePayload.score = Number(leadData.score);
        if (leadData.faixa) updatePayload.faixa = leadData.faixa;
        // Só sobrescreve UTMs se o valor novo for não-vazio (preserva UTMs do Inlead)
        if (resolvedUtmSource) updatePayload.utm_source = resolvedUtmSource;
        if (resolvedUtmMedium) updatePayload.utm_medium = resolvedUtmMedium;
        if (resolvedUtmCampaign) updatePayload.utm_campaign = resolvedUtmCampaign;
        if (resolvedUtmContent) updatePayload.utm_content = resolvedUtmContent;
        if (resolvedUtmTerm) updatePayload.utm_term = resolvedUtmTerm;
        if (fbclid) updatePayload.fbclid = fbclid;

        if (resetReprovado) {
          updatePayload.status = leadData.status ?? 1;
          updatePayload.motivo_reprovacao = null;
          updatePayload.avaliado = false;
          updatePayload.ultimo_status_change = now;
          updatePayload.status_atendimento_at = now;
        }

        const upRes = await fetch(
          `${SUPABASE_URL}/rest/v1/leads?id=eq.${encodeURIComponent(existing.id)}`,
          { method: "PATCH", headers: { ...REST, Prefer: "return=minimal" }, body: JSON.stringify(updatePayload) }
        );

        if (!upRes.ok) {
          const err = await upRes.text();
          console.error("[quiz-submit-lead] update falhou", err);
          return new Response(JSON.stringify({ ok: false, erro: "erro ao atualizar lead" }), { status: 500, headers: CORS });
        }

        return new Response(JSON.stringify({ ok: true, lead_id: existing.id }), { headers: CORS });
      }
    }

    // ── 2. Insere lead novo ───────────────────────────────────────────────────
    const insertPayload: Record<string, unknown> = {
      org_id,
      nome: nome || "",
      whatsapp: cleanWa,
      cidade: leadData.cidade || "",
      instagram: leadData.instagram || "",
      status: leadData.status ?? 1,
      quiz_respostas: leadData.quiz_respostas ?? {},
      created_at: now,
    };

    if (leadData.score != null && !isNaN(Number(leadData.score))) insertPayload.score = Number(leadData.score);
    if (leadData.faixa) insertPayload.faixa = leadData.faixa;
    insertPayload.utm_source = resolvedUtmSource;
    insertPayload.utm_medium = resolvedUtmMedium;
    insertPayload.utm_campaign = resolvedUtmCampaign;
    insertPayload.utm_content = resolvedUtmContent;
    insertPayload.utm_term = resolvedUtmTerm;
    if (fbclid) insertPayload.fbclid = fbclid;

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { ...REST, Prefer: "return=representation" },
      body: JSON.stringify(insertPayload),
    });

    if (!insRes.ok) {
      const err = await insRes.text();
      console.error("[quiz-submit-lead] insert falhou", err);
      return new Response(JSON.stringify({ ok: false, erro: "erro ao salvar lead" }), { status: 500, headers: CORS });
    }

    const rows = await insRes.json();
    const leadId = Array.isArray(rows) ? rows[0]?.id : rows?.id;

    return new Response(JSON.stringify({ ok: true, lead_id: leadId }), { headers: CORS });

  } catch (err) {
    console.error("[quiz-submit-lead] exception", err);
    return new Response(JSON.stringify({ ok: false, erro: String(err) }), { status: 500, headers: CORS });
  }
});
