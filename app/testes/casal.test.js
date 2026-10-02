// O casal de teste (testes/fixtures/casal.js) passando pelo motor inteiro.
// Cada número aqui foi conferido à mão; o comentário ao lado mostra a conta.
// Se algum mudar, é porque a regra mudou — confira a conta antes de
// "consertar" o teste.

import { test } from "node:test";
import assert from "node:assert/strict";
import { montarCasal, HOJE, COMPETENCIA } from "./fixtures/casal.js";
import { calcularClarezaDeCaixa } from "../src/domain/caixa.js";
import { calcularCustos, calcularMargem } from "../src/domain/orcamento.js";
import { calcularVisaoConsolidada, statusDivida } from "../src/domain/dividas.js";
import { calcularVisaoPorPessoa } from "../src/domain/pessoas.js";
import { montarBaseCenarios, compararCenarios } from "../src/domain/cenarios.js";
import { calcularHorizonte } from "../src/domain/projecao.js";
import { gastoDiaADiaMensal } from "../src/domain/previstos.js";
import { calcularDespesasForaDoPadrao } from "../src/domain/diagnostico.js";
import { diagnosticarCausaDeficit, calcularRendaAtual } from "../src/domain/renda.js";
import { detectarAchados } from "../src/domain/decisoes.js";

const { estado: E, pendencias } = montarCasal();
const porNome = (lista, nome, campo = "nome") => lista.find((x) => x[campo] === nome);
const clareza = calcularClarezaDeCaixa({ ...E, hoje: HOJE, horizonteDias: 30 });
const custos = calcularCustos(E.transacoes, E.categorias, COMPETENCIA);
const visaoDividas = calcularVisaoConsolidada(E.dividas, HOJE);

test("casal: tudo que foi mandado pelo chat entrou, sem pendência", () => {
  assert.deepEqual(pendencias, []);
});

test("casal: pagamento de fatura cai na fatura que fechou, mesmo no cartão que fecha dia 25 e vence dia 5", () => {
  const itau = porNome(E.cartoes, "Itaú Click", "apelido");
  const roxinho = porNome(E.cartoes, "Roxinho", "apelido");
  const status = (cartao) => Object.fromEntries(E.faturas.filter((f) => f.cartaoId === cartao.id).map((f) => [f.competencia, f.status]));
  // Pago em 05/08 = fatura de julho (fechou 25/07); em 05/09 = agosto. Setembro fecha 25/09 e vence 05/10: em aberto.
  assert.deepEqual(status(itau), { "2026-07": "paga", "2026-08": "paga", "2026-09": "aberta" });
  assert.deepEqual(status(roxinho), { "2026-07": "paga", "2026-08": "paga", "2026-09": "paga", "2026-10": "aberta" });
});

test("casal: parcela paga no extrato fica ligada à dívida e conta só a de setembro (as antigas já estavam no cadastro)", () => {
  const carro = porNome(E.dividas, "Financiamento carro");
  const emprestimo = porNome(E.dividas, "Empréstimo pessoal");
  assert.equal(carro.parcelasPagas, 20, "19 no cadastro + a de 15/09");
  assert.equal(emprestimo.parcelasPagas, 6, "5 no cadastro + a de 20/09");
  assert.equal(statusDivida(carro, HOJE), "ativa", "não pode aparecer como atrasada");
  assert.equal(statusDivida(emprestimo, HOJE), "ativa");
  assert.equal(E.transacoes.filter((t) => t.dividaId === carro.id).length, 3, "julho, agosto e setembro ficam ligados");
});

test("casal: dinheiro seguro para gastar = o menor saldo dos próximos 30 dias, contando salário, parcelas e contas mensais", () => {
  assert.equal(clareza.saldoAtualCentavos, 162000); // 1.240 + 380
  assert.equal(clareza.saldoReservaCentavos, 90000);
  // Sai: fatura Itaú 420 (05/10), aluguel 1.800 + fatura Roxinho 1.420 (10/10),
  // carro 1.150 + internet 120 (15/10), empréstimo 480 (20/10).
  assert.equal(clareza.comprometidoCentavos, 539000);
  // Entra: salário dela 3.200 (05/10) + piso dele 5.600, o pior mês fechado (12/10).
  assert.equal(clareza.entradasPrevistasCentavos, 880000);
  // 1.620 → 05/10: 4.400 → 10/10: 1.180 (o ponto mais baixo) → 12/10: 6.780 ...
  assert.equal(clareza.seguroParaGastarCentavos, 118000);
  assert.equal(clareza.diaMaisApertado, "2026-10-10");
  assert.equal(clareza.livreCentavos, 162000 - 539000, "livre = se nada entrasse");
});

