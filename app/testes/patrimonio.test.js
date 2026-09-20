import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularComposicaoAtivos, calcularPatrimonioLiquido, montarSnapshot,
  calcularVariacao, calcularRelacaoDividaAtivoPatrimonio,
} from "../src/domain/patrimonio.js";

// ---------- calcularComposicaoAtivos ----------

test("calcularComposicaoAtivos: soma por classe e calcula percentual", () => {
  const ativos = [
    { classe: "imovel", valorAtualCentavos: 300000000 },
    { classe: "liquido", valorAtualCentavos: 100000000 },
  ];
  const r = calcularComposicaoAtivos(ativos);
  assert.equal(r.totalCentavos, 400000000);
  assert.equal(r.composicao[0].classe, "imovel");
  assert.equal(r.composicao[0].percentual, 75);
  assert.equal(r.composicao[1].percentual, 25);
});

test("calcularComposicaoAtivos: sem ativos, zero sem quebrar", () => {
  const r = calcularComposicaoAtivos([]);
  assert.equal(r.totalCentavos, 0);
  assert.deepEqual(r.composicao, []);
});

// ---------- calcularPatrimonioLiquido ----------

test("calcularPatrimonioLiquido: ativos menos passivos, pode ficar negativo", () => {
  assert.equal(calcularPatrimonioLiquido({ ativosCentavos: 500000, passivosCentavos: 200000 }), 300000);
  assert.equal(calcularPatrimonioLiquido({ ativosCentavos: 100000, passivosCentavos: 300000 }), -200000);
});

// ---------- montarSnapshot ----------

test("montarSnapshot: calcula o líquido a partir de ativos e passivos", () => {
  const s = montarSnapshot({ competencia: "2026-03", ativosCentavos: 500000, passivosCentavos: 200000, composicao: [] });
  assert.equal(s.liquidoCentavos, 300000);
  assert.equal(s.competencia, "2026-03");
});

// ---------- calcularVariacao ----------

test("calcularVariacao: mensal ou acumulada é a mesma conta, snapshot base diferente", () => {
  const jan = montarSnapshot({ competencia: "2026-01", ativosCentavos: 400000, passivosCentavos: 200000, composicao: [] }); // líquido 200000
  const mar = montarSnapshot({ competencia: "2026-03", ativosCentavos: 500000, passivosCentavos: 150000, composicao: [] }); // líquido 350000
  const r = calcularVariacao(mar, jan);
  assert.equal(r.variacaoCentavos, 150000);
  assert.equal(r.variacaoPercentual, 75);
});

test("calcularVariacao: null quando falta um dos dois retratos", () => {
  const mar = montarSnapshot({ competencia: "2026-03", ativosCentavos: 500000, passivosCentavos: 150000, composicao: [] });
  assert.equal(calcularVariacao(mar, null), null);
  assert.equal(calcularVariacao(null, mar), null);
});

// ---------- calcularRelacaoDividaAtivoPatrimonio ----------

test("PORTÃO §14: dívida caindo, ativo subindo e patrimônio crescendo — os três sinais juntos", () => {
  const anterior = montarSnapshot({ competencia: "2026-02", ativosCentavos: 400000, passivosCentavos: 300000, composicao: [] }); // líquido 100000
  const atual = montarSnapshot({ competencia: "2026-03", ativosCentavos: 450000, passivosCentavos: 250000, composicao: [] }); // líquido 200000
  const r = calcularRelacaoDividaAtivoPatrimonio(atual, anterior);
  assert.equal(r.passivoCaiu, true);
  assert.equal(r.ativoSubiu, true);
  assert.equal(r.patrimonioSubiu, true);
  assert.equal(r.variacaoPatrimonioCentavos, 100000);
});

test("calcularRelacaoDividaAtivoPatrimonio: patrimônio pode piorar mesmo com ativo subindo, se a dívida subiu mais", () => {
  const anterior = montarSnapshot({ competencia: "2026-02", ativosCentavos: 400000, passivosCentavos: 100000, composicao: [] }); // líquido 300000
  const atual = montarSnapshot({ competencia: "2026-03", ativosCentavos: 420000, passivosCentavos: 200000, composicao: [] }); // líquido 220000
  const r = calcularRelacaoDividaAtivoPatrimonio(atual, anterior);
  assert.equal(r.ativoSubiu, true);
  assert.equal(r.passivoCaiu, false);
  assert.equal(r.patrimonioSubiu, false);
});
