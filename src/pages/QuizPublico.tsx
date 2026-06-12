import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useOrgId } from '@/hooks/useOrgId';
import { useQuizTracker } from '@/hooks/useQuizTracker';
import { supabase } from '@/integrations/supabase/client';
import {
  QuizRenderer,
  DEFAULT_COLETA_CONFIG,
  type ColetaCampo, type QuizConfig, type Bloco, type Opcao, type Pergunta, type Phase,
} from '@/components/quiz/QuizRenderer';
import { QuizBlockRenderer } from '@/components/quiz/QuizBlockRenderer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'src', 'fbclid', 'gclid'];
const UTM_SESSION_KEY = 'quiz_last_utms';

function initializeUtms() {
  try {
    const raw = new URLSearchParams(window.location.search);
    const fromUrl: Record<string, string> = {};
    UTM_KEYS.forEach(key => {
      const val = raw.get(key);
      if (val) fromUrl[key] = val;
    });

    if (Object.keys(fromUrl).length > 0) {
      let existing: Record<string, string> = {};
      try {
        const stored = sessionStorage.getItem(UTM_SESSION_KEY);
        if (stored) existing = JSON.parse(stored);
      } catch {}
      const merged = { ...existing, ...fromUrl };
      sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(merged));
    }
  } catch (e) {
    console.error('Error initializing UTMs:', e);
  }
}

function getUtmsPayload(): Record<string, string> {
  let stored: Record<string, string> = {};
  try {
    const storedStr = sessionStorage.getItem(UTM_SESSION_KEY);
    if (storedStr) stored = JSON.parse(storedStr);
  } catch {}

  const raw = new URLSearchParams(window.location.search);
  const fromUrl: Record<string, string> = {};
  UTM_KEYS.forEach(key => {
    const val = raw.get(key);
    if (val) fromUrl[key] = val;
  });

  const merged = { ...fromUrl, ...stored };

  const coreKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  coreKeys.forEach(key => {
    if (!merged[key]) {
      merged[key] = '';
    }
  });

  return merged;
}


declare global {
  interface Window { confetti?: (opts: Record<string, unknown>) => void; }
}

