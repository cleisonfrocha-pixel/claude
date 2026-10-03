import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularClarezaDeCaixa } from "../src/domain/caixa.js";
import { cartoesNoCaixa } from "../src/domain/cartaoNoCaixa.js";

const conta = { id: "k", status: "ativa", saldoInicialCentavos: 500000, dataSaldoInicial: "2026-09-01" };
const nubank = { id: "c1", apelido: "Nubank PF", status: "ativo", limiteTotalCentavos: 400000, diaFechamento: 11, diaVencimento: 18, diaPagamentoHabitual: 12, contaPagamentoId: "k" };
const hoje = "2026-10-02";
const compra = (o) => ({ tipo: "despesa", status: "pago", cartaoId: "c1", faturaId: "f1", competencia: "2026-10", data: "2026-10-01", valorCentavos: 100000, descricao: "Compra", ...o });
const faturas = [{ id: "f1", cartaoId: "c1", competencia: "2026-10", status: "aberta" }];
const lerTudo = (transacoes, extra = {}) => {
  const caixa = calcularClarezaDeCaixa({ contas: [conta], transacoes, faturas, cartoes: [nubank], dividas: [], recorrencias: [], fontesRenda: [], hoje, ...extra });
  return { caixa, c: cartoesNoCaixa({ cartoes: [nubank], faturas, transacoes, pontos: caixa.pontos, naContaCentavos: caixa.saldoAtualCentavos, hoje })[0] };
};

test("compra no cartão não mexe no saldo de hoje, reduz o limite e aparece na fatura do dia habitual", () => {
  const { caixa, c } = lerTudo([compra({})]);
  assert.equal(caixa.saldoAtualCentavos, 500000);
  assert.equal(c.limiteLivreCentavos, 300000);
  assert.equal(c.proximaFatura.jaNaFaturaCentavos, 100000);
  assert.equal(c.proximaFatura.saiEm, "2026-10-12");
  assert.equal(c.proximaFatura.vence, "2026-10-18");
  assert.equal(c.caixaCobreAFatura, true);
});

test("quanto cabe: o menor entre o limite livre e a folga do caixa no dia da fatura", () => {
  const { c } = lerTudo([compra({})]);
  assert.equal(c.folgaNoDiaCentavos, 400000);
  assert.equal(c.quantoCabeCentavos, 300000); // limite decide
  assert.equal(c.limiteDecide, true);
  const apertado = lerTudo([compra({}), { tipo: "despesa", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", data: "2026-10-13", valorCentavos: 350000, descricao: "Aluguel" }]).c;
  assert.equal(apertado.folgaNoDiaCentavos, 50000);
  assert.equal(apertado.quantoCabeCentavos, 50000); // caixa decide
  assert.equal(apertado.limiteDecide, false);
});

test("fatura que o caixa não cobre é sinalizada", () => {
  const { c } = lerTudo([compra({ valorCentavos: 100000 }), { tipo: "despesa", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", data: "2026-10-12", valorCentavos: 450000, descricao: "Obra" }]);
  assert.equal(c.caixaCobreAFatura, false);
  assert.equal(c.quantoCabeCentavos, 0);
});

test("limite e saldo da conta nunca são somados: o limite livre não vira dinheiro na conta", () => {
  const { caixa, c } = lerTudo([]);
  assert.equal(caixa.saldoAtualCentavos, 500000);
  assert.equal(c.limiteLivreCentavos, 400000);
});
