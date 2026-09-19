import { test } from "node:test";
import assert from "node:assert/strict";
import {
  padraoPessoa, padraoConta, padraoCartao, padraoCategoria,
  validarPessoa, validarConta, validarCartao, validarCategoria,
} from "../src/domain/esquema.js";

test("padraoPessoa preenche papel e ativo, mas não inventa nome", () => {
  const p = padraoPessoa({ nome: "Cleison" });
  assert.equal(p.nome, "Cleison");
  assert.equal(p.papel, "titular");
  assert.equal(p.ativo, true);
});

test("validarPessoa exige nome", () => {
  assert.deepEqual(validarPessoa(padraoPessoa({ nome: "" })), ["Nome é obrigatório."]);
  assert.deepEqual(validarPessoa(padraoPessoa({ nome: "Ana" })), []);
});

test("validarConta exige nome, responsável e tipo válido", () => {
  const erros = validarConta(padraoConta({ nome: "", pessoaId: "" }));
  assert.equal(erros.length, 2);
});

test("validarConta passa com dados completos", () => {
  const c = padraoConta({ nome: "Conta principal", pessoaId: "p1" });
  assert.deepEqual(validarConta(c), []);
});

test("validarCartao cobre responsável, conta de pagamento e dias válidos", () => {
  const c = padraoCartao({ apelido: "Roxinho", pessoaId: "p1", contaPagamentoId: "c1", diaFechamento: 40 });
  const erros = validarCartao(c);
  assert.ok(erros.some((e) => e.includes("fechamento")));
});

test("validarCategoria exige nome e valida grupo/natureza", () => {
  assert.deepEqual(validarCategoria(padraoCategoria({ nome: "Mercado" })), []);
});
