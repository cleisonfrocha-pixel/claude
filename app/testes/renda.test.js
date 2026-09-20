import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularRendaAtual, calcularConcentracaoRenda, calcularPrevisibilidadeFonte, historicoFonte,
  calcularGaps, diagnosticarCausaDeficit,
} from "../src/domain/renda.js";

function receita(overrides) {
  return { tipo: "receita", status: "pago", certeza: "confirmado", valorCentavos: 0, ...overrides };
}

// ---------- calcularRendaAtual ----------

test("calcularRendaAtual: só soma receita paga da competência", () => {
  const transacoes = [
    receita({ competencia: "2026-03", valorCentavos: 400000 }),
    receita({ competencia: "2026-03", valorCentavos: 100000, status: "previsto" }), // não conta
    receita({ competencia: "2026-02", valorCentavos: 999999 }), // fora do mês
  ];
  assert.equal(calcularRendaAtual(transacoes, "2026-03"), 400000);
});

// ---------- calcularConcentracaoRenda ----------

test("calcularConcentracaoRenda: concentração é a fatia da maior fonte", () => {
  const transacoes = [
    receita({ competencia: "2026-03", fonteRendaId: "f1", valorCentavos: 400000 }),
    receita({ competencia: "2026-03", fonteRendaId: "f2", valorCentavos: 100000 }),
  ];
  const r = calcularConcentracaoRenda(transacoes, "2026-03");
  assert.equal(r.totalCentavos, 500000);
  assert.equal(r.concentracaoPercentual, 80);
  assert.equal(r.quantidadeFontes, 2);
});

test("calcularConcentracaoRenda: receita sem fonte cadastrada não desaparece do total, mas não conta como fonte", () => {
  const transacoes = [receita({ competencia: "2026-03", fonteRendaId: null, valorCentavos: 200000 })];
  const r = calcularConcentracaoRenda(transacoes, "2026-03");
  assert.equal(r.totalCentavos, 200000, "o dinheiro em si nunca some da conta");
  assert.equal(r.concentracaoPercentual, 100, "percentual ainda reflete a fatia real, com ou sem fonte nomeada");
  assert.equal(r.quantidadeFontes, 0, "'sem-fonte' não é uma fonte cadastrada de verdade — dizer '1 fonte' seria inventar um cadastro que não existe");
});

test("calcularConcentracaoRenda: mistura de receita com e sem fonte conta só as fontes reais", () => {
  const transacoes = [
    receita({ competencia: "2026-03", fonteRendaId: "f1", valorCentavos: 300000 }),
    receita({ competencia: "2026-03", fonteRendaId: null, valorCentavos: 200000 }),
  ];
  const r = calcularConcentracaoRenda(transacoes, "2026-03");
  assert.equal(r.quantidadeFontes, 1);
});

// ---------- calcularPrevisibilidadeFonte ----------

test("calcularPrevisibilidadeFonte: null quando não há nenhuma entrada no período", () => {
  const r = calcularPrevisibilidadeFonte({ id: "f1" }, [], { competenciaAtual: "2026-03" });
  assert.equal(r, null);
});

test("calcularPrevisibilidadeFonte: previsibilidade é a fatia confirmada, conta os meses com entrada", () => {
  const transacoesDaFonte = [
    receita({ competencia: "2026-03", fonteRendaId: "f1", valorCentavos: 500000, certeza: "confirmado" }),
    receita({ competencia: "2026-02", fonteRendaId: "f1", valorCentavos: 500000, certeza: "provavel" }),
    receita({ competencia: "2025-01", fonteRendaId: "f1", valorCentavos: 999999 }), // fora da janela de 3 meses
  ];
  const r = calcularPrevisibilidadeFonte({ id: "f1" }, transacoesDaFonte, { competenciaAtual: "2026-03", mesesLookback: 3 });
  assert.equal(r.previsibilidadePercentual, 50);
  assert.equal(r.mesesComEntrada, 2);
});

// ---------- historicoFonte ----------

