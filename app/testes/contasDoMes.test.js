import { test } from "node:test";
import assert from "node:assert/strict";
import { contasDoMes } from "../src/domain/contasDoMes.js";

const HOJE = "2026-10-12";
const cats = [{ id: "ess", essencial: true }, { id: "lazer", essencial: false }, { id: "div", grupo: "dividas" }];
const t = (o) => ({ tipo: "despesa", status: "previsto", competencia: "2026-10", categoriaId: "lazer", valorCentavos: 10000, ...o });

test("estado de cada conta: atrasada, vence hoje, a pagar, paga", () => {
  const r = contasDoMes({
    competencia: "2026-10", hoje: HOJE, categorias: cats,
    transacoes: [
      t({ id: "a", descricao: "Luz", data: "2026-10-05" }),
      t({ id: "b", descricao: "Água", data: "2026-10-12" }),
      t({ id: "c", descricao: "Internet", data: "2026-10-20" }),
      t({ id: "d", descricao: "Aluguel", data: "2026-10-02", status: "pago", categoriaId: "ess" }),
    ],
  });
  const estado = (id) => r.itens.find((i) => i.transacaoId === id).estado;
  assert.equal(estado("a"), "atrasada");
  assert.equal(estado("b"), "hoje");
  assert.equal(estado("c"), "a_pagar");
  assert.equal(estado("d"), "paga");
  assert.equal(r.itens.find((i) => i.transacaoId === "a").diasAtraso, 7);
  assert.deepEqual(r.itens.map((i) => i.transacaoId), ["a", "b", "c", "d"]);
});

test("progresso sai da leitura: pago / total, atrasadas somadas", () => {
  const r = contasDoMes({
    competencia: "2026-10", hoje: HOJE, categorias: cats,
    transacoes: [
      t({ id: "a", data: "2026-10-05", valorCentavos: 30000 }),
      t({ id: "d", data: "2026-10-02", status: "pago", categoriaId: "ess", valorCentavos: 10000 }),
    ],
  });
  assert.equal(r.resumo.totalCentavos, 40000);
  assert.equal(r.resumo.pagoCentavos, 10000);
  assert.equal(r.resumo.faltaCentavos, 30000);
  assert.equal(r.resumo.percentualPago, 25);
  assert.equal(r.resumo.atrasadasCentavos, 30000);
});

test("compra no cartão não é conta; a fatura é (e uma vez só)", () => {
  const r = contasDoMes({
    competencia: "2026-10", hoje: HOJE, categorias: cats,
    cartoes: [{ id: "c1", apelido: "Nubank", diaFechamento: 11, diaVencimento: 18 }],
    faturas: [{ id: "f1", cartaoId: "c1", competencia: "2026-10", status: "aberta" }],
    transacoes: [
      t({ id: "x", cartaoId: "c1", faturaId: "f1", data: "2026-10-03", valorCentavos: 50000 }),
      t({ id: "y", cartaoId: "c1", faturaId: "f1", data: "2026-10-04", valorCentavos: 25000 }),
    ],
  });
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].tipo, "fatura");
  assert.equal(r.itens[0].valorCentavos, 75000);
});

test("fatura paga entra como paga; gasto avulso pago não é conta", () => {
  const r = contasDoMes({
    competencia: "2026-10", hoje: HOJE, categorias: cats,
    cartoes: [{ id: "c1", apelido: "Nubank", diaFechamento: 1, diaVencimento: 8 }],
    faturas: [{ id: "f1", cartaoId: "c1", competencia: "2026-10", status: "paga" }],
    transacoes: [
      t({ id: "x", cartaoId: "c1", faturaId: "f1", data: "2026-09-03", competencia: "2026-09", valorCentavos: 50000 }),
      t({ id: "mercado", data: "2026-10-03", status: "pago", valorCentavos: 9000 }),
      t({ id: "baixada", data: "2026-10-03", status: "pago", foiPrevisto: true }),
    ],
  });
  assert.deepEqual(r.itens.map((i) => i.chave).sort(), ["f:f1", "t:baixada"]);
  assert.ok(r.itens.every((i) => i.estado === "paga"));
});

