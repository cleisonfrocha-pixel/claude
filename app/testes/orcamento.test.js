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

test("calcularCustos: parcela de dívida paga (grupo dividas) sai do essencial e vira um balde à parte", () => {
  const categorias = [
    { id: "moradia", grupo: "moradia", essencial: true },
    { id: "dividas", grupo: "dividas", essencial: true },
    { id: "lazer", grupo: "lazer", essencial: false },
  ];
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 150000 }),
    despesa({ competencia: "2026-03", categoriaId: "dividas", valorCentavos: 50000 }), // "paguei a parcela"
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 20000 }),
  ];
  const r = calcularCustos(transacoes, categorias, "2026-03");
  assert.equal(r.essencialCentavos, 150000, "a parcela não conta como essencial — já é contada como comprometimento de dívida em outro lugar");
  assert.equal(r.dividasCentavos, 50000);
  assert.equal(r.atualCentavos, 220000, "o gasto total do mês continua incluindo a parcela paga");
  assert.equal(r.discricionarioCentavos, 20000, "discricionário não herda a parcela de dívida");
});

test("calcularCustos: fatura de cartão paga sem nenhuma compra lançada entra como gasto sem detalhe, não some", () => {
  const transacoes = [
    { tipo: "pagamento_fatura", status: "pago", competencia: "2026-03", faturaId: "fat1", valorCentavos: 300000 },
  ];
  const r = calcularCustos(transacoes, [], "2026-03");
  assert.equal(r.faturaSemDetalheCentavos, 300000);
  assert.equal(r.atualCentavos, 300000, "o gasto real não pode sumir só porque não foi detalhado");
  assert.equal(r.essencialCentavos, 0, "categoria de quem não detalhou é desconhecida, não presumida essencial");
  assert.equal(r.discricionarioCentavos, 0, "nem presumida discricionária");
});

test("calcularCustos: fatura paga COM compras lançadas continua sem contar o pagamento (as compras já contaram)", () => {
  const categorias = [{ id: "mercado", essencial: true }];
  const transacoes = [
    { tipo: "despesa", status: "pago", competencia: "2026-03", categoriaId: "mercado", faturaId: "fat1", valorCentavos: 300000 },
    { tipo: "pagamento_fatura", status: "pago", competencia: "2026-04", faturaId: "fat1", valorCentavos: 300000 },
  ];
  const r = calcularCustos(transacoes, categorias, "2026-04");
  assert.equal(r.faturaSemDetalheCentavos, 0);
  assert.equal(r.atualCentavos, 0, "o pagamento em si não é despesa nova — a compra já contou em março");
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

test("calcularMargem: usada com calcularCustos, não conta a parcela de dívida duas vezes", () => {
  // Renda 5000, essencial (sem dívida) 2000, parcela da dívida 1000 lançada
  // como despesa este mês (categoria "Dívidas e parcelas"). Margem certa:
  // 5000 - 2000 - 1000 = 2000. Antes da correção, a despesa da parcela
  // entrava no essencialCentavos (2000 -> 3000) e a margem saía em 1000:
  // a mesma parcela descontada duas vezes.
  const categorias = [
    { id: "moradia", grupo: "moradia", essencial: true },
    { id: "dividas", grupo: "dividas", essencial: true },
  ];
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 200000 }),
    despesa({ competencia: "2026-03", categoriaId: "dividas", valorCentavos: 100000 }),
  ];
  const custos = calcularCustos(transacoes, categorias, "2026-03");
  const m = calcularMargem({
    rendaAtualCentavos: 500000,
    custoEssencialCentavos: custos.essencialCentavos,
    comprometimentoMensalDividasCentavos: 100000, // cronograma da dívida (domain/dividas.js)
  });
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