function launchConfetti(primary: string) {
  const fire = () => {
    window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.55 }, colors: [primary, '#ffd700', '#ffffff'] });
    setTimeout(() => window.confetti?.({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: [primary, '#ffd700'] }), 300);
  };
  if (window.confetti) { fire(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  s.onload = fire;
  document.head.appendChild(s);
}

export default function QuizPublico() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  const [phase, setPhase] = useState<Phase>('loading');
  const [networkError, setNetworkError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [quiz, setQuiz] = useState<QuizConfig | null>(null);
  const [quizBlocks, setQuizBlocks] = useState<any[]>([]);
  const [currentBlockPageId, setCurrentBlockPageId] = useState('cover');
  const [blockSelectedOpcaoId, setBlockSelectedOpcaoId] = useState<string | null>(null);
  const [blockAnswers, setBlockAnswers] = useState<Record<string, string>>({});
  const [blockPoints, setBlockPoints] = useState<Record<string, number>>({});
  const [blocos, setBlocos] = useState<Bloco[]>([]);
  const [todasPerguntas, setTodasPerguntas] = useState<Pergunta[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [multipleAnswers, setMultipleAnswers] = useState<Record<string, string[]>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionKey, setQuestionKey] = useState(0);
  const [selectedOpcao, setSelectedOpcao] = useState<string | null>(null);
  const [selectedOpcoes, setSelectedOpcoes] = useState<string[]>([]);
  const [faixa, setFaixa] = useState<'verde' | 'amarelo' | null>(null);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cidade, setCidade] = useState('');
  const [instagram, setInstagram] = useState('');
  const [coletaStep, setColetaStep] = useState(0);
  const [blockCampoStep, setBlockCampoStep] = useState(0);
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});

  const { iniciarSessao, registrarEtapa, marcarConcluido, atualizarTotalEtapas, sessionIdRef } = useQuizTracker(
    slug || '',
    quiz?.org_id,
    todasPerguntas.length
  );

  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset coleta step ao entrar na fase ───────────────────────────────────────
  useEffect(() => {
    if (phase === 'coleta') setColetaStep(0);
  }, [phase]); // eslint-disable-line

  // ── Reset block campo step when page changes ──────────────────────────────────
  useEffect(() => {
    setBlockCampoStep(0);
  }, [currentBlockPageId]);

  // ── Confetti on approval page (block-editor live quiz) ────────────────────────
  useEffect(() => {
    if (!(quiz as any)?.use_block_editor) return;
    const page = todasPerguntas.find(p => p.id === currentBlockPageId);
    if (page?.tipo_resposta !== 'aprovacao') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    document.getElementById('quiz-confetti-canvas')?.remove();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.id = 'quiz-confetti-canvas';
    Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none', zIndex: '9999' });
    canvas.width = W * dpr; canvas.height = H * dpr;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    ctx.scale(dpr, dpr);
    const brand = quiz?.cor_primaria || '#2563eb';
    const pal = [brand, brand, brand, '#f59e0b', '#fbbf24', '#10b981', '#f472b6', '#a78bfa', '#fb923c'];
    type Shape = 'circle' | 'square' | 'ribbon';
    interface P { x: number; y: number; vx: number; vy: number; angle: number; spin: number; w: number; h: number; color: string; shape: Shape }
    function burst(cx: number, cy: number, n: number): P[] {
      return Array.from({ length: n }, (): P => {
        const shape: Shape = Math.random() < 0.35 ? 'circle' : Math.random() < 0.5 ? 'ribbon' : 'square';
        const speed = 10 + Math.random() * 18;
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.75;
        const sz = 5 + Math.random() * 7;
        return { x: cx + (Math.random() - 0.5) * 60, y: cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.35, w: shape === 'ribbon' ? sz * 0.35 : sz, h: shape === 'ribbon' ? sz * 4 : sz, color: pal[Math.floor(Math.random() * pal.length)], shape };
      });
    }
    const particles: P[] = [...burst(W * 0.5, H * 0.82, 70), ...burst(W * 0.2, H * 0.88, 50), ...burst(W * 0.8, H * 0.88, 50)];
    let wave2 = false;
    const t0 = performance.now(), TOTAL = 4200, FADE = 3000;
    let raf = 0;
    function frame(now: number) {
      const el = now - t0;
      if (!wave2 && el >= 350) { wave2 = true; particles.push(...burst(W * 0.35, H * 0.80, 40), ...burst(W * 0.65, H * 0.80, 40)); }
      ctx.clearRect(0, 0, W, H);
      let live = false;
      for (const p of particles) {
        p.vy += 0.5; p.vx *= 0.988; p.x += p.vx; p.y += p.vy; p.angle += p.spin;
        const alpha = el < FADE ? 1 : Math.max(0, 1 - (el - FADE) / (TOTAL - FADE));
        if (alpha <= 0 || p.y > H + 80) continue;
        live = true;
        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }
      if (live && el < TOTAL) raf = requestAnimationFrame(frame); else canvas.remove();
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); canvas.remove(); };
  }, [currentBlockPageId, todasPerguntas, quiz]); // eslint-disable-line

  function handleColetaNext() {
    setColetaStep(s => s + 1);
  }

  // ── Cria sessão assim que a capa do quiz é exibida ────────────────────────────
  // Chamada imediata: garante registro mesmo se a pessoa fechar antes de começar.
  useEffect(() => {
    if (phase === 'capa' && quiz) {
      iniciarSessao();
    }
  }, [phase, quiz]); // eslint-disable-line

  // ── Corrige total_etapas após perguntas carregarem ─────────────────────────────
  useEffect(() => {
    if (todasPerguntas.length > 0 && phase !== 'loading') {
      atualizarTotalEtapas(todasPerguntas.length);
    }
  }, [todasPerguntas.length]); // eslint-disable-line

  // ── Load quiz ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setPhase('not_found'); return; }
    let mounted = true;

    const timeoutId = setTimeout(() => {
      if (mounted) { setNetworkError(true); setPhase('not_found'); }
    }, 10000);

    async function loadQuiz() {
      try {
        const { data: quizData, error } = await db
          .from('quizzes').select('*').eq('slug', slug).eq('ativo', true).single();
        if (!mounted) return;
        if (error || !quizData) { clearTimeout(timeoutId); setPhase('not_found'); return; }
        setQuiz(quizData);

        if (quizData.use_block_editor) {
          const [blocksRes, blocoRes] = await Promise.all([
            db.from('quiz_page_blocks').select('*').eq('quiz_id', quizData.id).order('ordem'),
            db.from('quiz_blocos').select('*').eq('quiz_id', quizData.id).order('ordem'),
          ]);
          if (!mounted) return;
          setQuizBlocks(blocksRes.data || []);

          const blocoData: Bloco[] = blocoRes.data || [];
          const blocoIds = blocoData.map((b: Bloco) => b.id);

          if (blocoIds.length > 0) {
            const { data: pergs } = await db
              .from('quiz_perguntas').select('*').in('bloco_id', blocoIds).order('ordem');
            if (!mounted) return;
            if (pergs?.length) {
              const pergIds = (pergs as Pergunta[]).map((p: Pergunta) => p.id);
              const { data: ops } = await db
                .from('quiz_opcoes').select('*').in('pergunta_id', pergIds).order('ordem');
              if (!mounted) return;
              const blocoOrder: Record<string, number> = {};
              blocoData.forEach((b: Bloco) => { blocoOrder[b.id] = b.ordem; });
              const perguntasComOpcoes: Pergunta[] = [...(pergs as Pergunta[])]
                .sort((a: Pergunta, b: Pergunta) => {
                  const bA = blocoOrder[a.bloco_id] ?? 0;
                  const bB = blocoOrder[b.bloco_id] ?? 0;
                  return bA !== bB ? bA - bB : a.ordem - b.ordem;
                })
                .map((p: Pergunta) => ({
                  ...p,
                  opcoes: ((ops || []) as Opcao[])
                    .filter((o: Opcao) => o.pergunta_id === p.id)
                    .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
                }));
              setTodasPerguntas(perguntasComOpcoes);
            }
          }

          setCurrentBlockPageId('cover');
          clearTimeout(timeoutId);
          setPhase('capa');
          return;
        }

        const { data: blocoData } = await db
          .from('quiz_blocos').select('*').eq('quiz_id', quizData.id).order('ordem');
        if (!mounted) return;
        if (!blocoData?.length) { clearTimeout(timeoutId); setPhase('not_found'); return; }
        setBlocos(blocoData);

        const blocoIds = blocoData.map((b: Bloco) => b.id);
        const { data: pergs } = await db
          .from('quiz_perguntas').select('*').in('bloco_id', blocoIds).order('ordem');
        if (!mounted) return;
        if (!pergs?.length) { clearTimeout(timeoutId); setPhase('not_found'); return; }

        const pergIds = pergs.map((p: { id: string }) => p.id);
        const { data: ops } = await db
          .from('quiz_opcoes').select('*').in('pergunta_id', pergIds).order('ordem');
        if (!mounted) return;

        const blocoOrder: Record<string, number> = {};
        blocoData.forEach((b: Bloco) => { blocoOrder[b.id] = b.ordem; });

        const perguntasComOpcoes: Pergunta[] = pergs
          .sort((a: Pergunta, b: Pergunta) => {
            const bA = blocoOrder[a.bloco_id] ?? 0;
            const bB = blocoOrder[b.bloco_id] ?? 0;
            return bA !== bB ? bA - bB : a.ordem - b.ordem;
          })
          .map((p: Pergunta) => ({
            ...p,
            opcoes: (ops || [])
              .filter((o: Opcao) => o.pergunta_id === p.id)
              .sort((a: Opcao, b: Opcao) => a.ordem - b.ordem),
          }));

        clearTimeout(timeoutId);
        setTodasPerguntas(perguntasComOpcoes);
        setPhase('capa');
      } catch (err) {
        if (!mounted) return;
        clearTimeout(timeoutId);
        console.error('[QuizPublico] loadQuiz failed:', err);
        setNetworkError(true);
        setPhase('not_found');
      }
    }
    loadQuiz();

    return () => { mounted = false; clearTimeout(timeoutId); };
  }, [slug, isPreview, retryCount]);

  // ── Salva progresso ao visualizar cada pergunta (mesmo sem responder) ─────────
  useEffect(() => {
    if (phase !== 'quiz') return;
    if (currentIdx < 0) return;
    registrarEtapa(currentIdx + 1);
  }, [currentIdx, phase, registrarEtapa]);

  // ── Confetti on approval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'aprovado_form' && quiz) {
      launchConfetti(quiz.cor_primaria || '#2563eb');
    }
  }, [phase, quiz]);

  // ── FB Pixel on approval ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'aprovado_form' || !quiz?.pixel_id) return;
    const pixelId = quiz.pixel_id;
    const evento = quiz.pixel_evento_lead || 'Lead';

    function fireFbq() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbq = (window as any).fbq;
      if (typeof fbq !== 'function') return;
      fbq('init', pixelId);
      fbq('track', evento);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).fbq === 'function') {
      fireFbq();
    } else {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://connect.facebook.net/en_US/fbevents.js';
      s.onload = fireFbq;
      document.head.appendChild(s);
    }
  }, [phase, quiz]);

  // ── Helper to evaluate conditional option matching ───────────────────────────
  const isCondicaoAtendida = useCallback((ans: string, condOpId: string, parentPergId: string) => {
    if (ans === condOpId) return true;
    const parentPerg = todasPerguntas.find(q => q.id === parentPergId);
    if (!parentPerg) return false;
    
    const condOp = parentPerg.opcoes.find(o => o.id === condOpId);
    const selOp = parentPerg.opcoes.find(o => o.id === ans);
    if (!condOp || !selOp) return false;
    
    const cleanText = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cCond = cleanText(condOp.texto);
    const cSel = cleanText(selOp.texto);
    
    // 1. Exact cleaned match
    if (cCond === cSel) return true;
    
    // 2. Same first word (covers Sim/Não variants like "Sim, ...", "Não, ...", "Tenho ...", "Quero ...")
    const firstWord = (t: string) => t.split(/\s+/)[0];
    if (firstWord(cCond) === firstWord(cSel) && firstWord(cCond).length > 2) {
      return true;
    }
    
    // 3. Positive vs Positive synonyms
    const isPositive = (t: string) => 
      t.startsWith('sim') || 
      t.startsWith('quero') || 
      t.startsWith('tenho') || 
      t.startsWith('sou') || 
      t.startsWith('aceito') || 
      t.startsWith('gostaria') ||
      t.startsWith('com certeza') || 
      t.startsWith('claro');
      
    if (isPositive(cCond) && isPositive(cSel)) {
      return true;
    }
    
    // 4. Negative vs Negative synonyms
    const isNegative = (t: string) => 
      t.startsWith('nao') || 
      t.startsWith('nunca') || 
      t.startsWith('recuso') || 
      t.startsWith('nem') || 
      t.startsWith('sem');
      
    if (isNegative(cCond) && isNegative(cSel)) {
      return true;
    }
    
    // 5. Keyword fallbacks (like "filho" match for family steps)
    if (cCond.includes('filho') && cSel.includes('filho') && !cSel.startsWith('nao') && !cCond.startsWith('nao')) {
      return true;
    }
    
    return false;
  }, [todasPerguntas]);

  // ── Visible questions (conditional filtering) ─────────────────────────────────
  const visiblePerguntas = useCallback((): Pergunta[] => {
    return todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const answeredOpcaoId = answers[p.condicao_pergunta_id];
      if (!answeredOpcaoId) return false;
      if (p.condicao_opcao_id) return isCondicaoAtendida(answeredOpcaoId, p.condicao_opcao_id, p.condicao_pergunta_id);
      return true;
    });
  }, [todasPerguntas, answers, isCondicaoAtendida]);

  function calculateScore(ans: Record<string, string>, multiAns: Record<string, string[]>) {
    let totalScore = 0;
    for (const [pergId, oId] of Object.entries(ans)) {
      const perg = todasPerguntas.find(p => p.id === pergId);
      if (!perg) continue;
      if (perg.tipo_resposta === 'multipla') {
        const selectedIds = multiAns[pergId];
        if (!selectedIds || selectedIds.length === 0) continue;
        for (const opId of selectedIds) {
          const op = perg.opcoes.find(o => o.id === opId);
          if (op) totalScore += op.pontos ?? 0;
        }
      } else {
        const op = perg.opcoes.find(o => o.id === oId);
        if (op) totalScore += op.pontos ?? 0;
      }
    }
    return totalScore;
  }

  // ── Advance logic ─────────────────────────────────────────────────────────────
  function doAdvance(pergunta: Pergunta, opcaoIds: string[]) {
    if (opcaoIds.length === 0) return;
    const isMultipla = pergunta.tipo_resposta === 'multipla';

    // Check reprova on any selected option
    const hasReprova = opcaoIds.some(id => pergunta.opcoes.find(o => o.id === id)?.reprova_imediato);

    // For conditional logic, use the first selected option as primary answer
    const primaryAnswer = opcaoIds[0];
    const newAnswers = { ...answers, [pergunta.id]: primaryAnswer };

    // Store multiple selections for scoring
    const newMultipleAnswers = isMultipla
      ? { ...multipleAnswers, [pergunta.id]: opcaoIds }
      : multipleAnswers;

    setAnswers(newAnswers);
    setMultipleAnswers(newMultipleAnswers);
    setSelectedOpcao(null);
    setSelectedOpcoes([]);

    if (isMultipla) {
      const textos = opcaoIds
        .map(id => pergunta.opcoes.find(o => o.id === id)?.texto)
        .filter(Boolean).join(', ');
      registrarEtapa(currentIdx + 1, pergunta.texto, textos);
    }

    if (hasReprova) {
      const etapaReprovacao = currentIdx + 1;
      registrarEtapa(etapaReprovacao, pergunta.texto, 'Reprovada imediata');
      marcarConcluido(undefined, etapaReprovacao);
      setPhase('reprovado');
      return;
    }

    const newVisible = todasPerguntas.filter(p => {
      if (!p.condicao_pergunta_id) return true;
      const ans = newAnswers[p.condicao_pergunta_id];
      if (!ans) return false;
      if (p.condicao_opcao_id) return isCondicaoAtendida(ans, p.condicao_opcao_id, p.condicao_pergunta_id);
      return true;
    });

    const nextIdx = currentIdx + 1;
    
    // Custom redirection logic
    const selectedOpcaoObj = pergunta.opcoes.find(o => o.id === primaryAnswer);
    if (selectedOpcaoObj?.target_pergunta_id) {
      const targetId = selectedOpcaoObj.target_pergunta_id;
      if (targetId === 'approval') {
        const score = calculateScore(newAnswers, newMultipleAnswers);
        setScore(score); setFaixa(score >= (quiz?.corte_verde ?? 35) ? 'verde' : 'amarelo');
        marcarConcluido(undefined, newVisible.length, false);
        setPhase('aprovado_form'); return;
      }
      if (targetId === 'collect') {
        const score = calculateScore(newAnswers, newMultipleAnswers);
        setScore(score); setFaixa(score >= (quiz?.corte_verde ?? 35) ? 'verde' : 'amarelo');
        marcarConcluido(undefined, newVisible.length, false);
        setPhase('coleta'); return;
      }
      
      const targetIdx = newVisible.findIndex(p => p.id === targetId);
      if (targetIdx !== -1) {
        setCurrentIdx(targetIdx);
        setQuestionKey(k => k + 1);
        return;
      }
    }

    if (nextIdx >= newVisible.length) {
      const totalScore = calculateScore(newAnswers, newMultipleAnswers);
      setScore(totalScore);
      if (!quiz) return;
      
      const corteMinimo = quiz.corte_amarelo ?? quiz.corte_verde ?? 25;
      const isApproved = totalScore >= corteMinimo;
      setFaixa(totalScore >= quiz.corte_verde ? 'verde' : 'amarelo');
      
      setPhase('analise');
      registrarEtapa(newVisible.length, 'Análise', 'Iniciou análise');
      
      const duration = (quiz.analise_duracao || 4) * 1000;
      setTimeout(() => {
        if (isApproved) {
          marcarConcluido(undefined, newVisible.length, false);
          setPhase('aprovado_form');
        } else {
          marcarConcluido(undefined, newVisible.length);
          setPhase('reprovado');
        }
      }, duration);
    } else {
      setCurrentIdx(nextIdx);
      setQuestionKey(k => k + 1);
    }
  }

  function handleOpcaoClick(pergunta: Pergunta, opcao: Opcao) {
    const isMultipla = pergunta.tipo_resposta === 'multipla';

    if (isMultipla) {
      // Toggle selection in array
      navigator.vibrate?.(10);
      setSelectedOpcoes(prev =>
        prev.includes(opcao.id) ? prev.filter(id => id !== opcao.id) : [...prev, opcao.id]
      );
      return;
    }

    // Single choice: auto-advance after 350ms
    if (selectedOpcao) return;
    navigator.vibrate?.(10);
    setSelectedOpcao(opcao.id);
    
    // Registrar etapa no tracker
    registrarEtapa(currentIdx + 1, pergunta.texto, opcao.texto);

    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      doAdvance(pergunta, [opcao.id]);
    }, 280);
  }

  function handleContinue() {
    if (!currentPergunta) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    const isMultipla = currentPergunta.tipo_resposta === 'multipla';
    if (isMultipla) {
      if (selectedOpcoes.length === 0) return;
      doAdvance(currentPergunta, selectedOpcoes);
    } else {
      if (!selectedOpcao) return;
      doAdvance(currentPergunta, [selectedOpcao]);
    }
  }

  // ── Finaliza quiz: marca sessão, abre WA, vai para sucesso ───────────────────
  // virouLead=true por padrão porque finalizarQuiz só é chamado após submit do formulário com sucesso
  async function finalizarQuiz(leadId?: string | number, virouLead = true) {
    await marcarConcluido(leadId, undefined, virouLead);
    setSubmitting(false);

    // Campo-specific redirect: botao_acao === 'redirecionar' no último campo da coleta
    const lastCfg = coletaConfig[coletaConfig.length - 1];
    if (lastCfg?.botao_acao === 'redirecionar' && lastCfg?.botao_target) {
      let finalUrl = lastCfg.botao_target
        .replace(/\{\{nome\}\}/g, nome).replace(/\[NOME\]/g, nome)
        .replace(/\{\{whatsapp\}\}/g, whatsapp)
        .replace(/\{\{cidade\}\}/g, cidade).replace(/\[CIDADE\]/g, cidade)
        .replace(/\{\{instagram\}\}/g, instagram);
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
      window.location.href = finalUrl;
      return;
    }

    const isRedirect = (quiz as any).whatsapp_redirecionar_direto === true;
    if (isRedirect) {
      let redirectValue = (quiz as any).redirect_whatsapp || '';
      let targetUrl = redirectValue;
      let novaAba = false;

      if (redirectValue.startsWith('{') && redirectValue.endsWith('}')) {
        try {
          const parsed = JSON.parse(redirectValue);
          targetUrl = parsed.url || '';
          novaAba = !!parsed.nova_aba;
        } catch (e) {
          // Fallback
        }
      }

      if (targetUrl) {
        // Substitute placeholders (support both legacy [NOME]/[CIDADE] and new premium {{variable}} formats)
        let finalUrl = targetUrl
          .replace(/\[NOME\]/g, nome)
          .replace(/\[CIDADE\]/g, cidade)
          .replace(/%5BNOME%5D/gi, encodeURIComponent(nome))
          .replace(/%5BCIDADE%5D/gi, encodeURIComponent(cidade))
          // Double curly braces format: {{nome}}, {{whatsapp}}, {{cidade}}, {{instagram}}
          .replace(/\{\{nome\}\}/g, nome)
          .replace(/\{\{whatsapp\}\}/g, whatsapp)
          .replace(/\{\{cidade\}\}/g, cidade)
          .replace(/\{\{instagram\}\}/g, instagram)
          .replace(/\{\{intagram\}\}/g, instagram) // Typo protection
          // URL-encoded versions
          .replace(/%7B%7Bnome%7D%7D/gi, encodeURIComponent(nome))
          .replace(/%7B%7Bwhatsapp%7D%7D/gi, encodeURIComponent(whatsapp))
          .replace(/%7B%7Bcidade%7D%7D/gi, encodeURIComponent(cidade))
          .replace(/%7B%7Binstagram%7D%7D/gi, encodeURIComponent(instagram))
          .replace(/%7B%7Bintagram%7D%7D/gi, encodeURIComponent(instagram));

        if (!/^https?:\/\//i.test(finalUrl)) {
          finalUrl = 'https://' + finalUrl;
        }

        if (novaAba) {
          window.open(finalUrl, '_blank');
        } else {
          window.location.href = finalUrl;
        }
      }
    }
    setPhase('sucesso');
  }

  // ── Submit lead ───────────────────────────────────────────────────────────────
  async function handleSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz) return;

    const isBlockEditor = !!(quiz as any).use_block_editor;

    // FIX 4: Para block editor, calcular score somando pontos capturados em onOpcaoClick
    let submitScore = score;
    let submitFaixa: string | null = faixa;
    if (isBlockEditor) {
      submitScore = Object.values(blockPoints).reduce((sum, pts) => sum + pts, 0);
      const corteVerde: number = (quiz as any).corte_verde ?? 35;
      const corteAmarelo: number = (quiz as any).corte_amarelo ?? 25;
      submitFaixa = submitScore >= corteVerde ? 'verde' : submitScore >= corteAmarelo ? 'amarelo' : 'verde';
    } else {
      if (!submitFaixa) return;
    }

    const rawWa = whatsapp.replace(/\D/g, '');

    // WhatsApp validation — block-editor quizzes validate per-field inline
    if (!isBlockEditor) {
      if (rawWa.length !== 11) {
        alert('Por favor, informe um WhatsApp válido com DDD (11 dígitos).');
        return;
      }
      if (rawWa[2] !== '9') {
        alert('O número de WhatsApp deve ser um celular (começar com 9).');
        return;
      }
      // Validate required coleta fields (legacy flow only)
      const fvLegacy: Record<string, string> = { nome, whatsapp, cidade, instagram };
      for (const cfg of coletaConfig) {
        if (!cfg.obrigatorio) continue;
        if (cfg.campo === 'whatsapp') continue;
        const val = (fvLegacy[cfg.campo] ?? '').trim();
        if (!val) {
          alert(`Por favor, preencha o campo "${cfg.label}".`);
          return;
        }
      }
    }

    setSubmitting(true);
    console.log('Passou validações, construindo leadData...');

    const stripEmojis = (str: string) => str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();

    // FIX 3: Construir quizRespostas separado por fluxo
    const quizRespostas: Record<string, string> = {};
    if (isBlockEditor) {
      // Respostas dos blocos questão (capturadas no onOpcaoClick)
      Object.entries(blockAnswers).forEach(([pergId, texto]) => {
        const blk = quizBlocks.find((b: any) => b.page_id === pergId || b.id === pergId);
        const pergTexto = blk?.conteudo?.texto || todasPerguntas.find(p => p.id === pergId)?.texto || pergId;
        if (texto) quizRespostas[pergTexto] = texto;
      });
      if (nome) quizRespostas['Nome'] = nome;
      if (cidade) quizRespostas['Cidade'] = cidade;
      if (instagram) quizRespostas['Instagram'] = instagram;
      Object.entries(extraFields).forEach(([campo, val]) => {
        if (val.trim()) quizRespostas[campo] = val.trim();
      });
    } else {
      for (const perg of todasPerguntas) {
        const opcId = answers[perg.id];
        if (!opcId) continue;
        if (perg.tipo_resposta === 'multipla') {
          const selectedIds = multipleAnswers[perg.id] || [opcId as string];
          const textos = selectedIds
            .map(id => perg.opcoes.find(o => o.id === id)?.texto)
            .filter(Boolean).map(t => stripEmojis(t!)).join(', ');
          quizRespostas[perg.texto] = textos;
        } else {
          const op = perg.opcoes.find(o => o.id === opcId as string);
          if (op) quizRespostas[perg.texto] = stripEmojis(op.texto);
        }
      }
      // Campos extras (não-padrão da coleta) vão em quiz_respostas
      const defaultCampos = new Set(['nome', 'whatsapp', 'cidade', 'instagram']);
      Object.entries(extraFields).forEach(([campo, val]) => {
        if (!defaultCampos.has(campo) && val.trim()) {
          const cfg = coletaConfig.find(c => c.campo === campo);
          quizRespostas[cfg?.label || campo] = val.trim();
        }
      });
    }

    const leadData = {
      org_id: quiz.org_id,
      nome: nome.trim(),
      whatsapp: rawWa,
      cidade: cidade.trim(),
      instagram: instagram.trim(),
      status: 1,
      quiz_respostas: quizRespostas,
      score: submitScore,
      faixa: submitFaixa,
      created_at: new Date().toISOString(),
      ...getUtmsPayload()
    };

    console.log('LeadData final:', leadData);
    console.log('Inserindo no banco...');

    try {
      const { data: novoLead, error } = await db.from('leads').insert(leadData).select('id').single();
      console.log('Resultado insert:', { novoLead, error });

      if (error) {
        console.error('ERRO SUPABASE:', error);
        if (error.code === '23505') {
          console.log('Lead já existe, continuando...');
          await finalizarQuiz(undefined);
          return;
        }
        setSubmitting(false);
        alert('Erro ao salvar. Tente novamente.');
        return;
      }

      console.log('Lead salvo com sucesso.', novoLead?.id);
      await finalizarQuiz(novoLead?.id);
    } catch (err) {
      console.error('ERRO CATCH:', err);
      setSubmitting(false);
      alert('Erro ao salvar. Tente novamente.');
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────────
  const visible = visiblePerguntas();
  const totalVisible = visible.length;
  const currentPergunta = visible[currentIdx] ?? null;
  const currentBloco = blocos.find(b => b.id === currentPergunta?.bloco_id) ?? null;
  const rawColeta = (quiz?.coleta_campos as string[] | null);
  const coleta = rawColeta?.length ? rawColeta : ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz?.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coleta.includes(d.campo));
  const fieldValues: Record<string, string> = { nome, whatsapp, cidade, instagram };
  const canSubmit = coletaConfig
    .filter(c => c.obrigatorio)
    .every(c => {
      const val = fieldValues[c.campo] ?? '';
      if (c.campo === 'whatsapp') return val.replace(/\D/g, '').length === 11;
      return val.trim().length > 0;
    });
  const primary = quiz?.cor_primaria || '#2563eb';
  const whatsappEnabled = (quiz as any)?.whatsapp_redirecionar_direto === true;

  const utms = useRef<Record<string, string>>(getUtmsPayload());

  useEffect(() => {
    initializeUtms();
  }, []);

  useEffect(() => {
    if (!quiz) return;

    // ── Inject Scripts ──────────────────────────────────────────────────────
    const injectScript = (content: string, position: 'head' | 'body' | 'footer') => {
      if (!content) return;
      const el = document.createElement('div');
      el.innerHTML = content;
      const scripts = el.querySelectorAll('script');
      scripts.forEach(s => {
        const newS = document.createElement('script');
        if (s.src) newS.src = s.src;
        else newS.textContent = s.textContent;
        if (position === 'head') document.head.appendChild(newS);
        else if (position === 'body') document.body.prepend(newS);
        else document.body.appendChild(newS);
      });
    };

    // GTM
    if ((quiz as any).gtm_id) {
      const gtmId = (quiz as any).gtm_id;
      const script = document.createElement('script');
      script.textContent = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`;
      document.head.appendChild(script);
    }

    // Facebook Pixel
    if (quiz.pixel_id) {
      const script = document.createElement('script');
      script.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${quiz.pixel_id}');fbq('track', 'PageView');`;
      document.head.appendChild(script);
    }

    // Custom Scripts
    if ((quiz as any).script_head) injectScript((quiz as any).script_head, 'head');
    if ((quiz as any).script_body) injectScript((quiz as any).script_body, 'body');
    if ((quiz as any).script_footer) injectScript((quiz as any).script_footer, 'footer');

  }, [quiz?.id]);

  useEffect(() => {
    // Fire Lead Event on Approval
    if (phase === 'aprovado_form' && quiz?.pixel_id) {
      // 1. Standard Lead event
      if ((quiz as any).pixel_fire_lead_event !== false) {
        if ((window as any).fbq) (window as any).fbq('track', 'Lead');
      }

      // 2. Custom Script / Event from Approval Page
      const custom = (quiz as any).pixel_custom_event_name;
      if (custom) {
        // If it looks like a script or complex JS, inject it
        if (custom.includes('<script') || custom.includes('fbq(') || custom.includes('gtag(')) {
          const s = document.createElement('script');
          if (custom.includes('<script')) {
            const temp = document.createElement('div');
            temp.innerHTML = custom;
            const found = temp.querySelector('script');
            s.textContent = found ? found.textContent : custom;
          } else {
            s.textContent = custom;
          }
          document.body.appendChild(s);
        } else {
          // Otherwise treat as a simple event name
          if ((window as any).fbq) (window as any).fbq('track', custom);
        }
      }
    }
  }, [phase, quiz?.id]);

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: `2.5px solid #e5e7eb`, borderTopColor: primary, animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Not found / network error ─────────────────────────────────────────────────
  if (phase === 'not_found') {
    if (networkError) {
      return (
        <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: 'center' }}>
          <div style={{ fontSize: '40px' }}>⚡</div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Falha ao carregar</p>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verifique sua conexão e tente novamente.</p>
          <button
            onClick={() => { setNetworkError(false); setPhase('loading'); setRetryCount(c => c + 1); }}
            style={{ marginTop: '8px', padding: '12px 28px', borderRadius: '10px', border: 'none', background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', padding: '24px', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div style={{ fontSize: '40px' }}>🔍</div>
        <p style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Quiz não encontrado</p>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>Verifique o link e tente novamente.</p>
      </div>
    );
  }

  // ── Render via QuizBlockRenderer (novo sistema) ──────────────────────────────
  if ((quiz as any)?.use_block_editor) {
    return (
      <QuizBlockRenderer
        quiz={quiz!}
        blocks={quizBlocks}
        pageId={currentBlockPageId}
        phase={currentBlockPageId === 'cover' ? 'cover' : 'special'}
        onStart={() => {
          iniciarSessao();
          const firstPerg = todasPerguntas.find(p =>
            !['analise', 'aprovacao', 'coleta', 'reprovacao'].includes(p.tipo_resposta || '')
          );
          if (firstPerg) {
            setCurrentBlockPageId(firstPerg.id);
            setPhase('quiz');
          }
        }}
        onNext={() => {
          const allPageIds = ['cover', ...todasPerguntas.map(p => p.id)];
          const idx = allPageIds.indexOf(currentBlockPageId);
          const nextId = allPageIds[idx + 1];
          if (nextId) setCurrentBlockPageId(nextId);
        }}
        onNavigateTo={id => setCurrentBlockPageId(id)}
        onSubmit={handleSubmitLead}
        onFieldChange={(campo, val) => {
          if (campo === 'nome') setNome(val);
          else if (campo === 'whatsapp') setWhatsapp(val);
          else if (campo === 'cidade') setCidade(val);
          else if (campo === 'instagram') setInstagram(val);
          else setExtraFields(prev => ({ ...prev, [campo]: val }));
        }}
        fieldValues={{ nome, whatsapp, cidade, instagram, ...extraFields }}
        submitting={submitting}
        confettiEnabled={false}
        flatPerguntas={todasPerguntas}
        opcoesPorPergunta={Object.fromEntries(todasPerguntas.map(p => [p.id, (p as any).opcoes || []]))}
        selectedOpcaoId={blockSelectedOpcaoId}
        onOpcaoClick={(pergId, opcaoId, _reprova) => {
          setBlockSelectedOpcaoId(opcaoId);

          // Capturar texto e pontos — pode estar no bloco (questao) ou no banco (pergunta)
          const block = quizBlocks.find((b: any) => b.page_id === pergId || b.id === pergId);
          const opcaoNoBloco = block?.conteudo?.opcoes?.find((o: any) => o.id === opcaoId);
          const perg = todasPerguntas.find(p => p.id === pergId);
          const opcaoNoBanco = perg?.opcoes?.find((o: any) => o.id === opcaoId);
          const opcaoTexto = opcaoNoBloco?.texto || opcaoNoBanco?.texto || '';
          const opcaoPontos = opcaoNoBloco?.pontos ?? opcaoNoBanco?.pontos ?? 0;

          setBlockAnswers(prev => ({ ...prev, [pergId]: opcaoTexto }));
          setBlockPoints(prev => ({ ...prev, [pergId]: opcaoPontos }));

          const isMultipla = perg?.tipo_resposta === 'multipla' || block?.conteudo?.tipo_resposta === 'multipla';
          if (!isMultipla) {
            setTimeout(() => {
              setBlockSelectedOpcaoId(null);
              const targetPageId = opcaoNoBloco?.target_page_id || (opcaoNoBanco as any)?.target_page_id || null;
              const reprova = opcaoNoBloco?.reprova_imediato || (opcaoNoBanco as any)?.reprova_imediato || false;
              if (reprova) {
                const reprovaPerg = todasPerguntas.find(p => p.tipo_resposta === 'reprovacao');
                if (reprovaPerg) { setCurrentBlockPageId(reprovaPerg.id); return; }
              }
              if (targetPageId) {
                setCurrentBlockPageId(targetPageId);
                return;
              }
              const allPageIds = ['cover', ...todasPerguntas.map(p => p.id)];
              const idx = allPageIds.indexOf(currentBlockPageId);
              const nextId = allPageIds[idx + 1];
              if (nextId) setCurrentBlockPageId(nextId);
            }, 350);
          }
        }}
        campoStep={blockCampoStep}
        onCampoNext={() => {
          const campoBlocks = quizBlocks.filter(b => b.page_id === currentBlockPageId && b.tipo === 'campo_input');
          const isLast = blockCampoStep >= campoBlocks.length - 1;
          if (isLast) {
            const allPageIds = ['cover', ...todasPerguntas.map(p => p.id)];
            const idx = allPageIds.indexOf(currentBlockPageId);
            const nextId = allPageIds[idx + 1];
            if (nextId) setCurrentBlockPageId(nextId);
          } else {
            setBlockCampoStep(s => s + 1);
          }
        }}
      />
    );
  }

  // ── Render via QuizRenderer (sistema legado) ──────────────────────────────────
  return (
    <QuizRenderer
      quiz={quiz!}
      blocos={blocos}
      phase={phase}
      currentPergunta={currentPergunta}
      currentBloco={currentBloco}
      currentIdx={currentIdx}
      totalVisible={totalVisible}
      selectedOpcao={selectedOpcao}
      selectedOpcoes={selectedOpcoes}
      questionKey={questionKey}
      coleta={coleta}
      nome={nome}
      whatsapp={whatsapp}
      cidade={cidade}
      instagram={instagram}
      submitting={submitting}
      canSubmit={canSubmit}
      onStart={() => {
        iniciarSessao();
        setPhase('quiz');
        registrarEtapa(1);
      }}
      onOpcaoClick={handleOpcaoClick}
      onContinue={handleContinue}
      onGoToColeta={() => {
        setPhase('coleta');
        registrarEtapa(totalVisible, 'Coleta Manual', 'Acessou coleta manual');
      }}
      onNomeChange={setNome}
      onWhatsappChange={setWhatsapp}
      onCidadeChange={setCidade}
      onInstagramChange={setInstagram}
      onSubmit={handleSubmitLead}
      whatsappEnabled={whatsappEnabled}
      coletaStep={coletaStep}
      onColetaNext={handleColetaNext}
      extraFieldValues={extraFields}
      onExtraFieldChange={(campo, val) => setExtraFields(prev => ({ ...prev, [campo]: val }))}
    />
  );
}
