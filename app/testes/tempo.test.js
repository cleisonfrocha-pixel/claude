import { test } from "node:test";
import assert from "node:assert/strict";
import {
  competenciaAtual, competenciaDeData, competenciaLabel, competenciaAbrevAno,
  somarMeses, compararCompetencia, diferencaEmMeses, diasNoMes, dataDeCompetencia,
  somarDias, hojeISO,
} from "../src/domain/tempo.js";

test("competenciaAtual usa o relógio informado", () => {
  assert.equal(competenciaAtual(new Date(2026, 2, 15)), "2026-03");
});

test("competenciaDeData extrai AAAA-MM de uma data ISO", () => {
  assert.equal(competenciaDeData("2026-01-05T10:00:00Z"), "2026-01");
});

test("competenciaLabel formata por extenso em pt-BR", () => {
  assert.equal(competenciaLabel("2026-01"), "Janeiro 2026");
  assert.equal(competenciaLabel("2026-12"), "Dezembro 2026");
});

test("competenciaAbrevAno formata curto", () => {
  assert.equal(competenciaAbrevAno("2026-03"), "Mar/26");
});

test("somarMeses avança e vira o ano corretamente", () => {
  assert.equal(somarMeses("2025-12", 2), "2026-02");
  assert.equal(somarMeses("2026-01", -1), "2025-12");
});

test("compararCompetencia ordena cronologicamente", () => {
  assert.equal(compararCompetencia("2026-01", "2026-02"), -1);
  assert.equal(compararCompetencia("2026-02", "2026-01"), 1);
  assert.equal(compararCompetencia("2026-01", "2026-01"), 0);
});

test("diferencaEmMeses conta meses entre competências, cruzando o ano", () => {
  assert.equal(diferencaEmMeses("2025-11", "2026-02"), 3);
  assert.equal(diferencaEmMeses("2026-02", "2025-11"), -3);
});

test("diasNoMes conta corretamente, inclusive fevereiro bissexto", () => {
  assert.equal(diasNoMes("2026-02"), 28);
  assert.equal(diasNoMes("2028-02"), 29);
  assert.equal(diasNoMes("2026-04"), 30);
  assert.equal(diasNoMes("2026-01"), 31);
});

test("dataDeCompetencia limita o dia ao último dia real do mês", () => {
  assert.equal(dataDeCompetencia("2026-02", 31), "2026-02-28");
  assert.equal(dataDeCompetencia("2028-02", 31), "2028-02-29");
  assert.equal(dataDeCompetencia("2026-01", 15), "2026-01-15");
  assert.equal(dataDeCompetencia("2026-01", 0), "2026-01-01");
});

test("somarDias avança dentro do mês", () => {
  assert.equal(somarDias("2026-09-19", 10), "2026-09-29");
});

test("somarDias cruza mês e ano corretamente", () => {
  assert.equal(somarDias("2026-09-19", 30), "2026-10-19");
  assert.equal(somarDias("2026-12-20", 15), "2027-01-04");
});

test("somarDias aceita negativo (volta no tempo)", () => {
  assert.equal(somarDias("2026-01-05", -10), "2025-12-26");
});

test("hojeISO usa o relógio informado", () => {
  assert.equal(hojeISO(new Date(2026, 8, 19)), "2026-09-19");
});
