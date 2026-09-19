import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agregarPeriodo, totalizarMes, competenciaFatura, gerarParcelas,
  competenciasFaltantes, construirParTransferencia, efeitoNaConta,
  competenciaVencimentoFatura, dataVencimentoFatura,
} from "../src/domain/transacoes.js";

function t(overrides) {
  return { tipo: "despesa", valorCentavos: 0, competencia: "2026-01", status: "pago", ...overrides };
}

test("regra de ouro: transferência nunca conta como receita ou despesa", () => {
  const lista = [
    t({ tipo: "receita", valorCentavos: 500000 }),
    t({ tipo: "despesa", valorCentavos: 120000 }),
    t({ tipo: "transferencia", valorCentavos: 999999999 }), // gigante de propósito
  ];
  const totais = totalizarMes(lista, "2026-01");
  assert.equal(totais.receitas, 500000);
  assert.equal(totais.despesas, 120000);
  assert.equal(totais.transferencias, 999999999);
});

test("PORTÃO DA FASE 1: transferir R$ 1.000 entre contas próprias não altera receita nem despesa do mês", () => {
  const antes = [
    t({ tipo: "receita", valorCentavos: 700000 }),
    t({ tipo: "despesa", valorCentavos: 250000 }),
  ];
  const totaisAntes = totalizarMes(antes, "2026-01");

  const par = construirParTransferencia({
    contaOrigemId: "conta_a", contaDestinoId: "conta_b",
    valorCentavos: 100000, data: "2026-01-15", competencia: "2026-01",
    transferenciaId: "tr_1",
  });
  assert.equal(par.length, 2);
  assert.ok(par.every((p) => p.tipo === "transferencia"));

  const depois = [...antes, ...par];
  const totaisDepois = totalizarMes(depois, "2026-01");

  assert.equal(totaisDepois.receitas, totaisAntes.receitas);
  assert.equal(totaisDepois.despesas, totaisAntes.despesas);
  assert.equal(totaisDepois.transferencias, 200000); // as duas pontas, R$1000 cada
});

test("regra de ouro: pagamento de fatura não conta como despesa de novo", () => {
  const compra = t({ tipo: "despesa", valorCentavos: 30000, cartaoId: "c1", faturaId: "fat_1" });
  const pagamento = t({ tipo: "pagamento_fatura", valorCentavos: 30000, contaId: "conta_a", faturaId: "fat_1" });
  const totais = totalizarMes([compra, pagamento], "2026-01");
  assert.equal(totais.despesas, 30000, "a despesa já foi contada na compra; o pagamento não soma de novo");
  assert.equal(totais.pagamentosFatura, 30000);
});

test("agregarPeriodo respeita o intervalo de competências", () => {
  const lista = [
    t({ competencia: "2025-12", tipo: "despesa", valorCentavos: 100 }),
    t({ competencia: "2026-01", tipo: "despesa", valorCentavos: 200 }),
    t({ competencia: "2026-02", tipo: "despesa", valorCentavos: 400 }),
  ];
  const totais = agregarPeriodo(lista, { de: "2026-01", ate: "2026-01" });
  assert.equal(totais.despesas, 200);
});

test("competenciaFatura: compra até o fechamento entra no mês corrente", () => {
  const cartao = { diaFechamento: 10 };
  assert.equal(competenciaFatura(cartao, "2026-03-10"), "2026-03");
});

test("competenciaFatura: compra depois do fechamento vira fatura do mês seguinte", () => {
  const cartao = { diaFechamento: 10 };
  assert.equal(competenciaFatura(cartao, "2026-03-11"), "2026-04");
  assert.equal(competenciaFatura(cartao, "2026-12-15"), "2027-01");
});

test("gerarParcelas: soma das parcelas fecha exatamente com o total, mesmo quando não divide certo", () => {
  const parcelas = gerarParcelas({
    valorTotalCentavos: 10000, quantidade: 3, competenciaInicial: "2026-01",
    parcelaDeId: "p1", camposComuns: { tipo: "despesa", cartaoId: "c1" },
  });
  assert.equal(parcelas.length, 3);
  const soma = parcelas.reduce((s, p) => s + p.valorCentavos, 0);
  assert.equal(soma, 10000);
  assert.deepEqual(parcelas.map((p) => p.valorCentavos), [3334, 3333, 3333]);
});

