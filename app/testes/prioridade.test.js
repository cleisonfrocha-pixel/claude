import { test } from "node:test";
import assert from "node:assert/strict";
import { pesarSaida, oQuePesa } from "../src/domain/prioridade.js";

const hoje = "2026-10-02";
const categorias = [{ id: "ass", nome: "Assinaturas" }, { id: "div", grupo: "dividas", essencial: true, nome: "Dívidas" }, { id: "ess", essencial: true, nome: "Moradia" }];
const ctx = { categorias, dividas: [{ id: "j", emRisco: false }, { id: "e", negativada: true, bloqueio: "luz cortada" }], hoje };

test("assinatura pequena atrasada pesa menos que parcela grande vencendo em 3 dias", () => {
  const ass = pesarSaida({ tipo: "despesa", valorCentavos: 1500, atrasado: true, vencimento: "2026-09-20", categoriaId: "ass" }, ctx);
  const parcela = pesarSaida({ tipo: "parcela", valorCentavos: 331637, vencimento: "2026-10-05", categoriaId: "div", origem: { tipo: "divida", id: "j" } }, ctx);
  assert.ok(parcela.peso > ass.peso);
  assert.equal(ass.nivel, "rotina");
  assert.equal(parcela.nivel, "critico");
});

test("dívida com corte e negativada sobe; razões ficam anotadas", () => {
  const edp = pesarSaida({ tipo: "parcela", valorCentavos: 24338, atrasado: true, vencimento: "2025-11-25", origem: { tipo: "divida", id: "e" } }, ctx);
  assert.equal(edp.nivel, "critico");
  assert.ok(edp.razoes.some((r) => /luz cortada/.test(r)));
});

test("verba do mês é rotina; oQuePesa devolve poucos, em ordem estável", () => {
  assert.equal(pesarSaida({ tipo: "despesa", valorCentavos: 100000, semDia: true, vencimento: null }, ctx).nivel, "rotina");
  const lista = oQuePesa([
    { tipo: "despesa", valorCentavos: 1000, vencimento: "2026-10-30", data: "2026-10-30" },
    { tipo: "parcela", valorCentavos: 331637, vencimento: "2026-10-04", data: "2026-10-04", categoriaId: "div", origem: { tipo: "divida", id: "j" } },
    { tipo: "despesa", valorCentavos: 90000, vencimento: "2026-10-02", data: "2026-10-02", categoriaId: "ess" },
  ], ctx, { max: 2 });
  assert.equal(lista.length, 2);
  assert.ok(lista[0].peso >= lista[1].peso);
  assert.ok(lista.every((x) => x.nivel !== "rotina"));
});
