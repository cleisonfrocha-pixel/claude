import { test } from "node:test";
import assert from "node:assert/strict";
import { montarEscritas, montarDesfazer, resolver } from "../ferramentas/subirPainel.js";

const AGORA = "2026-09-26T12:00:00.000Z";

function estadoBase() {
  return {
    pessoas: [{ id: "p1", nome: "Cleison Fiorin ", papel: "titular", ativo: true }],
    contas: [
      { id: "c1", nome: "Nubank", instituicao: "NUBANK", pessoaId: "p1", tipo: "corrente", status: "ativa", saldoInicialCentavos: 0 },
      { id: "c2", nome: "Next", instituicao: "Next", pessoaId: "p1", tipo: "corrente", status: "ativa", saldoInicialCentavos: 0 },
    ],
    cartoes: [{ id: "k1", apelido: "Nubank Roxinho", pessoaId: "p1", contaPagamentoId: "c1", diaFechamento: 20, diaVencimento: 28, status: "ativo" }],
    categorias: [
      { id: "cat-mor", nome: "Moradia", grupo: "moradia", natureza: "despesa", essencial: true },
      { id: "cat-sal", nome: "Salário", grupo: "renda", natureza: "receita" },
      { id: "cat-div", nome: "Dívidas e parcelas", grupo: "dividas", natureza: "despesa", essencial: true },
    ],
    fontesRenda: [{ id: "f1", nome: "Sociable", pessoaId: "p1", tipo: "fixa", valorEsperadoCentavos: 450000 }],
    dividas: [{ id: "d1", nome: "Jeep", credor: "Banco", pessoaId: "p1", saldoOriginalCentavos: 6000000, valorParcelaCentavos: 129000, quantidadeParcelas: 48, parcelasPagas: 20, dataInicio: "2025-01-10" }],
    faturas: [],
    transacoes: [],
    lotesImportacao: [],
  };
}

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

function montar(itens, estado = estadoBase()) {
  return montarEscritas({ estado, pedido: { mensagemOriginal: "msg", hoje: "2026-09-26", itens }, agora: AGORA, gerarId: ids() });
}

const sets = (r, colecao) => r.escritas.filter((e) => e.op === "set" && e.collection === colecao).map((e) => e.data);

test("resolver: acha por nome sem acento/caixa, primeiro nome e id", () => {
  const e = estadoBase();
  assert.equal(resolver(e, "contas", "nubank").id, "c1");
  assert.equal(resolver(e, "pessoas", "cleison").id, "p1");
  assert.equal(resolver(e, "categorias", "salario").id, "cat-sal");
  assert.equal(resolver(e, "contas", "c2").id, "c2");
  assert.throws(() => resolver(e, "contas", "Itaú"), /não existe/);
});

test("despesa: nasce igual à do app, marcada como vinda do chat e não revisada", () => {
  const r = montar([{ acao: "despesa", valor: "350,00", conta: "nubank", categoria: "moradia", descricao: "Luz", data: "2026-09-25" }]);
  assert.deepEqual(r.pendencias, []);
  const [t] = sets(r, "transacoes");
  assert.equal(t.valorCentavos, 35000);
  assert.equal(t.tipo, "despesa");
  assert.equal(t.contaId, "c1");
  assert.equal(t.pessoaId, "p1");
  assert.equal(t.competencia, "2026-09");
  assert.equal(t.origem, "chat");
  assert.equal(t.origemId, r.loteId);
  assert.equal(t.revisado, false);
  const [lote] = sets(r, "lotesImportacao");
  assert.equal(lote.formato, "chat");
  assert.equal(lote.texto, "msg");
  assert.equal(lote.quantidadeCandidatos, 1);
});

