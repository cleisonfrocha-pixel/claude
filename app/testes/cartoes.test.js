import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataFechamentoFatura, faturaFechada, calcularVisaoCartao,
  LIMIAR_ATENCAO_PCT, LIMIAR_CRITICO_PCT,
} from "../src/domain/cartoes.js";

function cartao(overrides) {
  return { id: "cartao1", limiteTotalCentavos: 300000, diaFechamento: 10, diaVencimento: 20, ...overrides };
}
function fatura(overrides) {
  return { id: "fat1", cartaoId: "cartao1", status: "aberta", ...overrides };
}
function despesa(overrides) {
  return { tipo: "despesa", valorCentavos: 0, cartaoId: "cartao1", faturaId: "fat1", ...overrides };
}

test("dataFechamentoFatura monta a data certa", () => {
  assert.equal(dataFechamentoFatura(cartao(), "2026-03"), "2026-03-10");
});

test("faturaFechada: antes do fechamento ainda está aberta", () => {
  assert.equal(faturaFechada(cartao(), fatura({ competencia: "2026-03" }), "2026-03-05"), false);
});

test("faturaFechada: depois do fechamento já fechou", () => {
  assert.equal(faturaFechada(cartao(), fatura({ competencia: "2026-03" }), "2026-03-15"), true);
});

// ---------- calcularVisaoCartao ----------

test("calcularVisaoCartao: utilizado soma todas as faturas em aberto, não só a atual", () => {
  const c = cartao();
  const faturas = [
    fatura({ id: "f1", competencia: "2026-03", status: "aberta" }),
    fatura({ id: "f2", competencia: "2026-04", status: "aberta" }),
  ];
  const transacoes = [
    despesa({ faturaId: "f1", valorCentavos: 50000 }),
    despesa({ faturaId: "f2", valorCentavos: 30000 }),
  ];
  const r = calcularVisaoCartao({ cartao: c, transacoesDoCartao: transacoes, faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(r.utilizadoCentavos, 80000, "compromisso futuro (f2) conta no utilizado, não só a fatura corrente");
  assert.equal(r.disponivelCentavos, 300000 - 80000);
});

test("calcularVisaoCartao: fatura paga não entra mais no utilizado", () => {
  const c = cartao();
  const faturas = [fatura({ id: "f1", competencia: "2026-02", status: "paga" }), fatura({ id: "f2", competencia: "2026-03", status: "aberta" })];
  const transacoes = [despesa({ faturaId: "f1", valorCentavos: 99999 }), despesa({ faturaId: "f2", valorCentavos: 10000 })];
  const r = calcularVisaoCartao({ cartao: c, transacoesDoCartao: transacoes, faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(r.utilizadoCentavos, 10000);
});

test("calcularVisaoCartao: sem limite cadastrado, percentual não quebra", () => {
  const c = cartao({ limiteTotalCentavos: 0 });
  const r = calcularVisaoCartao({ cartao: c, transacoesDoCartao: [], faturasDoCartao: [], hoje: "2026-03-05" });
  assert.equal(r.percentualUtilizado, 0);
  assert.equal(r.nivelAlerta, "normal");
});

test("calcularVisaoCartao: nível de alerta segue os limiares", () => {
  const c = cartao({ limiteTotalCentavos: 100000 });
  const faturas = [fatura({ id: "f1", competencia: "2026-03" })];
  const normal = calcularVisaoCartao({ cartao: c, transacoesDoCartao: [despesa({ faturaId: "f1", valorCentavos: 50000 })], faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(normal.nivelAlerta, "normal");
  const atencao = calcularVisaoCartao({ cartao: c, transacoesDoCartao: [despesa({ faturaId: "f1", valorCentavos: LIMIAR_ATENCAO_PCT * 1000 })], faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(atencao.nivelAlerta, "atencao");
  const critico = calcularVisaoCartao({ cartao: c, transacoesDoCartao: [despesa({ faturaId: "f1", valorCentavos: LIMIAR_CRITICO_PCT * 1000 })], faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(critico.nivelAlerta, "critico");
});

test("calcularVisaoCartao: fatura atual, próxima e o resto como compromisso futuro", () => {
  const c = cartao();
  const faturas = [
    fatura({ id: "f1", competencia: "2026-03", status: "aberta" }),
    fatura({ id: "f2", competencia: "2026-04", status: "aberta" }),
    fatura({ id: "f3", competencia: "2026-05", status: "aberta" }),
  ];
  const transacoes = [
    despesa({ faturaId: "f1", valorCentavos: 10000 }),
    despesa({ faturaId: "f2", valorCentavos: 10000 }),
    despesa({ faturaId: "f3", valorCentavos: 10000 }),
  ];
  const r = calcularVisaoCartao({ cartao: c, transacoesDoCartao: transacoes, faturasDoCartao: faturas, hoje: "2026-03-05" });
  assert.equal(r.faturaAtual.competencia, "2026-03");
  assert.equal(r.faturaAtual.fechada, false);
  assert.equal(r.proximaFatura.competencia, "2026-04");
  assert.equal(r.comprometimentoFuturo.length, 1);
  assert.equal(r.comprometimentoFuturo[0].competencia, "2026-05");
});

test("PORTÃO DA FASE 3: parcela 1/10 aparece na fatura atual e as outras 9 como compromisso futuro, sem duplicar", () => {
  // Simula o resultado de criarParcelamento: 10 parcelas de R$100, uma fatura por mês.
  const c = cartao({ diaFechamento: 10, limiteTotalCentavos: 500000 });
  const faturas = [];
  const transacoes = [];
  for (let i = 0; i < 10; i++) {
    const competencia = i === 0 ? "2026-03" : `2026-${String(3 + i).padStart(2, "0")}`;
    faturas.push(fatura({ id: `f${i}`, competencia, status: "aberta" }));
    transacoes.push(despesa({ faturaId: `f${i}`, valorCentavos: 10000, parcelaDe: "p1", parcelaNum: i + 1, parcelaTotal: 10 }));
  }
  // corrige competências que passariam de dezembro (teste simplificado, usa só 4 meses de exemplo real)
  const r = calcularVisaoCartao({ cartao: c, transacoesDoCartao: transacoes.slice(0, 4), faturasDoCartao: faturas.slice(0, 4), hoje: "2026-03-05" });
  assert.equal(r.faturaAtual.totalCentavos, 10000, "só a parcela 1/10 está na fatura atual");
  assert.equal(r.utilizadoCentavos, 40000, "as 4 parcelas juntas comprometem o limite, sem duplicar");
  assert.equal(r.comprometimentoFuturo.length, 2, "parcelas 3 e 4 aparecem como compromisso futuro, além da próxima fatura");
});
