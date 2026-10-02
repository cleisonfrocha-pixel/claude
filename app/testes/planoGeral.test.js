import { test } from "node:test";
import assert from "node:assert/strict";
import { agruparAchados, alavancas } from "../src/domain/planoGeral.js";

const a = (chave, i, urgencia = "baixa") => ({ chave, id: `${chave}:${i}`, titulo: `${chave} ${i}`, urgencia, tipo: "risco", impactoCentavos: 100 });

test("agrupar: 12 recorrências novas viram uma linha só", () => {
  const achados = Array.from({ length: 12 }, (_, i) => a("nova_recorrencia", i));
  const g = agruparAchados(achados);
  assert.equal(g.length, 1);
  assert.equal(g[0].grupo, true);
  assert.equal(g[0].itens.length, 12);
  assert.match(g[0].titulo, /^12 /);
});

test("agrupar: abaixo do limiar segue individual e urgente vem primeiro", () => {
  const g = agruparAchados([a("x", 1), a("y", 1, "alta")]);
  assert.deepEqual(g.map((x) => x.chave), ["y", "x"]);
  assert.ok(g.every((x) => !x.grupo));
});

test("alavancas: corte de categoria não essencial usa só o gasto do mês", () => {
  const r = alavancas({
    competencia: "2026-10", hoje: "2026-10-03", sobraCentavos: 0,
    categorias: [{ id: "c1", nome: "Lazer", natureza: "despesa", essencial: false }, { id: "c2", nome: "Mercado", natureza: "despesa", essencial: true }],
    transacoes: [
      { tipo: "despesa", competencia: "2026-10", status: "pago", categoriaId: "c1", valorCentavos: 50000 },
      { tipo: "despesa", competencia: "2026-10", status: "pago", categoriaId: "c2", valorCentavos: 900000 },
      { tipo: "despesa", competencia: "2026-09", status: "pago", categoriaId: "c1", valorCentavos: 70000 },
    ],
    dividas: [],
  });
  assert.equal(r.length, 1);
  assert.equal(r[0].impactoMensalCentavos, 10000);
  assert.equal(r[0].baseCentavos, 50000);
});

test("alavancas: déficit vira 'renda nova' do tamanho do buraco; no máximo 3", () => {
  const r = alavancas({
    competencia: "2026-10", hoje: "2026-10-03", sobraCentavos: -300000,
    categorias: [{ id: "c1", nome: "Lazer", natureza: "despesa", essencial: false }],
    transacoes: [{ tipo: "despesa", competencia: "2026-10", status: "pago", categoriaId: "c1", valorCentavos: 50000 }],
    dividas: [{ id: "d1", nome: "Jeep", valorParcelaCentavos: 200000, quantidadeParcelas: 10, parcelasPagas: 2, saldoOriginalCentavos: 2000000, dataInicio: "2026-01-10" }],
  });
  assert.equal(r.length, 3);
  assert.equal(r[0].id, "renda:deficit");
  assert.equal(r[0].impactoMensalCentavos, 300000);
});

test("alavancas: categoria genérica 'Outros' nunca é sugerida como corte", () => {
  const r = alavancas({
    competencia: "2026-10", hoje: "2026-10-03", sobraCentavos: 0,
    categorias: [{ id: "c1", nome: "Outros", natureza: "despesa", essencial: false }],
    transacoes: [{ tipo: "despesa", competencia: "2026-10", status: "pago", categoriaId: "c1", valorCentavos: 900000 }],
    dividas: [],
  });
  assert.equal(r.length, 0);
});
