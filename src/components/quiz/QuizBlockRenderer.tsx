import React, { useState, useEffect, useRef } from 'react';
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
  onDeleteConfirm?: (id: string, fn: () => void) => void;
  pendingDeleteId?: string | null;
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

  /** Fire confetti on approval page. Only pass true from the live quiz (QuizPublico). */
  confettiEnabled?: boolean;
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
        <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', color: quiz.cor_titulo || '#111111', lineHeight: 1.1, margin: '0 0 12px', textAlign: 'center' }}>
          {texto}
        </h2>
      )}
      {subtexto && (
        <p style={{ fontSize: '15px', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 20px', lineHeight: 1.6, textAlign: 'center' }}>
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
      style={{ width: '100%', padding: '18px', borderRadius: '12px', border: 'none', background: submitting && isSubmit ? '#9ca3af' : btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: submitting && isSubmit ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', transition: 'opacity 0.15s, transform 0.15s ease-out, box-shadow 0.15s', opacity: clicked ? 0.7 : 1, transform: clicked ? 'scale(0.97)' : 'scale(1)' }}
      onMouseEnter={e => { if (!(submitting && isSubmit)) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; } }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
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
  const [localError, setLocalError] = useState<string | null>(null);
  const { campo, label, placeholder, tipo_campo = 'texto', obrigatorio, botao_texto, botao_acao, botao_target, subtitulo } = block.conteudo;
  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;
  const rawVal = fieldValues[campo] ?? '';
  const error = fieldErrors[campo] || localError;
  const displayVal = tipo_campo === 'telefone' ? maskPhone(rawVal) : tipo_campo === 'cpf' ? maskCpf(rawVal) : rawVal;
  const isSubmit = botao_acao === 'submit';
  const isUrl = botao_acao === 'url';

  const handleChange = (raw: string) => {
    if (isBuilderPreview) return;
    setLocalError(null);
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
            if (obrigatorio && !isBuilderPreview && !rawVal.trim()) {
              setLocalError('Este campo é obrigatório');
              return;
            }
            setLocalError(null);
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
            transition: 'opacity 0.15s, transform 0.15s ease-out, box-shadow 0.15s',
            opacity: clicked ? 0.7 : 1,
            transform: clicked ? 'scale(0.97)' : 'scale(1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
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

function BlockAlerta({ block }: { block: QuizBlock }) {
  const { cor = '#16a34a', texto = '' } = block.conteudo;
  return (
    <div style={{ padding: '14px 16px', borderRadius: '12px', background: `${cor}18`, border: `1.5px solid ${cor}40` }}>
      <p style={{ margin: 0, fontSize: '13px', color: cor, lineHeight: 1.5, fontWeight: 500, textAlign: 'center' }}>{texto}</p>
    </div>
  );
}

function BlockQuestao({ block, quiz }: {
  block: QuizBlock; quiz: BlockRendererProps['quiz'];
}) {
  const c = block.conteudo || {};
  const texto: string = c.texto || '';
  const subtexto: string | null = c.subtexto || null;
  const opcoes: any[] = c.opcoes || [];
  const isMultipla = c.tipo_resposta === 'multipla';

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', color: quiz.cor_titulo || '#111111', margin: '0 0 6px', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
        {texto || 'Adicione sua pergunta aqui'}
      </h2>
      {subtexto && (
        <p style={{ fontSize: '13px', textAlign: 'center', color: quiz.cor_subtitulo || '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
          {subtexto}
        </p>
      )}
      <div style={{ marginTop: subtexto ? 0 : '12px' }}>
        {opcoes.length > 0 ? opcoes.map((op, i) => (
          <div key={op.id} style={{ padding: '12px 16px', borderRadius: '10px', border: '1.5px solid #e5e7eb', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff' }}>
            {isMultipla && (
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1.5px solid #d1d5db', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '14px', color: '#111111', flex: 1 }}>{op.texto || `Opção ${i + 1}`}</span>
          </div>
        )) : ['Opção 1', 'Opção 2', 'Opção 3'].map((text, i) => (
          <div key={i} style={{ padding: '12px 16px', borderRadius: '10px', border: '1.5px solid #e5e7eb', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', background: '#fff' }}>
            {isMultipla && (
              <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: '1.5px solid #d1d5db', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
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

  const isSelfContained = block.tipo === 'questao';
  const primary = quiz.cor_primaria || '#2563eb';
  const btnColor = quiz.cor_botao || primary;

  // Self-contained questão: read from block.conteudo directly
  const pergId = isSelfContained ? block.id : (block.conteudo.pergunta_id as string);
  const perg = isSelfContained ? null : flatPerguntas?.find(p => p.id === pergId);
  const opcoes = isSelfContained
    ? (block.conteudo.opcoes || [])
    : (opcoesPorPergunta?.[pergId] || []).sort((a: any, b: any) => a.ordem - b.ordem);
  const isMultipla = isSelfContained
    ? block.conteudo.tipo_resposta === 'multipla'
    : perg?.tipo_resposta === 'multipla';

  const questionTitle = isSelfContained
    ? (block.conteudo.texto || 'Adicione sua pergunta aqui')
    : (perg?.texto || block.conteudo._preview_texto || 'Adicione sua pergunta aqui');
  const questionSub = isSelfContained ? (block.conteudo.subtexto || null) : perg?.subtexto;

  return (
    <div>
      <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em', color: quiz.cor_titulo || '#111111', lineHeight: 1.3, margin: '0 0 8px', textAlign: 'center' }}>
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
          {(opcoes as any[]).map(op => {
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
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px', borderRadius: '16px', textAlign: 'left', border: `${isSel ? '2.5px' : '1.5px'} solid ${isSel ? primary : '#e2e8f0'}`, background: isSel ? hexRgba(primary, 0.08) : '#fff', cursor: isBuilderPreview ? 'default' : 'pointer', transition: 'all 200ms ease', fontFamily: 'inherit', transform: isSel ? 'scale(1.01)' : 'scale(1)', boxShadow: isSel ? `0 8px 24px ${hexRgba(primary, 0.12)}` : 'none' }}
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
                  <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, border: `2px solid ${isSel ? primary : '#d1d5db'}`, background: isSel ? primary : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isSel && <Check style={{ width: '12px', height: '12px', color: '#fff', strokeWidth: 3 }} />}
                  </div>
                ) : op.emoji ? (
                  <span style={{ fontSize: '36px', lineHeight: 1, flexShrink: 0 }}>{op.emoji}</span>
                ) : null}
                <span style={{ flex: 1, fontSize: '15px', color: '#111111', fontWeight: isSel ? 600 : 500 }}>{op.texto}</span>
                {!isMultipla && isSel && <Check style={{ width: '16px', height: '16px', color: primary, flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isBuilderPreview ? (
            ['Opção A', 'Opção B', 'Opção C'].map((text, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderRadius: '16px', border: '1.5px solid #e5e7eb', background: '#fff' }}>
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
          style={{ width: '100%', padding: '18px', borderRadius: '12px', border: 'none', background: btnColor, color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', marginTop: '16px', transition: 'opacity 0.15s, transform 0.15s ease-out, box-shadow 0.15s', opacity: continueClicked ? 0.7 : 1, transform: continueClicked ? 'scale(0.97)' : 'scale(1)' }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)'; }}
        >
          Continuar ({selectedMulti.length} selecionada{selectedMulti.length !== 1 ? 's' : ''}) →
        </button>
      )}
    </div>
  );
}

// ── Análise loading + testimonials ────────────────────────────────────────────

function AnaliseContent({ quiz, isBuilderPreview, onComplete, selectedBlock, onSelectBlock, hoveredBlock, onHoverBlock }: {
  quiz: BlockRendererProps['quiz']; isBuilderPreview?: boolean; onComplete?: () => void;
  selectedBlock?: string | null; onSelectBlock?: (id: string | null) => void;
  hoveredBlock?: string | null; onHoverBlock?: (id: string | null) => void;
}) {
  const [progress, setProgress] = useState(isBuilderPreview ? 65 : 0);
  const primary = quiz.analise_cor || quiz.cor_primaria || '#2563eb';
  const depoimentos: Array<{ nome: string; handle?: string; texto: string }> =
    (quiz.analise_depoimentos && (quiz.analise_depoimentos as any[]).length > 0) ? quiz.analise_depoimentos : DEFAULT_DEPOIMENTOS;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (isBuilderPreview) return;
    const dur = (quiz.analise_duracao || 4) * 1000;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(Math.round((elapsed / dur) * 100), 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(() => onCompleteRef.current?.(), 300);
      }
    }, 50);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line

  const loadingLabel = isBuilderPreview ? 'Analisando seu perfil...' :
    progress < 30 ? 'Verificando perfil...' :
      progress < 60 ? 'Cruzando informações...' :
        progress < 88 ? 'Quase lá...' : 'Finalizando análise...';

  const selStyle = (id: string): React.CSSProperties => {
    if (!isBuilderPreview) return {};
    const isSel = selectedBlock === id;
    const isHov = hoveredBlock === id;
    return {
      borderRadius: '8px',
      outline: isSel ? '2px solid #2563eb' : isHov ? '1.5px dashed #2563eb' : '2px solid transparent',
      outlineOffset: '3px',
      cursor: 'pointer',
      transition: 'outline 0.1s',
    };
  };

  const bindSel = (id: string) => !isBuilderPreview ? {} : {
    onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSelectBlock?.(id); },
    onMouseEnter: () => onHoverBlock?.(id),
    onMouseLeave: () => onHoverBlock?.(null),
  };

  return (
    <div style={{ paddingBottom: '8px' }}>
      {/* Ícone/texto — clicável no builder */}
      <div style={{ ...selStyle('__analise_texto__'), textAlign: 'center', marginBottom: '16px' }} {...bindSel('__analise_texto__')}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', background: `${primary}18` }}>
          <Hourglass style={{ width: '22px', height: '22px', color: primary }} />
        </div>
      </div>

      {/* Barra de progresso — clicável no builder */}
      <div style={{ ...selStyle('__analise_barra__'), marginBottom: '20px', padding: '4px' }} {...bindSel('__analise_barra__')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: primary, marginBottom: '7px' }}>
          <span>Carregando...</span>
          <span>{progress}%</span>
        </div>
        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: primary, borderRadius: '999px', width: `${progress}%`, transition: isBuilderPreview ? 'none' : 'width 80ms linear' }} />
        </div>
        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '7px', textAlign: 'center' }}>{loadingLabel}</p>
      </div>

      {/* Depoimentos — clicáveis no builder */}
      <div style={selStyle('__analise_depoimentos__')} {...bindSel('__analise_depoimentos__')}>
        {depoimentos.map((d, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: '14px', padding: '16px', marginBottom: '12px', border: '1.5px solid #f3f4f6' }}>
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
    </div>
  );
}

// ── Sortable block wrapper ────────────────────────────────────────────────────

const BLOCK_LABELS: Record<string, string> = {
  titulo: 'TEXTO', imagem: 'IMAGEM', botao: 'BOTÃO',
  beneficios: 'BENEFÍCIOS', campo_input: 'CAMPO',
  opcoes: 'QUESTÃO', separador: 'ESPAÇO', pergunta: 'QUESTÃO',
  questao: 'QUESTÃO', // FIX: tipo 'questao' do banco
};

function SortableBlockWrapper({ block, isBuilderPreview, isSelected, isHovered, onSelect, onHover, onDelete, onDeleteConfirm, pendingDeleteId, children }: {
  block: QuizBlock; isBuilderPreview?: boolean;
  isSelected: boolean; isHovered: boolean;
  onSelect: () => void; onHover: (v: boolean) => void;
  onDelete?: () => void;
  onDeleteConfirm?: (id: string, fn: () => void) => void;
  pendingDeleteId?: string | null;
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
          style={{ color: '#fff', cursor: 'grab', display: 'flex', padding: '3px', touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={13} />
        </div>
        {onDelete && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation(); e.preventDefault();
              if (onDeleteConfirm) onDeleteConfirm(block.id, onDelete);
              else onDelete();
            }}
            title={pendingDeleteId === block.id ? 'Clique para confirmar' : 'Remover bloco'}
            style={{
              color: pendingDeleteId === block.id ? '#ef4444' : '#fff',
              background: pendingDeleteId === block.id ? '#fff' : 'none',
              border: 'none', cursor: 'pointer', display: 'flex', padding: '3px', borderRadius: '3px',
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {pendingDeleteId === block.id ? <Check size={13} /> : <Trash2 size={13} />}
          </button>
        )}
      </div>

      {/* Block content area */}
      <div
        onClick={e => { e.stopPropagation(); onSelect(); }}
        style={{ display: 'flex', alignItems: 'flex-start' }}
      >
        <div
          data-block-order={block.ordem}
          style={{
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
          }}
        >
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
  onDeleteConfirm,
  pendingDeleteId,
  onReorderBlocks,
  flatPerguntas,
  opcoesPorPergunta, onOpcaoClick, selectedOpcaoId,
  campoStep = 0,
  onCampoNext,
  confettiEnabled = false,
}: BlockRendererProps) {
  const [internalHovered, setInternalHovered] = useState<string | null>(null);

  const primary = quiz.cor_primaria || '#2563eb';

  // ── Confetes na aprovação ───────────────────────────────────────────────────
  const currentPageInfo = flatPerguntas?.find(p => p.id === pageId);
  const isAprovacaoPage = currentPageInfo?.tipo_resposta === 'aprovacao';

  useEffect(() => {
    if (!isAprovacaoPage || !confettiEnabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    document.getElementById('quiz-confetti-canvas')?.remove();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const canvas = document.createElement('canvas');
    canvas.id = 'quiz-confetti-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: `${W}px`, height: `${H}px`,
      pointerEvents: 'none', zIndex: '9999',
    });
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    ctx.scale(dpr, dpr);

    const brand = quiz.cor_primaria || '#2563eb';
    // High-contrast palette — works on both light and dark quiz backgrounds
    const palette = [
      brand, brand, brand,
      '#f59e0b', '#fbbf24',   // amber — festive, visible on white
      '#10b981',               // emerald
      '#f472b6',               // pink
      '#a78bfa',               // violet
      '#fb923c',               // orange
    ];

    type Shape = 'circle' | 'square' | 'ribbon';
    interface P {
      x: number; y: number; vx: number; vy: number;
      angle: number; spin: number; w: number; h: number;
      color: string; shape: Shape;
    }

    function burst(cx: number, cy: number, n: number): P[] {
      return Array.from({ length: n }, (): P => {
        const shape: Shape = Math.random() < 0.35 ? 'circle' : Math.random() < 0.5 ? 'ribbon' : 'square';
        const speed = 10 + Math.random() * 18;
        const spread = Math.PI * 0.75;
        const baseAngle = -Math.PI / 2;
        const a = baseAngle + (Math.random() - 0.5) * spread;
        const baseSize = 5 + Math.random() * 7;
        return {
          x: cx + (Math.random() - 0.5) * 60,
          y: cy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.35,
          w: shape === 'ribbon' ? baseSize * 0.35 : baseSize,
          h: shape === 'ribbon' ? baseSize * 4 : baseSize,
          color: palette[Math.floor(Math.random() * palette.length)],
          shape,
        };
      });
    }

    // Three burst sources near the bottom
    const particles: P[] = [
      ...burst(W * 0.5, H * 0.82, 70),
      ...burst(W * 0.2, H * 0.88, 50),
      ...burst(W * 0.8, H * 0.88, 50),
    ];

    // Second wave after 350ms
    let wave2Added = false;

    const TOTAL = 4200;
    const FADE_START = 3000;
    const t0 = performance.now();
    let raf = 0;

    function frame(now: number) {
      const elapsed = now - t0;

      if (!wave2Added && elapsed >= 350) {
        wave2Added = true;
        particles.push(
          ...burst(W * 0.35, H * 0.80, 40),
          ...burst(W * 0.65, H * 0.80, 40),
        );
      }

      ctx.clearRect(0, 0, W, H);
      let live = false;

      for (const p of particles) {
        p.vy += 0.5;
        p.vx *= 0.988;
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;

        const alpha = elapsed < FADE_START
          ? 1
          : Math.max(0, 1 - (elapsed - FADE_START) / (TOTAL - FADE_START));

        if (alpha <= 0 || p.y > H + 80) continue;
        live = true;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }

      if (live && elapsed < TOTAL) raf = requestAnimationFrame(frame);
      else canvas.remove();
    }

    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); canvas.remove(); };
  }, [isAprovacaoPage, confettiEnabled, quiz.cor_primaria]);

  // ── Barra de progresso: posição global (cover + todas as páginas) ───────────
  const currentTipoResposta = currentPageInfo?.tipo_resposta || '';
  const allPages = flatPerguntas || [];
  const totalSteps = 1 + allPages.length; // 1 (cover) + restante

  let progressWidth: number;
  if (pageId === 'cover') {
    progressWidth = Math.max(4, Math.round((1 / Math.max(totalSteps, 1)) * 100));
  } else {
    const pageIdx = allPages.findIndex(p => p.id === pageId);
    progressWidth = pageIdx >= 0
      ? Math.round(((pageIdx + 2) / Math.max(totalSteps, 1)) * 100) // +2: 1 por cover + 1 base-1
      : 4;
  }

  const hideProgressBar = false;

  const pageBlocks = blocks
    .filter(b => b.page_id === pageId)
    .sort((a, b) => a.ordem - b.ordem);

  const currentHovered = hoveredBlock ?? internalHovered;

  // Check page type
  const isAnalisePage = (currentPageInfo?.tipo_resposta === 'analise') || pageId === 'analise' || pageId === '__analise__';

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
      case 'alerta':
        return <BlockAlerta block={block} />;
      case 'questao':
        if (isBuilderPreview) {
          return <BlockQuestao block={block} quiz={quiz} />;
        }
        return (
          <BlockPergunta
            block={block} quiz={quiz}
            flatPerguntas={flatPerguntas}
            opcoesPorPergunta={opcoesPorPergunta}
            onOpcaoClick={onOpcaoClick}
            selectedOpcaoId={selectedOpcaoId}
            isBuilderPreview={false}
            onNext={onNext}
          />
        );
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
      style={{ minHeight: isBuilderPreview ? '100%' : '100vh', width: '100%', background: quiz.cor_fundo || '#ffffff', fontFamily: "'DM Sans', system-ui, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onClick={() => { if (isBuilderPreview) onSelectBlock?.(null); }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800&display=swap');
        @keyframes appleIn {
          0% { opacity: 0; transform: scale(0.985) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dropIn {
          0% { opacity: 0; transform: scaleX(0.5); }
          100% { opacity: 1; transform: scaleX(1); }
        }
        .quiz-option {
          backface-visibility: hidden;
          -webkit-font-smoothing: antialiased;
          transform: perspective(1px) translateZ(0);
        }
        .quiz-option:active { transform: perspective(1px) scale(0.98) translateZ(0) !important; }
        * { box-sizing: border-box; }
        input, textarea, button, select { font-family: inherit; }
      `}</style>

      {/* Header: logo + progress */}
      <div style={{ width: '100%', background: quiz.cor_fundo || '#ffffff', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingTop: isBuilderPreview ? '40px' : 'max(14px, env(safe-area-inset-top))' }}>
        {quiz.logo_url && (
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', padding: '4px 24px 6px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img src={quiz.logo_url} alt="" style={{ maxHeight: `${quiz.logo_altura || 32}px`, maxWidth: '160px', objectFit: 'contain' }} />
          </div>
        )}
        {!hideProgressBar && (
          <div style={{ padding: quiz.logo_url ? '4px 24px 12px' : '8px 24px 12px' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%', height: '10px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: primary, width: `${progressWidth}%`, borderRadius: '999px', transition: 'width 800ms cubic-bezier(0.65, 0, 0.35, 1)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Blocks */}
      <div style={{ maxWidth: '480px', width: '100%' }}>
      <form
        onSubmit={e => { if (isBuilderPreview) { e.preventDefault(); return; } onSubmit?.(e); }}
        style={{ padding: '32px 24px 80px' }}
      >
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
                  <div key="__preview__" style={{ opacity: 0.55, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                      <div style={{ flexShrink: 0, width: '18px' }} />
                      <div style={{ flex: 1, minWidth: 0, outline: '2px dashed #2563eb', outlineOffset: '2px', borderRadius: '8px', paddingRight: '4px' }}>
                        <div style={{ marginBottom: '20px' }}>{c}</div>
                      </div>
                    </div>
                  </div>
                );
              })() : null;

              const showGhostAtEnd = ghost && ghostEl && dropAfterOrder != null &&
                pageBlocks.length > 0 && dropAfterOrder >= pageBlocks[pageBlocks.length - 1].ordem;

              return (
                <>
                  {ghost && ghostEl && pageBlocks.length === 0 && ghostEl}

                  {pageBlocks.map((block, idx) => {
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginBottom: '8px' }}>
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
                          onDeleteConfirm={onDeleteConfirm}
                          pendingDeleteId={pendingDeleteId}
                        >
                          <div style={{ marginBottom: '20px' }}>{content}</div>
                        </SortableBlockWrapper>
                      </React.Fragment>
                    );
                  })}

                  {showGhostAtEnd && ghostEl}
                  {isBuilderPreview && !ghost && dropAfterOrder != null && pageBlocks.length > 0 && dropAfterOrder >= pageBlocks[pageBlocks.length - 1].ordem && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginTop: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                      <div style={{ flex: 1, height: '2px', background: '#2563eb', borderRadius: '1px' }} />
                    </div>
                  )}
                </>
              );
            })()}
          </SortableContext>
        </DndContext>

        {isAnalisePage && (
          <AnaliseContent
            quiz={quiz}
            isBuilderPreview={isBuilderPreview}
            onComplete={onNext}
            selectedBlock={selectedBlock}
            onSelectBlock={onSelectBlock}
            hoveredBlock={currentHovered}
            onHoverBlock={v => {
              setInternalHovered(v);
              onHoverBlock?.(v);
            }}
          />
        )}
      </form>
      </div>
    </div>
  );
}