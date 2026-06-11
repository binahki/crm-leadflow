import React, { useState, useEffect } from 'react';
import { Check, GripVertical, HelpCircle, Hourglass, ImageIcon, Trash2 } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { QuizBlock } from '@/hooks/useQuizBlocks';
import { hexRgba } from './QuizRenderer';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PerguntaInfo {
  id: string;
  texto?: string | null;
  subtexto?: string | null;
  tipo_resposta?: string | null;
}

export interface BlockRendererProps {
  quiz: {
    cor_primaria?: string | null;
    cor_botao?: string | null;
    cor_fundo?: string | null;
    cor_titulo?: string | null;
    cor_subtitulo?: string | null;
    logo_url?: string | null;
    logo_altura?: number | null;
    [key: string]: any;
  };
  blocks: QuizBlock[];
  pageId: string;
  phase: 'cover' | 'question' | 'special';

  onStart?: () => void;
  onNext?: () => void;
  onNavigateTo?: (pageId: string) => void;
  onSubmit?: (e: React.FormEvent) => void;
  onFieldChange?: (campo: string, value: string) => void;
  fieldValues?: Record<string, string>;
  fieldErrors?: Record<string, string | null>;
  submitting?: boolean;

  isBuilderPreview?: boolean;
  selectedBlock?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
  hoveredBlock?: string | null;
  onHoverBlock?: (blockId: string | null) => void;

  dropAfterOrder?: number | null;
  previewBlock?: { tipo: QuizBlock['tipo']; conteudo: Record<string, any> } | null;

  onDeleteBlock?: (blockId: string) => void;
  onReorderBlocks?: (pageId: string, orderedIds: string[]) => void;

  flatPerguntas?: PerguntaInfo[];
  opcoesPorPergunta?: Record<string, Array<{
    id: string; texto: string; pontos: number;
    reprova_imediato: boolean; ordem: number; emoji?: string | null;
  }>>;
  onOpcaoClick?: (perguntaId: string, opcaoId: string, reprova: boolean) => void;
  selectedOpcaoId?: string | null;

  /** Which campo_input to show in production (step-by-step) */
  campoStep?: number;
  onCampoNext?: () => void;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_DEPOIMENTOS = [
  { nome: 'Ana Paula Silva', handle: '@ana.silva', texto: 'Não acreditei quando vi os resultados. Em poucos meses já estava faturando muito mais do que esperava!' },
  { nome: 'Carla Mendes', handle: '@carla.mendes', texto: 'Comecei do zero, sem experiência nenhuma. Hoje tenho minha própria renda e trabalho no meu horário.' },
  { nome: 'Fernanda Costa', handle: '@fernanda.costa', texto: 'A melhor decisão que tomei foi dar esse primeiro passo. Mudou completamente minha vida financeira.' },
];

// ── Masks ─────────────────────────────────────────────────────────────────────

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Block renderers ───────────────────────────────────────────────────────────

function BlockTitulo({ block, quiz }: {
  block: QuizBlock; quiz: BlockRendererProps['quiz'];
  isActive: boolean; isHovered: boolean;
}) {
  const { texto, subtexto } = block.conteudo;
  return (
    <div>
      {texto && (
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: quiz.cor_titulo || '#111111', lineHeight: 1.35, margin: '0 0 8px', textAlign: 'center' }}>
          {texto}
        </h2>
      )}
      {subtexto && (
        <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 8px', lineHeight: 1.6, textAlign: 'center' }}>
          {subtexto}
        </p>
      )}
    </div>
  );
}

