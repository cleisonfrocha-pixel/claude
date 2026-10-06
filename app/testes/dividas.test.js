import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularSaldoAtual, parcelasRestantes, dataProximoVencimento, dataEstimadaQuitacao,
  statusDivida, calcularVisaoConsolidada,
} from "../src/domain/dividas.js";

function divida(overrides) {
  return {
    nome: "Financiamento", pessoaId: "p1", saldoOriginalCentavos: 1200000,
    valorParcelaCentavos: 100000, quantidadeParcelas: 12, parcelasPagas: 0,
    dataInicio: "2026-01-10", taxaJurosMensalPct: null, emRisco: false,
    ...overrides,
  };
}

// ---------- calcularSaldoAtual ----------

test("calcularSaldoAtual: original menos o que já foi pago", () => {
  const d = divida({ parcelasPagas: 3 });
  assert.equal(calcularSaldoAtual(d), 1200000 - 3 * 100000);
});

test("calcularSaldoAtual: nunca fica negativo mesmo com mais parcelas pagas que o esperado", () => {
  const d = divida({ quantidadeParcelas: 12, parcelasPagas: 20, valorParcelaCentavos: 100000, saldoOriginalCentavos: 1200000 });
  assert.equal(calcularSaldoAtual(d), 0);
});

test("calcularSaldoAtual: não some antes da hora quando o principal cadastrado exclui juros embutidos na parcela", () => {
  // Principal 5.000, parcela 600 × 10 = 6.000: 1.000 de juros embutidos
  // (taxa implícita ~3,46% a.m.). Original menos pago zeraria na 9ª
  // parcela com 1 ainda por pagar. Valor presente da última: 600/1,0346.
  const d = divida({ saldoOriginalCentavos: 500000, valorParcelaCentavos: 60000, quantidadeParcelas: 10, parcelasPagas: 9 });
  const saldo = calcularSaldoAtual(d);
  assert.ok(saldo > 57500 && saldo < 58500, `saldo ${saldo}`);
  assert.equal(calcularSaldoAtual({ ...d, parcelasPagas: 0 }), 500000, "no início, o saldo é o principal");
});

test("calcularSaldoAtual: com taxa informada, é o valor de quitar hoje (sem os juros futuros)", () => {
  // 29 parcelas de 1.150 a 1,8% a.m. valem ~25.79 mil hoje, não 33.350.
  const d = divida({ saldoOriginalCentavos: 3200000, valorParcelaCentavos: 115000, quantidadeParcelas: 48, parcelasPagas: 19, taxaJurosMensalPct: 1.8 });
  const saldo = calcularSaldoAtual(d);
  assert.ok(saldo > 2570000 && saldo < 2590000, `saldo ${saldo}`);
});

test("calcularSaldoAtual: com o principal batendo exatamente (sem juros separados), comportamento não muda", () => {
  const d = divida({ saldoOriginalCentavos: 1200000, valorParcelaCentavos: 100000, quantidadeParcelas: 12, parcelasPagas: 9 });
  assert.equal(calcularSaldoAtual(d), 300000);
});

// ---------- parcelasRestantes ----------

test("parcelasRestantes: total menos pagas", () => {
  assert.equal(parcelasRestantes(divida({ quantidadeParcelas: 12, parcelasPagas: 5 })), 7);
});

// ---------- datas ----------

test("dataProximoVencimento: primeira parcela ainda não paga vence na data de início", () => {
  const d = divida({ dataInicio: "2026-01-10", parcelasPagas: 0 });
  assert.equal(dataProximoVencimento(d), "2026-01-10");
});

test("dataProximoVencimento: rola o mês mantendo o dia", () => {
  const d = divida({ dataInicio: "2026-01-10", parcelasPagas: 3 });
  assert.equal(dataProximoVencimento(d), "2026-04-10");
});

test("dataProximoVencimento: null quando já está quitada", () => {
  const d = divida({ quantidadeParcelas: 12, parcelasPagas: 12 });
  assert.equal(dataProximoVencimento(d), null);
});

