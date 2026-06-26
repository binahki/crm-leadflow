import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_BASE = "https://graph.facebook.com/v18.0";

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getLimitesModo(modo: string) {
  switch (modo) {
    case "conservador": return { aumentoMaxPct: 0.15, reducaoMaxPct: 0.15, budgetMaxDia: 100 };
    case "agressivo":   return { aumentoMaxPct: 0.20, reducaoMaxPct: 0.20, budgetMaxDia: 200 };
    default:            return { aumentoMaxPct: 0.20, reducaoMaxPct: 0.20, budgetMaxDia: 150 };
  }
}

/// Chama a API do Facebook (POST)
async function fbPost(id: string, body: Record<string, unknown>, token: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch(`${META_BASE}/${id}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) return { ok: false, erro: data.error.message || data.error.error_user_msg || "Erro Meta" };
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

/// Busca todos os conjuntos de uma campanha
async function listAdsets(campaignId: string, token: string): Promise<string[]> {
  try {
    const res = await fetch(`${META_BASE}/${campaignId}/adsets?fields=id&limit=50&access_token=${token}`);
    const data = await res.json();
    return (data.data || []).map((a: any) => a.id);
  } catch { return []; }
}

/// Remove TODAS as exclusões de localização do targeting e pausa o conjunto
/// RETORNA true se o conjunto foi pausado com sucesso
async function removeExclusionsAndPause(adsetId: string, token: string): Promise<boolean> {
  try {
    // 1. Ler targeting atual
    const r = await fetch(`${META_BASE}/${adsetId}?fields=targeting&access_token=${token}`);
    const d = await r.json();
    if (d.error || !d.targeting) {
      console.log(`[fix] ${adsetId}: erro ao ler targeting:`, d.error?.message);
      return false;
    }

    // 2. Remover TODO excluded_geo_locations (é a única causa do erro)
    const targeting = JSON.parse(JSON.stringify(d.targeting));
    if (targeting.excluded_geo_locations) {
      delete targeting.excluded_geo_locations;
      console.log(`[fix] ${adsetId}: removed excluded_geo_locations`);
    } else {
      console.log(`[fix] ${adsetId}: sem excluded_geo_locations, tentando pausar mesmo assim`);
    }

    // 3. Atualizar targeting (sem as exclusões)
    const u = await fetch(`${META_BASE}/${adsetId}?access_token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targeting }),
    });
    const uData = await u.json();
    if (uData.error) {
      console.log(`[fix] ${adsetId}: erro ao atualizar targeting:`, uData.error.message);
      return false;
    }
    console.log(`[fix] ${adsetId}: targeting atualizado com sucesso`);

    // 4. Pausar
    const p = await fbPost(adsetId, { status: "PAUSED" }, token);
    if (!p.ok) {
      console.log(`[fix] ${adsetId}: erro ao pausar após fix:`, p.erro);
      return false;
    }
    console.log(`[fix] ${adsetId}: PAUSADO com sucesso`);
    return true;
  } catch (e) {
    console.log(`[fix] ${adsetId}: exceção:`, String(e));
    return false;
  }
}