function BlockImagem({ block }: { block: QuizBlock }) {
  const { url, altura = 200, border_radius = 16 } = block.conteudo;
  if (!url) return (
    <div style={{ width: '100%', height: `${altura}px`, borderRadius: `${border_radius}px`, background: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#9ca3af', fontSize: '13px' }}>
      <ImageIcon style={{ width: '24px', height: '24px', opacity: 0.5 }} />
      <span style={{ fontSize: '12px', opacity: 0.7 }}>Clique para adicionar imagem</span>
    </div>
  );
  return (
    <img src={url} alt=""
      style={{ width: '100%', borderRadius: `${border_radius}px`, objectFit: 'cover', maxHeight: `${altura}px`, display: 'block' }} />
  );
}

function BlockBeneficios({ block, quiz }: { block: QuizBlock; quiz: BlockRendererProps['quiz'] }) {
  const { items = [] } = block.conteudo;
  const primary = quiz.cor_primaria || '#2563eb';
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((item: string, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
            <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />
          </div>
          <span style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', lineHeight: 1.5 }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

function BlockBotao({ block, quiz, onAction, submitting }: {
  block: QuizBlock; quiz: BlockRendererProps['quiz'];
  onAction: (acao: string, target?: string) => void; submitting?: boolean;
}) {
  const [clicked, setClicked] = useState(false);
  const { texto = 'Continuar →', acao = 'proxima', target } = block.conteudo;
  const btnColor = quiz.cor_botao || quiz.cor_primaria || '#2563eb';
  const isSubmit = acao === 'submit';
  return (
    <button
      type={isSubmit ? 'submit' : 'button'}
      disabled={submitting && isSubmit}
      onClick={() => {
        setClicked(true);
        setTimeout(() => setClicked(false), 200);
        if (!isSubmit) onAction(acao, target);
      }}
      style={{ width: '100%', padding: '18px', borderRadius: '12px', border: 'none', background: submitting && isSubmit ? '#9ca3af' : btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: submitting && isSubmit ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transition: 'opacity 0.15s, transform 0.1s', opacity: clicked ? 0.7 : 1, transform: clicked ? 'scale(0.97)' : 'scale(1)' }}
      onMouseEnter={e => { if (!(submitting && isSubmit)) e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {submitting && isSubmit ? 'Enviando...' : texto}
    </button>
  );
}

function BlockCampoInput({ block, quiz, fieldValues = {}, fieldErrors = {}, onFieldChange, isBuilderPreview, onCampoNext }: {
  block: QuizBlock; quiz: BlockRendererProps['quiz'];
  fieldValues?: Record<string, string>;
  fieldErrors?: Record<string, string | null>;
  onFieldChange?: (campo: string, value: string) => void;
  isBuilderPreview?: boolean;
  onCampoNext?: () => void;
}) {
  const [clicked, setClicked] = useState(false);
  const { campo, label, placeholder, tipo_campo = 'texto', obrigatorio, botao_texto, botao_acao, botao_target, subtitulo } = block.conteudo;
  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;
  const rawVal = fieldValues[campo] ?? '';
  const error = fieldErrors[campo];
  const displayVal = tipo_campo === 'telefone' ? maskPhone(rawVal) : tipo_campo === 'cpf' ? maskCpf(rawVal) : rawVal;
  const isSubmit = botao_acao === 'submit';
  const isUrl = botao_acao === 'url';

  const handleChange = (raw: string) => {
    if (isBuilderPreview) return;
    let val = raw;
    if (tipo_campo === 'telefone') val = raw.replace(/\D/g, '').slice(0, 11);
    else if (tipo_campo === 'cpf') val = raw.replace(/\D/g, '').slice(0, 11);
    else if (tipo_campo === 'numero') val = raw.replace(/\D/g, '');
    onFieldChange?.(campo, val);
  };

  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: '22px', fontWeight: 700, color: quiz.cor_titulo || '#111111', marginBottom: '16px', textAlign: 'center' }}>
          {label}{obrigatorio && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
        </label>
      )}
      {subtitulo && (
        <p style={{ fontSize: '14px', color: quiz.cor_subtitulo || '#6b7280', textAlign: 'center', margin: '-8px 0 16px', lineHeight: 1.5 }}>
          {subtitulo}
        </p>
      )}
      <input
        type={tipo_campo === 'email' ? 'email' : tipo_campo === 'telefone' ? 'tel' : 'text'}
        inputMode={tipo_campo === 'numero' || tipo_campo === 'cpf' ? 'numeric' : undefined}
        value={displayVal}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        readOnly={isBuilderPreview}
        style={{ width: '100%', padding: '13px 14px', borderRadius: '12px', border: `1.5px solid ${error ? '#ef4444' : '#e5e7eb'}`, fontSize: '16px', color: '#111', outline: 'none', transition: 'border-color 150ms', background: '#fff', boxSizing: 'border-box' as const }}
        onFocus={e => { e.target.style.borderColor = primary; }}
        onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#e5e7eb'; }}
      />
      {error && <p style={{ fontSize: '12px', color: '#ef4444', margin: '6px 0 0', fontWeight: 600 }}>{error}</p>}
      {botao_texto && (
        <button
          type={isSubmit ? 'submit' : 'button'}
          onClick={() => {
            setClicked(true);
            setTimeout(() => setClicked(false), 200);
            if (isUrl && botao_target) window.location.href = botao_target;
            else if (!isSubmit) onCampoNext?.();
          }}
          style={{
            width: '100%', padding: '18px', borderRadius: '12px', border: 'none',
            background: btnColor, color: '#fff',
            fontSize: '15px', fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            marginTop: '16px',
            transition: 'opacity 0.15s, transform 0.1s',
            opacity: clicked ? 0.7 : 1,
            transform: clicked ? 'scale(0.97)' : 'scale(1)',
          }}
        >
          {botao_texto}
        </button>
      )}
    </div>
  );
}

function BlockSeparador({ block }: { block: QuizBlock }) {
  return <div style={{ height: `${block.conteudo.altura || 16}px` }} />;
}

function BlockPergunta({ block, quiz, flatPerguntas, opcoesPorPergunta, onOpcaoClick, selectedOpcaoId, isBuilderPreview, onNext }: {
  block: QuizBlock; quiz: BlockRendererProps['quiz'];
  flatPerguntas?: PerguntaInfo[];
  opcoesPorPergunta?: BlockRendererProps['opcoesPorPergunta'];
  onOpcaoClick?: BlockRendererProps['onOpcaoClick'];
  selectedOpcaoId?: string | null;
  isBuilderPreview?: boolean;
  onNext?: () => void;
}) {
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [continueClicked, setContinueClicked] = useState(false);

  const pergId = block.conteudo.pergunta_id as string;
  const perg = flatPerguntas?.find(p => p.id === pergId);
  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;
  const opcoes = (opcoesPorPergunta?.[pergId] || []).sort((a, b) => a.ordem - b.ordem);
  const isMultipla = perg?.tipo_resposta === 'multipla';

  const questionTitle = perg?.texto || block.conteudo._preview_texto || 'Adicione sua pergunta aqui';
  const questionSub = perg?.subtexto;

  return (
    <div>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: quiz.cor_titulo || '#111111', lineHeight: 1.35, margin: '0 0 8px', textAlign: 'center' }}>
        {questionTitle}
      </h2>
      {questionSub ? (
        <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 16px', lineHeight: 1.6, textAlign: 'center' }}>
          {questionSub}
        </p>
      ) : !perg && isBuilderPreview ? (
        <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', margin: '0 0 16px', lineHeight: 1.5 }}>
          Adicione as opções de resposta no painel lateral
        </p>
      ) : <div style={{ height: '8px' }} />}

      {opcoes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {opcoes.map(op => {
            const isSel = isMultipla ? selectedMulti.includes(op.id) : (selectedOpcaoId === op.id);
            return (
              <button key={op.id} type="button"
                onClick={() => {
                  if (isBuilderPreview) return;
                  if (isMultipla) {
                    setSelectedMulti(prev => prev.includes(op.id) ? prev.filter(id => id !== op.id) : [...prev, op.id]);
                  } else {
                    onOpcaoClick?.(pergId, op.id, op.reprova_imediato);
                  }
                }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', textAlign: 'left', border: `${isSel ? '2.5px' : '1.5px'} solid ${isSel ? primary : '#e2e8f0'}`, background: isSel ? hexRgba(primary, 0.08) : '#fff', cursor: isBuilderPreview ? 'default' : 'pointer', transition: 'all 0.2s', fontFamily: 'inherit', transform: isSel ? 'scale(1.01)' : 'scale(1)', boxShadow: isSel ? `0 4px 16px ${hexRgba(primary, 0.12)}` : 'none' }}
                onMouseEnter={e => {
                  if (isBuilderPreview || isSel) return;
                  const btn = e.currentTarget;
                  btn.style.borderColor = primary;
                  btn.style.background = hexRgba(primary, 0.04);
                  btn.style.transform = 'translateY(-2px) scale(1.01)';
                  btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                }}
                onMouseLeave={e => {
                  if (isBuilderPreview || isSel) return;
                  const btn = e.currentTarget;
                  btn.style.borderColor = '#e2e8f0';
                  btn.style.background = '#fff';
                  btn.style.transform = 'scale(1)';
                  btn.style.boxShadow = 'none';
                }}
              >
                {isMultipla ? (
                  <div style={{ width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0, border: `2px solid ${isSel ? primary : '#d1d5db'}`, background: isSel ? primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSel && <Check style={{ width: '11px', height: '11px', color: '#fff', strokeWidth: 3 }} />}
                  </div>
                ) : op.emoji ? (
                  <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{op.emoji}</span>
                ) : null}
                <span style={{ flex: 1, fontSize: '15px', color: '#111111', fontWeight: isSel ? 600 : 400 }}>{op.texto}</span>
                {!isMultipla && isSel && <Check style={{ width: '16px', height: '16px', color: primary, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isBuilderPreview ? (
            ['Opção A', 'Opção B', 'Opção C'].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '12px', border: '2px solid #e5e7eb', background: '#fff' }}>
                <span style={{ flex: 1, fontSize: '15px', color: '#9ca3af' }}>{text}</span>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', borderRadius: '12px', background: '#f9fafb', border: '2px dashed #e5e7eb' }}>
              <HelpCircle style={{ width: '20px', height: '20px', color: '#d1d5db', margin: '0 auto 6px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#b0b7c3' }}>Sem opções configuradas</p>
            </div>
          )}
        </div>
      )}

      {!isBuilderPreview && isMultipla && selectedMulti.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setContinueClicked(true);
            setTimeout(() => setContinueClicked(false), 200);
            onNext?.();
          }}
          style={{ width: '100%', padding: '18px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', marginTop: '16px', transition: 'opacity 0.15s, transform 0.1s', opacity: continueClicked ? 0.7 : 1, transform: continueClicked ? 'scale(0.97)' : 'scale(1)' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Continuar →
        </button>
      )}
    </div>
  );
}

// ── Análise loading + testimonials ────────────────────────────────────────────

function AnaliseContent({ quiz, isBuilderPreview }: { quiz: BlockRendererProps['quiz']; isBuilderPreview?: boolean }) {
  const [progress, setProgress] = useState(isBuilderPreview ? 65 : 0);
  const [showDepoimentos, setShowDepoimentos] = useState(isBuilderPreview ? true : false);
  const [hoveredDep, setHoveredDep] = useState<number | null>(null);
  const primary = quiz.cor_primaria || '#2563eb';
  const depoimentos: Array<{ nome: string; handle?: string; texto: string }> =
    (quiz.analise_depoimentos && (quiz.analise_depoimentos as any[]).length > 0) ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS;
  const [target] = useState(() => isBuilderPreview ? 65 : 70 + Math.floor(Math.random() * 20));

  useEffect(() => {
    if (isBuilderPreview) return;
    const start = Date.now();
    const duration = 2400;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min((elapsed / duration) * target, target);
      setProgress(Math.round(p));
      if (elapsed >= duration) {
        clearInterval(timer);
        setTimeout(() => setShowDepoimentos(true), 400);
      }
    }, 40);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line

  const loadingLabel = isBuilderPreview ? 'Analisando seu perfil...' :
    progress < 30 ? 'Verificando perfil...' :
    progress < 60 ? 'Cruzando informações...' :
    progress < 88 ? 'Quase lá...' : 'Finalizando análise...';

  return (
    <div style={{ paddingBottom: '8px' }}>
      {/* Hourglass icon */}
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: `${primary}18` }}>
          <Hourglass style={{ width: '22px', height: '22px', color: primary }} />
        </div>
      </div>

      {/* Loading bar */}
      <div style={{ marginBottom: '20px', borderRadius: '8px', padding: '4px', outline: isBuilderPreview ? `1.5px solid transparent` : undefined, transition: 'outline 0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: primary, marginBottom: '7px' }}>
          <span>Carregando...</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: primary, borderRadius: '999px', width: `${progress}%`, transition: isBuilderPreview ? 'none' : 'width 80ms linear' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '7px', textAlign: 'center' }}>{loadingLabel}</p>
      </div>

      {/* Testimonials */}
      {showDepoimentos && (
        <div style={isBuilderPreview ? undefined : { animation: 'appleIn 0.4s ease both' }}>
          {depoimentos.map((d, i) => (
            <div key={i}
              onMouseEnter={() => setHoveredDep(i)}
              onMouseLeave={() => setHoveredDep(null)}
              style={{
                background: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '12px',
                border: `1.5px solid ${hoveredDep === i ? '#2563eb' : '#f3f4f6'}`,
                outline: hoveredDep === i ? '2px solid rgba(37,99,235,0.2)' : '2px solid transparent',
                outlineOffset: '1px',
                cursor: isBuilderPreview ? 'pointer' : undefined,
                transition: 'border-color 0.15s, outline 0.15s',
                position: 'relative',
              }}
            >
              {isBuilderPreview && hoveredDep === i && (
                <div style={{ position: 'absolute', top: '-18px', right: '4px', zIndex: 5 }}>
                  <div style={{ background: '#2563eb', color: '#fff', fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.04em' }}>
                    DEPOIMENTO
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '2px', marginBottom: '8px' }}>
                {[...Array(5)].map((_, si) => <span key={si} style={{ color: '#f59e0b', fontSize: '14px' }}>★</span>)}
              </div>
              <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 10px', lineHeight: 1.6, fontStyle: 'italic' }}>"{d.texto}"</p>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#111' }}>{d.nome}</span>
                {d.handle && <span style={{ fontSize: '11px', color: '#9ca3af', marginLeft: '5px' }}>{d.handle}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sortable block wrapper ────────────────────────────────────────────────────

const BLOCK_LABELS: Record<string, string> = {
  titulo: 'TEXTO', imagem: 'IMAGEM', botao: 'BOTÃO',
  beneficios: 'BENEFÍCIOS', campo_input: 'CAMPO',
  opcoes: 'QUESTÃO', separador: 'ESPAÇO', pergunta: 'QUESTÃO',
};

function SortableBlockWrapper({ block, isBuilderPreview, isSelected, isHovered, onSelect, onHover, onDelete, children }: {
  block: QuizBlock; isBuilderPreview?: boolean;
  isSelected: boolean; isHovered: boolean;
  onSelect: () => void; onHover: (v: boolean) => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: `preview-block-${block.id}`,
    disabled: !isBuilderPreview,
    data: { type: 'preview-block' },
  });

  if (!isBuilderPreview) return <>{children}</>;

  const isActive = isSelected || isHovered;
  const sortStyle: React.CSSProperties = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    paddingTop: '6px',
  };

  return (
    <div
      ref={setNodeRef}
      style={sortStyle}
      data-block-order={block.ordem}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Toolbar — blue chip at top-left corner */}
      <div style={{
        position: 'absolute', top: '-1px', left: '-1px', zIndex: 5,
        display: 'flex', alignItems: 'center',
        background: isActive ? '#2563eb' : 'transparent',
        borderRadius: '6px', padding: '2px', gap: '1px',
        opacity: isActive ? 1 : 0.35,
        transition: 'opacity 0.12s, background 0.12s',
      }}>
        {/* Drag handle */}
        <div
          data-drag-handle="true"
          onPointerDown={e => e.stopPropagation()}
          style={{ color: '#fff', cursor: 'grab', display: 'flex', padding: '3px', touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </div>
        {onDelete && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
            title="Remover bloco"
            style={{
              color: '#fff', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', padding: '3px',
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Block content area */}
      <div
        onClick={e => { e.stopPropagation(); onSelect(); }}
        style={{ display: 'flex', alignItems: 'flex-start' }}
      >
        {/* Block content */}
        <div style={{
          flex: 1,
          position: 'relative',
          minWidth: 0,
          borderRadius: '8px',
          outline: isSelected
            ? '2px solid #2563eb'
            : isHovered
              ? '1.5px dashed #2563eb'
              : '2px solid transparent',
          outlineOffset: '2px',
          transition: 'outline 0.1s',
          padding: '8px',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuizBlockRenderer({
  quiz, blocks, pageId, phase,
  onStart, onNext, onNavigateTo, onSubmit,
  onFieldChange, fieldValues = {}, fieldErrors = {},
  submitting = false,
  isBuilderPreview = false,
  selectedBlock, onSelectBlock,
  hoveredBlock, onHoverBlock,
  dropAfterOrder,
  previewBlock,
  onDeleteBlock,
  onReorderBlocks,
  flatPerguntas,
  opcoesPorPergunta, onOpcaoClick, selectedOpcaoId,
  campoStep = 0,
  onCampoNext,
}: BlockRendererProps) {
  const [internalHovered, setInternalHovered] = useState<string | null>(null);

  const primary = quiz.cor_primaria || '#2563eb';
  const pageBlocks = blocks
    .filter(b => b.page_id === pageId)
    .sort((a, b) => a.ordem - b.ordem);

  const currentHovered = hoveredBlock ?? internalHovered;
  void hexRgba;

  // Check page type
  const pageInfo = flatPerguntas?.find(p => p.id === pageId);
  const isAnalisePage = (pageInfo?.tipo_resposta === 'analise') || pageId === 'analise' || pageId === '__analise__';
  const perguntaDaPagina = flatPerguntas?.find(
    p => p.id === pageId && (p.tipo_resposta === 'unica' || p.tipo_resposta === 'multipla')
  );

  // In production: show campo_input blocks one at a time
  const campoInputBlocks = pageBlocks.filter(b => b.tipo === 'campo_input');
  const activeCampoBlock = (!isBuilderPreview && campoInputBlocks.length > 0)
    ? campoInputBlocks[Math.min(campoStep, campoInputBlocks.length - 1)]
    : null;

  // Inner DnD sensors for block reordering
  const sortSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  function handleSortEnd(event: any) {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderBlocks) return;
    const activeId = String(active.id).replace('preview-block-', '');
    const overId = String(over.id).replace('preview-block-', '');
    const oldIdx = pageBlocks.findIndex(b => b.id === activeId);
    const newIdx = pageBlocks.findIndex(b => b.id === overId);
    if (oldIdx < 0 || newIdx < 0) return;
    const newIds = arrayMove(pageBlocks.map(b => b.id), oldIdx, newIdx);
    onReorderBlocks(pageId, newIds);
  }

  const handleAction = (acao: string, target?: string) => {
    if (isBuilderPreview) return;
    if (acao === 'start') onStart?.();
    else if (acao === 'proxima' || acao === 'next' || acao === 'coleta') {
      if (target) onNavigateTo?.(target);
      else onNext?.();
    }
    else if (acao === 'url' && target) window.location.href = target;
    else onNext?.();
  };

  const renderBlockContent = (block: QuizBlock) => {
    switch (block.tipo) {
      case 'titulo':
        return <BlockTitulo block={block} quiz={quiz} isActive={false} isHovered={false} />;
      case 'imagem':
        return <BlockImagem block={block} />;
      case 'beneficios':
        return <BlockBeneficios block={block} quiz={quiz} />;
      case 'botao':
        return <BlockBotao block={block} quiz={quiz} onAction={handleAction} submitting={submitting} />;
      case 'campo_input':
        return (
          <BlockCampoInput
            block={block} quiz={quiz}
            fieldValues={fieldValues} fieldErrors={fieldErrors}
            onFieldChange={onFieldChange}
            isBuilderPreview={isBuilderPreview}
            onCampoNext={onCampoNext}
          />
        );
      case 'separador':
        return <BlockSeparador block={block} />;
      case 'pergunta':
      case 'opcoes':
        return (
          <BlockPergunta
            block={block} quiz={quiz}
            flatPerguntas={flatPerguntas}
            opcoesPorPergunta={opcoesPorPergunta}
            onOpcaoClick={onOpcaoClick}
            selectedOpcaoId={selectedOpcaoId}
            isBuilderPreview={isBuilderPreview}
            onNext={onNext}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{ minHeight: '100%', background: quiz.cor_fundo || '#ffffff', fontFamily: "'DM Sans', system-ui, sans-serif" }}
      onClick={() => { if (isBuilderPreview) onSelectBlock?.(null); }}
    >
      {/* Header: logo + progress — always same height regardless of logo */}
      <div style={{ background: quiz.cor_fundo || '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingTop: isBuilderPreview ? '40px' : 'env(safe-area-inset-top, 12px)' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '8px 24px 6px', display: 'flex', justifyContent: 'center', minHeight: quiz.logo_url ? 'auto' : '38px' }}>
          {quiz.logo_url && (
            <img src={quiz.logo_url} alt="" style={{ maxHeight: `${quiz.logo_altura || 32}px`, maxWidth: '160px', objectFit: 'contain' }} />
          )}
        </div>
        <div style={{ padding: '0 24px 10px' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: primary, width: phase === 'cover' ? '2%' : '100%', borderRadius: '999px', transition: 'width 800ms cubic-bezier(0.65, 0, 0.35, 1)' }} />
          </div>
        </div>
      </div>

      {/* Blocks */}
      <form
        onSubmit={e => { if (isBuilderPreview) { e.preventDefault(); return; } onSubmit?.(e); }}
        style={{ maxWidth: '480px', margin: '0 auto', padding: '28px 24px 80px' }}
      >
        {/* Auto-rendered question block (no DB block needed) */}
        {perguntaDaPagina && (() => {
          const isAutoSelected = selectedBlock === '__auto_pergunta__';
          const isAutoHovered = currentHovered === '__auto_pergunta__';
          return (
            <div
              data-block-order="0"
              style={{ position: 'relative', paddingTop: '6px', marginBottom: '16px' }}
              onMouseEnter={() => { setInternalHovered('__auto_pergunta__'); onHoverBlock?.('__auto_pergunta__'); }}
              onMouseLeave={() => { setInternalHovered(null); onHoverBlock?.(null); }}
            >
              {isBuilderPreview && (
                <div style={{
                  position: 'absolute', top: '-1px', left: '-1px', zIndex: 5,
                  display: 'flex', alignItems: 'center',
                  background: isAutoSelected || isAutoHovered ? '#2563eb' : 'transparent',
                  borderRadius: '6px', padding: '2px', gap: '1px',
                  opacity: isAutoSelected || isAutoHovered ? 1 : 0.35,
                  transition: 'opacity 0.12s, background 0.12s',
                }}>
                  <div style={{ color: '#fff', padding: '3px', display: 'flex' }}>
                    <GripVertical size={13} style={{ opacity: 0.4 }} />
                  </div>
                </div>
              )}
              <div
                onClick={e => { e.stopPropagation(); if (isBuilderPreview) onSelectBlock?.('__auto_pergunta__'); }}
                style={{ display: 'flex', alignItems: 'flex-start', cursor: isBuilderPreview ? 'pointer' : undefined }}
              >
                <div style={{
                  flex: 1, position: 'relative', minWidth: 0, borderRadius: '8px',
                  outline: isAutoSelected ? '2px solid #2563eb' : isAutoHovered ? '1.5px dashed #2563eb' : '2px solid transparent',
                  outlineOffset: '2px', transition: 'outline 0.1s', padding: '8px',
                }}>
                  <BlockPergunta
                    block={{ id: '__auto_pergunta__', quiz_id: '', page_id: pageId, tipo: 'pergunta', ordem: 0, conteudo: { pergunta_id: pageId } } as QuizBlock}
                    quiz={quiz}
                    flatPerguntas={flatPerguntas}
                    opcoesPorPergunta={opcoesPorPergunta}
                    onOpcaoClick={onOpcaoClick}
                    selectedOpcaoId={selectedOpcaoId}
                    isBuilderPreview={isBuilderPreview}
                    onNext={onNext}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        <DndContext sensors={sortSensors} collisionDetection={closestCenter} onDragEnd={handleSortEnd}>
          <SortableContext
            items={pageBlocks.map(b => `preview-block-${b.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {(() => {
            const ghost: QuizBlock | null = (previewBlock && isBuilderPreview)
              ? { id: '__preview__', quiz_id: '', page_id: '', tipo: previewBlock.tipo, ordem: -1, conteudo: previewBlock.conteudo }
              : null;

            const ghostEl = ghost ? (() => {
              const c = renderBlockContent(ghost);
              if (!c) return null;
              return (
                <div key="__preview__" style={{ opacity: 0.55, pointerEvents: 'none', animation: 'dropIn 0.15s ease both' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: '18px' }} />
                    <div style={{ flex: 1, minWidth: 0, outline: '2px dashed #2563eb', outlineOffset: '2px', borderRadius: '8px', paddingRight: '4px' }}>
                      <div style={{ marginBottom: '16px' }}>{c}</div>
                    </div>
                  </div>
                </div>
              );
            })() : null;

            const showGhostAtEnd = ghost && ghostEl && dropAfterOrder != null &&
              pageBlocks.length > 0 && dropAfterOrder >= pageBlocks[pageBlocks.length - 1].ordem;

            return (
              <>
                {/* Empty page ghost */}
                {ghost && ghostEl && pageBlocks.length === 0 && ghostEl}

                {pageBlocks.map((block, idx) => {
                  // In production: skip non-active campo_input blocks
                  if (activeCampoBlock && block.tipo === 'campo_input' && block.id !== activeCampoBlock.id) {
                    return null;
                  }

                  const showDropBefore = isBuilderPreview && dropAfterOrder != null && (
                    (idx === 0 && block.ordem > dropAfterOrder + 1) ||
                    block.ordem === dropAfterOrder + 1
                  );

                  const isSelected = selectedBlock === block.id;
                  const isHovered = currentHovered === block.id;
                  const content = renderBlockContent(block);
                  if (!content) return null;

                  return (
                    <React.Fragment key={block.id}>
                      {showDropBefore && (
                        ghost && ghostEl ? ghostEl : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginBottom: '8px', animation: 'dropIn 0.2s ease both' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                            <div style={{ flex: 1, height: '2px', background: '#2563eb', borderRadius: '1px' }} />
                          </div>
                        )
                      )}
                      <SortableBlockWrapper
                        block={block}
                        isBuilderPreview={isBuilderPreview}
                        isSelected={isSelected}
                        isHovered={isHovered}
                        onSelect={() => onSelectBlock?.(block.id)}
                        onHover={v => {
                          setInternalHovered(v ? block.id : null);
                          onHoverBlock?.(v ? block.id : null);
                        }}
                        onDelete={onDeleteBlock ? () => onDeleteBlock(block.id) : undefined}
                      >
                        <div style={{ marginBottom: '16px' }}>{content}</div>
                      </SortableBlockWrapper>
                    </React.Fragment>
                  );
                })}

                {/* Drop ghost/indicator after last block */}
                {showGhostAtEnd && ghostEl}
                {isBuilderPreview && !ghost && dropAfterOrder != null && pageBlocks.length > 0 && dropAfterOrder >= pageBlocks[pageBlocks.length - 1].ordem && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginTop: '8px', animation: 'dropIn 0.2s ease both' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                    <div style={{ flex: 1, height: '2px', background: '#2563eb', borderRadius: '1px' }} />
                  </div>
                )}
              </>
            );
          })()}
          </SortableContext>
        </DndContext>

        {/* Analysis page special content (loading bar + testimonials) */}
        {isAnalisePage && <AnaliseContent quiz={quiz} isBuilderPreview={isBuilderPreview} />}
      </form>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes appleIn {
          0% { opacity: 0; transform: scale(0.985) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dropIn {
          0% { opacity: 0; transform: scaleX(0.5); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        * { box-sizing: border-box; }
        input, button { font-family: inherit; }
      `}</style>
    </div>
  );
}
