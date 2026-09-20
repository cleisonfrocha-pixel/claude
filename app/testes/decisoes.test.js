import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarAchados, priorizarAchados, montarPlanoVivo } from "../src/domain/decisoes.js";

function divida(overrides) {
  return {
    id: "d1", nome: "Cartão", saldoOriginalCentavos: 500000, valorParcelaCentavos: 100000,
    quantidadeParcelas: 5, parcelasPagas: 0, dataInicio: "2026-01-10", emRisco: false,
    ...overrides,
  };
}

// ---------- detectarAchados ----------

test("detectarAchados: seguro negativo vira problema de urgência alta, apontando a origem", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: -30000, livreCentavos: -30000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "caixa_seguro_negativo");
  assert.ok(a);
  assert.equal(a.tipo, "problema");
  assert.equal(a.urgencia, "alta");
  assert.equal(a.impactoCentavos, 30000);
  assert.equal(a.origem.rotulo, "Início — Dinheiro seguro para gastar");
});

test("detectarAchados: sem seguro negativo, nenhum problema de caixa aparece", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 5000, livreCentavos: 5000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.some((a) => a.chave === "caixa_seguro_negativo"), false);
});

test("detectarAchados: sobra livre relevante vira oportunidade", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 300000, livreCentavos: 300000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "caixa_sobra_livre");
  assert.ok(a);
  assert.equal(a.tipo, "oportunidade");
  assert.equal(a.urgencia, "baixa");
});

test("detectarAchados: dívida atrasada vira problema, apontando a dívida de origem", () => {
  const d = divida({ id: "d1", nome: "Financiamento", dataInicio: "2026-01-10", parcelasPagas: 0 }); // vence 2026-01-10
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "divida_atrasada");
  assert.ok(a);
  assert.equal(a.id, "divida_atrasada:d1");
  assert.equal(a.origem.id, "d1");
  assert.equal(a.impactoCentavos, 100000);
});

test("detectarAchados: dívida quitada não gera nenhum achado", () => {
  const d = divida({ id: "d1", quantidadeParcelas: 5, parcelasPagas: 5 });
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.some((a) => a.origem?.id === "d1"), false);
});

test("detectarAchados: dívida em risco (mas não atrasada) vira risco, sem duplicar com o achado de atraso", () => {
  const d = divida({ id: "d1", dataInicio: "2026-03-01", parcelasPagas: 0, emRisco: true });
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.filter((a) => a.origem?.id === "d1").length, 1);
  assert.equal(achados[0].chave, "divida_em_risco");
});

test("detectarAchados: cartão no limite vira risco de urgência alta; perto do limite, média", () => {
  const cartoesVisao = [
    { cartaoId: "c1", apelido: "Roxinho", visao: { nivelAlerta: "critico", disponivelCentavos: 1000, percentualUtilizado: 95 } },
    { cartaoId: "c2", apelido: "Azul", visao: { nivelAlerta: "atencao", disponivelCentavos: 20000, percentualUtilizado: 75 } },
    { cartaoId: "c3", apelido: "Verde", visao: { nivelAlerta: "normal", disponivelCentavos: 400000, percentualUtilizado: 10 } },
  ];
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [], cartoesVisao, hoje: "2026-03-01" });
  const critico = achados.find((a) => a.origem.id === "c1");
  const atencao = achados.find((a) => a.origem.id === "c2");
  assert.equal(critico.urgencia, "alta");
  assert.equal(atencao.urgencia, "media");
  assert.equal(achados.some((a) => a.origem.id === "c3"), false, "cartão normal não gera achado");
});

test("detectarAchados: saída crítica de 30 dias vira risco, urgência alta se for em até 7 dias", () => {
  const horizonte30d = { saidaCritica: { data: "2026-03-05", gapCentavos: 20000, itens: [{ descricao: "IPTU" }] } };
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, horizonte30d, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "projecao_saida_critica");
  assert.equal(a.urgencia, "alta", "5 dias de distância é dentro da janela de 7 dias");
  assert.equal(a.prazo, "2026-03-05");
});

// ---------- detectarAchados — Fase 10 (§17, §24) ----------