test("historicoFonte: mais recente primeiro, só da fonte pedida", () => {
  const transacoes = [
    receita({ id: "t1", fonteRendaId: "f1", data: "2026-01-05" }),
    receita({ id: "t2", fonteRendaId: "f1", data: "2026-03-05" }),
    receita({ id: "t3", fonteRendaId: "f2", data: "2026-02-05" }),
  ];
  const r = historicoFonte({ id: "f1" }, transacoes);
  assert.deepEqual(r.map((t) => t.id), ["t2", "t1"]);
});

// ---------- calcularGaps ----------

test("calcularGaps: cada gap é renda menos o patamar de custo, null quando o patamar não existe", () => {
  const r = calcularGaps({ rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, custoDesejadoCentavos: 600000, metaRecuperacaoCentavos: null });
  assert.equal(r.gapEssencialCentavos, 200000);
  assert.equal(r.gapDesejadoCentavos, -100000);
  assert.equal(r.gapRecuperacaoCentavos, null);
});

// ---------- diagnosticarCausaDeficit (PORTÃO DA FASE 8) ----------

test("PORTÃO DA FASE 8: renda não cobre nem o essencial -> causa 'renda'", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 200000, custoEssencialCentavos: 300000, custoAtualCentavos: 300000,
    comprometimentoMensalDividasCentavos: 0, seguroParaGastarCentavos: -100000,
  });
  assert.equal(r.temDeficit, true);
  assert.ok(r.causas.some((c) => c.tipo === "renda"));
});

test("PORTÃO DA FASE 8: renda cobre o essencial mas o gasto do mês passou muito disso -> causa 'gasto'", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, custoAtualCentavos: 550000,
    comprometimentoMensalDividasCentavos: 0, seguroParaGastarCentavos: -50000,
  });
  assert.equal(r.temDeficit, true);
  assert.equal(r.causas.length, 1, "só o gasto explica, não deveria inventar as outras causas");
  assert.equal(r.causas[0].tipo, "gasto");
});

test("PORTÃO DA FASE 8: sobra depois do essencial não cobre a parcela da dívida -> causa 'divida'", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 350000, custoEssencialCentavos: 300000, custoAtualCentavos: 300000,
    comprometimentoMensalDividasCentavos: 100000, seguroParaGastarCentavos: -50000,
  });
  assert.ok(r.causas.some((c) => c.tipo === "divida"));
  assert.equal(r.causas.some((c) => c.tipo === "renda"), false, "a renda cobre o essencial, não é causa aqui");
});

test("PORTÃO DA FASE 8: mês fecha no papel mas o caixa aperta agora -> causa 'timing', sozinha", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, custoAtualCentavos: 320000,
    comprometimentoMensalDividasCentavos: 0, seguroParaGastarCentavos: -20000,
  });
  assert.equal(r.temDeficit, true);
  assert.deepEqual(r.causas.map((c) => c.tipo), ["timing"]);
});

test("PORTÃO DA FASE 8: sem déficit nenhum, nenhuma causa aparece", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 500000, custoEssencialCentavos: 300000, custoAtualCentavos: 320000,
    comprometimentoMensalDividasCentavos: 50000, seguroParaGastarCentavos: 100000,
  });
  assert.equal(r.temDeficit, false);
  assert.deepEqual(r.causas, []);
});

test("PORTÃO DA FASE 8: déficit por combinação de causas ao mesmo tempo", () => {
  const r = diagnosticarCausaDeficit({
    rendaAtualCentavos: 250000, custoEssencialCentavos: 300000, custoAtualCentavos: 400000,
    comprometimentoMensalDividasCentavos: 50000, seguroParaGastarCentavos: -200000,
  });
  const tipos = r.causas.map((c) => c.tipo);
  assert.ok(tipos.includes("renda"));
  assert.ok(tipos.includes("gasto"));
  assert.ok(tipos.includes("divida"));
  assert.ok(tipos.length >= 2, "mais de uma causa ao mesmo tempo é exatamente a 'combinação' que o blueprint pede");
});