test("dataEstimadaQuitacao: data da última parcela", () => {
  const d = divida({ dataInicio: "2026-01-10", quantidadeParcelas: 12 });
  assert.equal(dataEstimadaQuitacao(d), "2026-12-10");
});

// ---------- statusDivida ----------

test("statusDivida: quitada quando não sobra parcela", () => {
  const d = divida({ quantidadeParcelas: 12, parcelasPagas: 12 });
  assert.equal(statusDivida(d, "2026-06-01"), "quitada");
});

test("statusDivida: atrasada quando a próxima parcela já venceu", () => {
  const d = divida({ dataInicio: "2026-01-10", parcelasPagas: 2 }); // próxima em 2026-03-10
  assert.equal(statusDivida(d, "2026-04-01"), "atrasada");
});

test("statusDivida: ativa quando em dia", () => {
  const d = divida({ dataInicio: "2026-01-10", parcelasPagas: 2 }); // próxima em 2026-03-10
  assert.equal(statusDivida(d, "2026-03-01"), "ativa");
});

// ---------- calcularVisaoConsolidada ----------

test("calcularVisaoConsolidada: soma saldo, comprometimento e conta atrasadas — dívida quitada não entra no comprometimento", () => {
  const dividas = [
    divida({ nome: "Carro", saldoOriginalCentavos: 1200000, valorParcelaCentavos: 100000, quantidadeParcelas: 12, parcelasPagas: 2, dataInicio: "2026-01-10" }),
    divida({ nome: "Cartão parcelado", saldoOriginalCentavos: 500000, valorParcelaCentavos: 50000, quantidadeParcelas: 10, parcelasPagas: 10, dataInicio: "2025-01-10" }), // quitada
    divida({ nome: "Empréstimo atrasado", saldoOriginalCentavos: 300000, valorParcelaCentavos: 100000, quantidadeParcelas: 3, parcelasPagas: 0, dataInicio: "2026-01-05" }),
  ];
  const v = calcularVisaoConsolidada(dividas, "2026-03-01");
  assert.equal(v.quantidadeAtivas, 2, "a quitada não conta como ativa");
  assert.equal(v.quantidadeAtrasadas, 1);
  assert.equal(v.saldoTotalAtualCentavos, (1200000 - 2 * 100000) + (300000 - 0));
  assert.equal(v.comprometimentoMensalCentavos, 100000 + 100000, "só as ativas somam no comprometimento mensal");
  assert.equal(v.saldoTotalOriginalCentavos, 1200000 + 500000 + 300000, "o original soma todas, inclusive quitadas");
});

test("calcularVisaoConsolidada: data de quitação total é a mais distante entre as ativas", () => {
  const dividas = [
    divida({ dataInicio: "2026-01-10", quantidadeParcelas: 6, parcelasPagas: 0 }), // quita em 2026-06-10
    divida({ dataInicio: "2026-01-10", quantidadeParcelas: 24, parcelasPagas: 0 }), // quita em 2027-12-10
  ];
  const v = calcularVisaoConsolidada(dividas, "2026-02-01");
  assert.equal(v.dataQuitacaoTotal, "2027-12-10");
});

