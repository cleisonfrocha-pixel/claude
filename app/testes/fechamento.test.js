import { test } from "node:test";
import assert from "node:assert/strict";
import { montarFechamento, resultadoDoMes } from "../src/domain/fechamento.js";

const cats = [{ id: "c1", nome: "Mercado", essencial: true }, { id: "c2", nome: "Lazer", essencial: false }];
const t = (o) => ({ status: "pago", tipo: "despesa", categoriaId: "c1", ...o });
const transacoes = [
  t({ tipo: "receita", competencia: "2026-09", valorCentavos: 1000000 }),
  t({ competencia: "2026-09", valorCentavos: 300000 }),
  t({ categoriaId: "c2", competencia: "2026-09", valorCentavos: 100000 }),
  t({ tipo: "receita", competencia: "2026-10", valorCentavos: 900000 }),
  t({ competencia: "2026-10", valorCentavos: 400000 }),
  t({ categoriaId: "c2", competencia: "2026-10", valorCentavos: 50000 }),
  t({ competencia: "2026-10", valorCentavos: 70000, status: "previsto" }),
  t({ tipo: "transferencia", competencia: "2026-10", valorCentavos: 999999 }),
];

test("resultado do mês: só o pago; transferência e previsto ficam de fora", () => {
  assert.deepEqual(resultadoDoMes(transacoes, cats, "2026-10"), { competencia: "2026-10", receitaCentavos: 900000, despesaCentavos: 450000, resultadoCentavos: 450000 });
});

test("fechamento compara com o mês anterior e separa o não realizado", () => {
  const f = montarFechamento({ competencia: "2026-10", competenciaAtual: "2026-10", transacoes, categorias: cats, snapshots: [], decisoes: [] });
  assert.equal(f.situacao, "em andamento");
  assert.equal(f.variacaoResultadoCentavos, 450000 - 600000);
  assert.equal(f.naoRealizado.despesaCentavos, 70000);
  assert.equal(f.mudancas[0].nome, "Mercado");
  assert.equal(f.mudancas[0].variacaoCentavos, 100000);
  assert.equal(f.historico.length, 2);
});

test("fechamento: mês sem dado no anterior não inventa variação; patrimônio vem do retrato", () => {
  const f = montarFechamento({
    competencia: "2026-09", competenciaAtual: "2026-10", transacoes, categorias: cats, decisoes: [],
    snapshots: [{ competencia: "2026-09", liquidoCentavos: -100, ativosCentavos: 50, passivosCentavos: 150 }],
  });
  assert.equal(f.situacao, "fechado");
  assert.equal(f.mesAnterior, null);
  assert.equal(f.variacaoResultadoCentavos, null);
  assert.equal(f.patrimonio.variacaoLiquidoCentavos, null);
  assert.equal(f.patrimonio.liquidoCentavos, -100);
});
