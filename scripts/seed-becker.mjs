import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://obguidmfvfjaekaskgob.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iZ3VpZG1mdmZqYWVrYXNrZ29iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ1MDYsImV4cCI6MjA5MTQyMDUwNn0.PEbZbWCLM-0Fvl8fi5E95t8G6i_LRZPyQrq4Crk03CY';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const BECKER_ORG_ID = '81b1ba7b-5c03-45c5-a74a-6ea8eb3432ae';

// ── Seed function (inline — transpiled from seedQuizBecker.ts) ─────────────
async function seedQuizBecker(quizId) {
  console.log(`\nSeedando quiz ${quizId}...`);

  // BLOCOS
  const { data: blocos, error: bErr } = await db
    .from('quiz_blocos')
    .insert([
      { quiz_id: quizId, titulo: 'Aquecimento', ordem: 1 },
      { quiz_id: quizId, titulo: 'Perfil Pessoal', ordem: 2 },
      { quiz_id: quizId, titulo: 'Potencial Comercial', ordem: 3 },
      { quiz_id: quizId, titulo: 'Segurança Financeira', ordem: 4 },
    ])
    .select();
  if (bErr) { console.error('Erro ao criar blocos:', bErr.message); throw bErr; }
  console.log(`  ✓ ${blocos.length} blocos criados`);
  const [b1, b2, b3, b4] = blocos;

  // BLOCO 1 — AQUECIMENTO
  const { data: aq, error: aqErr } = await db
    .from('quiz_perguntas')
    .insert([
      { bloco_id: b1.id, texto: 'Por que você quer começar a vender semijoias agora?', ordem: 1 },
      { bloco_id: b1.id, texto: 'Se você começasse hoje, quanto gostaria de ganhar por mês?', ordem: 2 },
    ])
    .select();
  if (aqErr) throw aqErr;

  await db.from('quiz_opcoes').insert([
    { pergunta_id: aq[0].id, texto: 'Renda extra', pontos: 0, reprova_imediato: false, ordem: 1 },
    { pergunta_id: aq[0].id, texto: 'Trabalhar de casa', pontos: 0, reprova_imediato: false, ordem: 2 },
    { pergunta_id: aq[0].id, texto: 'Ter meu próprio negócio', pontos: 0, reprova_imediato: false, ordem: 3 },
    { pergunta_id: aq[0].id, texto: 'Independência financeira', pontos: 0, reprova_imediato: false, ordem: 4 },
    { pergunta_id: aq[1].id, texto: 'Até R$500', pontos: 0, reprova_imediato: false, ordem: 1 },
    { pergunta_id: aq[1].id, texto: 'R$500 a R$1.000', pontos: 0, reprova_imediato: false, ordem: 2 },
    { pergunta_id: aq[1].id, texto: 'R$1.000 a R$3.000', pontos: 0, reprova_imediato: false, ordem: 3 },
    { pergunta_id: aq[1].id, texto: 'Mais de R$3.000', pontos: 0, reprova_imediato: false, ordem: 4 },
  ]);
  console.log(`  ✓ Bloco 1: 2 perguntas, 8 opções`);

  // BLOCO 2 — PERFIL PESSOAL
  const { data: pIdade } = await db
    .from('quiz_perguntas')
    .insert({ bloco_id: b2.id, texto: 'Qual sua idade?', ordem: 1 })
    .select().single();

  await db.from('quiz_opcoes').insert([
    { pergunta_id: pIdade.id, texto: 'Menos de 18 anos', pontos: 0, reprova_imediato: true, ordem: 1 },
    { pergunta_id: pIdade.id, texto: '18 a 24 anos', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pIdade.id, texto: '25 a 34 anos', pontos: 2, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pIdade.id, texto: '35 a 44 anos', pontos: 2, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pIdade.id, texto: '45 a 54 anos', pontos: 1, reprova_imediato: false, ordem: 5 },
    { pergunta_id: pIdade.id, texto: '+55 anos', pontos: 1, reprova_imediato: false, ordem: 6 },
  ]);

  const { data: pFilhos } = await db
    .from('quiz_perguntas')
    .insert({ bloco_id: b2.id, texto: 'Você tem filhos?', ordem: 2 })
    .select().single();

  const { data: filhosOps } = await db.from('quiz_opcoes').insert([
    { pergunta_id: pFilhos.id, texto: 'Não tenho filhos', pontos: 3, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pFilhos.id, texto: 'Sim, tenho 1 filho', pontos: 2, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pFilhos.id, texto: 'Sim, tenho 2 filhos', pontos: 1, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pFilhos.id, texto: 'Sim, tenho 3 ou mais filhos', pontos: 0, reprova_imediato: false, ordem: 4 },
  ]).select();

  const { data: pFilhoIdade } = await db
    .from('quiz_perguntas')
    .insert({
      bloco_id: b2.id,
      texto: 'Qual a idade do seu filho mais novo?',
      ordem: 3,
      condicao_pergunta_id: pFilhos.id,
      condicao_opcao_id: filhosOps[1].id,
    })
    .select().single();

  if (pFilhoIdade) {
    await db.from('quiz_opcoes').insert([
      { pergunta_id: pFilhoIdade.id, texto: 'Menos de 7 anos', pontos: 0, reprova_imediato: false, ordem: 1 },
      { pergunta_id: pFilhoIdade.id, texto: '7 a 14 anos', pontos: 1, reprova_imediato: false, ordem: 2 },
      { pergunta_id: pFilhoIdade.id, texto: 'Mais de 14 anos', pontos: 2, reprova_imediato: false, ordem: 3 },
    ]);
  }

  const { data: pApoio } = await db
    .from('quiz_perguntas')
    .insert({ bloco_id: b2.id, texto: 'Você tem rede de apoio?', ordem: 4 })
    .select().single();
  await db.from('quiz_opcoes').insert([
    { pergunta_id: pApoio.id, texto: 'Sim, tenho apoio total', pontos: 2, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pApoio.id, texto: 'Tenho apoio parcial', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pApoio.id, texto: 'Não tenho apoio, mas consigo me organizar', pontos: 0, reprova_imediato: false, ordem: 3 },
  ]);

  const { data: pMarido } = await db
    .from('quiz_perguntas')
    .insert({ bloco_id: b2.id, texto: 'Você mora com marido/companheiro?', ordem: 5 })
    .select().single();
  await db.from('quiz_opcoes').insert([
    { pergunta_id: pMarido.id, texto: 'Sim', pontos: 1, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pMarido.id, texto: 'Não', pontos: 0, reprova_imediato: false, ordem: 2 },
  ]);
  console.log(`  ✓ Bloco 2: 5 perguntas (1 condicional)`);

  // BLOCO 3 — POTENCIAL COMERCIAL
  const { data: pc, error: pcErr } = await db
    .from('quiz_perguntas')
    .insert([
      { bloco_id: b3.id, texto: 'Hoje você atua em qual dessas áreas?', ordem: 1 },
      { bloco_id: b3.id, texto: 'Qual sua situação atual?', ordem: 2 },
      { bloco_id: b3.id, texto: 'Hoje você já vende algum produto ou serviço?', ordem: 3 },
      { bloco_id: b3.id, texto: 'Por quais meios você pretende vender?', ordem: 4 },
      { bloco_id: b3.id, texto: 'Quantas horas por semana consegue dedicar?', ordem: 5 },
      { bloco_id: b3.id, texto: 'Quando gostaria de começar?', ordem: 6 },
      { bloco_id: b3.id, texto: 'Você já tentou vender semijoias antes?', ordem: 7 },
      { bloco_id: b3.id, texto: 'Seu Instagram hoje está ativo?', ordem: 8 },
    ])
    .select();
  if (pcErr) throw pcErr;

  await db.from('quiz_opcoes').insert([
    { pergunta_id: pc[0].id, texto: 'Enfermagem / Técnica de enfermagem', pontos: 3, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[0].id, texto: 'Professora / área da educação', pontos: 3, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[0].id, texto: 'Beleza / estética / salão', pontos: 2, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[0].id, texto: 'Comércio / atendimento / vendas', pontos: 2, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[0].id, texto: 'Recepção / clínica / administrativo', pontos: 1, reprova_imediato: false, ordem: 5 },
    { pergunta_id: pc[0].id, texto: 'Outra área', pontos: 0, reprova_imediato: false, ordem: 6 },
    { pergunta_id: pc[1].id, texto: 'CLT', pontos: 5, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[1].id, texto: 'MEI com atividade e renda recorrente', pontos: 4, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[1].id, texto: 'Empreendedora com negócio próprio', pontos: 4, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[1].id, texto: 'Autônoma / renda informal / revenda catálogo', pontos: 2, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[1].id, texto: 'Do lar', pontos: 1, reprova_imediato: false, ordem: 5 },
    { pergunta_id: pc[1].id, texto: 'Desempregada', pontos: 0, reprova_imediato: false, ordem: 6 },
    { pergunta_id: pc[2].id, texto: 'Sim, vendo com frequência', pontos: 3, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[2].id, texto: 'Sim, vendo às vezes', pontos: 2, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[2].id, texto: 'Hoje não, mas já vendi', pontos: 1, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[2].id, texto: 'Nunca vendi', pontos: 0, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[3].id, texto: 'WhatsApp', pontos: 1, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[3].id, texto: 'Instagram / Facebook', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[3].id, texto: 'Presencialmente', pontos: 2, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[3].id, texto: 'Já tenho clientes', pontos: 3, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[3].id, texto: 'Ainda não sei, mas quero aprender', pontos: 0, reprova_imediato: false, ordem: 5 },
    { pergunta_id: pc[4].id, texto: 'Não tenho certeza', pontos: 0, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[4].id, texto: 'Menos de 5 horas/semana', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[4].id, texto: 'De 5 a 10 horas/semana', pontos: 3, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[4].id, texto: 'Mais de 10 horas/semana', pontos: 4, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[5].id, texto: 'Imediatamente', pontos: 4, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[5].id, texto: 'Em até 7 dias', pontos: 3, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[5].id, texto: 'Ainda estou avaliando', pontos: 0, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[6].id, texto: 'Sim, tive sucesso', pontos: 3, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[6].id, texto: 'Nunca tentei', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[6].id, texto: 'Estou prestes a tentar', pontos: 1, reprova_imediato: false, ordem: 3 },
    { pergunta_id: pc[6].id, texto: 'Tentei, mas não deu certo', pontos: 0, reprova_imediato: false, ordem: 4 },
    { pergunta_id: pc[7].id, texto: 'Sim, posto com frequência', pontos: 2, reprova_imediato: false, ordem: 1 },
    { pergunta_id: pc[7].id, texto: 'Tenho, mas posto pouco', pontos: 1, reprova_imediato: false, ordem: 2 },
    { pergunta_id: pc[7].id, texto: 'Quase não uso', pontos: 0, reprova_imediato: false, ordem: 3 },
  ]);
  console.log(`  ✓ Bloco 3: 8 perguntas`);

  // BLOCO 4 — SEGURANÇA FINANCEIRA
  const { data: sf, error: sfErr } = await db
    .from('quiz_perguntas')
    .insert([
      { bloco_id: b4.id, texto: 'Para começar no consignado, você tem pelo menos uma dessas opções?', ordem: 1 },
      { bloco_id: b4.id, texto: 'Seu nome está negativado hoje?', ordem: 2 },
      { bloco_id: b4.id, texto: 'Você aceita as regras do consignado?', ordem: 3 },
    ])
    .select();
  if (sfErr) throw sfErr;

  await db.from('quiz_opcoes').insert([
    { pergunta_id: sf[0].id, texto: 'Tenho os dois', pontos: 5, reprova_imediato: false, ordem: 1 },
    { pergunta_id: sf[0].id, texto: 'Cartão de crédito', pontos: 4, reprova_imediato: false, ordem: 2 },
    { pergunta_id: sf[0].id, texto: 'Tenho uma reserva para custos iniciais', pontos: 3, reprova_imediato: false, ordem: 3 },
    { pergunta_id: sf[0].id, texto: 'Não tenho nenhum dos dois', pontos: 1, reprova_imediato: false, ordem: 4 },
    { pergunta_id: sf[1].id, texto: 'Sim, está negativado', pontos: 1, reprova_imediato: false, ordem: 1 },
    { pergunta_id: sf[1].id, texto: 'Não', pontos: 5, reprova_imediato: false, ordem: 2 },
    { pergunta_id: sf[2].id, texto: 'Sim, aceito as regras', pontos: 0, reprova_imediato: false, ordem: 1 },
    { pergunta_id: sf[2].id, texto: 'Não', pontos: 0, reprova_imediato: true, ordem: 2 },
  ]);
  console.log(`  ✓ Bloco 4: 3 perguntas`);
  console.log(`\n✅ Seed concluído com sucesso!`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Seed Quiz Becker ===\n');

  // ETAPA 1: verificar se já existe quiz com slug 'becker'
  console.log('Etapa 1: Verificando se existe quiz com slug "becker"...');
  const { data: existing, error: fetchErr } = await db
    .from('quizzes')
    .select('*')
    .eq('slug', 'becker')
    .maybeSingle();

  if (fetchErr) {
    console.error('Erro ao consultar quizzes:', fetchErr.message);
    process.exit(1);
  }

  let quizId;

  if (existing) {
    console.log(`  → Quiz encontrado! ID: ${existing.id}`);
    console.log(`    titulo: ${existing.titulo}`);
    console.log(`    ativo: ${existing.ativo}`);
    quizId = existing.id;

    // Verificar se já tem perguntas
    const { count } = await db
      .from('quiz_perguntas')
      .select('id', { count: 'exact', head: true })
      .in('bloco_id',
        (await db.from('quiz_blocos').select('id').eq('quiz_id', quizId)).data?.map(b => b.id) || []
      );

    if (count > 0) {
      console.log(`\n⚠️  Quiz já possui ${count} pergunta(s). Seed não executado para evitar duplicatas.`);
      console.log('   Se quiser re-seedar, apague os blocos/perguntas/opções primeiro.');
      process.exit(0);
    }
  } else {
    // ETAPA 2: criar o quiz
    console.log('  → Quiz não encontrado. Criando...');
    const { data: newQuiz, error: createErr } = await db
      .from('quizzes')
      .insert({
        org_id: BECKER_ORG_ID,
        titulo: 'Revendedora Becker',
        slug: 'becker',
        cor_primaria: '#cc785c',
        corte_verde: 35,
        corte_amarelo: 25,
        redirect_whatsapp: '5519999999999',
        mensagem_aprovado: 'Parabéns! Seu perfil foi aprovado. Preencha seus dados para continuar.',
        mensagem_reprovado: 'Obrigada pela participação! No momento seu perfil não se encaixa no que buscamos.',
        ativo: true,
      })
      .select()
      .single();

    if (createErr) {
      console.error('Erro ao criar quiz:', createErr.message);
      process.exit(1);
    }

    quizId = newQuiz.id;
    console.log(`  → Quiz criado! ID: ${quizId}`);
  }

  // ETAPA 3: seed
  console.log('\nEtapa 3: Executando seed...');
  await seedQuizBecker(quizId);

  // ETAPA 4: verificar resultado
  console.log('\nEtapa 4: Verificando dados inseridos...');
  const { data: blocos } = await db.from('quiz_blocos').select('id, titulo, ordem').eq('quiz_id', quizId).order('ordem');
  const blocoIds = blocos.map(b => b.id);
  const { count: totalPergs } = await db
    .from('quiz_perguntas')
    .select('id', { count: 'exact', head: true })
    .in('bloco_id', blocoIds);

  const pergIds = (await db.from('quiz_perguntas').select('id').in('bloco_id', blocoIds)).data?.map(p => p.id) || [];
  const { count: totalOps } = await db
    .from('quiz_opcoes')
    .select('id', { count: 'exact', head: true })
    .in('pergunta_id', pergIds);

  console.log(`\n📊 Resultado final:`);
  console.log(`  Blocos: ${blocos.length}`);
  blocos.forEach(b => console.log(`    - ${b.titulo} (ordem ${b.ordem})`));
  console.log(`  Total de perguntas: ${totalPergs}`);
  console.log(`  Total de opções: ${totalOps}`);
  console.log(`\n🔗 Acesse: http://localhost:8080/quiz/becker`);
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
