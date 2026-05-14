-- ================================================================
-- SEED QUIZ BECKER — versão limpa
-- Quiz ID : b9d1186f-13b7-41d3-9656-21f95ec78fd4
-- Execute no Supabase SQL Editor
-- ================================================================

DO $$
DECLARE
  v_quiz_id UUID := 'b9d1186f-13b7-41d3-9656-21f95ec78fd4';

  -- IDs dos blocos
  b1 UUID; b2 UUID; b3 UUID; b4 UUID;

  -- IDs das perguntas do bloco 2
  p_idade      UUID;
  p_filhos     UUID;
  p_filhoIdade UUID;
  p_apoio      UUID;
  p_marido     UUID;
  op_sim1      UUID;   -- ID da opção "Sim, tenho 1 filho"

  -- IDs das perguntas do bloco 3
  p_area       UUID;
  p_situacao   UUID;
  p_vendas     UUID;
  p_meios      UUID;
  p_horas      UUID;
  p_quando     UUID;
  p_semijoia   UUID;
  p_instagram  UUID;

  -- IDs das perguntas do bloco 4
  p_consignado UUID;
  p_negativo   UUID;
  p_regras     UUID;

BEGIN

  -- ── 0. LIMPAR DADOS ANTERIORES ──────────────────────────────────
  DELETE FROM quiz_opcoes
   WHERE pergunta_id IN (
     SELECT qp.id
       FROM quiz_perguntas qp
       JOIN quiz_blocos    qb ON qb.id = qp.bloco_id
      WHERE qb.quiz_id = v_quiz_id
   );

  DELETE FROM quiz_perguntas
   WHERE bloco_id IN (
     SELECT id FROM quiz_blocos WHERE quiz_id = v_quiz_id
   );

  DELETE FROM quiz_blocos WHERE quiz_id = v_quiz_id;

  -- ── 1. BLOCOS ────────────────────────────────────────────────────
  INSERT INTO quiz_blocos (quiz_id, titulo, ordem) VALUES
    (v_quiz_id, 'Aquecimento',          1),
    (v_quiz_id, 'Perfil Pessoal',       2),
    (v_quiz_id, 'Potencial Comercial',  3),
    (v_quiz_id, 'Segurança Financeira', 4);

  SELECT id INTO b1 FROM quiz_blocos WHERE quiz_id = v_quiz_id AND ordem = 1;
  SELECT id INTO b2 FROM quiz_blocos WHERE quiz_id = v_quiz_id AND ordem = 2;
  SELECT id INTO b3 FROM quiz_blocos WHERE quiz_id = v_quiz_id AND ordem = 3;
  SELECT id INTO b4 FROM quiz_blocos WHERE quiz_id = v_quiz_id AND ordem = 4;

  -- ── 2. BLOCO 1 — AQUECIMENTO ────────────────────────────────────
  -- Pergunta 1
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b1, 'Por que você quer começar a vender semijoias agora?', 1)
  RETURNING id INTO p_area;   -- reutiliza variável como temp

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_area, 'Renda extra',               0, false, 1),
    (p_area, 'Trabalhar de casa',         0, false, 2),
    (p_area, 'Ter meu próprio negócio',   0, false, 3),
    (p_area, 'Independência financeira',  0, false, 4);

  -- Pergunta 2
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b1, 'Se você começasse hoje, quanto gostaria de ganhar por mês?', 2)
  RETURNING id INTO p_area;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_area, 'Até R$500',          0, false, 1),
    (p_area, 'R$500 a R$1.000',    0, false, 2),
    (p_area, 'R$1.000 a R$3.000',  0, false, 3),
    (p_area, 'Mais de R$3.000',    0, false, 4);

  -- ── 3. BLOCO 2 — PERFIL PESSOAL ─────────────────────────────────

  -- Pergunta 3 — Qual sua idade?
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

  -- Pergunta 4 — Você tem filhos?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você tem filhos?', 2)
  RETURNING id INTO p_filhos;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_filhos, 'Não tenho filhos',            3, false, 1),
    (p_filhos, 'Sim, tenho 1 filho',          2, false, 2),
    (p_filhos, 'Sim, tenho 2 filhos',         1, false, 3),
    (p_filhos, 'Sim, tenho 3 ou mais filhos', 0, false, 4);

  SELECT id INTO op_sim1
    FROM quiz_opcoes
   WHERE pergunta_id = p_filhos AND texto = 'Sim, tenho 1 filho';

  -- Pergunta 5 — Qual a idade do filho mais novo? (condicional)
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem, condicao_pergunta_id, condicao_opcao_id)
    VALUES (b2, 'Qual a idade do seu filho mais novo?', 3, p_filhos, op_sim1)
  RETURNING id INTO p_filhoIdade;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_filhoIdade, 'Menos de 7 anos', 0, false, 1),
    (p_filhoIdade, '7 a 14 anos',     1, false, 2),
    (p_filhoIdade, 'Mais de 14 anos', 2, false, 3);

  -- Pergunta 6 — Você tem rede de apoio?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você tem rede de apoio?', 4)
  RETURNING id INTO p_apoio;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_apoio, 'Sim, tenho apoio total',                    2, false, 1),
    (p_apoio, 'Tenho apoio parcial',                       1, false, 2),
    (p_apoio, 'Não tenho apoio, mas consigo me organizar', 0, false, 3);

  -- Pergunta 7 — Você mora com marido/companheiro?
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b2, 'Você mora com marido/companheiro?', 5)
  RETURNING id INTO p_marido;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_marido, 'Sim', 1, false, 1),
    (p_marido, 'Não', 0, false, 2);

  -- ── 4. BLOCO 3 — POTENCIAL COMERCIAL ────────────────────────────

  -- Pergunta 8 — Área de atuação
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Hoje você atua em qual dessas áreas?', 1)
  RETURNING id INTO p_area;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_area, 'Enfermagem / Técnica de enfermagem',  3, false, 1),
    (p_area, 'Professora / área da educação',       3, false, 2),
    (p_area, 'Beleza / estética / salão',           2, false, 3),
    (p_area, 'Comércio / atendimento / vendas',     2, false, 4),
    (p_area, 'Recepção / clínica / administrativo', 1, false, 5),
    (p_area, 'Outra área',                          0, false, 6);

  -- Pergunta 9 — Situação atual
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Qual sua situação atual?', 2)
  RETURNING id INTO p_situacao;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_situacao, 'CLT',                                          5, false, 1),
    (p_situacao, 'MEI com atividade e renda recorrente',         4, false, 2),
    (p_situacao, 'Empreendedora com negócio próprio',            4, false, 3),
    (p_situacao, 'Autônoma / renda informal / revenda catálogo', 2, false, 4),
    (p_situacao, 'Do lar',                                       1, false, 5),
    (p_situacao, 'Desempregada',                                 0, false, 6);

  -- Pergunta 10 — Experiência em vendas
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Hoje você já vende algum produto ou serviço?', 3)
  RETURNING id INTO p_vendas;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_vendas, 'Sim, vendo com frequência',  3, false, 1),
    (p_vendas, 'Sim, vendo às vezes',        2, false, 2),
    (p_vendas, 'Hoje não, mas já vendi',     1, false, 3),
    (p_vendas, 'Nunca vendi',                0, false, 4);

  -- Pergunta 11 — Meios de venda
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Por quais meios você pretende vender?', 4)
  RETURNING id INTO p_meios;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_meios, 'WhatsApp',                          1, false, 1),
    (p_meios, 'Instagram / Facebook',              1, false, 2),
    (p_meios, 'Presencialmente',                   2, false, 3),
    (p_meios, 'Já tenho clientes',                 3, false, 4),
    (p_meios, 'Ainda não sei, mas quero aprender', 0, false, 5);

  -- Pergunta 12 — Horas por semana
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Quantas horas por semana consegue dedicar?', 5)
  RETURNING id INTO p_horas;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_horas, 'Não tenho certeza',        0, false, 1),
    (p_horas, 'Menos de 5 horas/semana', 1, false, 2),
    (p_horas, 'De 5 a 10 horas/semana',  3, false, 3),
    (p_horas, 'Mais de 10 horas/semana', 4, false, 4);

  -- Pergunta 13 — Quando começar
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Quando gostaria de começar?', 6)
  RETURNING id INTO p_quando;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_quando, 'Imediatamente',         4, false, 1),
    (p_quando, 'Em até 7 dias',         3, false, 2),
    (p_quando, 'Ainda estou avaliando', 0, false, 3);

  -- Pergunta 14 — Tentou vender semijoias
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Você já tentou vender semijoias antes?', 7)
  RETURNING id INTO p_semijoia;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_semijoia, 'Sim, tive sucesso',        3, false, 1),
    (p_semijoia, 'Nunca tentei',             1, false, 2),
    (p_semijoia, 'Estou prestes a tentar',   1, false, 3),
    (p_semijoia, 'Tentei, mas não deu certo',0, false, 4);

  -- Pergunta 15 — Instagram ativo
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b3, 'Seu Instagram hoje está ativo?', 8)
  RETURNING id INTO p_instagram;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_instagram, 'Sim, posto com frequência', 2, false, 1),
    (p_instagram, 'Tenho, mas posto pouco',    1, false, 2),
    (p_instagram, 'Quase não uso',             0, false, 3);

  -- ── 5. BLOCO 4 — SEGURANÇA FINANCEIRA ───────────────────────────

  -- Pergunta 16 — Consignado
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b4, 'Para começar no consignado, você tem pelo menos uma dessas opções?', 1)
  RETURNING id INTO p_consignado;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_consignado, 'Tenho os dois',                          5, false, 1),
    (p_consignado, 'Cartão de crédito',                      4, false, 2),
    (p_consignado, 'Tenho uma reserva para custos iniciais', 3, false, 3),
    (p_consignado, 'Não tenho nenhum dos dois',              1, false, 4);

  -- Pergunta 17 — Negativado
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b4, 'Seu nome está negativado hoje?', 2)
  RETURNING id INTO p_negativo;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_negativo, 'Sim, está negativado', 1, false, 1),
    (p_negativo, 'Não',                  5, false, 2);

  -- Pergunta 18 — Aceita as regras
  INSERT INTO quiz_perguntas (bloco_id, texto, ordem)
    VALUES (b4, 'Você aceita as regras do consignado?', 3)
  RETURNING id INTO p_regras;

  INSERT INTO quiz_opcoes (pergunta_id, texto, pontos, reprova_imediato, ordem) VALUES
    (p_regras, 'Sim, aceito as regras', 0, false, 1),
    (p_regras, 'Não',                   0, true,  2);

  RAISE NOTICE 'Seed concluído com sucesso!';

END $$;

-- ── VERIFICAÇÃO FINAL ────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM quiz_blocos
    WHERE quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4'
  ) AS blocos,

  (SELECT count(*) FROM quiz_perguntas
    WHERE bloco_id IN (
      SELECT id FROM quiz_blocos
       WHERE quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4'
    )
  ) AS perguntas,

  (SELECT count(*) FROM quiz_opcoes
    WHERE pergunta_id IN (
      SELECT qp.id
        FROM quiz_perguntas qp
        JOIN quiz_blocos    qb ON qb.id = qp.bloco_id
       WHERE qb.quiz_id = 'b9d1186f-13b7-41d3-9656-21f95ec78fd4'
    )
  ) AS opcoes;