test("casal: custos do mês com a parcela fora do essencial e margem sem contar a parcela duas vezes", () => {
  assert.equal(custos.essencialCentavos, 359100); // aluguel 1.800 + luz 251 + internet 120 + mercado 1.030 + gasolina 390
  assert.equal(custos.dividasCentavos, 163000); // 1.150 + 480
  assert.equal(custos.atualCentavos, 569690);
  assert.equal(custos.discricionarioCentavos, 47590); // restaurante 420 + streaming 55,90
  assert.equal(custos.faturaSemDetalheCentavos, 0);
  const renda = calcularRendaAtual(E.transacoes, COMPETENCIA);
  assert.equal(renda, 1010000);
  assert.equal(calcularMargem({ rendaAtualCentavos: renda, custoEssencialCentavos: custos.essencialCentavos, comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos }), 487900);
  const causa = diagnosticarCausaDeficit({
    rendaAtualCentavos: renda, custoEssencialCentavos: custos.essencialCentavos, custoAtualCentavos: custos.atualCentavos,
    custoDividasPagasCentavos: custos.dividasCentavos, comprometimentoMensalDividasCentavos: visaoDividas.comprometimentoMensalCentavos,
    seguroParaGastarCentavos: clareza.seguroParaGastarCentavos,
  });
  assert.equal(causa.temDeficit, false, "mês com sobra de 4.403 não é déficit");
});

test("casal: saldo das dívidas é o valor de quitar hoje, e nenhuma com acordo aparece atrasada", () => {
  // Carro: 28 parcelas de 1.150 a 1,8% ≈ 25.119,63. Empréstimo: 12 de 480 a 4,5% ≈ 4.376,92.
  // Serasa: 4.200 + 850 sem acordo.
  assert.equal(visaoDividas.saldoTotalAtualCentavos, 2511963 + 437692 + 420000 + 85000);
  assert.equal(visaoDividas.comprometimentoMensalCentavos, 163000);
  assert.equal(visaoDividas.quantidadeSoAtrasadas, 0);
  assert.equal(visaoDividas.quantidadeNegativadas, 2);
});

test("casal: por pessoa, cada um cobre o próprio mês e a soma fecha com a casa", () => {
  const v = calcularVisaoPorPessoa({ ...E, competencia: COMPETENCIA, hoje: HOJE });
  const cleison = v.pessoas.find((p) => p.nome === "Cleison");
  const ana = v.pessoas.find((p) => p.nome === "Ana");
  assert.equal(cleison.numeros.coberturaCentavos, 205000); // 6.900 − 3.220 − 1.630
  assert.equal(ana.numeros.coberturaCentavos, 282900); // 3.200 − 371
  assert.equal(v.casa.coberturaCentavos, 487900);
  assert.equal(v.semDono, null);
  assert.deepEqual(v.repasses.map((r) => r.totalCentavos), [80000]);
});

test("casal: caminhos partem da média dos meses fechados, descontam a parcela uma vez e o conservador usa o pior mês dele", () => {
  const base = montarBaseCenarios({ ...E, clareza, competencia: COMPETENCIA, hoje: HOJE });
  assert.equal(base.mesesHistorico, 2, "julho e agosto; setembro está em andamento");
  assert.equal(base.rendaMediaCentavos, 1010000); // (11.400 + 8.800) / 2
  assert.equal(base.custoEssencialCentavos, 395750); // (3.970 + 3.945) / 2
  assert.equal(base.discricionarioCentavos, 32090); // (405,90 + 235,90) / 2
  assert.equal(base.rendaGarantidaCentavos, 880000); // 3.200 dela + 5.600, o pior mês dele
  assert.equal(base.caixaCentavos, 162000);
  const c = compararCenarios(base);
  const atual = c.cenarios.find((x) => x.id === "atual").resultado;
  assert.equal(atual.sobraMensalInicialCentavos, 419160); // 10.100 − 3.957,50 − 320,90 − 1.630
  assert.equal(c.cenarios.find((x) => x.id === "conservador").resultado.viavel, true);
  assert.equal(c.recomendado.id, "quitacao");
  assert.equal(c.cenarios.find((x) => x.id === "quitacao").resultado.mesNomeLimpo, 1);
});

test("casal: projeção de 30 dias com o gasto do dia a dia na média dos últimos meses", () => {
  const gasto = gastoDiaADiaMensal({ ...E, competencia: COMPETENCIA });
  assert.equal(gasto, 235840); // média de 4.375,90 e 4.180,90 sem parcelas, menos aluguel e internet já projetados
  const h = calcularHorizonte({ ...E, gastoDiaADiaMensalCentavos: gasto, saldoInicialCentavos: clareza.saldoAtualCentavos, hoje: HOJE, dias: 30 });
  assert.equal(h.entradasSeguroCentavos, 880000);
  assert.equal(h.saidasSeguroCentavos, 539000 + 235840);
  assert.equal(h.saldoFinalSeguroCentavos, 162000 + 880000 - 539000 - 235840);
});

test("casal: só alerta o que é de verdade", () => {
  // Nenhum "fora do padrão" inventado por mês sem dado antes do histórico:
  // só o restaurante (420 contra a média de 265).
  const fora = calcularDespesasForaDoPadrao(E.transacoes, COMPETENCIA);
  assert.deepEqual(fora.map((f) => E.categorias.find((c) => c.id === f.categoriaId).nome), ["Lazer"]);
  const achados = detectarAchados({ clareza, dividas: E.dividas, hoje: HOJE, foraDoPadrao: fora });
  const chaves = achados.map((a) => a.chave).sort();
  assert.deepEqual(chaves, ["despesa_fora_padrao", "divida_negativada", "divida_negativada"]);
});
