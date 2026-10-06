import { test } from "node:test";
import assert from "node:assert/strict";
import { paraCentavos, paraReais, formatarBRL, formatarBRLCurto, somar, dividirCentavos } from "../src/domain/dinheiro.js";

test("paraCentavos: formatos brasileiros comuns", () => {
  assert.equal(paraCentavos("1.234,56"), 123456);
  assert.equal(paraCentavos("1234,56"), 123456);
  assert.equal(paraCentavos("1234.56"), 123456);
  assert.equal(paraCentavos("1234"), 123400);
  assert.equal(paraCentavos(""), 0);
  assert.equal(paraCentavos(null), 0);
  assert.equal(paraCentavos("abc"), 0);
});

test("paraCentavos: negativos", () => {
  assert.equal(paraCentavos("-50,00"), -5000);
  assert.equal(paraCentavos("(50,00)"), -5000);
});

test("paraCentavos: milhar sem decimal não confunde com decimal de 3 dígitos", () => {
  assert.equal(paraCentavos("1.234"), 123400);
});

test("paraCentavos: número direto (ex.: vindo de outro cálculo)", () => {
  assert.equal(paraCentavos(10.5), 1050);
});

test("paraReais é o inverso de centavos para exibição de cálculo", () => {
  assert.equal(paraReais(123456), 1234.56);
});

test("formatarBRL: padrão pt-BR com duas casas", () => {
  assert.equal(formatarBRL(123456), "R$ 1.234,56");
  assert.equal(formatarBRL(0), "R$ 0,00");
  assert.equal(formatarBRL(-5000), "-R$ 50,00");
});

test("formatarBRL: comSinal antepõe + a positivos, nunca a zero", () => {
  assert.equal(formatarBRL(5000, { comSinal: true }), "+R$ 50,00");
  assert.equal(formatarBRL(0, { comSinal: true }), "R$ 0,00");
  assert.equal(formatarBRL(-5000, { comSinal: true }), "-R$ 50,00");
});

test("formatarBRLCurto: abaixo de mil reais é igual ao formato completo", () => {
  assert.equal(formatarBRLCurto(50000), "R$ 500,00");
});

test("formatarBRLCurto: acima de mil reais abrevia em k", () => {
  assert.equal(formatarBRLCurto(1234500), "R$ 12,3k");
});

test("somar: soma segura, ignora valores inválidos", () => {
  assert.equal(somar(100, 200, 300), 600);
  assert.equal(somar(100, NaN, undefined, null), 100);
});

test("dividirCentavos: divisão exata não perde nem ganha centavo", () => {
  assert.deepEqual(dividirCentavos(9000, 3), [3000, 3000, 3000]);
});

test("dividirCentavos: divisão que não fecha distribui o resto nas primeiras parcelas", () => {
  const partes = dividirCentavos(10000, 3);
  assert.deepEqual(partes, [3334, 3333, 3333]);
  assert.equal(partes.reduce((a, b) => a + b, 0), 10000);
});

test("dividirCentavos: 1 centavo em 3 partes não inventa nem some dinheiro", () => {
  const partes = dividirCentavos(1, 3);
  assert.deepEqual(partes, [1, 0, 0]);
});

test("dividirCentavos: valor negativo também soma exato", () => {
  const partes = dividirCentavos(-1000, 3);
  assert.equal(partes.reduce((a, b) => a + b, 0), -1000);
});

test("regra de ouro: nunca ponto flutuante perdendo centavo", () => {
  // 0.1 + 0.2 em float não fecha em JS puro; em centavos inteiros, fecha.
  const a = paraCentavos("0,10");
  const b = paraCentavos("0,20");
  assert.equal(a + b, 30);
  assert.equal(formatarBRL(a + b), "R$ 0,30");
});

import { valorDigitadoValido } from "../src/domain/dinheiro.js";
test("13.1 item 18: valor digitado inválido é recusado em vez de virar R$ 0,00", () => {
  for (const ok of ["1.234,56", "1234,5", "1234.56", "R$ 90", "-15,00", "2252,98", "1,234.56", "0,99", "300"]) assert.equal(valorDigitadoValido(ok), true, ok);
  for (const ruim of ["1.2.3", "12,345,6", "abc", "", "  ", "1,2,3", "R$", "12a"]) assert.equal(valorDigitadoValido(ruim), false, JSON.stringify(ruim));
});
