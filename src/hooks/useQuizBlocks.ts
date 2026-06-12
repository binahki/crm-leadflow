import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export interface QuizBlock {
  id: string;
  quiz_id: string;
  page_id: string;
  tipo: 'titulo' | 'imagem' | 'botao' | 'beneficios' | 'opcoes' | 'campo_input' | 'separador' | 'pergunta' | 'questao' | 'alerta';
  ordem: number;
  conteudo: Record<string, any>;
}

export function useQuizBlocks(quizId: string | null) {
  const [blocks, setBlocks] = useState<QuizBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBlocks = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    const { data } = await db
      .from('quiz_page_blocks')
      .select('*')
      .eq('quiz_id', quizId)
      .order('ordem');
    setBlocks(data || []);
    setLoading(false);
  }, [quizId]);

  const getPageBlocks = useCallback((pageId: string) => {
    return blocks
      .filter(b => b.page_id === pageId)
      .sort((a, b) => a.ordem - b.ordem);
  }, [blocks]);

  const addBlock = useCallback(async (
    pageId: string,
    tipo: QuizBlock['tipo'],
    conteudo: Record<string, any>,
    afterOrder?: number
  ): Promise<QuizBlock | null> => {
    if (!quizId) return null;
    const pageBlocks = blocks.filter(b => b.page_id === pageId);
    const maxOrdem = pageBlocks.reduce((mx, b) => Math.max(mx, b.ordem), 0);
    const novaOrdem = afterOrder != null ? afterOrder + 1 : maxOrdem + 1;

    // Reordenar blocos que vêm depois
    if (afterOrder != null) {
      const toUpdate = pageBlocks.filter(b => b.ordem > afterOrder);
      await Promise.all(toUpdate.map(b =>
        db.from('quiz_page_blocks').update({ ordem: b.ordem + 1 }).eq('id', b.id)
      ));
      setBlocks(prev => prev.map(b =>
        b.page_id === pageId && b.ordem > afterOrder
          ? { ...b, ordem: b.ordem + 1 }
          : b
      ));
    }

    // Optimistic insert — add a temp block immediately, replace with real data
    const tempId = `temp_${Date.now()}`;
    const tempBlock: QuizBlock = {
      id: tempId, quiz_id: quizId,
      page_id: pageId, tipo,
      ordem: novaOrdem, conteudo,
    };
    setBlocks(prev => [...prev, tempBlock]);

    const { data, error } = await db.from('quiz_page_blocks').insert({
      quiz_id: quizId,
      page_id: pageId,
      tipo,
      ordem: novaOrdem,
      conteudo,
    }).select().single();

    if (error || !data) {
      // Revert optimistic insert
      setBlocks(prev => prev.filter(b => b.id !== tempId));
      return null;
    }
    // Replace temp block with real data
    setBlocks(prev => prev.map(b => b.id === tempId ? data : b));
    return data;
  }, [quizId, blocks]);

  const updateBlock = useCallback(async (
    blockId: string,
    conteudo: Record<string, any>
  ) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, conteudo } : b));
    await db.from('quiz_page_blocks').update({ conteudo }).eq('id', blockId);
  }, []);

  const deleteBlock = useCallback(async (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
    await db.from('quiz_page_blocks').delete().eq('id', blockId);
  }, []);

  const reorderBlocks = useCallback(async (pageId: string, orderedIds: string[]) => {
    const updated = blocks.map(b => {
      if (b.page_id !== pageId) return b;
      const newOrdem = orderedIds.indexOf(b.id) + 1;
      return newOrdem > 0 ? { ...b, ordem: newOrdem } : b;
    });
    setBlocks(updated);
    await Promise.all(
      orderedIds.map((id, idx) =>
        db.from('quiz_page_blocks').update({ ordem: idx + 1 }).eq('id', id)
      )
    );
  }, [blocks]);

  const createDefaultBlocks = useCallback(async (pageId: string, tipo: string) => {
    if (!quizId) return;
    const defaults: { tipo: QuizBlock['tipo']; conteudo: Record<string, any> }[] = [];

    if (pageId === 'cover') {
      defaults.push(
        { tipo: 'titulo', conteudo: { texto: 'Descubra se você tem o perfil ideal! 🎯', subtexto: 'Responda algumas perguntas rápidas e veja se você se encaixa no nosso programa.' } },
        { tipo: 'imagem', conteudo: { url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=80', altura: 200, border_radius: 16 } },
        { tipo: 'beneficios', conteudo: { items: ['Resposta imediata após o quiz', 'Apenas 2 minutos para completar', 'Sem compromisso inicial'] } },
        { tipo: 'botao', conteudo: { texto: 'Quero descobrir agora →', acao: 'start' } },
      );
    } else if (tipo === 'aprovacao') {
      defaults.push(
        { tipo: 'titulo', conteudo: { texto: '🎉 Parabéns! Você foi aprovada.', subtexto: 'Seu perfil está dentro do que buscamos. Próximo passo: preencher seus dados.' } },
        { tipo: 'botao', conteudo: { texto: 'Preencher meus dados →', acao: 'coleta' } },
      );
    } else if (tipo === 'reprovacao') {
      defaults.push(
        { tipo: 'titulo', conteudo: { texto: 'Obrigada pela participação!', subtexto: 'No momento seu perfil não atende aos requisitos.' } },
        { tipo: 'beneficios', conteudo: { items: ['Continue acompanhando nossas dicas', 'Tente novamente em 30 dias'] } },
      );
    } else if (tipo === 'analise') {
      defaults.push(
        { tipo: 'titulo', conteudo: { texto: 'Estamos analisando seu perfil...', subtexto: 'Aguarde enquanto verificamos suas respostas.' } },
      );
    } else if (tipo === 'coleta') {
      const campos = [
        { campo: 'nome', label: 'Qual o seu nome completo?', placeholder: 'Digite seu nome', tipo_campo: 'texto', obrigatorio: true },
        { campo: 'cidade', label: 'Qual a sua cidade?', placeholder: 'Ex: São Paulo - SP', tipo_campo: 'texto', obrigatorio: false },
        { campo: 'instagram', label: 'Qual o seu Instagram?', placeholder: '@seuinstagram', tipo_campo: 'texto', obrigatorio: false },
        { campo: 'whatsapp', label: 'Qual o seu WhatsApp com DDD?', placeholder: '(XX) XXXXX-XXXX', tipo_campo: 'telefone', obrigatorio: true },
      ];
      campos.forEach(c => {
        defaults.push({ tipo: 'campo_input', conteudo: { ...c, botao_texto: c.campo === 'whatsapp' ? 'Concluir cadastro' : 'Continuar →', botao_acao: c.campo === 'whatsapp' ? 'submit' : 'proxima' } });
      });
    }

    for (let i = 0; i < defaults.length; i++) {
      const { data } = await db.from('quiz_page_blocks').insert({
        quiz_id: quizId,
        page_id: pageId,
        tipo: defaults[i].tipo,
        ordem: i + 1,
        conteudo: defaults[i].conteudo,
      }).select().single();
      if (data) setBlocks(prev => [...prev, data]);
    }
  }, [quizId]);

  return {
    blocks, loading,
    loadBlocks, getPageBlocks,
    addBlock, updateBlock, deleteBlock,
    reorderBlocks, createDefaultBlocks,
  };
}
