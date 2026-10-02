import { test } from "node:test";
import assert from "node:assert/strict";
import { leituraDoBem, separarDividas, avisoPatrimonioIncompleto } from "../src/domain/bens.js";

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

test("dívidas em duas listas: com acordo e negativadas/sem acordo", () => {
  const neg = { id: "d2", nome: "Serasa", saldoOriginalCentavos: 800000, valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0, negativada: true, dataInicio: "2026-01-10" };
  const r = separarDividas([jeep, neg], "2026-10-03");
  assert.deepEqual(r.comAcordo.map((d) => d.id), ["d1"]);
  assert.deepEqual(r.negativadas.map((d) => d.id), ["d2"]);
  assert.equal(r.totalNegativadasCentavos, 800000);
  assert.equal(r.parcelasMesCentavos, 250000);
});

test("patrimônio incompleto: dívida sem nenhum bem avisa; bem sem valor também", () => {
  const a = avisoPatrimonioIncompleto({ ativos: [], dividas: [jeep], hoje: "2026-10-03" });
  assert.match(a.motivos[0], /só as dívidas/);
  const b = avisoPatrimonioIncompleto({ ativos: [{ nome: "Galpão", valorAtualCentavos: 0 }], dividas: [], hoje: "2026-10-03" });
  assert.match(b.motivos[0], /Galpão está sem valor/);
  assert.equal(avisoPatrimonioIncompleto({ ativos: [{ nome: "X", valorAtualCentavos: 10, dataAvaliacao: "2026-09-01" }], dividas: [], hoje: "2026-10-03" }), null);
});