test("despesa no cartão: cria a fatura certa pelo fechamento e reaproveita a existente", () => {
  const r = montar([
    { acao: "despesa", valor: 100, cartao: "roxinho", categoria: "Moradia", data: "2026-09-25" },
    { acao: "despesa", valor: 50, cartao: "roxinho", categoria: "Moradia", data: "2026-09-26" },
  ]);
  const faturas = sets(r, "faturas");
  assert.equal(faturas.length, 1);
  assert.equal(faturas[0].competencia, "2026-10"); // compra depois do dia 20 cai na fatura seguinte
  const [a, b] = sets(r, "transacoes");
  assert.equal(a.contaId, null);
  assert.equal(a.faturaId, b.faturaId);
});

test("receita com fonte de renda", () => {
  const r = montar([{ acao: "receita", valor: "4.500", conta: "Nubank", categoria: "Salário", fonteRenda: "sociable" }]);
  const [t] = sets(r, "transacoes");
  assert.equal(t.valorCentavos, 450000);
  assert.equal(t.fonteRendaId, "f1");
  assert.equal(t.data, "2026-09-26");
});

test("categoria de natureza errada vira pendência, não dado sujo", () => {
  const r = montar([{ acao: "receita", valor: 10, conta: "Nubank", categoria: "Moradia" }]);
  assert.equal(r.escritas.length, 0);
  assert.match(r.pendencias[0].motivo, /é de despesa/);
});

test("transferência: duas pernas ligadas, nunca receita nem despesa", () => {
  const r = montar([{ acao: "transferencia", valor: 1000, de: "Nubank", para: "Next" }]);
  const pernas = sets(r, "transacoes");
  assert.equal(pernas.length, 2);
  assert.ok(pernas.every((p) => p.tipo === "transferencia"));
  assert.equal(pernas[0].transferenciaId, pernas[1].transferenciaId);
  assert.deepEqual(pernas.map((p) => p.direcao), ["saida", "entrada"]);
  assert.equal(sets(r, "lotesImportacao")[0].quantidadeCandidatos, 1);
});

test("parcelamento: soma exata, 1ª paga, demais previstas, uma fatura por parcela", () => {
  const r = montar([{ acao: "parcelamento", valorTotal: "100,00", parcelas: 3, cartao: "Roxinho", categoria: "Moradia", data: "2026-09-10" }]);
  const parcelas = sets(r, "transacoes");
  assert.equal(parcelas.reduce((s, p) => s + p.valorCentavos, 0), 10000);
  assert.deepEqual(parcelas.map((p) => p.status), ["pago", "previsto", "previsto"]);
  assert.deepEqual(sets(r, "faturas").map((f) => f.competencia), ["2026-09", "2026-10", "2026-11"]);
});

test("duplicata: mesmo valor, conta e data próxima fica de fora, a menos que force", () => {
  const e = estadoBase();
  e.transacoes.push({ id: "t0", tipo: "despesa", contaId: "c1", valorCentavos: 35000, data: "2026-09-25", descricao: "Luz" });
  const item = { acao: "despesa", valor: 350, conta: "Nubank", categoria: "Moradia", data: "2026-09-26" };
  const r = montar([item], e);
  assert.equal(r.escritas.length, 0);
  assert.match(r.pendencias[0].motivo, /parece repetido/);
  const forcado = montar([{ ...item, forcar: true }], e);
  assert.equal(sets(forcado, "transacoes").length, 1);
});

test("item com pendência não deixa nada pela metade e os outros sobem", () => {
  const r = montar([
    { acao: "despesa", valor: 10, cartao: "Roxinho", categoria: "Inexistente" },
    { acao: "despesa", valor: 20, conta: "Nubank", categoria: "Moradia" },
  ]);
  assert.equal(r.pendencias.length, 1);
  assert.equal(sets(r, "faturas").length, 0);
  assert.equal(sets(r, "transacoes").length, 1);
});

