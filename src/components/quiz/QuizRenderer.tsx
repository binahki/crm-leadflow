import React from 'react';
import { Check, X, Instagram, MessageCircle } from 'lucide-react';

// ── Shared types ─────────────────────────────────────────────────────────────
export interface ColetaCampo {
  campo: string; label: string; placeholder: string;
  obrigatorio: boolean; ordem: number;
  subtitulo?: string | null;
  tipo?: 'texto' | 'telefone' | 'email' | 'numero' | 'cpf' | null;
  show_whatsapp_warning?: boolean;
  whatsapp_warning_text?: string | null;
  botao_texto?: string | null;
  botao_acao?: 'proxima_etapa' | 'redirecionar' | 'pagina_sucesso' | 'whatsapp' | null;
  botao_target?: string | null;
}

export const DEFAULT_COLETA_CONFIG: ColetaCampo[] = [
  { campo: 'nome',      label: 'Qual o seu nome completo?',    placeholder: 'Digite seu nome',      tipo: 'texto',    obrigatorio: true,  ordem: 1, botao_texto: 'Continuar →',          botao_acao: 'proxima_etapa' },
  { campo: 'cidade',    label: 'Qual a sua cidade?',           placeholder: 'Ex: São Paulo - SP',   tipo: 'texto',    obrigatorio: false, ordem: 2, botao_texto: 'Continuar →',          botao_acao: 'proxima_etapa' },
  { campo: 'instagram', label: 'Qual o seu Instagram?',        placeholder: '@seuinstagram',        tipo: 'texto',    obrigatorio: false, ordem: 3, botao_texto: 'Continuar →',          botao_acao: 'proxima_etapa' },
  { campo: 'whatsapp',  label: 'Qual o seu WhatsApp com DDD?', placeholder: '(XX) XXXXX-XXXX',      tipo: 'telefone', obrigatorio: true,  ordem: 4, botao_texto: 'Concluir meu cadastro', botao_acao: 'redirecionar', show_whatsapp_warning: true, whatsapp_warning_text: '📲 Ao clicar, você será direcionada para o WhatsApp. Envie a mensagem para garantir sua vaga — a mensagem já vem preenchida ✓' },
];

export interface QuizConfig {
  id: string; org_id: string; titulo: string; slug: string;
  cor_primaria: string; redirect_whatsapp: string;
  corte_verde: number; corte_amarelo: number;
  mensagem_aprovado: string; mensagem_reprovado: string;
  ativo: boolean; publicado?: boolean; logo_url: string | null;
  capa_titulo?: string | null; capa_subtitulo?: string | null;
  capa_imagem_url?: string | null; capa_imagem_altura?: number | null;
  capa_beneficios?: string[] | null;
  capa_botao_texto?: string | null; coleta_campos?: string[] | null;
  coleta_config?: ColetaCampo[] | null;
  pixel_id?: string | null; pixel_evento_lead?: string | null;
  cor_botao?: string | null; cor_fundo?: string | null;
  cor_titulo?: string | null; cor_subtitulo?: string | null;
  capa_imagem_height?: number | null; logo_altura?: number | null;
  emoji_aprovado?: string | null; emoji_reprovado?: string | null;
  mensagem_aprovado_subtitulo?: string | null;
  mensagem_reprovado_subtitulo?: string | null;
  reprovado_conteudo?: string[] | null;
  capa_ordem?: any | null;
  reprovado_botao_url?: string | null;
  analise_duracao?: number | null;
  analise_titulo?: string | null;
  analise_subtitulo?: string | null;
  analise_texto_carregando?: string | null;
  analise_depoimentos?: any[] | null;
  whatsapp_mensagem_personalizada?: string | null;
  whatsapp_redirecionar_direto?: boolean | null;
  published_at?: string | null;
  updated_at?: string | null;
  pages_enabled?: string[] | null;
}
export interface Bloco { id: string; titulo: string; ordem: number; emoji?: string | null; }
export interface Opcao {
  id: string; pergunta_id: string; texto: string;
  pontos: number; reprova_imediato: boolean; ordem: number;
  emoji?: string | null;
  target_pergunta_id?: string | null;
}
export interface Pergunta {
  id: string; bloco_id: string; texto: string; ordem: number;
  subtexto?: string | null; tipo_resposta?: string | null;
  condicao_pergunta_id: string | null; condicao_opcao_id: string | null;
  opcoes: Opcao[];
}
export type Phase = 'loading' | 'capa' | 'quiz' | 'analise' | 'aprovado_form' | 'coleta' | 'reprovado' | 'sucesso' | 'not_found';