/// Tenta pausar por todos os meios possíveis
async function pausarComFallback(id: string, token: string): Promise<{ success: boolean; erro: string | null }> {
  // Tentativa 1: pausa direta
  const r1 = await fbPost(id, { status: "PAUSED" }, token);
  if (r1.ok) {
    console.log(`[pausar] ${id}: pausa direta OK`);
    return { success: true, erro: null };
  }
  console.log(`[pausar] ${id}: pausa direta falhou: ${r1.erro}`);

  // Tentativa 2: se for campanha, pegar todos os conjuntos e tentar remover exclusões + pausar cada um
  const adsets = await listAdsets(id, token);
  if (adsets.length > 0) {
    console.log(`[pausar] ${id}: campanha com ${adsets.length} conjuntos, tentando corrigir cada um`);
    let pausados = 0;
    for (const asId of adsets) {
      if (await removeExclusionsAndPause(asId, token)) pausados++;
    }
    if (pausados > 0) {
      console.log(`[pausar] ${id}: ${pausados}/${adsets.length} conjuntos pausados`);
      return { success: true, erro: null };
    }
  }

  // Tentativa 3: tratar o próprio ID como conjunto
  console.log(`[pausar] ${id}: tentando como conjunto diretamente`);
  if (await removeExclusionsAndPause(id, token)) {
    return { success: true, erro: null };
  }

  return { success: false, erro: r1.erro || "Erro ao pausar após múltiplas tentativas" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { log_id, acao_id } = await req.json();
    if (!log_id) {
      return new Response(
        JSON.stringify({ ok: false, erro: "log_id obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: log, error: logErr } = await db
      .from("ai_optimization_logs")
      .select("*")
      .eq("id", log_id)
      .single();
    if (logErr || !log) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Log não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("meta_token, meta_account_id, ravena_modo")
      .eq("id", log.org_id)
      .single();
    if (orgErr || !org || !org.meta_token) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Org ou token não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limites = getLimitesModo(org.ravena_modo || "equilibrado");
    const sugestoes: any[] = log.acoes_sugeridas || [];
    const paraExecutar = acao_id
      ? sugestoes.filter((a: any) => a.id === acao_id)
      : sugestoes;
    if (paraExecutar.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Nenhuma sugestão encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const acoesExecutadas: any[] = [...(log.acoes_executadas || [])];
    let okCount = 0;

    for (const acao of paraExecutar) {
      try {
        const tipo = (acao.tipo || "").toLowerCase();
        console.log(`[executar] tipo="${tipo}" id="${acao.id}"`);

        const isIncrease = tipo.includes("aumentar") || acao.direcao === "aumento";
        const isDecrease = tipo.includes("reduzir") || acao.direcao === "reducao";

        if (tipo.includes("pausar")) {
          const { success, erro } = await pausarComFallback(acao.id, org.meta_token);
          acoesExecutadas.push({ ...acao, novo_budget: undefined, automatico: false, ok: success, erro, executado_em: new Date().toISOString() });
          if (success) okCount++;
        } else if (isIncrease) {
          const atual = Number(acao.antigo_budget || 0);
          let novo = Number(acao.novo_budget || 0);
          if (atual <= 0 || novo <= 0) continue;
          novo = Math.min(novo, Math.round(atual * (1 + limites.aumentoMaxPct)));
          if (!tipo.includes("conjunto")) novo = Math.min(novo, limites.budgetMaxDia);
          if (novo <= atual) continue;
          const res = await fetch(`${META_BASE}/${acao.id}?access_token=${org.meta_token}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ daily_budget: Math.round(novo * 100) }),
          });
          const data = await res.json();
          const budgetOk = data.success === true;
          acoesExecutadas.push({ ...acao, novo_budget: novo, automatico: false, ok: budgetOk, erro: data.error?.message || (budgetOk ? null : JSON.stringify(data)), executado_em: new Date().toISOString() });
          if (budgetOk) okCount++;
        } else if (isDecrease) {
          const atual = Number(acao.antigo_budget || 0);
          let novo = Number(acao.novo_budget || 0);
          if (atual <= 0 || novo <= 0 || novo >= atual) continue;
          novo = Math.max(novo, Math.round(atual * (1 - limites.reducaoMaxPct)));
          novo = Math.max(novo, 10);
          if (novo >= atual) continue;
          const res = await fetch(`${META_BASE}/${acao.id}?access_token=${org.meta_token}`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ daily_budget: Math.round(novo * 100) }),
          });
          const data = await res.json();
          const budgetOk = data.success === true;
          acoesExecutadas.push({ ...acao, novo_budget: novo, automatico: false, ok: budgetOk, erro: data.error?.message || (budgetOk ? null : JSON.stringify(data)), executado_em: new Date().toISOString() });
          if (budgetOk) okCount++;
        } else {
          acoesExecutadas.push({ ...acao, automatico: false, ok: true, aprovado: true, executado_em: new Date().toISOString() });
          okCount++;
        }
      } catch (e) {
        console.error(`[executar] Erro na ação ${acao.id}:`, e);
        acoesExecutadas.push({ ...acao, automatico: false, ok: false, erro: String(e), executado_em: new Date().toISOString() });
      }
    }

    const idsExecutados = new Set(paraExecutar.map((a: any) => a.id));
    const sugestoesPendentes = sugestoes.filter((a: any) => !idsExecutados.has(a.id));
    const novoStatus = sugestoesPendentes.length > 0 ? "pendente" : "executado";

    await db.from("ai_optimization_logs").update({
      acoes_executadas: acoesExecutadas, acoes_sugeridas: sugestoesPendentes,
      status: novoStatus, executado_em: new Date().toISOString(),
    }).eq("id", log_id);

    return new Response(
      JSON.stringify({ ok: true, ok_count: okCount, sugestoes_pendentes: sugestoesPendentes.length, acoes_executadas: acoesExecutadas, acoes_sugeridas: sugestoesPendentes, status: novoStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[executar-otimizacao] Erro crítico:", err);
    return new Response(
      JSON.stringify({ ok: false, erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