test("conta atrasada de mês anterior aparece no mês atual; mês futuro não herda atraso", () => {
  const velha = t({ id: "gato", competencia: "2026-09", data: "2026-09-28", status: "atrasado", valorCentavos: 3500 });
  const atual = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes: [velha] });
  assert.equal(atual.itens[0].estado, "atrasada");
  const futuro = contasDoMes({ competencia: "2026-11", hoje: HOJE, categorias: cats, transacoes: [velha] });
  assert.equal(futuro.itens.length, 0);
});

test("parcela de dívida sem lançamento vira conta com o vencimento original", () => {
  const r = contasDoMes({
    competencia: "2026-10", hoje: HOJE, categorias: cats,
    dividas: [{ id: "d1", nome: "Jeep", valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 19, dataInicio: "2025-03-04", saldoOriginalCentavos: 19898220 }],
    transacoes: [],
  });
  // 20ª parcela = 04/10/2026, já vencida em 12/10 → atrasada, com o dia certo
  const p = r.itens.find((i) => i.origem?.tipo === "divida");
  assert.ok(p);
  assert.equal(p.vencimento, "2026-10-04");
  assert.equal(p.estado, "atrasada");
  assert.equal(p.diasAtraso, 8);
});

test("conta sem dia fixo (verba) fica a pagar até o mês acabar", () => {
  const r = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes: [t({ id: "v", data: "2026-10-01", semDia: true })] });
  assert.equal(r.itens[0].estado, "a_pagar");
  assert.equal(r.itens[0].semDia, true);
});

test("conta atrasada de setembro paga hoje conta como paga em outubro", () => {
  const paga = t({ id: "gato", competencia: "2026-09", data: "2026-09-28", status: "pago", foiPrevisto: true, pagoEm: "2026-10-12", valorCentavos: 3500 });
  const out = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes: [paga] });
  assert.equal(out.itens[0].estado, "paga");
  assert.equal(out.itens[0].pagoEm, "2026-10-12");
  assert.equal(out.resumo.quantidadePagas, 1);
});

import { entradasDoMes } from "../src/domain/contasDoMes.js";

const fonte = (o) => ({ id: "f1", nome: "Sociable", tipo: "recorrente", ativa: true, valorEsperadoCentavos: 520000, diaRecebimento: 5, pessoaId: "p1", ...o });

test("entradas: renda esperada vira a receber; passou do dia sem cair vira atrasada", () => {
  const futuro = entradasDoMes({ competencia: "2026-10", hoje: "2026-10-02", fontesRenda: [fonte()], transacoes: [] });
  assert.equal(futuro.itens[0].estado, "a_pagar");
  assert.equal(futuro.itens[0].vencimento, "2026-10-05");
  const passou = entradasDoMes({ competencia: "2026-10", hoje: "2026-10-12", fontesRenda: [fonte()], transacoes: [] });
  assert.equal(passou.itens[0].estado, "atrasada");
  assert.equal(passou.itens[0].diasAtraso, 7);
});

test("entradas: recebida conta como paga e a fonte não projeta de novo no mês", () => {
  const r = entradasDoMes({
    competencia: "2026-10", hoje: "2026-10-12", fontesRenda: [fonte()],
    transacoes: [{ id: "x", tipo: "receita", status: "pago", competencia: "2026-10", data: "2026-10-05", valorCentavos: 520000, fonteRendaId: "f1", descricao: "Sociable" }],
  });
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].estado, "paga");
  assert.equal(r.resumo.percentualPago, 100);
});

