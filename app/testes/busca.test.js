import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrarTransacoes, haFiltroAtivo, buscaGlobal, transacoesParaCSV, atividadeRecente, montarExportacao } from "../src/domain/busca.js";

const ts = [
  { id: "1", descricao: "Conta de Luz", valorCentavos: 15065, data: "2026-10-13", pessoaId: "p1", categoriaId: "c1", tipo: "despesa", status: "previsto" },
  { id: "2", descricao: "Salário Ação", valorCentavos: 500000, data: "2026-10-05", pessoaId: "p2", categoriaId: "c2", tipo: "receita", status: "pago" },
];

test("filtro por texto ignora acento e caixa; acha por valor", () => {
  assert.deepEqual(filtrarTransacoes(ts, { texto: "acao" }).map((t) => t.id), ["2"]);
  assert.deepEqual(filtrarTransacoes(ts, { texto: "150,6" }).map((t) => t.id), ["1"]);
});

test("filtros combinam (pessoa + status) e período", () => {
  assert.deepEqual(filtrarTransacoes(ts, { pessoaId: "p1", status: "previsto" }).map((t) => t.id), ["1"]);
  assert.deepEqual(filtrarTransacoes(ts, { de: "2026-10-10" }).map((t) => t.id), ["1"]);
  assert.equal(haFiltroAtivo({ texto: "", pessoaId: "" }), false);
  assert.equal(haFiltroAtivo({ texto: "x" }), true);
});

test("busca global agrupa por tipo e exige 2 letras", () => {
  const g = buscaGlobal({ transacoes: ts, dividas: [{ id: "d", nome: "Financiamento Jeep", credor: "Banco" }] }, "luz");
  assert.deepEqual(g.map((x) => x.tipo), ["transacao"]);
  assert.equal(buscaGlobal({ transacoes: ts }, "l").length, 0);
  assert.equal(buscaGlobal({ dividas: [{ id: "d", nome: "Financiamento Jeep" }] }, "jeep")[0].tipo, "divida");
});

test("CSV: valor em reais com vírgula, aspas escapadas, nomes no lugar dos ids", () => {
  const csv = transacoesParaCSV([{ ...ts[0], descricao: 'Luz "2"; relógio', contaId: "k1" }], { contas: [{ id: "k1", nome: "Next" }], categorias: [{ id: "c1", nome: "Moradia" }] });
  const [cab, linha] = csv.split("\n");
  assert.match(cab, /^data;tipo;descricao;valor/);
  assert.match(linha, /"Luz ""2""; relógio";150,65;previsto/);
  assert.match(linha, /;Next;;Moradia;/);
});

test("atividade recente ordena do mais novo, distingue criado de alterado", () => {
  const a = atividadeRecente({ dividas: [{ id: "1", nome: "A", criadoEm: "2026-10-01T00:00:00Z", atualizadoEm: "2026-10-03T00:00:00Z" }, { id: "2", nome: "B", criadoEm: "2026-10-02T00:00:00Z" }] });
  assert.deepEqual(a.map((x) => [x.titulo, x.acao]), [["A", "alterado"], ["B", "criado"]]);
  assert.equal(JSON.parse(montarExportacao({ x: [] }, "2026-10-03")).versao, 1);
});