test("gerarParcelas: cada parcela sabe seu número, total e competência correta", () => {
  const parcelas = gerarParcelas({
    valorTotalCentavos: 30000, quantidade: 3, competenciaInicial: "2026-11",
    parcelaDeId: "p2",
  });
  assert.deepEqual(parcelas.map((p) => p.competencia), ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(parcelas.map((p) => p.parcelaNum), [1, 2, 3]);
  assert.ok(parcelas.every((p) => p.parcelaTotal === 3 && p.parcelaDe === "p2"));
});

test("competenciasFaltantes: não repete o que já existe", () => {
  const recorrencia = { inicio: "2026-01" };
  const faltam = competenciasFaltantes(recorrencia, {
    competenciaAtual: "2026-01", horizonteMeses: 3,
    competenciasExistentes: ["2026-01"],
  });
  assert.deepEqual(faltam, ["2026-02", "2026-03"]);
});

test("competenciasFaltantes: respeita início e fim da recorrência", () => {
  const recorrencia = { inicio: "2026-02", fim: "2026-02" };
  const faltam = competenciasFaltantes(recorrencia, {
    competenciaAtual: "2026-01", horizonteMeses: 4,
    competenciasExistentes: [],
  });
  assert.deepEqual(faltam, ["2026-02"]);
});

test("efeitoNaConta: receita paga soma, despesa paga subtrai", () => {
  assert.equal(efeitoNaConta(t({ tipo: "receita", valorCentavos: 1000, contaId: "c1", status: "pago" })), 1000);
  assert.equal(efeitoNaConta(t({ tipo: "despesa", valorCentavos: 1000, contaId: "c1", status: "pago" })), -1000);
});

test("efeitoNaConta: nada que não esteja pago mexe no saldo", () => {
  assert.equal(efeitoNaConta(t({ tipo: "despesa", valorCentavos: 1000, contaId: "c1", status: "previsto" })), 0);
  assert.equal(efeitoNaConta(t({ tipo: "despesa", valorCentavos: 1000, contaId: "c1", status: "agendado" })), 0);
});

test("efeitoNaConta: despesa em cartão não mexe na conta (só a fatura, quando paga)", () => {
  assert.equal(efeitoNaConta(t({ tipo: "despesa", valorCentavos: 1000, cartaoId: "cartao1", contaId: null, status: "pago" })), 0);
});

test("efeitoNaConta: pagamento de fatura sai da conta que pagou", () => {
  assert.equal(efeitoNaConta(t({ tipo: "pagamento_fatura", valorCentavos: 1000, contaId: "c1", status: "pago" })), -1000);
});

test("efeitoNaConta: transferência usa a direção — cada perna soma o oposto da outra", () => {
  const par = construirParTransferencia({
    contaOrigemId: "a", contaDestinoId: "b", valorCentavos: 5000,
    data: "2026-01-10", competencia: "2026-01", transferenciaId: "tr1",
  });
  const [origem, destino] = par;
  assert.equal(efeitoNaConta(origem), -5000);
  assert.equal(efeitoNaConta(destino), 5000);
  assert.equal(efeitoNaConta(origem) + efeitoNaConta(destino), 0, "dinheiro não pode nascer nem sumir numa transferência");
});

test("competenciaVencimentoFatura: vencimento no mesmo mês quando o dia é maior ou igual ao fechamento", () => {
  const cartao = { diaFechamento: 10, diaVencimento: 20 };
  assert.equal(competenciaVencimentoFatura(cartao, "2026-03"), "2026-03");
});

test("competenciaVencimentoFatura: vencimento no mês seguinte quando o dia é menor que o fechamento", () => {
  const cartao = { diaFechamento: 28, diaVencimento: 5 };
  assert.equal(competenciaVencimentoFatura(cartao, "2026-03"), "2026-04");
});

test("dataVencimentoFatura monta a data completa", () => {
  const cartao = { diaFechamento: 28, diaVencimento: 5 };
  assert.equal(dataVencimentoFatura(cartao, "2026-03"), "2026-04-05");
});
