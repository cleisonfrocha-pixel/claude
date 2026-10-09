import { test } from "node:test";
import assert from "node:assert/strict";
import { painelDeVerbas } from "../src/domain/verbas.js";

const verba = { id: "v1", tipo: "despesa", semDia: true, status: "previsto", categoriaId: "lazer", competencia: "2026-10", data: "2026-10-01", valorCentavos: 50000, descricao: "Lazer do mês" };
const gasto = (v, id) => ({ id, tipo: "despesa", status: "pago", categoriaId: "lazer", competencia: "2026-10", data: "2026-10-05", valorCentavos: v });

test("painel de verbas: da cota de R$ 500, usou R$ 150, ainda pode R$ 350", () => {
  const [l] = painelDeVerbas([verba, gasto(15000, "g1")], "2026-10-09");
  assert.equal(l.totalCentavos, 50000);
  assert.equal(l.gastoCentavos, 15000);
  assert.equal(l.restanteCentavos, 35000);
  assert.equal(l.percentual, 30);
  assert.equal(l.ritmo, "no ritmo");
  assert.equal(l.semanasRestantes, 4); // 9 a 31/10: 23 dias
  assert.equal(l.porSemanaCentavos, 8750);
});

test("painel de verbas: gastar demais cedo é 'acima'; passar da cota é 'estourou' e mostra o excedente", () => {
  assert.equal(painelDeVerbas([verba, gasto(30000, "g1")], "2026-10-09")[0].ritmo, "acima");
  const [e] = painelDeVerbas([verba, gasto(60000, "g1")], "2026-10-09");
  assert.equal(e.ritmo, "estourou");
  assert.equal(e.restanteCentavos, 0);
  assert.equal(e.excedenteCentavos, 10000);
});

test("painel de verbas: só o mês corrente; gasto de outra categoria ou cancelado não conta", () => {
  const outra = { ...gasto(9999, "g2"), categoriaId: "mercado" };
  const cancelado = { ...gasto(9999, "g3"), status: "cancelado" };
  const mesPassado = { ...verba, id: "v0", competencia: "2026-09", data: "2026-09-01" };
  const r = painelDeVerbas([verba, mesPassado, outra, cancelado], "2026-10-09");
  assert.equal(r.length, 1);
  assert.equal(r[0].gastoCentavos, 0);
});

test("painel de verbas: traz os últimos gastos da verba, para o Cleison ver o que já entrou", () => {
  const [l] = painelDeVerbas([verba, gasto(1000, "a"), { ...gasto(2000, "b"), data: "2026-10-08", descricao: "Cinema" }], "2026-10-09");
  assert.equal(l.lancamentos.length, 2);
  assert.equal(l.lancamentos[0].descricao, "Cinema");
});
