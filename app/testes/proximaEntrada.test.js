import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularClarezaDeCaixa } from "../src/domain/caixa.js";

const conta = { id: "k", status: "ativa", saldoInicialCentavos: 100000, dataSaldoInicial: "2026-09-01" };
const d = (o) => ({ tipo: "despesa", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", ...o });
const r = (o) => ({ tipo: "receita", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", ...o });
const base = { contas: [conta], faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], hoje: "2026-10-02" };

test("até a próxima entrada: o saldo mais baixo antes de ela chegar, não o do mês todo", () => {
  const transacoes = [
    d({ id: "a", descricao: "Luz", data: "2026-10-04", valorCentavos: 30000 }),
    r({ id: "e", descricao: "Del Poente", data: "2026-10-05", valorCentavos: 500000 }),
    d({ id: "b", descricao: "Jeep", data: "2026-10-20", valorCentavos: 331637 }),
  ];
  const c = calcularClarezaDeCaixa({ ...base, transacoes });
  assert.equal(c.proximaEntrada.data, "2026-10-05");
  assert.equal(c.proximaEntrada.valorCentavos, 500000);
  assert.equal(c.seguroAteAProximaEntradaCentavos, 70000);
  assert.equal(c.primeiroBuraco, null);
});

test("entrada incerta não é a próxima entrada certa", () => {
  const transacoes = [r({ id: "e", descricao: "Talvez", data: "2026-10-05", valorCentavos: 500000, certeza: "incerto" }), r({ id: "f", descricao: "Salário", data: "2026-10-08", valorCentavos: 200000 })];
  const c = calcularClarezaDeCaixa({ ...base, transacoes });
  assert.equal(c.proximaEntrada.descricao, "Salário");
});

test("o que quebra: primeiro dia em que o saldo fica negativo, com as contas desse dia", () => {
  const transacoes = [
    d({ id: "a", descricao: "Aluguel", data: "2026-10-10", valorCentavos: 120000 }),
    d({ id: "b", descricao: "Luz", data: "2026-10-10", valorCentavos: 20000 }),
  ];
  const c = calcularClarezaDeCaixa({ ...base, transacoes });
  assert.equal(c.primeiroBuraco.data, "2026-10-10");
  assert.equal(c.primeiroBuraco.faltaCentavos, 40000);
  assert.deepEqual(c.primeiroBuraco.causas.map((x) => x.descricao), ["Aluguel", "Luz"]);
});