test("dívida paga com trabalho (cota da GEDI): o saldo cai a cada abatimento, não pede dinheiro e não atrasa", async () => {
  const { classificarDivida } = await import("../src/domain/dividas.js");
  const { validarDivida, padraoDivida } = await import("../src/domain/esquema.js");
  const cota = divida({
    nome: "Cota GEDI", pagaComTrabalho: true, saldoOriginalCentavos: 2500000, valorComJurosCentavos: 1200000, valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0,
    dataInicio: "2026-12-24", abatimentoDesde: "2026-10-03", abatimentoMensalCentavos: 350000, abatimentoDia: 24, abatimentoAte: "2026-12",
    abatimentosUnicos: [{ data: "2026-10-05", valorCentavos: 150000 }],
  });
  assert.equal(calcularSaldoAtual(cota, "2026-10-03"), 1200000);
  assert.equal(calcularSaldoAtual(cota, "2026-10-05"), 1050000);   // aporte do Del Poente
  assert.equal(calcularSaldoAtual(cota, "2026-10-24"), 700000);    // + 3.500 do trabalho
  assert.equal(calcularSaldoAtual(cota, "2026-12-24"), 0);          // zera em dezembro
  assert.equal(calcularSaldoAtual(cota, "2027-03-01"), 0);          // não passa de zero nem abate depois do fim
  assert.equal(dataEstimadaQuitacao(cota), "2026-12-24");
  assert.equal(statusDivida(cota, "2026-11-30"), "ativa");          // nunca "atrasada"
  assert.equal(statusDivida(cota, "2026-12-24"), "quitada");
  assert.equal(classificarDivida(cota, "2026-10-10"), "trabalho");
  const v = calcularVisaoConsolidada([cota], "2026-10-10");
  assert.equal(v.quantidadeSemAcordo, 0);
  assert.equal(v.quantidadeProblemas, 0);
  assert.deepEqual(validarDivida(padraoDivida({ ...cota, pessoaId: "p1" })), []);
});

test("evolução da dívida: pago + previsto + depois somam o total (financiamento e cota paga com trabalho)", async () => {
  const { evolucaoDaDivida } = await import("../src/domain/dividas.js");
  const jeep = divida({ nome: "Jeep", saldoOriginalCentavos: 19898220, valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 20, dataInicio: "2025-03-04" });
  const e = evolucaoDaDivida(jeep, "2026-10-03");
  assert.equal(e.totalCentavos, 331637 * 60);
  assert.equal(e.pagoCentavos, 331637 * 20);
  assert.equal(e.previstoCentavos, 331637 * 12);
  assert.equal(e.depoisCentavos, 331637 * 28);
  assert.equal(e.pagoCentavos + e.previstoCentavos + e.depoisCentavos, e.totalCentavos);
  assert.equal(e.unidadesRestantes, 40);
  assert.equal(e.previstoAte, "2027-10-04");
  const cota = divida({
    nome: "Cota", pagaComTrabalho: true, saldoOriginalCentavos: 2500000, valorComJurosCentavos: 1200000, valorParcelaCentavos: 0, quantidadeParcelas: 1, dataInicio: "2026-12-24",
    abatimentoDesde: "2026-10-03", abatimentoMensalCentavos: 350000, abatimentoDia: 24, abatimentoAte: "2026-12", abatimentosUnicos: [{ data: "2026-10-05", valorCentavos: 150000 }],
  });
  const c = evolucaoDaDivida(cota, "2026-10-03");
  // A barra parte dos R$ 12.000 de 03/10, não dos R$ 25.000 originais (13.5 item 33).
  assert.equal(c.totalCentavos, 1200000);
  assert.equal(c.pagoCentavos, 0);
  assert.equal(c.previstoCentavos, 1200000);
  assert.equal(c.depoisCentavos, 0);
  assert.equal(c.pagoCentavos + c.previstoCentavos + c.depoisCentavos, c.totalCentavos);
  assert.equal(c.previstoAte, "2026-12-24");
  assert.equal(evolucaoDaDivida(cota, "2026-11-30").pagoCentavos, 150000 + 700000);
});