test("criar dívida com valores em reais e pessoa padrão; repetida vira pendência", () => {
  const r = montar([{ acao: "criar", colecao: "dividas", dados: { nome: "Shoppe", credor: "Shopee", saldoOriginal: "1.200,00", valorParcela: 200, quantidadeParcelas: 6, parcelasPagas: 1, dataInicio: "2026-08-05" } }]);
  const [d] = sets(r, "dividas");
  assert.equal(d.saldoOriginalCentavos, 120000);
  assert.equal(d.valorParcelaCentavos, 20000);
  assert.equal(d.pessoaId, "p1");
  assert.equal(d.origemId, r.loteId);
  const repetida = montar([{ acao: "criar", colecao: "dividas", dados: { nome: "jeep", saldoOriginal: 1, valorParcela: 1, quantidadeParcelas: 1 } }]);
  assert.match(repetida.pendencias[0].motivo, /já existe/);
});

test("criar conta e já usar na mesma mensagem", () => {
  const r = montar([
    { acao: "criar", colecao: "contas", dados: { nome: "Inter", saldoInicial: "500" } },
    { acao: "transferencia", valor: 100, de: "Nubank", para: "Inter" },
  ]);
  assert.deepEqual(r.pendencias, []);
  assert.equal(sets(r, "contas")[0].saldoInicialCentavos, 50000);
});

test("recorrência gera os previstos dos próximos meses, como a tela", () => {
  const r = montar([{ acao: "criar", colecao: "recorrencias", dados: { descricao: "Aluguel", valorEstimado: 3000, conta: "Nubank", categoria: "Moradia", diaBase: 5, inicio: "2026-09" } }]);
  const previstos = sets(r, "transacoes");
  assert.deepEqual(previstos.map((t) => t.data), ["2026-09-05", "2026-10-05", "2026-11-05"]);
  assert.ok(previstos.every((t) => t.status === "previsto" && t.recorrenciaId));
});

test("pagar parcela: soma na dívida e não passa do total", () => {
  const r = montar([{ acao: "pagar_parcela_divida", divida: "jeep" }]);
  const [u] = r.escritas.filter((e) => e.op === "update");
  assert.equal(u.data.parcelasPagas, 21);
  assert.deepEqual(sets(r, "lotesImportacao")[0].alteracoes, [{ colecao: "dividas", id: "d1", antes: { parcelasPagas: 20 } }]);
  const demais = montar([{ acao: "pagar_parcela_divida", divida: "jeep", quantidade: 29 }]);
  assert.equal(demais.escritas.length, 0);
});

test("pagamento de fatura: não é despesa e marca a fatura como paga", () => {
  const e = estadoBase();
  e.faturas.push({ id: "fat9", cartaoId: "k1", competencia: "2026-09", status: "fechada" });
  const r = montar([{ acao: "pagamento_fatura", valor: 800, cartao: "Roxinho" }], e);
  const [t] = sets(r, "transacoes");
  assert.equal(t.tipo, "pagamento_fatura");
  assert.equal(t.faturaId, "fat9");
  assert.equal(t.contaId, "c1");
  const u = r.escritas.find((x) => x.op === "update");
  assert.equal(u.doc_id, "fat9");
  assert.equal(u.data.status, "paga");
});

test("desfazer: apaga o que nasceu do envio e devolve o que ele mudou", () => {
  const r = montar([
    { acao: "despesa", valor: 10, conta: "Nubank", categoria: "Moradia" },
    { acao: "pagar_parcela_divida", divida: "jeep" },
  ]);
  const e = estadoBase();
  for (const w of r.escritas.filter((x) => x.op === "set")) e[w.collection].push({ id: w.doc_id, ...w.data });
  e.dividas[0].parcelasPagas = 21;
  const d = montarDesfazer({ estado: e, loteId: r.loteId });
  const deletes = d.escritas.filter((x) => x.op === "delete").map((x) => x.collection);
  assert.deepEqual(deletes.sort(), ["lotesImportacao", "transacoes"]);
  const restauro = d.escritas.find((x) => x.op === "update");
  assert.deepEqual(restauro, { op: "update", collection: "dividas", doc_id: "d1", data: { parcelasPagas: 20 } });
});

test("desfazer recusa lote de importação de planilha", () => {
  const e = estadoBase();
  e.lotesImportacao.push({ id: "L1", formato: "csv" });
  assert.throws(() => montarDesfazer({ estado: e, loteId: "L1" }), /só desfaço/);
});
