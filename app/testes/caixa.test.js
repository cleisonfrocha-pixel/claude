import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularSaldoConta, calcularComprometido, calcularClarezaDeCaixa } from "../src/domain/caixa.js";

function conta(overrides) {
  return { id: "c1", saldoInicialCentavos: 100000, dataSaldoInicial: "2026-01-01", status: "ativa", ehReserva: false, ...overrides };
}
function t(overrides) {
  return { tipo: "despesa", valorCentavos: 0, data: "2026-01-15", competencia: "2026-01", status: "pago", contaId: "c1", ...overrides };
}

// ---------- calcularSaldoConta ----------

test("calcularSaldoConta: soma receitas e despesas pagas depois do saldo inicial", () => {
  const c = conta();
  const transacoes = [
    t({ tipo: "receita", valorCentavos: 50000 }),
    t({ tipo: "despesa", valorCentavos: 20000 }),
  ];
  assert.equal(calcularSaldoConta(c, transacoes), 100000 + 50000 - 20000);
});

test("calcularSaldoConta: não conta transação de outra conta", () => {
  const c = conta();
  const transacoes = [t({ tipo: "receita", valorCentavos: 999999, contaId: "outra-conta" })];
  assert.equal(calcularSaldoConta(c, transacoes), 100000);
});

test("calcularSaldoConta: não conta transação pendente (ainda não é dinheiro de verdade)", () => {
  const c = conta();
  const transacoes = [t({ tipo: "despesa", valorCentavos: 50000, status: "previsto" })];
  assert.equal(calcularSaldoConta(c, transacoes), 100000);
});

test("calcularSaldoConta: não conta de novo o que já está embutido no saldo inicial (mesma data ou antes)", () => {
  const c = conta({ dataSaldoInicial: "2026-01-15" });
  const transacoes = [t({ tipo: "receita", valorCentavos: 50000, data: "2026-01-15" }), t({ tipo: "receita", valorCentavos: 1, data: "2026-01-10" })];
  assert.equal(calcularSaldoConta(c, transacoes), 100000);
});

test("calcularSaldoConta: transferência entre contas soma numa e subtrai na outra, sem sobrar nem faltar", () => {
  const origem = conta({ id: "origem", saldoInicialCentavos: 100000 });
  const destino = conta({ id: "destino", saldoInicialCentavos: 50000 });
  const transacoes = [
    t({ tipo: "transferencia", valorCentavos: 30000, contaId: "origem", direcao: "saida" }),
    t({ tipo: "transferencia", valorCentavos: 30000, contaId: "destino", direcao: "entrada" }),
  ];
  const saldoOrigem = calcularSaldoConta(origem, transacoes);
  const saldoDestino = calcularSaldoConta(destino, transacoes);
  assert.equal(saldoOrigem, 70000);
  assert.equal(saldoDestino, 80000);
  assert.equal(saldoOrigem + saldoDestino, 100000 + 50000, "o total do núcleo não muda com uma transferência interna");
});

// ---------- calcularComprometido ----------

test("calcularComprometido: inclui despesa prevista dentro do horizonte", () => {
  const transacoes = [t({ status: "previsto", valorCentavos: 15000, data: "2026-01-20", descricao: "Aluguel" })];
  const r = calcularComprometido({ transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 15000);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].descricao, "Aluguel");
});