test("cotação de quitação: vale a do banco menos as parcelas pagas depois; sem cotação, o valor presente na taxa do contrato", async () => {
  const { cotacaoDeQuitacao } = await import("../src/domain/dividas.js");
  const jeep = divida({ nome: "Jeep", saldoOriginalCentavos: 9890000, valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 21, dataInicio: "2025-02-04", taxaJurosMensalPct: 2.4525, quitacaoInformadaCentavos: 8554186, quitacaoInformadaEm: "2026-10-05", quitacaoParcelasPagas: 20 });
  const c = cotacaoDeQuitacao(jeep, "2026-10-06");
  assert.equal(c.origem, "banco");
  assert.equal(c.valorCentavos, 8554186 - 331637);          // a parcela de outubro foi paga depois da cotação
  assert.equal(c.velha, false);
  assert.equal(c.somaDasParcelasCentavos, 331637 * 39);
  assert.equal(cotacaoDeQuitacao(jeep, "2026-12-01").velha, true);
  const sem = cotacaoDeQuitacao({ ...jeep, quitacaoInformadaCentavos: 0 }, "2026-10-06");
  assert.equal(sem.origem, "estimativa");
  assert.ok(sem.valorCentavos > 8000000 && sem.valorCentavos < 8500000);   // PV de 39 parcelas a 2,4525% a.m. ≈ R$ 82,7 mil
});

import { sujaONome, calcularVisaoConsolidada as visaoDiv } from "../src/domain/dividas.js";
import { placarNomeLimpo } from "../src/domain/esteira.js";
test("13.4 item 25: nome sujo é uma regra só (negativada ou protestada, sem contar a mesma dívida duas vezes)", () => {
  const ds = [
    { id: "a", nome: "Serasa", negativada: true, saldoOriginalCentavos: 1000, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2026-01-01" },
    { id: "b", nome: "Protesto", protestada: true, saldoOriginalCentavos: 1000, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2026-01-01" },
    { id: "c", nome: "Protesto da mesma", protestada: true, mesmaDividaDe: "a", saldoOriginalCentavos: 1000, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2026-01-01" },
  ];
  assert.deepEqual(ds.map(sujaONome), [true, true, false]);
  assert.equal(visaoDiv(ds, "2026-10-06").quantidadeNegativadas, placarNomeLimpo(ds).total);
});

import { evolucaoDaDivida, cotacaoDeQuitacao, statusDivida as statusDiv } from "../src/domain/dividas.js";
test("13.5 item 33: dívida paga com trabalho mostra só o que o trabalho abateu", () => {
  const gedi = { id: "g", nome: "Cota GEDI", pagaComTrabalho: true, saldoOriginalCentavos: 2500000, valorComJurosCentavos: 1200000, abatimentoDesde: "2026-10-03", abatimentoDia: 24, abatimentoMensalCentavos: 350000, abatimentoAte: "2026-12", abatimentosUnicos: [{ data: "2026-10-05", valorCentavos: 150000 }] };
  const e = evolucaoDaDivida(gedi, "2026-10-06");
  assert.equal(e.totalCentavos, 1200000);
  assert.equal(e.pagoCentavos, 150000);
  assert.equal(e.faltaCentavos, 1050000);
});

test("13.5 item 34: cotação de quitação só desconta parcela paga depois do dia da cotação", () => {
  const jeep = { id: "j", valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 21, quitacaoInformadaCentavos: 8554186, quitacaoInformadaEm: "2026-10-05", quitacaoParcelasPagas: 20, dataInicio: "2025-02-04" };
  const pagas = [{ dividaId: "j", tipo: "despesa", status: "pago", data: "2026-10-03", pagoEm: "2026-10-03" }];
  assert.equal(cotacaoDeQuitacao(jeep, "2026-10-06", pagas).valorCentavos, 8554186);
  const depois = [...pagas, { dividaId: "j", tipo: "despesa", status: "pago", data: "2026-11-04", pagoEm: "2026-11-04" }];
  assert.equal(cotacaoDeQuitacao({ ...jeep, parcelasPagas: 22 }, "2026-11-05", depois).valorCentavos, 8554186 - 331637);
});

test("13.5 item 37: dívida sem acordo não fica atrasada nem em dia pela data em que foi cadastrada", () => {
  const bb = { id: "b", negativada: true, saldoOriginalCentavos: 1711873, quantidadeParcelas: 1, parcelasPagas: 0, valorParcelaCentavos: 0, dataInicio: "2026-10-05" };
  assert.equal(statusDiv(bb, "2026-10-04"), "ativa");
  assert.equal(statusDiv(bb, "2026-10-06"), "ativa");
});
