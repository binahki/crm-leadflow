// executar-otimizacao — executa as ações sugeridas de um log pendente
// Chamada pelo frontend após o usuário revisar e aprovar as sugestões.
import "@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

const dbH = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path: string, opts?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: dbH, ...opts });
}

const META_BASE = "https://graph.facebook.com/v18.0";

function getLimitesModo(modo: string) {
  switch (modo) {
    case "conservador":
      return { aumentoMaxPct: 0.15, reducaoMaxPct: 0.20, budgetMaxDia: 300 };
    case "agressivo":
      return { aumentoMaxPct: 0.50, reducaoMaxPct: 0.40, budgetMaxDia: 1000 };
    default: // equilibrado
      return { aumentoMaxPct: 0.25, reducaoMaxPct: 0.30, budgetMaxDia: 500 };
  }
}

async function chamarMeta(
  id: string,
  body: Record<string, unknown>,
  token: string
): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch(`${META_BASE}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, access_token: token }),
    });
    const data = await res.json();
    if (data.error) {
      return { ok: false, erro: data.error.message || data.error.error_user_msg || "Erro Meta API" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const body = await req.json();
    const { log_id, acao_id } = body;
    if (!log_id) {
      return new Response(
        JSON.stringify({ ok: false, erro: "log_id obrigatório" }),
        { status: 422, headers: CORS }
      );
    }

    // 1. Buscar o log (pendente ou executado — suporta execução parcial)
    const logRes = await rest(
      `ai_optimization_logs?select=*&id=eq.${log_id}&limit=1`
    );
    const [log] = await logRes.json();
    if (!log || log.status === 'ignorado') {
      return new Response(
        JSON.stringify({ ok: false, erro: "Log não encontrado ou ignorado" }),
        { status: 404, headers: CORS }
      );
    }

    // 2. Buscar dados da org (token e modo)
    const orgRes = await rest(
      `organizations?select=meta_token,meta_account_id,ravena_modo&id=eq.${log.org_id}&limit=1`
    );
    const [org] = await orgRes.json();
    if (!org?.meta_token) {
      return new Response(
        JSON.stringify({ ok: false, erro: "Organização sem token Meta configurado" }),
        { status: 400, headers: CORS }
      );
    }

    const token = org.meta_token;
    const limites = getLimitesModo(org.ravena_modo || "equilibrado");
    const acoesExecutadas: any[] = [];
    let pausasExecutadas = 0;

    // Se acao_id fornecido, executar apenas essa ação específica (aplicação individual)
    const todasAcoes: any[] = log.acoes_sugeridas || [];
    const acoesParaExecutar = acao_id
      ? todasAcoes.filter((a: any) => a.id === acao_id)
      : todasAcoes;

    // 3. Executar cada ação selecionada
    for (const acao of acoesParaExecutar) {
      const tipo: string = acao.tipo || "";

      // Ação "manter" — ignorar silenciosamente
      if (tipo === "manter") continue;

      // Pausa de campanha ou adset
      if (
        tipo === "pausar_campanha" ||
        tipo === "pausar_adset" ||
        tipo === "pausar"
      ) {
        if (pausasExecutadas >= 2) {
          acoesExecutadas.push({
            ...acao,
            ok: false,
            erro: "Limite de 2 pausas por execução atingido",
          });
          console.log(`[executar] limite de pausas atingido para ${acao.id}`);
          continue;
        }

        const result = await chamarMeta(acao.id, { status: "PAUSED" }, token);
        pausasExecutadas++;
        acoesExecutadas.push({ ...acao, ok: result.ok, erro: result.erro });
        console.log(`[executar] pausar id=${acao.id} ok=${result.ok}`);
      }

      // Ajuste de orçamento diário
      else if (
        tipo === "ajustar_budget_campanha" ||
        tipo === "ajustar_budget_adset" ||
        tipo === "aumentar" ||
        tipo === "reduzir"
      ) {
        const atual = Number(acao.antigo_budget) || 0;
        let novo = Number(acao.novo_budget) || atual;

        // Aplicar limites de segurança por modo
        const isAumento =
          acao.direcao === "aumento" ||
          tipo === "aumentar" ||
          tipo === "ajustar_budget_campanha" && acao.direcao === "aumento";

        if (isAumento) {
          // Não escalar mais que o permitido pelo modo
          const maximo = atual * (1 + limites.aumentoMaxPct);
          novo = Math.min(novo, maximo, limites.budgetMaxDia);
        } else {
          // Não reduzir mais que o permitido pelo modo
          const minimo = atual * (1 - limites.reducaoMaxPct);
          novo = Math.max(novo, minimo, 10); // mínimo R$ 10
        }

        novo = Math.round(novo);

        if (novo === atual || novo <= 0) {
          acoesExecutadas.push({
            ...acao,
            novo_budget: novo,
            ok: false,
            erro: "Novo budget igual ao atual ou inválido após limites de segurança",
          });
          continue;
        }

        // Meta API recebe em centavos
        const result = await chamarMeta(
          acao.id,
          { daily_budget: String(novo * 100) },
          token
        );
        acoesExecutadas.push({ ...acao, novo_budget: novo, ok: result.ok, erro: result.erro });
        console.log(
          `[executar] budget id=${acao.id} ${atual}→${novo} ok=${result.ok}`
        );
      }
    }

    // 4. Atualizar log: mesclar ações executadas; remover aplicadas de acoes_sugeridas
    const prevExecutadas: any[] = log.acoes_executadas || [];
    const novasExecutadas = [...prevExecutadas, ...acoesExecutadas];

    // acoes_sugeridas: remover as que foram aplicadas nesta chamada
    const idsAplicados = new Set(acoesExecutadas.filter(a => a.ok).map((a: any) => a.id));
    const sugestoesRestantes = todasAcoes.filter((a: any) => !idsAplicados.has(a.id));
    const novoStatus = sugestoesRestantes.length === 0 ? 'executado' : log.status;

    const patchRes = await rest(`ai_optimization_logs?id=eq.${log_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: novoStatus,
        acoes_executadas: novasExecutadas,
        acoes_sugeridas: sugestoesRestantes,
        executado_em: new Date().toISOString(),
      }),
      headers: { ...dbH, Prefer: "return=minimal" },
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("[executar] erro ao atualizar log:", err);
    }

    const okCount = acoesExecutadas.filter((a) => a.ok).length;
    const errCount = acoesExecutadas.filter((a) => !a.ok).length;

    console.log(
      `[executar] org=${log.org_id} total=${acoesExecutadas.length} ok=${okCount} err=${errCount}`
    );

    return new Response(
      JSON.stringify({
        ok: true,
        acoes: acoesExecutadas.length,
        ok_count: okCount,
        err_count: errCount,
        acoes_executadas: acoesExecutadas,
      }),
      { status: 200, headers: CORS }
    );
  } catch (err) {
    console.error("[executar-otimizacao] erro geral:", String(err));
    return new Response(
      JSON.stringify({ ok: false, erro: String(err) }),
      { status: 500, headers: CORS }
    );
  }
});
