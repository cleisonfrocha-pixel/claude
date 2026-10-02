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

test("verba do mês corrente pesa hoje por inteiro; a de mês futuro é repartida em semanas sem perder centavo", () => {
  const corrente = repartirVerba({ competencia: "2026-10", valorCentavos: 100001 }, HOJE);
  assert.deepEqual(corrente, [{ data: "2026-10-02", valorCentavos: 100001 }]);
  const futuro = repartirVerba({ competencia: "2026-11", valorCentavos: 100001 }, HOJE);
  assert.equal(futuro.length, 4);
  assert.equal(futuro.reduce((s, p) => s + p.valorCentavos, 0), 100001);
  assert.deepEqual(futuro.map((p) => p.data), ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]);
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
