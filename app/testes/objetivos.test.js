import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularHorizonteObjetivo, calcularProgressoObjetivo,
  verificarCompatibilidadeComMargem, simularNovoPrazo,
} from "../src/domain/objetivos.js";

function objetivo(overrides) {
  return { nome: "Viagem", valorAlvoCentavos: 1200000, prazo: "2026-12-01", ...overrides };
}

// ---------- calcularHorizonteObjetivo ----------

test("calcularHorizonteObjetivo: até 12 meses é curto prazo", () => {
  assert.equal(calcularHorizonteObjetivo("2026-12-01", "2026-03-01"), "curto");
});

test("calcularHorizonteObjetivo: até 36 meses é médio prazo", () => {
  assert.equal(calcularHorizonteObjetivo("2028-06-01", "2026-03-01"), "medio");
});

test("calcularHorizonteObjetivo: além de 36 meses é longo prazo", () => {
  assert.equal(calcularHorizonteObjetivo("2032-01-01", "2026-03-01"), "longo");
});

// ---------- calcularProgressoObjetivo ----------

test("calcularProgressoObjetivo: progresso percentual, o que falta, e o valor necessário por mês", () => {
  const o = objetivo({ valorAlvoCentavos: 1200000, prazo: "2026-09-01" });
  const r = calcularProgressoObjetivo(o, 300000, "2026-03-01");
  assert.equal(r.progressoPercentual, 25);
  assert.equal(r.faltaCentavos, 900000);
  assert.equal(r.mesesRestantes, 6);
  assert.equal(r.valorNecessarioPorMesCentavos, 150000);
});

test("calcularProgressoObjetivo: prazo já vencido não fica com meses negativos", () => {
  const o = objetivo({ valorAlvoCentavos: 1000000, prazo: "2026-01-01" });
  const r = calcularProgressoObjetivo(o, 500000, "2026-03-01");
  assert.equal(r.mesesRestantes, 0);
  assert.equal(r.valorNecessarioPorMesCentavos, 500000, "sem meses restantes, precisa do que falta de uma vez");
});

test("calcularProgressoObjetivo: progresso nunca passa de 100%", () => {
  const o = objetivo({ valorAlvoCentavos: 100000, prazo: "2026-09-01" });
  const r = calcularProgressoObjetivo(o, 999999, "2026-03-01");
  assert.equal(r.progressoPercentual, 100);
  assert.equal(r.faltaCentavos, 0);
});

// ---------- verificarCompatibilidadeComMargem (PORTÃO §16) ----------

test("PORTÃO §16: meta compatível com a margem atual", () => {
  const o = objetivo({ valorAlvoCentavos: 1200000, prazo: "2026-09-01" });
  const r = verificarCompatibilidadeComMargem(o, 300000, 200000, "2026-03-01");
  // falta 900000 em 6 meses = 150000/mês; margem de 200000 cobre
  assert.equal(r.valorNecessarioPorMesCentavos, 150000);
  assert.equal(r.compativel, true);
  assert.equal(r.faltaPorMesCentavos, 0);
});

test("PORTÃO §16: meta incompatível diz exatamente quanto falta por mês, não só 'não cabe'", () => {
  const o = objetivo({ valorAlvoCentavos: 1200000, prazo: "2026-09-01" });
  const r = verificarCompatibilidadeComMargem(o, 300000, 80000, "2026-03-01");
  // falta 900000 em 6 meses = 150000/mês; margem de apenas 80000 não cobre
  assert.equal(r.valorNecessarioPorMesCentavos, 150000);
  assert.equal(r.compativel, false);
  assert.equal(r.faltaPorMesCentavos, 70000);
});

// ---------- simularNovoPrazo ----------

test("simularNovoPrazo: com mais margem, o prazo encurta — simulação pura, não altera o objetivo", () => {
  const o = Object.freeze(objetivo({ valorAlvoCentavos: 1200000, prazo: "2026-09-01" }));
  const r = simularNovoPrazo(o, 300000, 300000);
  assert.equal(r.mesesNecessarios, 3, "faltam 900000, com 300000/mês são 3 meses");
  assert.equal(r.atingivel, true);
  assert.equal(o.valorAlvoCentavos, 1200000, "o objetivo real não foi tocado pela simulação");
});

test("simularNovoPrazo: margem zero ou negativa nunca atinge a meta", () => {
  const o = objetivo({ valorAlvoCentavos: 1200000 });
  const r = simularNovoPrazo(o, 300000, 0);
  assert.equal(r.atingivel, false);
  assert.equal(r.mesesNecessarios, null);
});

test("simularNovoPrazo: objetivo já alcançado não precisa de mais nenhum mês", () => {
  const o = objetivo({ valorAlvoCentavos: 100000 });
  const r = simularNovoPrazo(o, 200000, 50000);
  assert.equal(r.mesesNecessarios, 0);
  assert.equal(r.atingivel, true);
});
