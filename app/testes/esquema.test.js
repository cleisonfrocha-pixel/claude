import { test } from "node:test";
import assert from "node:assert/strict";
import {
  padraoPessoa, padraoConta, padraoCartao, padraoCategoria,
  padraoTransacao, padraoRecorrencia, padraoDivida,
  validarPessoa, validarConta, validarCartao, validarCategoria,
  validarTransacao, validarRecorrencia, validarDivida,
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

test("validarConta rejeita status que não seja 'ativa'/'encerrada' — regressão do bug do checkbox", () => {
  // O campo "Encerrada" do formulário é uma caixa de marcar sobre um campo
  // de texto (ver telaCadastro.js, valorMarcado/valorDesmarcado). Sem essa
  // ponte, o valor gravado vira um booleano puro (true/false) em vez da
  // string esperada — isto aconteceu de verdade e passava batido porque
  // validarConta não conferia o status.
  const c = padraoConta({ nome: "Conta principal", pessoaId: "p1", status: false });
  assert.ok(validarConta(c).some((e) => e.includes("Status")));
});

test("validarCartao cobre responsável, conta de pagamento e dias válidos", () => {
  const c = padraoCartao({ apelido: "Roxinho", pessoaId: "p1", contaPagamentoId: "c1", diaFechamento: 40 });
  const erros = validarCartao(c);
  assert.ok(erros.some((e) => e.includes("fechamento")));
});

test("validarCategoria exige nome e valida grupo/natureza", () => {
  assert.deepEqual(validarCategoria(padraoCategoria({ nome: "Mercado" })), []);
});

test("validarTransacao exige valor positivo e conta ou cartão", () => {
  const t = padraoTransacao({ tipo: "despesa", valorCentavos: 0, categoriaId: "cat1" });
  const erros = validarTransacao(t);
  assert.ok(erros.some((e) => e.includes("Valor")));
  assert.ok(erros.some((e) => e.includes("conta")));
});

test("validarTransacao: despesa e receita exigem categoria", () => {
  const t = padraoTransacao({ tipo: "despesa", valorCentavos: 1000, contaId: "c1", categoriaId: "" });
  assert.ok(validarTransacao(t).some((e) => e.includes("categoria")));
});

test("validarTransacao: transferência não exige conta/cartão no mesmo campo genérico", () => {
  const t = padraoTransacao({ tipo: "transferencia", valorCentavos: 1000, contaId: "c1" });
  assert.deepEqual(validarTransacao(t), []);
});

test("validarTransacao passa com uma despesa completa", () => {
  const t = padraoTransacao({ tipo: "despesa", valorCentavos: 5000, contaId: "c1", categoriaId: "cat1" });
  assert.deepEqual(validarTransacao(t), []);
});

test("validarRecorrencia exige descrição, valor, destino, categoria e periodicidade válida", () => {
  const r = padraoRecorrencia({ descricao: "", valorEstimadoCentavos: 0 });
  const erros = validarRecorrencia(r);
  assert.ok(erros.length >= 3);
});

test("validarRecorrencia passa com dados completos", () => {
  const r = padraoRecorrencia({ descricao: "Aluguel", valorEstimadoCentavos: 150000, contaId: "c1", categoriaId: "cat1" });
  assert.deepEqual(validarRecorrencia(r), []);
});

test("validarDivida exige nome, responsável, saldo e parcela positivos", () => {
  const d = padraoDivida({ nome: "", pessoaId: "", saldoOriginalCentavos: 0, valorParcelaCentavos: 0 });
  const erros = validarDivida(d);
  assert.ok(erros.length >= 4);
});

test("validarDivida rejeita parcelas pagas maior que o total — regressão de digitação", () => {
  const d = padraoDivida({ nome: "Carro", pessoaId: "p1", saldoOriginalCentavos: 100000, valorParcelaCentavos: 10000, quantidadeParcelas: 5, parcelasPagas: 8 });
  assert.ok(validarDivida(d).some((e) => e.includes("Parcelas pagas")));
});

test("validarDivida passa com dados completos e taxa de juros nula", () => {
  const d = padraoDivida({ nome: "Financiamento", pessoaId: "p1", saldoOriginalCentavos: 1200000, valorParcelaCentavos: 100000, quantidadeParcelas: 12, parcelasPagas: 2 });
  assert.deepEqual(validarDivida(d), []);
});
