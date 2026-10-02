import { test } from "node:test";
import assert from "node:assert/strict";
import { mapaDeMeses, marcosDosProximosMeses, acharBuraco } from "../src/domain/mapa12.js";

const HOJE = "2026-10-02";
const base = {
  transacoes: [], faturas: [], cartoes: [], dividas: [],
  fontesRenda: [{ id: "f1", nome: "Gedi", tipo: "fixa", ativa: true, valorEsperadoCentavos: 500000, diaRecebimento: 5, pessoaId: "p1", fim: "2026-11" }],
  recorrencias: [{ id: "r1", descricao: "Aluguel", tipo: "despesa", ativa: true, valorEstimadoCentavos: 290000, diaBase: 2, inicio: "2026-12", fim: null, pessoaId: "p1", categoriaId: "c1" }],
};

test("marcos: aluguel que começa e renda que acaba aparecem no mês certo", () => {
  const m = marcosDosProximosMeses({ ...base, hoje: HOJE });
  assert.deepEqual(m.map((x) => [x.competencia, x.tipo]), [["2026-12", "entrada_acaba"], ["2026-12", "saida_nova"]]);
});

test("mapa: dezembro vira o mês em que a sobra despenca", () => {
  const r = mapaDeMeses({ ...base, saldoInicialCentavos: 100000, gastoDiaADiaMensalCentavos: 0, hoje: HOJE, meses: 6 });
  const por = Object.fromEntries(r.linhas.map((l) => [l.competencia, l]));
  assert.equal(r.linhas.length, 6);
  assert.equal(por["2026-11"].sobraCentavos, 500000);
  // dezembro: renda do Gedi já acabou e o aluguel começou
  assert.equal(por["2026-12"].entradasCentavos, 0);
  assert.equal(por["2026-12"].saidasCentavos, 290000);
  assert.equal(por["2026-12"].sobraCentavos, -290000);
  assert.deepEqual(por["2026-12"].marcos.map((m) => m.tipo).sort(), ["entrada_acaba", "saida_nova"]);
  assert.equal(r.buraco.mesDaVirada, "2026-12");
  assert.equal(r.buraco.deficitMensalCentavos, 290000);
});

test("mapa: saldo seguro não conta renda incerta", () => {
  const b = { ...base, fontesRenda: [{ id: "f2", nome: "Eventual", tipo: "variavel", ativa: true, valorEsperadoCentavos: 900000, diaRecebimento: 5, pessoaId: "p1" }], recorrencias: [] };
  const r = mapaDeMeses({ ...b, saldoInicialCentavos: 0, hoje: HOJE, meses: 3 });
  assert.ok(r.linhas.every((l) => l.sobraCentavos === 0));
  assert.ok(r.linhas.some((l) => l.entradasIncertasCentavos > 0));
});

test("buraco: sem sobra negativa nem saldo negativo não há buraco", () => {
  assert.equal(acharBuraco([{ competencia: "2026-10", sobraCentavos: 10, saldoFimCentavos: 10 }, { competencia: "2026-11", sobraCentavos: 20, saldoFimCentavos: 30 }]), null);
});

test("buraco: quanto falta pra aguentar = ponto mais baixo do saldo", () => {
  const b = acharBuraco([
    { competencia: "2026-11", sobraCentavos: 500000, saldoFimCentavos: 600000 },
    { competencia: "2026-12", sobraCentavos: -290000, saldoFimCentavos: 310000 },
    { competencia: "2027-01", sobraCentavos: -290000, saldoFimCentavos: 20000 },
    { competencia: "2027-02", sobraCentavos: -290000, saldoFimCentavos: -270000 },
  ]);
  assert.equal(b.mesDaVirada, "2026-12");
  assert.equal(b.primeiroMesNegativo, "2027-02");
  assert.equal(b.faltaParaAguentarCentavos, 270000);
  assert.equal(b.saldoAntesDaViradaCentavos, 600000);
});

test("buraco: o mês corrente (só o resto) nunca vira a virada", () => {
  const b = acharBuraco([
    { competencia: "2026-10", atual: true, sobraCentavos: -300000, saldoFimCentavos: 500000 },
    { competencia: "2026-11", sobraCentavos: 100000, saldoFimCentavos: 600000 },
  ]);
  assert.equal(b, null);
});

test("mapa avisa quando não há histórico de gasto do dia a dia", () => {
  assert.equal(mapaDeMeses({ ...base, saldoInicialCentavos: 0, hoje: HOJE, meses: 2 }).semDiaADia, true);
  assert.equal(mapaDeMeses({ ...base, saldoInicialCentavos: 0, gastoDiaADiaMensalCentavos: 50000, hoje: HOJE, meses: 2 }).semDiaADia, false);
});
