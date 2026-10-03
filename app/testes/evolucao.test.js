import { test } from "node:test";
import assert from "node:assert/strict";
import { montarEvolucao, pagasComAtraso, mesclarInstantaneo } from "../src/domain/evolucao.js";

const hoje = "2026-10-03";
const cats = [{ id: "c", nome: "Casa", essencial: true }];
const paga = (o) => ({ tipo: "despesa", status: "pago", categoriaId: "c", valorCentavos: 10000, ...o });
const rec = (o) => ({ tipo: "receita", status: "pago", valorCentavos: 500000, ...o });

test("contas pagas com atraso: conta por mês do vencimento, ignora cartão e verba", () => {
  const t = [
    paga({ data: "2026-08-05", pagoEm: "2026-08-15", competencia: "2026-08" }),
    paga({ data: "2026-08-10", pagoEm: "2026-08-10", competencia: "2026-08" }),
    paga({ data: "2026-08-10", pagoEm: "2026-08-30", competencia: "2026-08", semDia: true }),
    paga({ data: "2026-08-10", pagoEm: "2026-08-30", competencia: "2026-08", cartaoId: "x" }),
  ];
  const p = pagasComAtraso(t, "2026-08");
  assert.equal(p.quantidade, 1);
  assert.equal(p.diasMedios, 10);
});

test("tendência: melhorando quando atrasos e dívida caem e o resultado sobe; mês corrente fica de fora", () => {
  const t = [
    rec({ data: "2026-07-05", competencia: "2026-07" }), paga({ data: "2026-07-05", pagoEm: "2026-07-20", competencia: "2026-07", valorCentavos: 300000 }), paga({ data: "2026-07-06", pagoEm: "2026-07-21", competencia: "2026-07", valorCentavos: 100000 }),
    rec({ data: "2026-08-05", competencia: "2026-08" }), paga({ data: "2026-08-05", pagoEm: "2026-08-05", competencia: "2026-08", valorCentavos: 100000 }),
    rec({ data: "2026-10-01", competencia: "2026-10", valorCentavos: 1 }),
  ];
  const e = montarEvolucao({ transacoes: t, categorias: cats, dividas: [], hoje, meses: 4,
    snapshots: [{ competencia: "2026-07", liquidoCentavos: 0, passivosCentavos: 900000 }, { competencia: "2026-08", liquidoCentavos: 50000, passivosCentavos: 800000 }], instantaneos: [] });
  assert.equal(e.tendencia.status, "melhorando");
  assert.ok(e.tendencia.comparados >= 3);
  const set = e.serie.find((s) => s.competencia === "2026-09");
  assert.equal(set.temDados, false);
  assert.equal(set.patrimonioLiquidoCentavos, null);
});

test("sem dois meses fechados com dados, é 'sem dados' e nada é inventado", () => {
  const e = montarEvolucao({ transacoes: [rec({ data: "2026-09-05", competencia: "2026-09" })], categorias: cats, dividas: [], hoje, snapshots: [], instantaneos: [] });
  assert.equal(e.tendencia.status, "sem_dados");
});

test("instantâneo guarda o pior momento visto no mês e o máximo de atrasadas", () => {
  const a = mesclarInstantaneo(null, { competencia: "2026-10", menorPontoCentavos: 5000, atrasadasQuantidade: 3, atrasadasCentavos: 1, livreGarantidoCentavos: 0, hoje: "2026-10-03" });
  const b = mesclarInstantaneo(a, { competencia: "2026-10", menorPontoCentavos: 9000, atrasadasQuantidade: 1, atrasadasCentavos: 1, livreGarantidoCentavos: 0, hoje: "2026-10-04" });
  assert.equal(b.menorPontoCentavos, 5000);
  assert.equal(b.atrasadasMaximo, 3);
  assert.equal(b.atrasadasQuantidade, 1);
});
