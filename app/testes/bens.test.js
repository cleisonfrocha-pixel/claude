import { test } from "node:test";
import assert from "node:assert/strict";
import { leituraDoBem, separarDividas, avisoPatrimonioIncompleto } from "../src/domain/bens.js";
import { classificarDivida, calcularVisaoConsolidada } from "../src/domain/dividas.js";

const jeep = { id: "d1", nome: "Jeep", saldoOriginalCentavos: 10000000, valorParcelaCentavos: 250000, quantidadeParcelas: 48, parcelasPagas: 8, dataInicio: "2026-01-10" };

test("bem financiado: líquido = valor - dívida ligada; custos ligados somam por mês", () => {
  const r = leituraDoBem(
    { id: "a1", nome: "Jeep", valorAtualCentavos: 15000000, dividaId: "d1" },
    [jeep],
    [{ id: "r1", ativoId: "a1", ativa: true, tipo: "despesa", descricao: "Seguro", valorEstimadoCentavos: 30000 }, { id: "r2", ativoId: "outro", ativa: true, tipo: "despesa", valorEstimadoCentavos: 999 }],
  );
  assert.equal(r.liquidoCentavos, 15000000 - r.dividaCentavos);
  assert.ok(r.dividaCentavos > 0);
  assert.equal(r.custosMensaisCentavos, 30000);
});

test("bem sem dívida ligada: líquido é o valor", () => {
  assert.equal(leituraDoBem({ id: "a", valorAtualCentavos: 500 }, [], []).liquidoCentavos, 500);
});

test("financiamento em dia não é dívida; negativada, atrasada e sem acordo são", () => {
  const neg = { id: "d2", nome: "Serasa", saldoOriginalCentavos: 800000, valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0, negativada: true, dataInicio: "2026-01-10" };
  const atrasada = { id: "d3", nome: "TV", saldoOriginalCentavos: 10500, valorParcelaCentavos: 3500, quantidadeParcelas: 3, parcelasPagas: 0, dataInicio: "2026-08-28" };
  const r = separarDividas([jeep, neg, atrasada], "2026-09-05");
  assert.deepEqual(r.financiamentos.map((d) => d.id), ["d1"]);
  assert.deepEqual(r.problemas.map((d) => d.id).sort(), ["d2", "d3"]);
  assert.equal(r.parcelasFinanciamentosCentavos, 250000);
  assert.ok(r.totalProblemasCentavos > 800000);
  assert.ok(r.totalFinanciamentosCentavos > 0);
});

test("tipo manual força o lado, mas atraso ou nome sujo sempre vence", () => {
  assert.equal(classificarDivida({ ...jeep, tipo: "divida" }, "2026-09-05"), "divida");
  assert.equal(classificarDivida({ ...jeep, tipo: "financiamento", negativada: true }, "2026-09-05"), "divida");
  assert.equal(classificarDivida({ ...jeep, parcelasPagas: 48 }, "2026-09-05"), "quitada");
  assert.equal(classificarDivida({ ...jeep, emRisco: true }, "2026-09-05"), "divida");
});

test("visão consolidada separa o que pesa como dívida do financiamento em dia", () => {
  const atrasada = { id: "d3", nome: "TV", saldoOriginalCentavos: 10500, valorParcelaCentavos: 3500, quantidadeParcelas: 3, parcelasPagas: 0, dataInicio: "2026-08-28" };
  const v = calcularVisaoConsolidada([jeep, atrasada], "2026-09-05");
  assert.equal(v.quantidadeProblemas, 1);
  assert.equal(v.quantidadeFinanciamentos, 1);
  assert.equal(v.saldoProblemasCentavos + v.saldoFinanciamentosCentavos, v.saldoTotalAtualCentavos);
  assert.equal(v.parcelasFinanciamentosCentavos, 250000);
});

test("leitura do bem traz parcela, parcelas que faltam e quitação", () => {
  const r = leituraDoBem({ id: "a1", nome: "Jeep", valorAtualCentavos: 15000000, dividaId: "d1" }, [jeep], []);
  assert.equal(r.parcelasRestantes, 40);
  assert.equal(r.parcelaCentavos, 250000);
  assert.ok(r.quitacao);
});

test("patrimônio incompleto: dívida sem nenhum bem avisa; bem sem valor também", () => {
  const a = avisoPatrimonioIncompleto({ ativos: [], dividas: [jeep], hoje: "2026-10-03" });
  assert.match(a.motivos[0], /só as dívidas/);
  const b = avisoPatrimonioIncompleto({ ativos: [{ nome: "Galpão", valorAtualCentavos: 0 }], dividas: [], hoje: "2026-10-03" });
  assert.match(b.motivos[0], /Galpão está sem valor/);
  assert.equal(avisoPatrimonioIncompleto({ ativos: [{ nome: "X", valorAtualCentavos: 10, dataAvaliacao: "2026-09-01" }], dividas: [], hoje: "2026-10-03" }), null);
});
