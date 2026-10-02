import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularVisaoCartao, cabeNoCartao } from "../src/domain/cartoes.js";
import { dataPagamentoPrevisto } from "../src/domain/transacoes.js";
import { compromissosPorDia } from "../src/domain/calendario.js";

const nubank = { id: "c1", apelido: "Nubank PF", limiteTotalCentavos: 40000, diaFechamento: 11, diaVencimento: 18, contaPagamentoId: "k" };
const compra = (o) => ({ tipo: "despesa", status: "previsto", cartaoId: "c1", faturaId: "f1", valorCentavos: 10000, data: "2026-10-05", competencia: "2026-10", descricao: "Compra", ...o });
const fat = [{ id: "f1", cartaoId: "c1", competencia: "2026-10", status: "aberta" }];

test("pedalada: o dinheiro sai no dia habitual, depois do fechamento e antes do vencimento", () => {
  assert.equal(dataPagamentoPrevisto(nubank, "2026-10"), "2026-10-18");
  assert.equal(dataPagamentoPrevisto({ ...nubank, diaPagamentoHabitual: 12 }, "2026-10"), "2026-10-12");
  assert.equal(dataPagamentoPrevisto({ ...nubank, diaPagamentoHabitual: 5 }, "2026-10"), "2026-10-18"); // antes de fechar: ignora
  assert.equal(dataPagamentoPrevisto({ ...nubank, diaPagamentoHabitual: 25 }, "2026-10"), "2026-10-18"); // depois do vencimento: ignora
});

test("linha do tempo: fatura pesa no dia habitual, mantendo o vencimento real", () => {
  const dias = compromissosPorDia({ transacoes: [compra({})], faturas: fat, cartoes: [{ ...nubank, diaPagamentoHabitual: 12 }], de: "2026-10-01", ate: "2026-10-31", hoje: "2026-10-02", extras: [] });
  const d = dias.find((x) => x.itens.some((i) => i.tipo === "fatura"));
  assert.equal(d.data, "2026-10-12");
  assert.equal(d.itens.find((i) => i.tipo === "fatura").vencimento, "2026-10-18");
});

test("limite livre informado vale a partir da data; só compra posterior reduz", () => {
  const cartao = { ...nubank, limiteLivreInformado: { valorCentavos: 25000, em: "2026-10-02" } };
  const v = calcularVisaoCartao({ cartao, transacoesDoCartao: [compra({ data: "2026-10-01" }), compra({ id: "n", data: "2026-10-04", valorCentavos: 5000 })], faturasDoCartao: fat, hoje: "2026-10-05" });
  assert.equal(v.disponivelCentavos, 20000);
});

test("compra planejada não consome limite", () => {
  const v = calcularVisaoCartao({ cartao: nubank, transacoesDoCartao: [compra({}), compra({ descricao: "Compras previstas NOV", valorCentavos: 119670 })], faturasDoCartao: fat, hoje: "2026-10-05" });
  assert.equal(v.disponivelCentavos, 30000);
  assert.equal(v.previstoCentavos, 119670);
});

test("cabe no cartão: limite e saldo da conta que paga a fatura", () => {
  const visao = { disponivelCentavos: 30000 };
  assert.deepEqual(cabeNoCartao({ visao, valorCentavos: 20000, saldoContaPagadoraCentavos: 50000 }).ok, true);
  assert.equal(cabeNoCartao({ visao, valorCentavos: 40000 }).cabeNoLimite, false);
  const r = cabeNoCartao({ visao, valorCentavos: 20000, saldoContaPagadoraCentavos: 10000 });
  assert.equal(r.cabeNaFatura, false);
  assert.equal(r.ok, false);
});
