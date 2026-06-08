// otimizar-campanhas — analisa campanhas e grava SUGESTÕES (status: 'pendente')
// NÃO executa nenhuma ação. O usuário aprova e a função executar-otimizacao executa.
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
const LEAD_ACTIONS = [
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
];

function getLeadsFromActions(actions: any[]): number {
  return parseInt(
    actions?.find((a: any) => LEAD_ACTIONS.includes(a.action_type))?.value || "0"
  );
}

function getLimitesModo(modo: string) {
  switch (modo) {
    case "conservador":
      return { aumentoMaxPct: 0.15, reducaoMaxPct: 0.20, budgetMaxDia: 300, pausarCPLRatio: 2.5 };
    case "agressivo":
      return { aumentoMaxPct: 0.50, reducaoMaxPct: 0.40, budgetMaxDia: 1000, pausarCPLRatio: 1.8 };
    default: // equilibrado
      return { aumentoMaxPct: 0.25, reducaoMaxPct: 0.30, budgetMaxDia: 500, pausarCPLRatio: 2.0 };
  }
}

async function analisarOrg(orgId: string) {
  // Buscar configuração da org
  const orgRes = await rest(
    `organizations?select=meta_token,meta_account_id,ravena_ativa,ravena_modo,ravena_meta_revendedoras&id=eq.${orgId}&limit=1`
  );
  const [org] = await orgRes.json();

  if (!org?.ravena_ativa || !org.meta_token || !org.meta_account_id) {
    return { skip: true, motivo: "Ravena não ativa ou sem token configurado" };
  }

  const { meta_token: token, meta_account_id: account } = org;
  const modo = org.ravena_modo || "equilibrado";
  const metaRevs = Number(org.ravena_meta_revendedoras) || 0;
  const limites = getLimitesModo(modo);
  const dp = "last_7d";

  // Buscar campanhas via Meta API
  const campUrl = new URL(`${META_BASE}/act_${account}/campaigns`);
  campUrl.searchParams.set(
    "fields",
    `id,name,status,daily_budget,lifetime_budget,insights.date_preset(${dp}){spend,impressions,clicks,ctr,cpm,actions}`
  );
  campUrl.searchParams.set("limit", "50");
  campUrl.searchParams.set("access_token", token);

  const campData = await (await fetch(campUrl.toString())).json();

  if (campData.error) {
    const { code, error_subcode, type } = campData.error;
    if ((code === 100 && error_subcode) || code === 190 || code === 17 || code === 4 || type === "OAuthException") {
      return {
        skip: false,
        log: {
          org_id: orgId,
          status: "erro",
          acoes_sugeridas: [],
          acoes_executadas: [],
          decisao_principal: "Análise interrompida devido a problema na integração",
          frase_do_dia: "⚠️ Erro na sincronização com Facebook Ads",
          resumo: "Sem dados recebidos da Meta",
          insights: [],
          alerta: "⚠️ Sua conta de anúncios está bloqueada ou o token expirou. Verifique o Gerenciador de Negócios do Facebook.",
          total_gasto: 0,
          total_leads: 0,
          cpl_medio: 0,
          ritmo_mensal: 0,
          revendedoras_mes: 0,
          dias_restantes: 0,
        }
      };
    }
  }

  const campanhas: any[] = campData.data || [];
  if (!campanhas.length) return { skip: true, motivo: "Sem campanhas com dados" };

  // Buscar leads do CRM (últimos 7 dias) para cruzamento
  const ha7 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const leadsRes = await rest(
    `leads?select=id,utm_campaign,utm_source,status,created_at,status_aprovado_at&org_id=eq.${orgId}&created_at=gte.${ha7}T00:00:00-03:00&order=created_at.desc&limit=1000`
  );
  const leads: any[] = (await leadsRes.json()) || [];

  // Métricas globais
  let totalGasto = 0;
  let totalLeadsApi = 0;
  for (const c of campanhas) {
    const ins = c.insights?.data?.[0];
    totalGasto += parseFloat(ins?.spend || "0");
    totalLeadsApi += getLeadsFromActions(ins?.actions || []);
  }

  const cplMedio = totalLeadsApi > 0 ? totalGasto / totalLeadsApi : 0;

  // Revendedoras aprovadas no período
  const revsTotal = leads.filter((l) => Number(l.status) === 3).length;
  const totalLeadsCRM = leads.length;

  // Ritmo e dias
  const agora = new Date();
  const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
  const diasRestantes = diasNoMes - agora.getDate();
  const diasDecorridos = Math.max(agora.getDate(), 1);
  const ritmoMensal = Math.round((totalGasto / diasDecorridos) * diasNoMes);

  // Gerar sugestões por campanha
  const acoesSugeridas: any[] = [];
  const insights: any[] = [];
  let alertaMensagem = "";

  for (const camp of campanhas) {
    if (camp.status === "ARCHIVED" || camp.status === "DELETED") continue;

    const ins = camp.insights?.data?.[0];
    const gasto = parseFloat(ins?.spend || "0");
    const leadsApi = getLeadsFromActions(ins?.actions || []);
    const daily_budget = camp.daily_budget ? parseInt(camp.daily_budget) / 100 : 0;

    if (gasto < 5) continue; // sem dados suficientes

    // Leads CRM desta campanha (match por utm_campaign ou id)
    const campLeadsCRM = leads.filter((l: any) => {
      const utm = (l.utm_campaign || "").trim().toLowerCase();
      if (!utm) return false;
      const utmBase = utm.split("|")[0].trim();
      const cn = camp.name.toLowerCase().trim();
      return (
        utm === camp.id ||
        utmBase === camp.id ||
        cn === utmBase ||
        (cn.length >= 10 && utmBase.includes(cn.slice(0, 15))) ||
        (utmBase.length >= 10 && cn.includes(utmBase.slice(0, 15)))
      );
    });

    const campRevsCRM = campLeadsCRM.filter((l: any) => Number(l.status) === 3).length;
    const campLeadsN = Math.max(campLeadsCRM.length, leadsApi, 1);
    const campCPL = gasto / campLeadsN;

    // Decisão baseada em CPL relativo à média
    if (camp.status === "ACTIVE") {
      if (
        cplMedio > 0 &&
        campCPL > cplMedio * limites.pausarCPLRatio &&
        campLeadsN > 3 &&
        campRevsCRM === 0
      ) {
        // Campanha com CPL muito alto e sem conversões → sugerir pausar
        acoesSugeridas.push({
          tipo: "pausar_campanha",
          id: camp.id,
          nome: camp.name,
          motivo: `CPL R$ ${Math.round(campCPL)} está ${Math.round(
            (campCPL / cplMedio - 1) * 100
          )}% acima da média (R$ ${Math.round(cplMedio)}) sem aprovações no período.`,
        });
        insights.push({
          campanha_nome: camp.name,
          decisao: "pausar",
          porque: `CPL ${Math.round((campCPL / cplMedio - 1) * 100)}% acima da média sem conversões`,
          proximo_passo: "Revisar criativos e segmentação antes de reativar",
        });
      } else if (
        campRevsCRM > 0 &&
        cplMedio > 0 &&
        campCPL <= cplMedio * 0.75 &&
        daily_budget > 0
      ) {
        // Campanha com CPL abaixo da média e com conversões → sugerir escalar
        const novoOrca = Math.min(
          Math.round(daily_budget * (1 + limites.aumentoMaxPct)),
          limites.budgetMaxDia
        );
        if (novoOrca > daily_budget) {
          acoesSugeridas.push({
            tipo: "ajustar_budget_campanha",
            id: camp.id,
            nome: camp.name,
            direcao: "aumento",
            antigo_budget: daily_budget,
            novo_budget: novoOrca,
            motivo: `CPL R$ ${Math.round(campCPL)} abaixo da média com ${campRevsCRM} aprovação${
              campRevsCRM !== 1 ? "ões" : ""
            }. Escalando para maximizar resultados.`,
          });
          insights.push({
            campanha_nome: camp.name,
            decisao: "escalar",
            porque: `Melhor CPL da conta com conversões confirmadas`,
            proximo_passo: `Monitorar frequência após escalonamento`,
          });
        }
      } else if (
        cplMedio > 0 &&
        campCPL > cplMedio * 1.4 &&
        campLeadsN > 5 &&
        daily_budget > 0
      ) {
        // CPL acima da média mas não crítico → sugerir reduzir
        const novoOrca = Math.max(
          Math.round(daily_budget * (1 - limites.reducaoMaxPct)),
          50
        );
        if (novoOrca < daily_budget) {
          acoesSugeridas.push({
            tipo: "ajustar_budget_campanha",
            id: camp.id,
            nome: camp.name,
            direcao: "reducao",
            antigo_budget: daily_budget,
            novo_budget: novoOrca,
            motivo: `CPL R$ ${Math.round(campCPL)} está acima da média. Reduzindo orçamento para otimizar alocação.`,
          });
          insights.push({
            campanha_nome: camp.name,
            decisao: "otimizar",
            porque: `CPL ${Math.round((campCPL / cplMedio - 1) * 100)}% acima da média`,
            proximo_passo: "Testar novos criativos ou públicos",
          });
        }
      } else {
        insights.push({
          campanha_nome: camp.name,
          decisao: "manter",
          porque: `Performance dentro do esperado`,
          proximo_passo: "",
        });
      }
    }
  }

  // Alertas de nível de conta
  if (totalLeadsApi > 10 && revsTotal === 0 && totalLeadsCRM > 10) {
    alertaMensagem = `${totalLeadsApi} leads sem aprovações no período — verifique o funil de vendas e o processo de qualificação.`;
  } else if (metaRevs > 0 && diasDecorridos >= 10) {
    const ritmoRevs = Math.round((revsTotal / diasDecorridos) * diasNoMes);
    if (ritmoRevs < metaRevs * 0.5) {
      alertaMensagem = `Ritmo atual projeta ${ritmoRevs} aprovações no mês — meta é ${metaRevs}. Considere intensificar as campanhas de melhor performance.`;
    }
  }

  const acoesFiltradas = acoesSugeridas.filter((a) => a.tipo !== "manter");
  const decisao =
    acoesFiltradas.length > 0
      ? `${acoesFiltradas.length} ação${acoesFiltradas.length !== 1 ? "ões" : ""} recomendada${
          acoesFiltradas.length !== 1 ? "s" : ""
        } — revise e aplique`
      : "Nenhuma ação necessária — campanhas em ritmo normal";

  const fraseDoDia =
    acoesFiltradas.length > 0
      ? `Analisei suas campanhas e encontrei ${acoesFiltradas.length} oportunidade${
          acoesFiltradas.length !== 1 ? "s" : ""
        } de otimização. Revise as sugestões antes de aplicar.`
      : `Campanhas em boa performance. CPL médio R$ ${Math.round(cplMedio)} com ${revsTotal} aprovações nos últimos 7 dias.`;

  return {
    skip: false,
    log: {
      org_id: orgId,
      status: "pendente",
      acoes_sugeridas: acoesSugeridas,
      acoes_executadas: [],
      decisao_principal: decisao,
      frase_do_dia: fraseDoDia,
      resumo: `${totalLeadsApi} leads · CPL R$ ${Math.round(cplMedio)} · ${revsTotal} aprovações (7 dias)`,
      insights: insights.slice(0, 10),
      alerta: alertaMensagem || null,
      total_gasto: totalGasto,
      total_leads: Math.max(totalLeadsApi, totalLeadsCRM),
      cpl_medio: cplMedio,
      ritmo_mensal: ritmoMensal,
      revendedoras_mes: revsTotal,
      dias_restantes: diasRestantes,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch { /* body vazio */ }

    let orgIds: string[] = [];

    if (body.org_id) {
      orgIds = [body.org_id];
    } else {
      // Cron: processar todas as orgs com Ravena ativa
      const res = await rest(
        `organizations?select=id&ravena_ativa=eq.true&limit=200`
      );
      const orgs = await res.json();
      orgIds = (orgs || []).map((o: any) => o.id);
    }

    const resultados: any[] = [];

    for (const orgId of orgIds) {
      try {
        const result = await analisarOrg(orgId);

        if (result.skip) {
          resultados.push({ orgId, status: "pulado", motivo: result.motivo });
          continue;
        }

        // Salvar log com status 'pendente' — NÃO executar ações
        const saveRes = await rest("ai_optimization_logs", {
          method: "POST",
          body: JSON.stringify(result.log),
          headers: { ...dbH, Prefer: "return=representation" },
        });

        const [saved] = await saveRes.json();
        const numAcoes = (result.log.acoes_sugeridas as any[]).filter(
          (a) => a.tipo !== "manter"
        ).length;

        resultados.push({
          orgId,
          status: "pendente",
          log_id: saved?.id,
          acoes_sugeridas: numAcoes,
        });

        console.log(`[otimizar] org=${orgId} sugestões=${numAcoes} log=${saved?.id}`);
      } catch (err) {
        console.error(`[otimizar] Erro org=${orgId}:`, String(err));
        resultados.push({ orgId, status: "erro", erro: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, resultados }), {
      status: 200,
      headers: CORS,
    });
  } catch (err) {
    console.error("[otimizar] erro geral:", String(err));
    return new Response(JSON.stringify({ ok: false, erro: String(err) }), {
      status: 500,
      headers: CORS,
    });
  }
});