const BASE = { clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" };

test("PORTÃO DA FASE 10 (§9/§24): todo achado com lançamento concreto carrega dados.lancamentos", () => {
  const achados = detectarAchados({
    ...BASE,
    clareza: { seguroParaGastarCentavos: -30000, livreCentavos: -30000, detalhes: { compromissos: [{ descricao: "Aluguel", valorCentavos: 30000, data: "2026-03-05" }] } },
  });
  const a = achados.find((x) => x.chave === "caixa_seguro_negativo");
  assert.equal(a.dados.lancamentos.length, 1);
  assert.equal(a.dados.lancamentos[0].descricao, "Aluguel");
});

test("detectarAchados: despesa fora do padrão vira risco apontando a categoria e os lançamentos", () => {
  const foraDoPadrao = [{ categoriaId: "cat1", nomeCategoria: "Mercado", valorCentavos: 80000, mediaCentavos: 40000, percentualAcima: 100, lancamentos: [{ descricao: "Supermercado X", valorCentavos: 80000, data: "2026-03-10" }] }];
  const achados = detectarAchados({ ...BASE, foraDoPadrao });
  const a = achados.find((x) => x.chave === "despesa_fora_padrao");
  assert.ok(a);
  assert.equal(a.tipo, "risco");
  assert.equal(a.origem.id, "cat1");
  assert.equal(a.dados.lancamentos.length, 1);
});

test("detectarAchados: categoria crescente vira risco de urgência baixa", () => {
  const categoriasCrescentes = [{ categoriaId: "cat1", nomeCategoria: "Lazer", serieCentavos: [1000, 2000, 3000], crescimentoTotalPercentual: 200, lancamentos: [] }];
  const achados = detectarAchados({ ...BASE, categoriasCrescentes });
  const a = achados.find((x) => x.chave === "categoria_crescente");
  assert.ok(a);
  assert.equal(a.urgencia, "baixa");
});

test("detectarAchados: nova recorrência de despesa vira risco; de receita vira oportunidade", () => {
  const novaRecorrencia = [
    { recorrenciaId: "r1", descricao: "Streaming", tipo: "despesa", valorEstimadoCentavos: 4000 },
    { recorrenciaId: "r2", descricao: "Bico fixo", tipo: "receita", valorEstimadoCentavos: 50000 },
  ];
  const achados = detectarAchados({ ...BASE, novaRecorrencia });
  const despesa = achados.find((x) => x.origem.id === "r1");
  const receita = achados.find((x) => x.origem.id === "r2");
  assert.equal(despesa.tipo, "risco");
  assert.equal(receita.tipo, "oportunidade");
});

test("detectarAchados: recorrência com valor realizado maior que o esperado vira risco", () => {
  const recorrenciaValorDiferente = [{ recorrenciaId: "r1", descricao: "Assinatura", esperadoCentavos: 4000, realizadoCentavos: 6000, percentual: 50, dataTransacao: "2026-03-05" }];
  const achados = detectarAchados({ ...BASE, recorrenciaValorDiferente });
  const a = achados.find((x) => x.chave === "recorrencia_valor_diferente");
  assert.equal(a.tipo, "risco");
  assert.equal(a.impactoCentavos, 2000);
});

test("detectarAchados: gasto atípico de cartão vira risco de urgência média, com os lançamentos da fatura", () => {
  const aumentoCartao = [{ cartaoId: "c1", apelido: "Roxinho", atualCentavos: 300000, mediaCentavos: 100000, percentualAcima: 200, lancamentos: [{ descricao: "Compra grande", valorCentavos: 200000 }] }];
  const achados = detectarAchados({ ...BASE, aumentoCartao });
  const a = achados.find((x) => x.chave === "cartao_aumento_atipico");
  assert.equal(a.urgencia, "media");
  assert.equal(a.dados.lancamentos.length, 1);
});

test("detectarAchados: receita esperada não recebida vira problema de urgência alta", () => {
  const receitaEsperadaNaoRecebida = [{ fonteId: "f1", nome: "Salário", valorEsperadoCentavos: 500000 }];
  const achados = detectarAchados({ ...BASE, receitaEsperadaNaoRecebida });
  const a = achados.find((x) => x.chave === "receita_esperada_nao_recebida");
  assert.equal(a.tipo, "problema");
  assert.equal(a.urgencia, "alta");
});

test("detectarAchados: receita em queda vira risco; receita em alta vira oportunidade", () => {
  const queda = detectarAchados({ ...BASE, mudancaReceita: { subiu: false, variacaoPercentual: -40, variacaoCentavos: -40000 } });
  const alta = detectarAchados({ ...BASE, mudancaReceita: { subiu: true, variacaoPercentual: 40, variacaoCentavos: 40000 } });
  assert.equal(queda.find((a) => a.chave === "receita_mudou").tipo, "risco");
  assert.equal(alta.find((a) => a.chave === "receita_mudou").tipo, "oportunidade");
});

test("detectarAchados: margem em queda vira risco; margem em alta não gera achado", () => {
  const caiu = detectarAchados({ ...BASE, mudancaMargem: { subiu: false, variacaoPercentual: -30, variacaoCentavos: -30000 } });
  const subiu = detectarAchados({ ...BASE, mudancaMargem: { subiu: true, variacaoPercentual: 30, variacaoCentavos: 30000 } });
  assert.ok(caiu.find((a) => a.chave === "margem_caiu"));
  assert.equal(subiu.some((a) => a.chave === "margem_caiu"), false);
});

test("detectarAchados: passivo aumentou vira risco de dívida aumentando", () => {
  const relacaoPatrimonio = { passivoCaiu: false, ativoSubiu: false, patrimonioSubiu: false, variacaoPassivoCentavos: 50000, variacaoAtivoCentavos: 0, variacaoPatrimonioCentavos: -50000 };
  const achados = detectarAchados({ ...BASE, relacaoPatrimonio });
  assert.ok(achados.find((a) => a.chave === "divida_aumentou"));
  assert.equal(achados.some((a) => a.chave === "patrimonio_evoluiu_positivo"), false);
});

test("detectarAchados: patrimônio líquido subiu vira oportunidade", () => {
  const relacaoPatrimonio = { passivoCaiu: true, ativoSubiu: true, patrimonioSubiu: true, variacaoPassivoCentavos: -20000, variacaoAtivoCentavos: 30000, variacaoPatrimonioCentavos: 50000 };
  const achados = detectarAchados({ ...BASE, relacaoPatrimonio });
  const a = achados.find((x) => x.chave === "patrimonio_evoluiu_positivo");
  assert.ok(a);
  assert.equal(a.tipo, "oportunidade");
  assert.equal(a.impactoCentavos, 50000);
});

// ---------- priorizarAchados ----------

test("priorizarAchados: urgência alta vem antes de média e baixa", () => {
  const achados = [
    { urgencia: "baixa", impactoCentavos: 999999 },
    { urgencia: "alta", impactoCentavos: 1 },
    { urgencia: "media", impactoCentavos: 500 },
  ];
  const r = priorizarAchados(achados);
  assert.deepEqual(r.map((a) => a.urgencia), ["alta", "media", "baixa"]);
});

test("priorizarAchados: empate de urgência desempata por impacto financeiro", () => {
  const achados = [
    { urgencia: "alta", impactoCentavos: 100 },
    { urgencia: "alta", impactoCentavos: 900 },
  ];
  const r = priorizarAchados(achados);
  assert.equal(r[0].impactoCentavos, 900);
});

// ---------- montarPlanoVivo ----------

test("PORTÃO DA FASE 7 (§9/§10): achados vão para os horizontes certos, e o plano se recalcula do zero cada vez", () => {
  const achados = [
    { id: "a", urgencia: "alta", impactoCentavos: 100, prazo: null },
    { id: "b", urgencia: "media", impactoCentavos: 50, prazo: "2026-03-04" }, // dentro de 7 dias -> esta semana
    { id: "c", urgencia: "media", impactoCentavos: 50, prazo: null }, // sem prazo -> este mês
    { id: "d", urgencia: "baixa", impactoCentavos: 10, prazo: null }, // -> 90 dias
  ];
  const plano = montarPlanoVivo(achados, "2026-03-01");
  assert.deepEqual(plano.agora.map((a) => a.id), ["a"]);
  assert.deepEqual(plano.estaSemana.map((a) => a.id), ["b"]);
  assert.deepEqual(plano.esteMes.map((a) => a.id), ["c"]);
  assert.deepEqual(plano.em90.map((a) => a.id), ["d"]);
  assert.deepEqual(plano.em12meses, []);

  // O mesmo achado resolvido (removido da lista de pendentes) simplesmente
  // não aparece mais em nenhum horizonte — não é preciso "desfazer" nada.
  const planoDepois = montarPlanoVivo(achados.filter((a) => a.id !== "a"), "2026-03-01");
  assert.deepEqual(planoDepois.agora, []);
});
