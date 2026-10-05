import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoFavorecido, agruparFavorecidos, camposDaDecisao, regraDoFavorecido, aplicarRegras, precisaRevisar } from "../src/domain/favorecidos.js";
import { validarRegraClassificacao, padraoRegraClassificacao } from "../src/domain/esquema.js";

const categorias = [
  { id: "c-out", nome: "Outros", natureza: "despesa" },
  { id: "c-esc", nome: "Escritório", natureza: "despesa" },
  { id: "c-cli", nome: "Receita de clientes", natureza: "receita" },
  { id: "c-mer", nome: "Mercado", natureza: "despesa" },
];
const tx = (id, tipo, descricao, valorCentavos, data, categoriaId = "c-out") => ({ id, tipo, descricao, valorCentavos, data, categoriaId, status: "pago" });

test("chaveDoFavorecido: tira prefixo e sufixo do importador, acento e número de CNPJ", () => {
  assert.equal(chaveDoFavorecido("Serviço: Ana Maria De Jesus"), "ana maria de jesus");
  assert.equal(chaveDoFavorecido("Guillermo Ismael Mart (a classificar)"), "guillermo ismael mart");
  assert.equal(chaveDoFavorecido("28 125 720 Giuliana Marcato Lima (a classificar)"), "giuliana marcato lima");
  assert.equal(chaveDoFavorecido("Pix no crédito para Katia (a classificar)"), "katia");
});

test("precisaRevisar: despesa em Outros ou marcada a classificar; categoria boa não", () => {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  assert.equal(precisaRevisar(tx("1", "despesa", "Fulano", 100, "2026-01-01"), porId), true);
  assert.equal(precisaRevisar(tx("2", "despesa", "WMS", 100, "2026-01-01", "c-mer"), porId), false);
  assert.equal(precisaRevisar(tx("3", "receita", "Serviço: X", 100, "2026-01-01", "c-cli"), porId), false);
  assert.equal(precisaRevisar(tx("4", "receita", "Y (a classificar)", 100, "2026-01-01", "c-cli"), porId), true);
  assert.equal(precisaRevisar({ ...tx("6", "despesa", "Fulano", 100, "2026-01-01"), status: "previsto" }, porId), false);
  assert.equal(precisaRevisar(tx("7", "despesa", "Compras até o fechamento (fatura OUT, detalhe a chegar)", 100, "2026-01-01"), porId), false);
  assert.equal(precisaRevisar({ ...tx("5", "transferencia", "x", 1, "2026-01-01"), tipo: "transferencia" }, porId), false);
});

test("agruparFavorecidos: junta pelo nome, soma e ordena pelo maior valor", () => {
  const lista = [
    tx("1", "despesa", "Ana Maria De Jesus (a classificar)", 100000, "2026-04-14"),
    tx("2", "despesa", "Ana Maria De Jesus (a classificar)", 8000, "2026-04-20"),
    tx("3", "receita", "Serviço: Ana Maria De Jesus (a classificar)", 19300, "2026-04-22", "c-cli"),
    tx("4", "despesa", "Gringo Pay S.A. (a classificar)", 140002, "2026-01-26"),
    tx("5", "despesa", "Mercado X", 5000, "2026-01-02", "c-mer"),
  ];
  const g = agruparFavorecidos(lista, categorias);
  assert.deepEqual(g.map((x) => x.chave), ["gringo pay s.a.", "ana maria de jesus"]);
  const ana = g[1];
  assert.equal(ana.quantidade, 3);
  assert.equal(ana.saiuCentavos, 108000);
  assert.equal(ana.entrouCentavos, 19300);
  assert.equal(ana.desde, "2026-04-14");
  assert.equal(ana.ate, "2026-04-22");
});

test("camposDaDecisao: categoria só serve se a natureza bate; repasse vira entrada ou saída", () => {
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const gasto = tx("1", "despesa", "Guillermo Ismael Mart (a classificar)", 71000, "2026-08-12");
  const ganho = tx("2", "receita", "Serviço: Y", 1000, "2026-08-12", "c-cli");
  const c = camposDaDecisao(gasto, { tipo: "categoria", categoriaId: "c-esc" }, porId);
  assert.equal(c.categoriaId, "c-esc");
  assert.equal(c.descricao, "Guillermo Ismael Mart");
  assert.equal(c.revisado, true);
  assert.equal(camposDaDecisao(ganho, { tipo: "categoria", categoriaId: "c-esc" }, porId), null);
  assert.deepEqual(camposDaDecisao(gasto, { tipo: "repasse" }, porId), { tipo: "repasse", direcao: "saida", categoriaId: "", revisado: true });
  assert.equal(camposDaDecisao(ganho, { tipo: "repasse" }, porId).direcao, "entrada");
});

test("regras: valem para o próximo extrato e a mais específica ganha", () => {
  const regras = [
    { id: "r1", chave: "ana maria", decisao: { tipo: "repasse" } },
    { id: "r2", chave: "ana maria de jesus", decisao: { tipo: "categoria", categoriaId: "c-esc" } },
  ];
  assert.equal(regraDoFavorecido(regras, "Ana Maria De Jesus (a classificar)").id, "r2");
  assert.equal(regraDoFavorecido(regras, "Ana Maria V B Bistrat (a classificar)").id, "r1");
  assert.equal(regraDoFavorecido(regras, "Outro nome"), null);
  const novos = [tx("9", "despesa", "Guillermo Ismael Mart (a classificar)", 100, "2026-10-01"), tx("10", "despesa", "Desconhecido (a classificar)", 100, "2026-10-01")];
  const prop = aplicarRegras(novos, [{ id: "r3", chave: "guillermo", decisao: { tipo: "categoria", categoriaId: "c-esc" } }], categorias);
  assert.equal(prop.length, 1);
  assert.equal(prop[0].id, "9");
  assert.equal(prop[0].campos.categoriaId, "c-esc");
});

test("validarRegraClassificacao: exige favorecido e categoria quando a decisão é categoria", () => {
  assert.deepEqual(validarRegraClassificacao(padraoRegraClassificacao({ chave: "x", decisao: { tipo: "repasse" } })), []);
  assert.equal(validarRegraClassificacao(padraoRegraClassificacao({ chave: "", decisao: { tipo: "repasse" } })).length, 1);
  assert.equal(validarRegraClassificacao(padraoRegraClassificacao({ chave: "x", decisao: { tipo: "categoria", categoriaId: "" } })).length, 1);
});
