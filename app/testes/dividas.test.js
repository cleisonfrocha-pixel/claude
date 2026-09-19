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
