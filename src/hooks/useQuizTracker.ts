import { useRef, useCallback } from 'react';
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
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get('utm_source') || undefined,
    utm_medium: p.get('utm_medium') || undefined,
    utm_campaign: p.get('utm_campaign') || undefined,
  };
}

export function useQuizTracker(quizSlug: string, orgId?: string | null, totalEtapas?: number) {
  const sessionIdRef = useRef<string>(generateSessionId());
  const iniciadoRef = useRef(false);
  const respostasRef = useRef<Record<string, any>>({});

  const iniciarSessao = useCallback(async () => {
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;

    await supabase.from('quiz_sessoes').upsert({
      session_id: sessionIdRef.current,
      quiz_slug: quizSlug,
      org_id: orgId || null,
      total_etapas: totalEtapas || 0,
      ultima_etapa: 0,
      concluiu: false,
      virou_lead: false,
      dispositivo: getDispositivo(),
      user_agent: navigator.userAgent.slice(0, 200),
      ...getUTMs(),
    }, { onConflict: 'session_id' });
  }, [quizSlug, orgId, totalEtapas]);

  const registrarEtapa = useCallback(async (etapaIndex: number, pergunta?: string, resposta?: any) => {
    if (!iniciadoRef.current) await iniciarSessao();

    if (pergunta && resposta !== undefined) {
      respostasRef.current[pergunta] = resposta;
    }

    await supabase.from('quiz_sessoes').update({
      ultima_etapa: etapaIndex,
      respostas: respostasRef.current,
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionIdRef.current);
  }, [iniciarSessao]);

  const marcarConcluido = useCallback(async (leadId?: string) => {
    await supabase.from('quiz_sessoes').update({
      concluiu: true,
      virou_lead: !!leadId,
      lead_id: leadId || null,
      updated_at: new Date().toISOString(),
    }).eq('session_id', sessionIdRef.current);
  }, []);

  return { iniciarSessao, registrarEtapa, marcarConcluido, sessionId: sessionIdRef.current };
}
