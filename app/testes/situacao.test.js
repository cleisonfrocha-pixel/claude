import { test } from "node:test";
import assert from "node:assert/strict";
import { lerSituacao, zonaDoCaixa } from "../src/domain/situacao.js";

const conta = { id: "k", status: "ativa", saldoInicialCentavos: 800000, dataSaldoInicial: "2026-09-01" };
const cats = [{ id: "ess", essencial: true, grupo: "moradia" }, { id: "div", grupo: "dividas", essencial: true }, { id: "laz", grupo: "lazer" }];
const d = (o) => ({ tipo: "despesa", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", categoriaId: "laz", ...o });
const r = (o) => ({ tipo: "receita", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", ...o });
const base = { contas: [conta], faturas: [], cartoes: [], dividas: [], recorrencias: [], fontesRenda: [], categorias: cats, hoje: "2026-10-02" };

test("zona: negativo é risco; abaixo de meio mês é risco; até um mês, apertado; depois, confortável", () => {
  assert.equal(zonaDoCaixa(-1, 100000), "risco");
  assert.equal(zonaDoCaixa(49999, 100000), "risco");
  assert.equal(zonaDoCaixa(50000, 100000), "apertado");
  assert.equal(zonaDoCaixa(99999, 100000), "apertado");
  assert.equal(zonaDoCaixa(100000, 100000), "confortavel");
  assert.equal(zonaDoCaixa(0, 0), "confortavel");
});

test("comprometido: só o que sai antes da próxima entrada, por grupo, e livre = menor ponto até lá", () => {
  const s = lerSituacao({ ...base, transacoes: [
    d({ id: "a", descricao: "Luz", data: "2026-10-03", valorCentavos: 30000, categoriaId: "ess" }),
    d({ id: "b", descricao: "Parcela carro", data: "2026-10-04", valorCentavos: 200000, categoriaId: "div" }),
    d({ id: "c", descricao: "Cinema", data: "2026-10-04", valorCentavos: 10000 }),
    r({ id: "e", descricao: "Cliente", data: "2026-10-05", valorCentavos: 400000 }),
    d({ id: "z", descricao: "Depois", data: "2026-10-20", valorCentavos: 100000 }),
  ] });
  assert.equal(s.naContaCentavos, 800000);
  assert.equal(s.comprometido.totalCentavos, 240000);
  assert.equal(s.comprometido.grupos.essencial.totalCentavos, 30000);
  assert.equal(s.comprometido.grupos.parcelas.totalCentavos, 200000);
  assert.equal(s.comprometido.grupos.outros.totalCentavos, 10000);
  assert.equal(s.livreProvavelCentavos, 800000 - 240000);
});

test("livre garantido nunca passa do provável, e incerto fica fora dos dois", () => {
  const s = lerSituacao({ ...base, transacoes: [
    d({ id: "a", descricao: "Aluguel", data: "2026-10-10", valorCentavos: 900000, categoriaId: "ess" }),
    r({ id: "p", descricao: "Provável", data: "2026-10-05", valorCentavos: 300000, certeza: "provavel" }),
    r({ id: "i", descricao: "Incerto", data: "2026-10-06", valorCentavos: 900000, certeza: "incerto" }),
  ] });
  assert.ok(s.livreGarantidoCentavos <= s.livreProvavelCentavos);
  assert.equal(s.menorPontoGarantidoCentavos, 800000 - 900000);
  assert.equal(s.menorPontoCentavos, 800000 + 300000 - 900000);
});

test("buraco vira decisão com data, valor e a causa; sem buraco e com atraso, manda pagar o atrasado", () => {
  const buraco = lerSituacao({ ...base, transacoes: [
    d({ id: "a", descricao: "Jeep", data: "2026-10-04", valorCentavos: 900000, categoriaId: "div" }),
    r({ id: "e", descricao: "Del Poente", data: "2026-10-05", valorCentavos: 500000 }),
  ] });
  assert.equal(buraco.decisao.tipo, "buraco");
  assert.match(buraco.decisao.texto, /faltam R\$\s?1\.000,00/);
  assert.match(buraco.decisao.texto, /Jeep/);
  const atraso = lerSituacao({ ...base, transacoes: [d({ id: "x", descricao: "Água", data: "2026-09-30", valorCentavos: 5000, status: "atrasado" })] });
  assert.equal(atraso.decisao.tipo, "atrasadas");
  assert.equal(atraso.comprometido.grupos.atrasado.totalCentavos, 5000);
});

test("invariante: comprometido nunca passa do que sai no horizonte da própria trilha", () => {
  const s = lerSituacao({ ...base, transacoes: [d({ id: "a", data: "2026-10-03", valorCentavos: 1000 }), d({ id: "b", data: "2026-10-25", valorCentavos: 2000 })] });
  assert.equal(s.comprometido.totalCentavos, 3000);
});