test("entradas: incerta aparece mas nunca entra nos totais", () => {
  const r = entradasDoMes({
    competencia: "2026-10", hoje: "2026-10-02", fontesRenda: [],
    transacoes: [
      { id: "a", tipo: "receita", status: "previsto", competencia: "2026-10", data: "2026-10-20", valorCentavos: 500000, certeza: "incerto", descricao: "Del Poente" },
      { id: "b", tipo: "receita", status: "previsto", competencia: "2026-10", data: "2026-10-10", valorCentavos: 100000, certeza: "provavel", descricao: "Gábbia" },
    ],
  });
  assert.equal(r.itens.length, 2);
  assert.equal(r.resumo.totalCentavos, 100000);
  assert.equal(r.resumo.incertasCentavos, 500000);
  assert.equal(r.resumo.quantidade, 1);
});

import { compromissosPorDia } from "../src/domain/calendario.js";
import { eventosFuturos } from "../src/domain/previstos.js";

test("invariante: A pagar aberto do mês == saídas da linha do tempo do mês (uma vez cada)", () => {
  const transacoes = [
    t({ id: "a", descricao: "Luz", data: "2026-10-05", contaId: "k", valorCentavos: 20000 }),
    t({ id: "c", descricao: "Net", data: "2026-10-20", contaId: "k", valorCentavos: 12000 }),
    t({ id: "v", descricao: "Mercado", data: "2026-10-01", semDia: true, contaId: "k", valorCentavos: 100000 }),
    t({ id: "r", tipo: "receita", descricao: "Salário", data: "2026-10-25", contaId: "k", valorCentavos: 500000 }),
  ];
  const r = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes });
  const abertas = r.itens.filter((i) => !i.paga);
  assert.equal(abertas.length, 3);
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: HOJE, ate: "2026-10-31", hoje: HOJE, extras: [] });
  const saidas = dias.reduce((s, d) => s + d.saidasCentavos, 0);
  assert.equal(r.resumo.faltaCentavos, saidas);
  assert.equal(new Set(abertas.map((i) => i.chave)).size, abertas.length);
});

test("invariante: parcela de dívida em atraso pesa uma vez, com o vencimento original", () => {
  const dividas = [{ id: "d1", nome: "Jeep", valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 19, dataInicio: "2025-03-04" }];
  const r = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, dividas, transacoes: [] });
  const extras = eventosFuturos({ transacoes: [], dividas, de: HOJE, ate: "2026-10-31", hoje: HOJE });
  const dias = compromissosPorDia({ transacoes: [], faturas: [], cartoes: [], de: HOJE, ate: "2026-10-31", hoje: HOJE, extras });
  assert.equal(r.resumo.faltaCentavos, dias.reduce((s, d) => s + d.saidasCentavos, 0));
  assert.equal(r.itens.length, 1);
});

test("verba do mês mostra quanto já foi gasto e o total", () => {
  const r = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes: [
    t({ id: "v", descricao: "Mercado", data: "2026-10-01", semDia: true, contaId: "k", categoriaId: "mer", valorCentavos: 92000 }),
    t({ id: "g", descricao: "Mercado Assaí", data: "2026-10-03", status: "pago", semDia: true, contaId: "k", categoriaId: "mer", valorCentavos: 8000 }),
  ] });
  const v = r.itens.find((i) => i.transacaoId === "v");
  assert.equal(v.gastoDaVerbaCentavos, 8000);
  assert.equal(v.totalDaVerbaCentavos, 100000);
  assert.equal(v.valorCentavos, 92000);
});

test("13.2 item 6: gasto real da categoria abate a verba mesmo sem ligar um ao outro", () => {
  const r = contasDoMes({ competencia: "2026-10", hoje: HOJE, categorias: cats, transacoes: [
    t({ id: "v", descricao: "Mercado do mês", data: "2026-10-01", semDia: true, contaId: "k", categoriaId: "mer", valorCentavos: 100000 }),
    t({ id: "g", descricao: "Assaí", data: "2026-10-03", status: "pago", contaId: "k", categoriaId: "mer", valorCentavos: 36670 }),
  ] });
  const v = r.itens.find((i) => i.transacaoId === "v");
  assert.equal(v.gastoDaVerbaCentavos, 36670);
  assert.equal(v.totalDaVerbaCentavos, 100000);
  assert.equal(v.valorCentavos, 100000 - 36670);
});
