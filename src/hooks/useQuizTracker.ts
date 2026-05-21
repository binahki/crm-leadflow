import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getDispositivo(): string {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function getUTMs() {
  const href = window.location.href;
  const searchPart = href.includes('?') ? href.substring(href.indexOf('?')) : '';
  const p = new URLSearchParams(searchPart);
  
  const captured: Record<string, string> = {};
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'fbclid', 'gclid'];
  utmKeys.forEach(key => {
    const val = p.get(key);
    if (val) captured[key] = val;
  });
  return captured;
}

export function useQuizTracker(quizSlug: string, orgId?: string | null, totalEtapas?: number) {
  const sessionIdRef = useRef<string>(generateSessionId());
  const iniciadoRef = useRef(false);
  const respostasRef = useRef<Record<string, any>>({});
  const queuePromiseRef = useRef<Promise<any>>(Promise.resolve());

  const quizSlugRef = useRef(quizSlug);
  const orgIdRef = useRef(orgId);
  const totalEtapasRef = useRef(totalEtapas || 0);

  // Sync refs immediately in the render phase to avoid timing race conditions
  quizSlugRef.current = quizSlug;
  orgIdRef.current = orgId;
  totalEtapasRef.current = totalEtapas || 0;

  useEffect(() => { quizSlugRef.current = quizSlug; }, [quizSlug]);
  useEffect(() => { orgIdRef.current = orgId; }, [orgId]);
  useEffect(() => { totalEtapasRef.current = totalEtapas || 0; }, [totalEtapas]);

  const enqueue = useCallback((op: () => Promise<any>) => {
    queuePromiseRef.current = queuePromiseRef.current
      .then(op)
      .catch(err => {
        console.error("useQuizTracker: Queue operation failed", err);
      });
    return queuePromiseRef.current;
  }, []);

  const iniciarSessao = useCallback(() => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;

    enqueue(async () => {
      const payload = {
        session_id: sessionIdRef.current,
        quiz_slug: quizSlugRef.current,
        org_id: orgIdRef.current || null,
        total_etapas: totalEtapasRef.current,
        ultima_etapa: 0,
        concluiu: false,
        virou_lead: false,
        dispositivo: getDispositivo(),
        user_agent: navigator.userAgent.slice(0, 200),
        ...getUTMs(),
      };
      
      const { error } = await supabase.from('quiz_sessoes').upsert(payload, { onConflict: 'session_id' });
      if (error) {
        console.error("useQuizTracker: Error in iniciarSessao upsert", error);
      }
    });
  }, [enqueue]);

  const registrarEtapa = useCallback((etapaIndex: number, pergunta?: string, resposta?: any) => {
    if (!iniciadoRef.current) {
      iniciarSessao();
    }

    if (pergunta && resposta !== undefined) {
      respostasRef.current[pergunta] = resposta;
    }

    enqueue(async () => {
      // Upsert garante que a linha é criada mesmo se iniciarSessao falhou
      // (RLS, rede, etc). Campos concluiu/virou_lead são omitidos para não
      // sobrescrever valores já gravados por marcarConcluido.
      const upsertPayload: any = {
        session_id: sessionIdRef.current,
        quiz_slug: quizSlugRef.current,
        org_id: orgIdRef.current || null,
        ultima_etapa: etapaIndex,
        updated_at: new Date().toISOString(),
        dispositivo: getDispositivo(),
        user_agent: navigator.userAgent.slice(0, 200),
        ...getUTMs(),
      };

      if (Object.keys(respostasRef.current).length > 0) {
        upsertPayload.respostas = { ...respostasRef.current };
      }

      if (totalEtapasRef.current > 0) {
        upsertPayload.total_etapas = totalEtapasRef.current;
      }

      const { error } = await supabase
        .from('quiz_sessoes')
        .upsert(upsertPayload, { onConflict: 'session_id' });

      if (error) {
        console.error("useQuizTracker: Error in registrarEtapa upsert", error);
      }
    });
  }, [iniciarSessao, enqueue]);

  const atualizarTotalEtapas = useCallback((total: number) => {
    if (!iniciadoRef.current || total === 0) return;
    totalEtapasRef.current = total;

    enqueue(async () => {
      const updatePayload: any = {
        total_etapas: total,
      };
      if (orgIdRef.current) {
        updatePayload.org_id = orgIdRef.current;
      }
      const { error } = await supabase
        .from('quiz_sessoes')
        .update(updatePayload)
        .eq('session_id', sessionIdRef.current);

      if (error) {
        console.error("useQuizTracker: Error in atualizarTotalEtapas update", error);
      }
    });
  }, [enqueue]);

  const marcarConcluido = useCallback((leadId?: string | number, etapaAtual?: number) => {
    const total = totalEtapasRef.current;

    enqueue(async () => {
      const updatePayload: any = {
        concluiu: true,
        ultima_etapa: etapaAtual !== undefined ? etapaAtual : (total > 0 ? total : undefined),
        total_etapas: total > 0 ? total : undefined,
        virou_lead: !!leadId,
        lead_id: leadId || null,
        updated_at: new Date().toISOString(),
      };
      if (orgIdRef.current) {
        updatePayload.org_id = orgIdRef.current;
      }
      const { error } = await supabase
        .from('quiz_sessoes')
        .update(updatePayload)
        .eq('session_id', sessionIdRef.current);

      if (error) {
        console.error("useQuizTracker: Error in marcarConcluido update", error);
      }
    });
  }, [enqueue]);

  return { iniciarSessao, registrarEtapa, marcarConcluido, atualizarTotalEtapas, sessionId: sessionIdRef.current, sessionIdRef, iniciadoRef, totalEtapasRef };
}
