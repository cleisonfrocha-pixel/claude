import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularClarezaDeCaixa, calcularSaldoConta } from "../src/domain/caixa.js";
import { repartirVerba } from "../src/domain/calendario.js";

const HOJE = "2026-10-02";
const conta = { id: "c1", nome: "Next", status: "ativa", saldoInicialCentavos: 1000000, dataSaldoInicial: "2026-10-01" };
const desp = (o) => ({ tipo: "despesa", status: "previsto", contaId: "c1", competencia: "2026-10", certeza: "confirmado", categoriaId: "x", ...o });

test("conta de setembro paga hoje tira o dinheiro de hoje do saldo (não do vencimento)", () => {
  const antes = calcularSaldoConta(conta, []);
  const paga = desp({ id: "luz", status: "pago", data: "2026-09-23", pagoEm: HOJE, valorCentavos: 15679 });
  assert.equal(calcularSaldoConta(conta, [paga]), antes - 15679);
});

test("pagar antes da data do saldo inicial continua já contado no saldo", () => {
  const velha = desp({ id: "v", status: "pago", data: "2026-09-23", pagoEm: "2026-09-25", valorCentavos: 15679 });
  assert.equal(calcularSaldoConta(conta, [velha]), calcularSaldoConta(conta, []));
});

test("lançamento antigo sem pagoEm vale pela data (compatível)", () => {
  assert.equal(calcularSaldoConta(conta, [desp({ status: "pago", data: "2026-10-03", valorCentavos: 1000 })]), 1000000 - 1000);
});

