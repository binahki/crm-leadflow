-- ============================================================
-- SEED QUIZ BECKER
-- Quiz ID: b9d1186f-13b7-41d3-9656-21f95ec78fd4
-- Execute no Supabase SQL Editor (Authentication > SQL Editor)
-- ============================================================

DO $$
DECLARE
  quiz_id  UUID := 'b9d1186f-13b7-41d3-9656-21f95ec78fd4';

  -- blocos
  b1 UUID; b2 UUID; b3 UUID; b4 UUID;

  -- bloco 2
  p_idade    UUID;
  p_filhos   UUID;
  p_filhoIdade UUID;
  p_apoio    UUID;
  p_marido   UUID;
  op_sim1    UUID;  -- "Sim, tenho 1 filho"

  -- bloco 3
  pc UUID[]; -- array de 8 perguntas

  -- bloco 4
  sf UUID[]; -- array de 3 perguntas

BEGIN

  -- ── 0. Limpar dados anteriores (seguro re-rodar) ────────────────
  DELETE FROM quiz_opcoes
   WHERE pergunta_id IN (
     SELECT qp.id FROM quiz_perguntas qp
     JOIN quiz_blocos qb ON qb.id = qp.bloco_id
     WHERE qb.quiz_id = quiz_id
   );
  DELETE FROM quiz_perguntas
   WHERE bloco_id IN (SELECT id FROM quiz_blocos WHERE quiz_id = quiz_id);
  DELETE FROM quiz_blocos WHERE quiz_id = quiz_id;

  -- ── 1. BLOCOS ─────────────────────────────────────────────────────
  INSERT INTO quiz_blocos (quiz_id, titulo, ordem) VALUES
    (quiz_id, 'Aquecimento',          1),
    (quiz_id, 'Perfil Pessoal',       2),
    (quiz_id, 'Potencial Comercial',  3),
    (quiz_id, 'Segurança Financeira', 4)
  RETURNING id INTO b1;

  SELECT id INTO b1 FROM quiz_blocos WHERE quiz_id = quiz_id AND ordem = 1;
  SELECT id INTO b2 FROM quiz_blocos WHERE quiz_id = quiz_id AND ordem = 2;
  SELECT id INTO b3 FROM quiz_blocos WHERE quiz_id = quiz_id AND ordem = 3;
  SELECT id INTO b4 FROM quiz_blocos WHERE quiz_id = quiz_id AND ordem = 4;

  -- ── 2. BLOCO 1 — AQUECIMENTO ─────────────────────────────────────
  WITH ins AS (
    INSERT INTO quiz_perguntas (bloco_id, texto, ordem) VALUES
      (b1, 'Por que você quer começar a vender semijoias agora?', 1),
      (b1, 'Se você começasse hoje, quanto gostaria de ganhar por mês?',  2)
    RETURNING id, ordem
  )
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT p.id,
         o.texto, o.pontos, false, o.ord
  FROM ins p
  JOIN (VALUES
    (1, 'Renda extra',                1),
    (1, 'Trabalhar de casa',          2),
    (1, 'Ter meu próprio negócio',    3),
    (1, 'Independência financeira',   4),
    (2, 'Até R$500',                  1),
    (2, 'R$500 a R$1.000',            2),
    (2, 'R$1.000 a R$3.000',          3),
    (2, 'Mais de R$3.000',            4)
  ) AS o(pord, texto, ord) ON p.ordem = o.pord
  -- pontos todos 0
  -- (abusing JOIN to set pontos=0 in SELECT)
  -- pontos is already defaulted to 0 in table, but let's be explicit:
  ;
  -- ↑ pontos omitted → use default or fix below
  -- Re-insert properly:
  -- Actually the WITH ins above won't work cleanly for opcoes pontos.
  -- Let's do it step by step instead.

  -- Bloco 1: insert perguntas first, then opcoes
  -- (reset and do it cleanly)
  DELETE FROM quiz_perguntas WHERE bloco_id = b1;

  INSERT INTO quiz_perguntas (bloco_id, texto, ordem) VALUES
    (b1, 'Por que você quer começar a vender semijoias agora?', 1),
    (b1, 'Se você começasse hoje, quanto gostaria de ganhar por mês?',  2);

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, 0, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    (1, 'Renda extra',              1),
    (1, 'Trabalhar de casa',        2),
    (1, 'Ter meu próprio negócio',  3),
    (1, 'Independência financeira', 4),
    (2, 'Até R$500',                1),
    (2, 'R$500 a R$1.000',          2),
    (2, 'R$1.000 a R$3.000',        3),
    (2, 'Mais de R$3.000',          4)
  ) AS o(pord, texto, ord) ON qp.ordem = o.pord
  WHERE qp.bloco_id = b1;

  -- ── 3. BLOCO 2 — PERFIL PESSOAL ──────────────────────────────────

  -- Qual sua idade?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Qual sua idade?', 1)
  RETURNING id INTO p_idade;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_idade, 'Menos de 18 anos', 0, true,  1),
    (p_idade, '18 a 24 anos',     1, false, 2),
    (p_idade, '25 a 34 anos',     2, false, 3),
    (p_idade, '35 a 44 anos',     2, false, 4),
    (p_idade, '45 a 54 anos',     1, false, 5),
    (p_idade, '+55 anos',         1, false, 6);

  -- Você tem filhos?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você tem filhos?', 2)
  RETURNING id INTO p_filhos;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_filhos, 'Não tenho filhos',            3, false, 1),
    (p_filhos, 'Sim, tenho 1 filho',          2, false, 2),
    (p_filhos, 'Sim, tenho 2 filhos',         1, false, 3),
    (p_filhos, 'Sim, tenho 3 ou mais filhos', 0, false, 4);

  -- Pega o ID de "Sim, tenho 1 filho" para a condição
  SELECT id INTO op_sim1
    FROM quiz_opcoes
   WHERE pergunta_id = p_filhos AND texto = 'Sim, tenho 1 filho';

  -- Qual a idade do filho mais novo? (condicional)
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem, condicao_pergunta_id, condicao_opcao_id)
    VALUES (b2, 'Qual a idade do seu filho mais novo?', 3, p_filhos, op_sim1)
  RETURNING id INTO p_filhoIdade;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_filhoIdade, 'Menos de 7 anos', 0, false, 1),
    (p_filhoIdade, '7 a 14 anos',     1, false, 2),
    (p_filhoIdade, 'Mais de 14 anos', 2, false, 3);

  -- Você tem rede de apoio?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você tem rede de apoio?', 4)
  RETURNING id INTO p_apoio;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_apoio, 'Sim, tenho apoio total',                      2, false, 1),
    (p_apoio, 'Tenho apoio parcial',                         1, false, 2),
    (p_apoio, 'Não tenho apoio, mas consigo me organizar',   0, false, 3);

  -- Você mora com marido/companheiro?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você mora com marido/companheiro?', 5)
  RETURNING id INTO p_marido;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_marido, 'Sim', 1, false, 1),
    (p_marido, 'Não', 0, false, 2);

  -- ── 4. BLOCO 3 — POTENCIAL COMERCIAL ─────────────────────────────

  INSERT INTO quiz_perguntas (bloco_id, texto, ordem) VALUES
    (b3, 'Hoje você atua em qual dessas áreas?',             1),
    (b3, 'Qual sua situação atual?',                         2),
    (b3, 'Hoje você já vende algum produto ou serviço?',     3),
    (b3, 'Por quais meios você pretende vender?',            4),
    (b3, 'Quantas horas por semana consegue dedicar?',       5),
    (b3, 'Quando gostaria de começar?',                      6),
    (b3, 'Você já tentou vender semijoias antes?',           7),
    (b3, 'Seu Instagram hoje está ativo?',                   8);

  -- Área de atuação (ordem 1)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Enfermagem / Técnica de enfermagem',      3, 1),
    ('Professora / área da educação',           3, 2),
    ('Beleza / estética / salão',               2, 3),
    ('Comércio / atendimento / vendas',         2, 4),
    ('Recepção / clínica / administrativo',     1, 5),
    ('Outra área',                              0, 6)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 1;

  -- Situação atual (ordem 2)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('CLT',                                          5, 1),
    ('MEI com atividade e renda recorrente',         4, 2),
    ('Empreendedora com negócio próprio',            4, 3),
    ('Autônoma / renda informal / revenda catálogo', 2, 4),
    ('Do lar',                                       1, 5),
    ('Desempregada',                                 0, 6)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 2;

  -- Experiência em vendas (ordem 3)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Sim, vendo com frequência',   3, 1),
    ('Sim, vendo às vezes',         2, 2),
    ('Hoje não, mas já vendi',      1, 3),
    ('Nunca vendi',                 0, 4)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 3;

  -- Meios de venda (ordem 4)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('WhatsApp',                         1, 1),
    ('Instagram / Facebook',             1, 2),
    ('Presencialmente',                  2, 3),
    ('Já tenho clientes',                3, 4),
    ('Ainda não sei, mas quero aprender',0, 5)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 4;

  -- Horas/semana (ordem 5)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Não tenho certeza',           0, 1),
    ('Menos de 5 horas/semana',     1, 2),
    ('De 5 a 10 horas/semana',      3, 3),
    ('Mais de 10 horas/semana',     4, 4)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 5;

  -- Quando começar (ordem 6)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Imediatamente',          4, 1),
    ('Em até 7 dias',          3, 2),
    ('Ainda estou avaliando',  0, 3)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 6;

  -- Tentou vender semijoias (ordem 7)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Sim, tive sucesso',       3, 1),
    ('Nunca tentei',            1, 2),
    ('Estou prestes a tentar',  1, 3),
    ('Tentei, mas não deu certo',0,4)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 7;

  -- Instagram ativo (ordem 8)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Sim, posto com frequência', 2, 1),
    ('Tenho, mas posto pouco',    1, 2),
    ('Quase não uso',             0, 3)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b3 AND qp.ordem = 8;

  -- ── 5. BLOCO 4 — SEGURANÇA FINANCEIRA ────────────────────────────

  INSERT INTO quiz_perguntas (bloco_id, texto, ordem) VALUES
    (b4, 'Para começar no consignado, você tem pelo menos uma dessas opções?', 1),
    (b4, 'Seu nome está negativado hoje?',                                     2),
    (b4, 'Você aceita as regras do consignado?',                               3);

  -- Consignado (ordem 1)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Tenho os dois',                          5, 1),
    ('Cartão de crédito',                      4, 2),
    ('Tenho uma reserva para custos iniciais', 3, 3),
    ('Não tenho nenhum dos dois',              1, 4)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b4 AND qp.ordem = 1;

  -- Negativado (ordem 2)
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, false, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Sim, está negativado', 1, 1),
    ('Não',                  5, 2)
  ) AS o(texto, pts, ord) ON true
  WHERE qp.bloco_id = b4 AND qp.ordem = 2;

  -- Aceita regras (ordem 3) — "Não" reprova imediato
  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem)
  SELECT qp.id, o.texto, o.pts, o.reprova, o.ord
  FROM quiz_perguntas qp
  JOIN (VALUES
    ('Sim, aceito as regras', 0, false, 1),
    ('Não',                   0, true,  2)
  ) AS o(texto, pts, reprova, ord) ON true
  WHERE qp.bloco_id = b4 AND qp.ordem = 3;

  RAISE NOTICE '✅ Seed concluído!';
  RAISE NOTICE '   Blocos: 4';
  RAISE NOTICE '   Perguntas: 18 (1 condicional)';
  RAISE NOTICE '   Quiz URL: /quiz/becker';

END $$;

-- Verificação final
SELECT
  (SELECT count(*) FROM quiz_blocos    WHERE quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4') AS blocos,
  (SELECT count(*) FROM quiz_perguntas WHERE bloco_id IN (
    SELECT id FROM quiz_blocos WHERE quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4'
  )) AS perguntas,
  (SELECT count(*) FROM quiz_opcoes WHERE pergunta_id IN (
    SELECT qp.id FROM quiz_perguntas qp
    JOIN quiz_blocos qb ON qb.id = qp.bloco_id
    WHERE qb.quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4'
  )) AS opcoes;