test("calcularComprometido: ignora despesa prevista fora do horizonte", () => {
  const transacoes = [t({ status: "previsto", valorCentavos: 15000, data: "2026-06-01" })];
  const r = calcularComprometido({ transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 0);
});

test("calcularComprometido: despesa atrasada conta mesmo com data antiga, fora do horizonte para trás", () => {
  const transacoes = [t({ status: "atrasado", valorCentavos: 8000, data: "2025-03-01" })];
  const r = calcularComprometido({ transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 8000);
  assert.equal(r.itens[0].atrasado, true);
});

test("calcularComprometido: despesa já paga ou cancelada não conta", () => {
  const transacoes = [
    t({ status: "pago", valorCentavos: 5000, data: "2026-01-20" }),
    t({ status: "cancelado", valorCentavos: 5000, data: "2026-01-20" }),
  ];
  const r = calcularComprometido({ transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 0);
});

test("calcularComprometido: despesa em cartão não entra direto — só via a fatura", () => {
  const transacoes = [t({ status: "previsto", valorCentavos: 5000, cartaoId: "cartao1", contaId: null })];
  const r = calcularComprometido({ transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 0, "sem a fatura correspondente, essa despesa de cartão não deveria contar sozinha");
});

test("calcularComprometido: soma o total da fatura em aberto com vencimento dentro do horizonte", () => {
  const cartao = { id: "cartao1", apelido: "Roxinho", diaFechamento: 10, diaVencimento: 20 };
  const fatura = { id: "fat1", cartaoId: "cartao1", competencia: "2026-01", status: "fechada" };
  const transacoes = [
    t({ status: "pago", valorCentavos: 12000, cartaoId: "cartao1", contaId: null, faturaId: "fat1" }),
    t({ status: "previsto", valorCentavos: 3000, cartaoId: "cartao1", contaId: null, faturaId: "fat1" }),
  ];
  const r = calcularComprometido({ transacoes, faturas: [fatura], cartoes: [cartao], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 15000);
  assert.equal(r.itens[0].descricao, "Fatura Roxinho");
});

test("calcularComprometido: fatura já paga não conta mais", () => {
  const cartao = { id: "cartao1", diaFechamento: 10, diaVencimento: 20 };
  const fatura = { id: "fat1", cartaoId: "cartao1", competencia: "2026-01", status: "paga" };
  const transacoes = [t({ status: "pago", valorCentavos: 12000, cartaoId: "cartao1", contaId: null, faturaId: "fat1" })];
  const r = calcularComprometido({ transacoes, faturas: [fatura], cartoes: [cartao], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 0);
});

test("calcularComprometido: fatura com vencimento além do horizonte não conta ainda", () => {
  const cartao = { id: "cartao1", diaFechamento: 10, diaVencimento: 20 };
  const fatura = { id: "fat1", cartaoId: "cartao1", competencia: "2026-06", status: "aberta" };
  const transacoes = [t({ status: "previsto", valorCentavos: 12000, cartaoId: "cartao1", contaId: null, faturaId: "fat1" })];
  const r = calcularComprometido({ transacoes, faturas: [fatura], cartoes: [cartao], hoje: "2026-01-15", horizonteAte: "2026-02-14" });
  assert.equal(r.totalCentavos, 0);
});

// ---------- calcularClarezaDeCaixa (o painel inteiro) ----------

test("PORTÃO DA FASE 2: os quatro números do painel, explicáveis pelos detalhes", () => {
  const contas = [
    conta({ id: "operacao", saldoInicialCentavos: 500000, dataSaldoInicial: "2026-01-01" }),
    conta({ id: "reserva", saldoInicialCentavos: 200000, dataSaldoInicial: "2026-01-01", ehReserva: true }),
  ];
  const transacoes = [
    t({ tipo: "receita", valorCentavos: 300000, contaId: "operacao", data: "2026-01-05" }),
    t({ tipo: "despesa", valorCentavos: 100000, contaId: "operacao", data: "2026-01-06" }),
    t({ tipo: "despesa", valorCentavos: 150000, contaId: "operacao", data: "2026-01-20", status: "previsto", descricao: "Aluguel" }),
  ];
  const r = calcularClarezaDeCaixa({ contas, transacoes, faturas: [], cartoes: [], hoje: "2026-01-15", horizonteDias: 30 });

  // Saldo atual: só a conta de operação, saldo inicial + pago.
  assert.equal(r.saldoAtualCentavos, 500000 + 300000 - 100000);
  // Reserva fica separada, não soma no "posso gastar".
  assert.equal(r.saldoReservaCentavos, 200000);
  // Comprometido: o aluguel previsto dentro do horizonte.
  assert.equal(r.comprometidoCentavos, 150000);
  // Livre = atual - comprometido.
  assert.equal(r.livreCentavos, r.saldoAtualCentavos - 150000);
  // Nesta fase, seguro para gastar == livre (a margem já é a reserva separada).
  assert.equal(r.seguroParaGastarCentavos, r.livreCentavos);

  // Explicável linha a linha: cada número tem os itens que o compõem.
  assert.equal(r.detalhes.contasOperacao.length, 1);
  assert.equal(r.detalhes.contasReserva.length, 1);
  assert.equal(r.detalhes.compromissos.length, 1);
  assert.equal(r.detalhes.compromissos[0].descricao, "Aluguel");
});

test("calcularClarezaDeCaixa: conta encerrada não entra em nada", () => {
  const contas = [conta({ id: "encerrada", status: "encerrada", saldoInicialCentavos: 999999 })];
  const r = calcularClarezaDeCaixa({ contas, transacoes: [], faturas: [], cartoes: [], hoje: "2026-01-15" });
  assert.equal(r.saldoAtualCentavos, 0);
  assert.equal(r.detalhes.contasOperacao.length, 0);
});