export interface QuizRendererProps {
  quiz: QuizConfig;
  blocos: Bloco[];
  phase: Phase;
  currentPergunta: Pergunta | null;
  currentBloco?: Bloco | null;
  currentIdx: number;
  totalVisible: number;
  selectedOpcao?: string | null;      // single choice
  selectedOpcoes?: string[];          // multiple choice
  questionKey?: number;
  coleta?: string[];
  nome?: string; whatsapp?: string; cidade?: string; instagram?: string;
  submitting?: boolean; canSubmit?: boolean;
  onStart?: () => void;
  onOpcaoClick?: (perg: Pergunta, opcao: Opcao) => void;
  onContinue?: () => void;
  onNomeChange?: (v: string) => void;
  onWhatsappChange?: (v: string) => void;
  onCidadeChange?: (v: string) => void;
  onInstagramChange?: (v: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onGoToColeta?: () => void;
  isPreview?: boolean;
  whatsappEnabled?: boolean;
  coletaStep?: number;
  onColetaNext?: () => void;
  extraFieldValues?: Record<string, string>;
  onExtraFieldChange?: (campo: string, value: string) => void;
  isBuilderPreview?: boolean;
  selectedColetaElement?: 'texto' | 'campo' | 'botao' | 'aviso' | null;
  onSelectColetaElement?: (element: 'texto' | 'campo' | 'botao' | 'aviso' | null) => void;
  selectedElement?: string | null;
  onSelectElement?: (element: string | null) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function hexRgba(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function maskCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function maskWhatsapp(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

export function defaultEmojiForBloco(titulo: string): string {
  const t = titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, string> = {
    aquecimento: '🔥', perfil: '👤', pessoal: '👤',
    comercial: '💼', financeira: '🔒', financeiro: '🔒',
  };
  for (const [key, emoji] of Object.entries(map)) if (t.includes(key)) return emoji;
  return '📝';
}

export const DEFAULT_DEPOIMENTOS = [
  { nome: 'Ana Paula Silva',   handle: '@ana.silva',      texto: 'Não acreditei quando vi os resultados. Em poucos meses já estava faturando muito mais do que esperava!' },
  { nome: 'Carla Mendes',      handle: '@carla.mendes',   texto: 'Comecei do zero, sem experiência nenhuma. Hoje tenho minha própria renda e trabalho no meu horário.' },
  { nome: 'Fernanda Costa',    handle: '@fernanda.costa', texto: 'A melhor decisão que tomei foi dar esse primeiro passo. Mudou completamente minha vida financeira.' },
];

function journeyProgress(currentStep: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  return Math.min(Math.round((currentStep / totalSteps) * 100), 100);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function QuizRenderer({
  quiz, phase, currentPergunta, currentBloco,
  currentIdx, totalVisible, selectedOpcao = null,
  selectedOpcoes = [], questionKey = 0,
  coleta, nome = '', whatsapp = '', cidade = '', instagram = '',
  submitting = false, canSubmit = false,
  onStart, onOpcaoClick, onContinue,
  onNomeChange, onWhatsappChange, onCidadeChange, onInstagramChange, onSubmit,
  onGoToColeta,
  isPreview = false,
  whatsappEnabled = false,
  coletaStep, onColetaNext,
  extraFieldValues, onExtraFieldChange,
  isBuilderPreview = false,
  selectedColetaElement = null,
  onSelectColetaElement,
  selectedElement = null,
  onSelectElement,
}: QuizRendererProps) {
  const [cities, setCities] = React.useState<string[]>([]);
  const [citySearch, setCitySearch] = React.useState('');
  const [showCitySugg, setShowCitySugg] = React.useState(false);
  const [analiseProgress, setAnaliseProgress] = React.useState(0);
  const [internalColetaStep, setInternalColetaStep] = React.useState(0);
  const [coletaFieldError, setColetaFieldError] = React.useState<string | null>(null);
  const [hoveredColetaElement, setHoveredColetaElement] = React.useState<'texto' | 'campo' | 'botao' | 'aviso' | null>(null);
  const [internalHoveredEl, setInternalHoveredEl] = React.useState<string | null>(null);
  const [maxProgressReached, setMaxProgressReached] = React.useState(0);

  const effectiveColetaStep = coletaStep !== undefined ? coletaStep : internalColetaStep;

  React.useEffect(() => {
    if (phase !== 'coleta') {
      setInternalColetaStep(0);
      setColetaFieldError(null);
    }
  }, [phase]);

  React.useEffect(() => {
    setColetaFieldError(null);
  }, [coletaStep]);

  React.useEffect(() => {
    if (phase === 'analise') {
      const dur = (quiz.analise_duracao || 4) * 1000;
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        const p = Math.min(Math.round((elapsed / dur) * 100), 100);
        setAnaliseProgress(p);
        if (p >= 100) clearInterval(interval);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [phase, quiz.analise_duracao]);

  const rawColetaCampos = coleta || (quiz.coleta_campos as string[] | null);
  const coletaCampos = rawColetaCampos?.length ? rawColetaCampos : ['nome', 'whatsapp', 'cidade', 'instagram'];
  const coletaConfig: ColetaCampo[] = quiz.coleta_config?.length
    ? [...quiz.coleta_config].sort((a, b) => a.ordem - b.ordem)
    : DEFAULT_COLETA_CONFIG.filter(d => coletaCampos.includes(d.campo));
  const isMultipla = currentPergunta?.tipo_resposta === 'multipla';
  const hasSelection = isMultipla ? selectedOpcoes.length > 0 : !!selectedOpcao;
  const imgAltura = quiz.capa_imagem_height || 200;

  const totalJourneySteps = 3 + totalVisible + coletaConfig.length;

  React.useEffect(() => {
    if (phase === 'capa') {
      setMaxProgressReached(0);
      return;
    }

    let currentStep: number;
    switch (phase) {
      case 'quiz':
        currentStep = 1 + currentIdx;
        break;
      case 'analise':
        currentStep = 1 + totalVisible;
        break;
      case 'aprovado_form':
        currentStep = 2 + totalVisible;
        break;
      case 'coleta':
        currentStep = 3 + totalVisible + effectiveColetaStep;
        break;
      default:
        return;
    }

    const target = journeyProgress(currentStep, totalJourneySteps);
    setMaxProgressReached(prev => Math.max(prev, target));
  }, [phase, currentIdx, totalVisible, effectiveColetaStep, totalJourneySteps]);

  React.useEffect(() => {
    if (phase !== 'aprovado_form' || isPreview) return;
    const container = document.createElement('div');
    container.id = 'quiz-confetti';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;';
    const colors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      const color = colors[i % colors.length];
      const size = 5 + Math.random() * 9;
      const left = Math.random() * 100;
      const delay = Math.random() * 1.2;
      const dur = 2.2 + Math.random() * 1.5;
      const isRect = Math.random() > 0.5;
      p.style.cssText = `position:absolute;top:-20px;left:${left}%;width:${size}px;height:${isRect ? size * 2.5 : size}px;background:${color};border-radius:${isRect ? '2px' : '50%'};animation:quizConfettiFall ${dur}s ease-in ${delay}s forwards;`;
      container.appendChild(p);
    }
    const styleEl = document.createElement('style');
    styleEl.id = 'quiz-confetti-style';
    styleEl.textContent = `@keyframes quizConfettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}85%{opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}`;
    document.head.appendChild(styleEl);
    document.body.appendChild(container);
    const t = setTimeout(() => { document.getElementById('quiz-confetti')?.remove(); document.getElementById('quiz-confetti-style')?.remove(); }, 5000);
    return () => { clearTimeout(t); document.getElementById('quiz-confetti')?.remove(); document.getElementById('quiz-confetti-style')?.remove(); };
  }, [phase, isPreview]);


  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;

  const redirectVal = (quiz as any).redirect_whatsapp || '';
  let redirectUrl = '';
  if (redirectVal.startsWith('{') && redirectVal.endsWith('}')) {
    try {
      redirectUrl = JSON.parse(redirectVal).url || '';
    } catch (e) {}
  } else {
    redirectUrl = redirectVal;
  }
  const isWhatsAppUrl = redirectUrl.toLowerCase().includes('wa.me') || redirectUrl.toLowerCase().includes('whatsapp');
  const isGreen = whatsappEnabled && isWhatsAppUrl;
  const buttonText = (quiz as any).whatsapp_mensagem_personalizada || (whatsappEnabled ? 'Enviar e falar no WhatsApp' : 'Enviar meus dados →');

  const continueBtnPos: React.CSSProperties = isPreview
    ? {}
    : { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50 };

  const wrapElement = (
    elKey: string,
    label: string,
    children: React.ReactNode,
    reactKey?: string,
    extraStyle?: React.CSSProperties
  ): React.ReactNode => {
    if (!isBuilderPreview) return children;
    const isActive = selectedElement === elKey || internalHoveredEl === elKey;
    return (
      <div
        key={reactKey}
        style={{
          position: 'relative',
          borderRadius: '8px',
          outline: isActive ? '2px solid #2563eb' : '2px solid transparent',
          outlineOffset: '4px',
          cursor: 'pointer',
          ...extraStyle,
        }}
        onMouseEnter={() => setInternalHoveredEl(elKey)}
        onMouseLeave={() => setInternalHoveredEl(null)}
        onClick={e => { e.stopPropagation(); onSelectElement?.(elKey); }}
      >
        {isActive && (
          <div style={{
            position: 'absolute', top: '-18px', left: '0',
            background: '#2563eb', color: '#fff',
            fontSize: '10px', fontWeight: 700,
            padding: '2px 6px', borderRadius: '4px', zIndex: 10,
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            {label}
          </div>
        )}
        {children}
      </div>
    );
  };

  return (
    <div style={{
      minHeight: isPreview ? '100%' : '100vh',
      width: '100%',
      background: quiz.cor_fundo || '#ffffff',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');
        @keyframes appleIn {
          0% { opacity: 0; transform: scale(0.985) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .quiz-option {
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          transform: perspective(1px) translateZ(0);
        }
        .quiz-option:active {
          transform: perspective(1px) scale(0.98) translateZ(0) !important;
        }
        .quiz-option span {
          transform: translateZ(0);
        }
        *{box-sizing:border-box;}
        input,textarea,button,select{font-family:inherit;}
      `}</style>

      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        width: '100%',
        background: quiz.cor_fundo || '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        paddingTop: isPreview ? '40px' : 'env(safe-area-inset-top, 12px)',
      }}>
        {quiz.logo_url && (
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '8px 24px 6px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src={quiz.logo_url} alt={quiz.titulo}
              style={{ maxHeight: `${quiz.logo_altura || 32}px`, maxWidth: '160px', objectFit: 'contain' }} />
          </div>
        )}
        {phase !== 'reprovado' && phase !== 'sucesso' && (
          <div style={{ padding: '0 24px 10px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', background: primary,
                width: `${maxProgressReached}%`,
                borderRadius: '999px',
                transition: 'width 800ms cubic-bezier(0.65, 0, 0.35, 1)',
              }} />
            </div>
          </div>
        )}
      </div>

      {phase === 'capa' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '32px 24px 80px', animation: 'fadeIn 0.35s ease' }}>
          {(() => {
            const ordem = (quiz.capa_ordem as string[]) || ['titulo', 'subtitulo', 'imagem', 'beneficios', 'botao'];
            return ordem.map(key => {
              if (key === 'imagem' && quiz.capa_imagem_url) return wrapElement('capa_imagem', 'IMAGEM',
                <img key="imagem" src={quiz.capa_imagem_url} alt=""
                  style={{ width: '100%', borderRadius: '16px', marginBottom: '24px', objectFit: 'cover', maxHeight: `${imgAltura}px` }} />,
                'imagem'
              );
              if (key === 'titulo') return wrapElement('capa_titulo', 'TÍTULO',
                <h1 key="titulo" style={{ fontSize: '32px', fontWeight: 800, color: quiz.cor_titulo || '#111111', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '0 0 10px', textAlign: 'center' }}>
                  {quiz.capa_titulo || quiz.titulo}
                </h1>,
                'titulo'
              );
              if (key === 'subtitulo' && quiz.capa_subtitulo) return wrapElement('capa_subtitulo', 'SUBTÍTULO',
                <p key="subtitulo" style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.6, textAlign: 'center' }}>
                  {quiz.capa_subtitulo}
                </p>,
                'subtitulo'
              );
              if (key === 'beneficios' && (quiz.capa_beneficios?.length ?? 0) > 0) return wrapElement('capa_beneficios', 'BENEFÍCIOS',
                <div key="beneficios" style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {quiz.capa_beneficios!.map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                        <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
                      </div>
                      <span style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', lineHeight: 1.5 }}>{b}</span>
                    </div>
                  ))}
                </div>,
                'beneficios'
              );
              if (key === 'botao') return wrapElement('capa_botao', 'BOTÃO',
                <button
                  key="botao"
                  onClick={isBuilderPreview ? undefined : onStart}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0) scale(0.98)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  style={{
                    width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
                    background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
                    cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    transition: 'all 0.15s ease-out',
                  }}
                >
                  {quiz.capa_botao_texto || 'Clique para iniciar →'}
                </button>,
                'botao'
              );
              return null;
            });
          })()}
        </div>
      )}

      {phase === 'quiz' && currentPergunta && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '28px 24px 140px', userSelect: 'none' }}>
            <div
              key={questionKey}
              style={{ 
                width: '100%', 
                maxWidth: '480px', 
                animation: 'appleIn 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards', 
                willChange: 'transform, opacity' 
              }}
            >
            {currentBloco && (
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 14px 5px 10px', borderRadius: '999px', background: hexRgba(primary, 0.08), border: `1px solid ${hexRgba(primary, 0.18)}` }}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>{currentBloco.emoji}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: primary, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{currentBloco.titulo}</span>
                </span>
              </div>
            )}
            {wrapElement('perg_texto', 'TEXTO',
              <h2 style={{ fontSize: '24px', fontWeight: 700, color: quiz.cor_titulo || '#111111', lineHeight: 1.3, margin: '0 0 8px', textAlign: 'center' }}>{currentPergunta.texto}</h2>
            )}
            {currentPergunta.tipo_resposta === 'informativa' ? (() => {
              const rawSub = currentPergunta.subtexto || '';
              const isBtnConfig = rawSub.startsWith('btn:');
              const btnTexto = isBtnConfig ? rawSub.replace('btn:', '').split('|')[0] : 'Continuar →';
              const btnAcao  = isBtnConfig ? (rawSub.split('|')[1] || 'next') : 'next';
              const handleBtnClick = () => {
                if (btnAcao === 'collect') { onGoToColeta?.(); }
                else { onContinue?.(); }
              };
              return wrapElement('inf_botao', 'BOTÃO', (
                <>
                  <div style={{ height: '20px' }} />
                  <button
                    onClick={isBuilderPreview ? undefined : handleBtnClick}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
                    onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0) scale(0.98)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    style={{
                      width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
                      background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
                      cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', marginTop: '8px',
                      transition: 'all 0.15s ease-out',
                    }}
                  >
                    {btnTexto || 'Continuar →'}
                  </button>
                </>
              ));
            })() : (
              <>
                {currentPergunta.subtexto ? <p style={{ fontSize: '14px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5, textAlign: 'center' }}>{currentPergunta.subtexto}</p> : <div style={{ height: '20px' }} />}
                {wrapElement('perg_opcoes', 'RESPOSTAS',
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentPergunta.opcoes.map(opcao => {
                      const isSelected = isMultipla ? selectedOpcoes.includes(opcao.id) : selectedOpcao === opcao.id;
                      const isDisabled = !isMultipla && !!selectedOpcao && !isSelected;
                      return (
                        <button key={opcao.id}
                          className="quiz-option"
                          onClick={() => { if (isBuilderPreview) return; if (!isDisabled) onOpcaoClick?.(currentPergunta, opcao); }}
                          style={{
                            width: '100%', padding: '16px 20px', borderRadius: '16px',
                            border: `${isSelected ? '2.5px' : '1.5px'} solid ${isSelected ? primary : '#e2e8f0'}`,
                            background: isSelected ? hexRgba(primary, 0.08) : '#fff',
                            cursor: isDisabled ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '16px',
                            transition: 'all 400ms cubic-bezier(0.2, 0.8, 0.2, 1)', textAlign: 'left',
                            opacity: isDisabled ? 0.5 : 1,
                            transform: isSelected ? 'scale(1.01) translateZ(0)' : 'scale(1) translateZ(0)',
                            boxShadow: isSelected ? `0 12px 32px ${hexRgba(primary, 0.12)}` : 'none',
                          }}
                          onMouseEnter={e => {
                            if (!isDisabled && !isSelected) {
                              const btn = e.currentTarget as HTMLElement;
                              btn.style.borderColor = primary;
                              btn.style.background = hexRgba(primary, 0.04);
                              btn.style.transform = 'perspective(1px) translateY(-2px) scale(1.01) translateZ(0)';
                              btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) {
                              const btn = e.currentTarget as HTMLElement;
                              btn.style.borderColor = '#e2e8f0';
                              btn.style.background = '#fff';
                              btn.style.transform = 'translateY(0) scale(1)';
                              btn.style.boxShadow = 'none';
                            }
                          }}
                        >
                          {isMultipla ? (
                            <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, border: `2px solid ${isSelected ? primary : '#d1d5db'}`, background: isSelected ? primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isSelected && <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />}
                            </div>
                          ) : (
                            isSelected && (
                              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />
                              </div>
                            )
                          )}
                          {opcao.emoji && <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>{opcao.emoji}</span>}
                          <span style={{ flex: 1, fontSize: '15px', color: quiz.cor_titulo || '#111', fontWeight: 500, lineHeight: 1.4 }}>{opcao.texto}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {phase === 'quiz' && isMultipla && hasSelection && (
        <div style={{ ...continueBtnPos, display: 'flex', justifyContent: 'center', padding: '12px 24px 28px', background: 'linear-gradient(to top, #fff 60%, transparent)', animation: 'slideUp 200ms ease-out' }}>
          <button
            onClick={onContinue}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
            onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0) scale(0.98)'; }}
            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
            style={{
              width: '100%', maxWidth: '432px', padding: '16px', borderRadius: '12px', border: 'none',
              background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              transition: 'all 0.15s ease-out',
            }}
          >
            Continuar ({selectedOpcoes.length} selecionada{selectedOpcoes.length !== 1 ? 's' : ''}) →
          </button>
        </div>
      )}

      {phase === 'analise' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '32px 24px 100px' }}>
          {wrapElement('analise_texto', 'TEXTOS',
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '42px', marginBottom: '12px' }}>⌛</div>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: quiz.cor_titulo || '#111111', lineHeight: 1.25, margin: '0 0 10px' }}>
                {quiz.analise_titulo || 'Estamos analisando seu perfil...'}
              </h2>
              <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', lineHeight: 1.6, margin: '0' }}>
                {quiz.analise_subtitulo || 'Aguarde enquanto verificamos se você tem o que é preciso para ser uma revendedora de sucesso!'}
              </p>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #e5e7eb', borderBottom: '1px dashed #e5e7eb', padding: '20px 0', margin: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>Carregando...</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#111' }}>{analiseProgress}%</span>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ height: '100%', background: '#111', width: `${analiseProgress}%`, transition: 'width 100ms linear' }} />
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', margin: 0 }}>
              {analiseProgress < 30 ? 'Verificando seus dados...' : 
               analiseProgress < 60 ? 'Analisando respostas...' : 
               analiseProgress < 90 ? 'Cruzando informações...' : 'Finalizando análise...'}
            </p>
          </div>

          {wrapElement('analise_depoimentos', 'DEPOIMENTOS',
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', userSelect: 'none' }}>
              {(quiz.analise_depoimentos && quiz.analise_depoimentos.length > 0 ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS).map((d, i) => (
                <div key={i} style={{ padding: '16px', borderRadius: '16px', border: '1.5px solid #f1f5f9', background: '#fff', animation: 'none', transition: 'none' }}>
                  <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                    {[...Array(5)].map((_, j) => (
                      <span key={j} style={{ fontSize: '14px', color: '#fbbf24' }}>⭐</span>
                    ))}
                  </div>
                  <h4 style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 700, color: '#111' }}>{d.nome}</h4>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ca3af' }}>{d.handle}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>{d.texto}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'aprovado_form' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '40px 24px 80px', animation: 'fadeIn 0.4s ease' }}>
          {wrapElement('aprovado_texto', 'TEXTOS',
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '64px', lineHeight: 1, marginBottom: '18px' }}>{quiz.emoji_aprovado || '🎉'}</div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 10px', textAlign: 'center' }}>
                {quiz.mensagem_aprovado || 'Parabéns! Você foi aprovada.'}
              </h2>
              {quiz.mensagem_aprovado_subtitulo && (
                <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
                  {quiz.mensagem_aprovado_subtitulo}
                </p>
              )}
            </div>
          )}
          {wrapElement('aprovado_botao', 'BOTÃO',
            <button
              onClick={isBuilderPreview ? undefined : onGoToColeta}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translateY(0) scale(0.98)'; }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              style={{
                width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
                background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease-out',
              }}
            >
              Preencher meus dados →
            </button>
          )}
        </div>
      )}

      {phase === 'coleta' && (() => {
        const effectiveStep = coletaStep !== undefined ? coletaStep : internalColetaStep;
        const capped = Math.min(effectiveStep, coletaConfig.length - 1);
        const cfg = coletaConfig[capped];
        if (!cfg) return null;
        const isLast = capped >= coletaConfig.length - 1;
        const stepNum = capped + 1;
        const totalSteps = coletaConfig.length;
        const pct = Math.round((capped / Math.max(totalSteps, 1)) * 100);

        const effectiveTipo: string = cfg.tipo || (cfg.campo === 'whatsapp' ? 'telefone' : 'texto');
        const allVals: Record<string, string> = { nome, whatsapp, cidade, instagram, ...(extraFieldValues || {}) };
        const rawVal = allVals[cfg.campo] ?? '';
        const displayVal = effectiveTipo === 'telefone' ? maskWhatsapp(rawVal)
          : effectiveTipo === 'cpf' ? maskCpf(rawVal)
          : rawVal;

        const handleFieldChange = (raw: string) => {
          let val = raw;
          if (effectiveTipo === 'telefone') val = raw.replace(/\D/g, '').slice(0, 11);
          else if (effectiveTipo === 'cpf') val = raw.replace(/\D/g, '').slice(0, 11);
          else if (effectiveTipo === 'numero') val = raw.replace(/\D/g, '');
          else if (cfg.campo === 'cidade') val = raw.replace(/[0-9]/g, '');
          setColetaFieldError(null);
          if (cfg.campo === 'nome') onNomeChange?.(val);
          else if (cfg.campo === 'whatsapp') onWhatsappChange?.(val);
          else if (cfg.campo === 'cidade') onCidadeChange?.(val);
          else if (cfg.campo === 'instagram') onInstagramChange?.(val);
          else onExtraFieldChange?.(cfg.campo, val);
        };

        const checkValid = (): string | null => {
          if (!cfg.obrigatorio) return null;
          if (effectiveTipo === 'telefone' || cfg.campo === 'whatsapp')
            return rawVal.replace(/\D/g, '').length === 11 ? null : 'Informe um WhatsApp válido com DDD (11 dígitos).';
          if (effectiveTipo === 'email')
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawVal) ? null : 'Informe um e-mail válido.';
          if (effectiveTipo === 'cpf')
            return rawVal.replace(/\D/g, '').length === 11 ? null : 'Informe um CPF válido (11 dígitos).';
          return rawVal.trim().length > 0 ? null : 'Este campo é obrigatório.';
        };

        const isWALast = isLast && isWhatsAppUrl;

        const advance = () => {
          const err = checkValid();
          if (err) { setColetaFieldError(err); return; }
          setColetaFieldError(null);
          if (coletaStep !== undefined) onColetaNext?.();
          else setInternalColetaStep(s => s + 1);
        };

        const rawBotaoAcao = cfg.botao_acao || (isWALast ? 'redirecionar' : isLast ? 'pagina_sucesso' : 'proxima_etapa');
        const effectiveBotaoAcao = rawBotaoAcao === 'whatsapp' ? 'redirecionar' : rawBotaoAcao;
        const btnLabel = cfg.botao_texto || (effectiveBotaoAcao === 'pagina_sucesso' ? buttonText : 'Continuar →');
        // Último campo sempre submete — redirect acontece no finalizarQuiz após salvar o lead
        const isSubmitAction = isLast;

        const executeAction = () => {
          if (effectiveBotaoAcao === 'redirecionar') {
            if (!isPreview) {
              const err = checkValid();
              if (err) { setColetaFieldError(err); return; }
              setColetaFieldError(null);
            }
            if (isSubmitAction) {
              return; // handled by onSubmit in form
            }
            const url = cfg.botao_target || redirectUrl || '';
            if (url) window.location.href = url;
          } else {
            if (cfg.botao_target && cfg.botao_target !== 'proxima') {
              const err = checkValid();
              if (err) { setColetaFieldError(err); return; }
              setColetaFieldError(null);
              const targetIdx = coletaConfig.findIndex(c => c.campo === cfg.botao_target);
              if (targetIdx >= 0) {
                if (coletaStep !== undefined) onColetaNext?.();
                else setInternalColetaStep(targetIdx);
                return;
              }
            }
            advance();
          }
        };

        const getWrapperStyle = (type: 'texto' | 'campo' | 'botao' | 'aviso'): React.CSSProperties => {
          if (!isBuilderPreview) return {};
          const isActive = selectedColetaElement === type || hoveredColetaElement === type;
          return {
            position: 'relative',
            cursor: 'pointer',
            borderRadius: '12px',
            padding: '12px',
            margin: '-12px -12px 4px -12px',
            outline: isActive ? '2px solid #2563eb' : 'none',
            outlineOffset: '0px',
          };
        };

        const BuilderBadge = ({ type, label }: { type: 'texto' | 'campo' | 'botao' | 'aviso', label: string }) => {
          if (!isBuilderPreview) return null;
          const isActive = selectedColetaElement === type || hoveredColetaElement === type;
          if (!isActive) return null;
          return (
            <div style={{ position: 'absolute', top: '-10px', left: '12px', background: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', zIndex: 10 }}>
              {label}
            </div>
          );
        };

        return (
          <div
            style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '24px 24px 80px', animation: 'fadeIn 0.4s ease' }}
            onClick={e => { if (isBuilderPreview && e.target === e.currentTarget) onSelectColetaElement?.(null); }}
          >
            <form onSubmit={e => {
              if (isBuilderPreview) { e.preventDefault(); return; }
              if (isSubmitAction) {
                if (!isPreview) {
                  const err = checkValid();
                  if (err) { e.preventDefault(); setColetaFieldError(err); return; }
                  setColetaFieldError(null);
                }
                onSubmit?.(e);
              } else {
                e.preventDefault();
              }
            }}>
              <div
                style={getWrapperStyle('texto')}
                onMouseEnter={() => { if (isBuilderPreview) setHoveredColetaElement('texto'); }}
                onMouseLeave={() => { if (isBuilderPreview) setHoveredColetaElement(null); }}
                onClick={e => { if (isBuilderPreview) { e.stopPropagation(); onSelectColetaElement?.('texto'); } }}
              >
                <BuilderBadge type="texto" label="TEXTOS" />
                <label style={{ display: 'block', fontSize: '22px', fontWeight: 700, color: quiz.cor_titulo || '#111111', marginBottom: '4px', textAlign: 'center' as const }}>
                  {cfg.label}{cfg.obrigatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
                </label>
                {cfg.subtitulo && (
                  <p style={{ fontSize: '14px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 14px', lineHeight: 1.5, textAlign: 'center' as const }}>
                    {cfg.subtitulo}
                  </p>
                )}
              </div>

              <div
                style={{ ...getWrapperStyle('campo'), marginTop: isBuilderPreview ? '16px' : '16px' }}
                onMouseEnter={() => { if (isBuilderPreview) setHoveredColetaElement('campo'); }}
                onMouseLeave={() => { if (isBuilderPreview) setHoveredColetaElement(null); }}
                onClick={e => { if (isBuilderPreview) { e.stopPropagation(); onSelectColetaElement?.('campo'); } }}
              >
                <BuilderBadge type="campo" label="CAMPO" />
                {effectiveTipo === 'email' ? (
                  <input
                    key={cfg.campo}
                    type="email"
                    autoFocus
                    value={rawVal}
                    onChange={e => handleFieldChange(e.target.value)}
                    placeholder={cfg.placeholder}
                    style={{ ...inpS, borderColor: coletaFieldError ? '#ef4444' : '#e5e7eb' }}
                  />
                ) : (
                  <input
                    key={cfg.campo}
                    autoFocus
                    type={effectiveTipo === 'telefone' ? 'tel' : 'text'}
                    inputMode={effectiveTipo === 'numero' || effectiveTipo === 'cpf' ? 'numeric' : undefined}
                    value={displayVal}
                    onChange={e => handleFieldChange(e.target.value)}
                    placeholder={cfg.placeholder}
                    style={{ ...inpS, borderColor: coletaFieldError ? '#ef4444' : '#e5e7eb' }}
                  />
                )}

                {coletaFieldError && (
                  <p style={{ fontSize: '12px', color: '#ef4444', margin: '6px 0 0', fontWeight: 600 }}>{coletaFieldError}</p>
                )}
              </div>

              <div
                style={{ ...getWrapperStyle('botao'), marginTop: isBuilderPreview ? '22px' : '22px' }}
                onMouseEnter={() => { if (isBuilderPreview) setHoveredColetaElement('botao'); }}
                onMouseLeave={() => { if (isBuilderPreview) setHoveredColetaElement(null); }}
                onClick={e => { if (isBuilderPreview) { e.stopPropagation(); onSelectColetaElement?.('botao'); } }}
              >
                <BuilderBadge type="botao" label="BOTÃO" />
                {isSubmitAction ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    onMouseEnter={e => {
                      if (submitting) return;
                      e.currentTarget.style.opacity = '0.88';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                      if (submitting) return;
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                    }}
                    onMouseDown={e => {
                      if (submitting) return;
                      e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                    }}
                    onMouseUp={e => {
                      if (submitting) return;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    style={{
                      width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                      background: submitting ? '#9ca3af' : btnColor,
                      color: '#fff', fontSize: '15px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                      transition: 'all 0.15s ease-out',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }}
                  >
                    {submitting ? 'Enviando...' : btnLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={e => {
                      if (isBuilderPreview) { e.stopPropagation(); onSelectColetaElement?.('botao'); }
                      else executeAction();
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.opacity = '0.88';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
                    }}
                    onMouseDown={e => {
                      e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                    }}
                    onMouseUp={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    style={{
                      width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                      background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-out',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                    }}
                  >
                    {btnLabel}
                  </button>
                )}
              </div>

              {cfg.campo === 'whatsapp' && cfg.show_whatsapp_warning !== false && (
                <div
                  style={{ ...getWrapperStyle('aviso'), marginTop: isBuilderPreview ? '14px' : '14px' }}
                  onMouseEnter={() => { if (isBuilderPreview) setHoveredColetaElement('aviso'); }}
                  onMouseLeave={() => { if (isBuilderPreview) setHoveredColetaElement(null); }}
                  onClick={e => { if (isBuilderPreview) { e.stopPropagation(); onSelectColetaElement?.('aviso'); } }}
                >
                  <BuilderBadge type="aviso" label="AVISO WA" />
                  <div style={{ padding: '14px', borderRadius: '12px', background: '#dcfce7', border: '1px solid #86efac', textAlign: 'center' as const }}>
                    <p style={{ fontSize: '13px', color: '#166534', margin: 0, lineHeight: 1.5 }}>
                      {cfg.whatsapp_warning_text || '📲 Ao clicar, você será direcionada para o WhatsApp. Envie a mensagem para garantir sua vaga — a mensagem já vem preenchida ✓'}
                    </p>
                  </div>
                </div>
              )}
            </form>
          </div>
        );
      })()}

      {phase === 'reprovado' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '40px 24px', textAlign: 'center', animation: 'fadeIn 0.35s ease' }}>
          {wrapElement('reprovado_texto', 'TEXTOS', (
            <>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <X style={{ width: '32px', height: '32px', strokeWidth: 3 }} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 8px' }}>
                {quiz.mensagem_reprovado || 'Obrigada pela participação!'}
              </h2>
              {(quiz as any).mensagem_reprovado_subtitulo && (
                <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
                  {(quiz as any).mensagem_reprovado_subtitulo}
                </p>
              )}
            </>
          ))}
          {wrapElement('reprovado_dicas', 'DICAS',
            <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '20px', marginBottom: '32px', textAlign: 'left' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Para uma próxima tentativa:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(Array.isArray(quiz.reprovado_conteudo) && quiz.reprovado_conteudo.length > 0 ? quiz.reprovado_conteudo : [
                  'Continue acompanhando nossas dicas no Instagram',
                  'Mantenha seu CPF regularizado',
                  'Tente novamente em 30 dias'
                ]).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d1d5db', marginTop: '6px', flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(quiz as any).reprovado_botao_texto && wrapElement('reprovado_botao', 'BOTÃO',
            <button onClick={isBuilderPreview ? undefined : () => window.open((quiz as any).reprovado_botao_url || '#', '_blank')} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              {(quiz as any).reprovado_botao_texto}
            </button>
          )}
        </div>
      )}
      {phase === 'sucesso' && (
        <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '40px 24px', textAlign: 'center', animation: 'fadeIn 0.35s ease' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#d1fae5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check style={{ width: '32px', height: '32px', strokeWidth: 3 }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: quiz.cor_titulo || '#111111', margin: '0 0 8px' }}>
            Cadastro realizado!
          </h2>
          <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 24px', lineHeight: 1.5 }}>
            Seus dados foram enviados com sucesso! Em breve entraremos em contato.
          </p>
        </div>
      )}
    </div>
  );
}

const lblS: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' };
const inpS: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: '12px', border: '1.5px solid #e5e7eb', fontSize: '16px', color: '#111', outline: 'none', transition: 'all 150ms ease-out', background: '#fff' };
