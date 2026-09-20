import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCustos, calcularMargem, calcularRecorrenteVsExtraordinario,
  calcularEvolucaoPorCategoria, identificarCategoriasCrescentes,
} from "../src/domain/orcamento.js";

function despesa(overrides) {
  return { tipo: "despesa", status: "pago", valorCentavos: 0, ...overrides };
}

// ---------- calcularCustos ----------

test("calcularCustos: essencial, atual e discricionário", () => {
  const categorias = [{ id: "moradia", essencial: true }, { id: "lazer", essencial: false }];
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 150000 }),
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 50000 }),
    despesa({ competencia: "2026-03", categoriaId: "moradia", status: "previsto", valorCentavos: 999999 }), // não conta
  ];
  const r = calcularCustos(transacoes, categorias, "2026-03");
  assert.equal(r.essencialCentavos, 150000);
  assert.equal(r.atualCentavos, 200000);
  assert.equal(r.discricionarioCentavos, 50000);
});

// ---------- calcularMargem ----------

test("calcularMargem: renda menos essencial menos dívida", () => {
  const m = calcularMargem({ rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, comprometimentoMensalDividasCentavos: 100000 });
  assert.equal(m, 100000);
});

test("calcularMargem: sem comprometimento de dívida informado, não quebra", () => {
  const m = calcularMargem({ rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, comprometimentoMensalDividasCentavos: null });
  assert.equal(m, 200000);
});

// ---------- calcularRecorrenteVsExtraordinario ----------

test("calcularRecorrenteVsExtraordinario: separa pelo campo recorrenciaId já existente", () => {
  const transacoes = [
    despesa({ competencia: "2026-03", recorrenciaId: "r1", valorCentavos: 100000 }),
    despesa({ competencia: "2026-03", recorrenciaId: null, valorCentavos: 40000 }),
  ];
  const r = calcularRecorrenteVsExtraordinario(transacoes, "2026-03");
  assert.equal(r.recorrenteCentavos, 100000);
  assert.equal(r.extraordinarioCentavos, 40000);
});

// ---------- calcularEvolucaoPorCategoria ----------

test("calcularEvolucaoPorCategoria: as maiores categorias do mês, com a média dos meses anteriores", () => {
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "mercado", valorCentavos: 80000 }),
    despesa({ competencia: "2026-02", categoriaId: "mercado", valorCentavos: 60000 }),
    despesa({ competencia: "2026-01", categoriaId: "mercado", valorCentavos: 40000 }),
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 10000 }),
  ];
  const r = calcularEvolucaoPorCategoria(transacoes, "2026-03", { mesesHistorico: 2, limite: 5 });
  const mercado = r.find((x) => x.categoriaId === "mercado");
  assert.equal(mercado.valorCentavos, 80000);
  assert.equal(mercado.mediaCentavos, 50000, "média de 60000 e 40000");
  assert.equal(r[0].categoriaId, "mercado", "maior gasto vem primeiro");
});

test("calcularEvolucaoPorCategoria: respeita o limite de categorias devolvidas", () => {
  const transacoes = ["a", "b", "c"].map((cat) => despesa({ competencia: "2026-03", categoriaId: cat, valorCentavos: 10000 }));
  const r = calcularEvolucaoPorCategoria(transacoes, "2026-03", { limite: 2 });
  assert.equal(r.length, 2);
});

// ---------- identificarCategoriasCrescentes ----------

test("identificarCategoriasCrescentes: categoria que sobe mês a mês, sem nenhuma queda", () => {
  const transacoes = [
    despesa({ competencia: "2026-01", categoriaId: "saude", valorCentavos: 20000 }),
    despesa({ competencia: "2026-02", categoriaId: "saude", valorCentavos: 30000 }),
    despesa({ competencia: "2026-03", categoriaId: "saude", valorCentavos: 50000 }),
  ];
  const r = identificarCategoriasCrescentes(transacoes, "2026-03", { meses: 3 });
  assert.equal(r.length, 1);
  assert.equal(r[0].categoriaId, "saude");
  assert.equal(r[0].crescimentoTotalPercentual, 150);
});

test("identificarCategoriasCrescentes: uma queda no meio já desqualifica", () => {
  const transacoes = [
    despesa({ competencia: "2026-01", categoriaId: "lazer", valorCentavos: 50000 }),
    despesa({ competencia: "2026-02", categoriaId: "lazer", valorCentavos: 20000 }), // caiu
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 60000 }),
  ];
  const r = identificarCategoriasCrescentes(transacoes, "2026-03", { meses: 3 });
  assert.deepEqual(r, []);
});

test("identificarCategoriasCrescentes: categoria sem gasto num mês do meio não conta como crescente", () => {
  const transacoes = [
    despesa({ competencia: "2026-01", categoriaId: "viagem", valorCentavos: 50000 }),
    despesa({ competencia: "2026-03", categoriaId: "viagem", valorCentavos: 100000 }),
    // nada em 2026-02 — a série fica [50000, 0, 100000], quebra a sequência
  ];
  const r = identificarCategoriasCrescentes(transacoes, "2026-03", { meses: 3 });
  assert.deepEqual(r, []);
});