test("13.2 item 5: verba do mês corrente é repartida nas semanas que faltam; a de mês futuro desde o dia 1, sem perder centavo", () => {
  const corrente = repartirVerba({ competencia: "2026-10", valorCentavos: 100001 }, HOJE);
  assert.deepEqual(corrente.map((p) => p.data), ["2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"]);
  assert.equal(corrente.reduce((s, p) => s + p.valorCentavos, 0), 100001);
  const futuro = repartirVerba({ competencia: "2026-11", valorCentavos: 100001 }, HOJE);
  assert.equal(futuro.length, 5);
  assert.equal(futuro.reduce((s, p) => s + p.valorCentavos, 0), 100001);
  assert.deepEqual(futuro.map((p) => p.data), ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"]);
});

test("verba de 01/10 ainda não paga pesa no pode gastar (antes sumia da trilha)", () => {
  const transacoes = [
    desp({ id: "almoco", data: "2026-10-01", semDia: true, valorCentavos: 45000 }),
    desp({ id: "mercado", data: "2026-10-04", valorCentavos: 100000 }),
  ];
  const r = calcularClarezaDeCaixa({ contas: [conta], transacoes, faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: HOJE, horizonteDias: 30 });
  assert.equal(r.comprometidoCentavos, 145000);
  assert.equal(r.seguroParaGastarCentavos, 1000000 - 145000);
});

test("em conta + entra − sai é o saldo no fim da trilha (os números do Início fecham)", () => {
  const transacoes = [
    desp({ id: "a", data: "2026-10-01", semDia: true, valorCentavos: 45000 }),
    desp({ id: "b", data: "2026-10-10", valorCentavos: 20000 }),
    desp({ id: "c", competencia: "2026-11", data: "2026-11-01", semDia: true, valorCentavos: 30000 }),
    { tipo: "receita", status: "previsto", contaId: "c1", competencia: "2026-10", data: "2026-10-05", valorCentavos: 500000, certeza: "provavel", categoriaId: "r" },
  ];
  const r = calcularClarezaDeCaixa({ contas: [conta], transacoes, faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: HOJE, horizonteDias: 30 });
  const fim = r.saldoAtualCentavos + r.entradasPrevistasCentavos - r.comprometidoCentavos;
  assert.equal(r.detalhes.compromissos.reduce((s, i) => s + i.valorCentavos, 0), r.comprometidoCentavos);
  assert.equal(fim, 1000000 + 500000 - r.comprometidoCentavos);
  assert.ok(r.seguroParaGastarCentavos <= r.saldoAtualCentavos);
});

test("conta atrasada mantém o vencimento original para mostrar na tela", () => {
  const t = desp({ id: "l", data: "2026-09-23", competencia: "2026-09", status: "previsto", valorCentavos: 15679 });
  const r = calcularClarezaDeCaixa({ contas: [conta], transacoes: [t], faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: HOJE, horizonteDias: 30 });
  assert.equal(r.detalhes.compromissos[0].atrasado, true);
  assert.equal(r.detalhes.compromissos[0].vencimento, "2026-09-23");
});

import { formatarData } from "../src/domain/tempo.js";
test("data do calendário não anda um dia no horário de Brasília", () => {
  assert.equal(formatarData("2026-09-23"), "23/09/2026");
  assert.equal(formatarData("2026-10-01"), "01/10/2026");
});

import { candidatosDePagamento } from "../src/domain/conciliacao.js";
test("conta conferida no meio do dia: o que entra depois da conferência conta, o de antes não", () => {
  const c = { ...conta, dataSaldoInicial: "2026-10-02", saldoConferidoEm: "2026-10-02T15:00:00.000Z" };
  const antes = desp({ status: "pago", data: "2026-10-02", pagoEm: "2026-10-02", valorCentavos: 1000, criadoEm: "2026-10-02T14:00:00.000Z" });
  const depois = desp({ status: "pago", data: "2026-10-02", pagoEm: "2026-10-02", valorCentavos: 2500, criadoEm: "2026-10-01T10:00:00.000Z", movimentadoEm: "2026-10-02T16:00:00.000Z" });
  assert.equal(calcularSaldoConta(c, [antes, depois]), 1000000 - 2500);
});

test("13.1 item 15: lançamento criado antes da conferência e editado depois não entra de novo", () => {
  const c = { ...conta, dataSaldoInicial: "2026-10-02", saldoConferidoEm: "2026-10-02T15:00:00.000Z" };
  const editado = desp({ status: "pago", data: "2026-10-02", pagoEm: "2026-10-02", valorCentavos: 1000, criadoEm: "2026-10-02T14:00:00.000Z", atualizadoEm: "2026-10-02T18:00:00.000Z" });
  assert.equal(calcularSaldoConta(c, [editado]), 1000000);
});

test("13.1: conta sem hora de conferência não soma o mesmo dia (o saldo informado já inclui o dia)", () => {
  const c = { ...conta, dataSaldoInicial: "2026-10-02" };
  const t = desp({ status: "pago", data: "2026-10-02", pagoEm: "2026-10-02", valorCentavos: 1000, criadoEm: "2026-10-02T18:00:00.000Z" });
  assert.equal(calcularSaldoConta(c, [t]), 1000000);
});

test("conciliar: o Vivo pago aponta a conta Vivo aberta, e uma conta sem parentesco não aparece", () => {
  const abertas = [
    desp({ id: "vivo", descricao: "Vivo internet móvel", data: "2026-10-10", valorCentavos: 9462 }),
    desp({ id: "luz", descricao: "Conta de Luz 1", data: "2026-10-13", valorCentavos: 15061 }),
    desp({ id: "pago", status: "pago", descricao: "Vivo", data: "2026-10-10", valorCentavos: 9462 }),
  ];
  const r = candidatosDePagamento({ tipo: "despesa", valorCentavos: 9200, descricao: "Vivo internet móvel SET", data: "2026-10-02" }, abertas, { hoje: "2026-10-02" });
  assert.deepEqual(r.map((x) => x.transacao.id), ["vivo"]);
  assert.equal(candidatosDePagamento({ tipo: "despesa", valorCentavos: 12345, descricao: "Pizza", data: "2026-10-02" }, abertas, { hoje: "2026-10-02" }).length, 0);
});

import { lerVerbas } from "../src/domain/verbas.js";
test("13.2 item 7: verba de mês passado expira e não pesa hoje", () => {
  const transacoes = [desp({ id: "set", data: "2026-09-01", competencia: "2026-09", semDia: true, valorCentavos: 50000 })];
  const r = calcularClarezaDeCaixa({ contas: [conta], transacoes, faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: HOJE, horizonteDias: 30 });
  assert.equal(r.comprometidoCentavos, 0);
  assert.equal(lerVerbas(transacoes, HOJE).get("set").expirada, true);
});

test("13.2 item 6: duas verbas na mesma categoria dividem o gasto real; compra no cartão também consome", () => {
  const v = lerVerbas([
    desp({ id: "cafe", data: "2026-10-01", semDia: true, categoriaId: "esc", valorCentavos: 10000 }),
    desp({ id: "almoco", data: "2026-10-01", semDia: true, categoriaId: "esc", valorCentavos: 45000 }),
    desp({ id: "x", data: "2026-10-02", status: "pago", categoriaId: "esc", valorCentavos: 11000 }),
    desp({ id: "y", data: "2026-10-02", status: "previsto", contaId: null, cartaoId: "c", faturaId: "f", categoriaId: "esc", valorCentavos: 11000 }),
  ], HOJE);
  assert.equal(v.get("cafe").restanteCentavos + v.get("almoco").restanteCentavos, 55000 - 22000);
  assert.equal(v.get("almoco").restanteCentavos, 27000);
});

test("13.2 item 6: gasto acima da verba zera o que falta, nunca negativo", () => {
  const transacoes = [
    desp({ id: "lazer", data: "2026-10-01", semDia: true, categoriaId: "laz", valorCentavos: 50000 }),
    desp({ id: "g", data: "2026-10-02", status: "pago", categoriaId: "laz", valorCentavos: 80000 }),
  ];
  assert.equal(lerVerbas(transacoes, HOJE).get("lazer").restanteCentavos, 0);
  const r = calcularClarezaDeCaixa({ contas: [conta], transacoes, faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: HOJE, horizonteDias: 30 });
  assert.equal(r.comprometidoCentavos, 0);
});

test("13.3 item 63: R$ 100 de mercado não sugere Vivo, Claude nem DAS só porque o valor é perto", () => {
  const abertas = [
    desp({ id: "vivo", descricao: "Vivo internet móvel", data: "2026-10-10", valorCentavos: 9462 }),
    desp({ id: "claude", descricao: "Claude IA", data: "2026-10-04", valorCentavos: 11000 }),
    desp({ id: "das", descricao: "DAS Simples Nacional (agosto)", data: "2026-08-20", status: "atrasado", valorCentavos: 9088 }),
  ];
  assert.equal(candidatosDePagamento({ tipo: "despesa", valorCentavos: 10000, descricao: "Mercado", data: "2026-10-02" }, abertas, { hoje: "2026-10-02" }).length, 0);
  assert.deepEqual(candidatosDePagamento({ tipo: "despesa", valorCentavos: 9088, descricao: "DAS agosto", data: "2026-10-02" }, abertas, { hoje: "2026-10-02" }).map((c) => c.transacao.id), ["das"]);
});
