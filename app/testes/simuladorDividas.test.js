import { test } from "node:test";
import assert from "node:assert/strict";
import { simularAporteExtra, simularQuitacaoAntecipada, compararRitmos } from "../src/domain/simuladorDividas.js";

// ---------- simularAporteExtra — sem juros ----------

test("simularAporteExtra: sem juros, aporte extra encurta o prazo na proporção certa", () => {
  const r = simularAporteExtra({
    saldoAtualCentavos: 500000, valorParcelaCentavos: 100000, taxaJurosMensalPct: null, aporteExtraCentavos: 50000,
  });
  assert.equal(r.base.meses, 5, "500000 / 100000 = 5 parcelas");
  assert.equal(r.base.jurosTotalCentavos, 0);
  assert.equal(r.comAporte.meses, 4, "500000 / 150000 arredonda pra cima -> 4 meses");
  assert.equal(r.mesesEconomizados, 1);
  assert.equal(r.jurosEconomizadosCentavos, 0, "sem juros cadastrados, não há juros a economizar");
  assert.equal(r.impactoMensalCentavos, 50000, "o impacto mensal é exatamente o aporte extra");
});

// ---------- simularAporteExtra — com juros (caminho mês a mês verificado à mão) ----------

test("simularAporteExtra: com juros, mostra prazo novo E juros economizados", () => {
  const r = simularAporteExtra({
    saldoAtualCentavos: 10000, valorParcelaCentavos: 6000, taxaJurosMensalPct: 10, aporteExtraCentavos: 9000,
  });
  // Mês 1: juros 1000 (10% de 10000) -> saldo 11000 -> paga 6000 -> saldo 5000.
  // Mês 2: juros 500 (10% de 5000) -> saldo 5500 -> paga 5500 -> saldo 0.
  assert.equal(r.base.meses, 2);
  assert.equal(r.base.jurosTotalCentavos, 1500);
  // Com aporte (parcela vira 15000): mês 1: juros 1000 -> saldo 11000 -> paga 11000 -> saldo 0.
  assert.equal(r.comAporte.meses, 1);
  assert.equal(r.comAporte.jurosTotalCentavos, 1000);
  assert.equal(r.mesesEconomizados, 1);
  assert.equal(r.jurosEconomizadosCentavos, 500);
});

test("simularAporteExtra: pagamento que não cobre nem os juros nunca quita", () => {
  const r = simularAporteExtra({
    saldoAtualCentavos: 100000, valorParcelaCentavos: 1000, taxaJurosMensalPct: 50, aporteExtraCentavos: 0,
  });
  assert.equal(r.base.quitada, false);
  assert.equal(r.base.meses, 1200, "bate no limite de segurança sem nunca zerar o saldo");
});

// ---------- simularQuitacaoAntecipada ----------

test("simularQuitacaoAntecipada: abate o saldo hoje, mantém a parcela, sem impacto mensal", () => {
  const r = simularQuitacaoAntecipada({
    saldoAtualCentavos: 500000, valorParcelaCentavos: 100000, taxaJurosMensalPct: null, valorPagamentoUnicoCentavos: 200000,
  });
  assert.equal(r.base.meses, 5);
  assert.equal(r.comAporte.meses, 3, "300000 restantes / 100000 = 3 meses");
  assert.equal(r.mesesEconomizados, 2);
  assert.equal(r.impactoMensalCentavos, 0, "a parcela mensal não muda, só o saldo de hoje");
});

test("simularQuitacaoAntecipada: pagamento maior que o saldo simplesmente quita tudo", () => {
  const r = simularQuitacaoAntecipada({
    saldoAtualCentavos: 100000, valorParcelaCentavos: 50000, taxaJurosMensalPct: null, valorPagamentoUnicoCentavos: 999999,
  });
  assert.equal(r.comAporte.meses, 0);
  assert.equal(r.comAporte.quitada, true);
});

// ---------- compararRitmos ----------

test("compararRitmos: cada ritmo devolve seu próprio prazo e juros, lado a lado", () => {
  const r = compararRitmos({
    saldoAtualCentavos: 500000, taxaJurosMensalPct: null,
    ritmos: [
      { nome: "Ritmo atual", valorParcelaCentavos: 100000 },
      { nome: "Ritmo acelerado", valorParcelaCentavos: 250000 },
    ],
  });
  assert.equal(r.length, 2);
  assert.equal(r[0].meses, 5);
  assert.equal(r[1].meses, 2);
});

// ---------- PORTÃO DA FASE 6 (simulador) ----------

test("PORTÃO DA FASE 6: simular um aporte de R$ 500/mês mostra prazo novo, juros economizados e impacto mensal", () => {
  // Dívida real: R$ 12.000 restantes, parcela de R$ 1.000/mês, juros de 1,5% a.m.
  const dividaReal = Object.freeze({ saldoAtualCentavos: 1200000, valorParcelaCentavos: 100000, taxaJurosMensalPct: 1.5 });
  const r = simularAporteExtra({ ...dividaReal, aporteExtraCentavos: 50000 }); // + R$ 500/mês

  assert.ok(r.comAporte.meses < r.base.meses, "PRAZO NOVO: deveria ser mais curto que o atual");
  assert.ok(r.jurosEconomizadosCentavos > 0, "JUROS ECONOMIZADOS: deveria ser positivo, já que há juros cadastrados");
  assert.equal(r.impactoMensalCentavos, 50000, "IMPACTO MENSAL: exatamente o aporte simulado, R$ 500,00");

  // A dívida "real" passada para a simulação não foi tocada — Object.freeze
  // já teria lançado erro se a função tentasse escrever nela.
  assert.equal(dividaReal.saldoAtualCentavos, 1200000);
});
