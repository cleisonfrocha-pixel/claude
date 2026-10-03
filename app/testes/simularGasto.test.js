import { test } from "node:test";
import assert from "node:assert/strict";
import { simularGasto } from "../src/domain/simularGasto.js";

const conta = { id: "k", status: "ativa", saldoInicialCentavos: 500000, dataSaldoInicial: "2026-09-01" };
const nubank = { id: "c1", apelido: "Nubank PF", status: "ativo", limiteTotalCentavos: 400000, diaFechamento: 11, diaVencimento: 18, contaPagamentoId: "k" };
const d = (o) => ({ tipo: "despesa", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", ...o });
const r = (o) => ({ tipo: "receita", status: "previsto", certeza: "confirmado", contaId: "k", competencia: "2026-10", ...o });
const congelar = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === "object" && !Object.isFrozen(v)) congelar(v); return o; };
const estado = (transacoes, extra = {}) => congelar({ contas: [conta], transacoes, faturas: [], cartoes: [nubank], dividas: [], recorrencias: [], fontesRenda: [], hoje: "2026-10-02", horizonteDias: 30, ...extra });

test("cabe: gasto pequeno não quebra nenhum dia, e nada é escrito (entrada congelada não reclama)", () => {
  const e = estado([d({ id: "a", data: "2026-10-10", valorCentavos: 100000 })]);
  const s = simularGasto(e, { valorCentavos: 50000 });
  assert.equal(s.veredito, "cabe");
  assert.equal(s.semEscrever, true);
  assert.equal(e.transacoes.length, 1);
});

test("não cabe na conta, cabe no cartão: gasto de R$ 3.000 com aluguel de R$ 4.000 dia 10 e Del Poente só dia 20", () => {
  const e = estado([d({ id: "a", data: "2026-10-10", valorCentavos: 400000 }), r({ id: "e", data: "2026-10-20", valorCentavos: 500000 })]);
  const s = simularGasto(e, { valorCentavos: 300000 });
  // a fatura de uma compra feita dia 2 (fecha dia 11) vence 18, antes do Del Poente: não cabe no cartão
  assert.notEqual(s.veredito, "cabe");
  const e2 = estado([d({ id: "a", data: "2026-10-10", valorCentavos: 400000 }), r({ id: "e", data: "2026-10-15", valorCentavos: 500000 })]);
  const s2 = simularGasto(e2, { valorCentavos: 300000 });
  assert.equal(s2.veredito, "cabe_no_cartao");
  assert.equal(s2.cartaoApelido, "Nubank PF");
});

test("adiar: devolve o primeiro dia em que cabe", () => {
  const e = estado([d({ id: "a", data: "2026-10-04", valorCentavos: 400000 }), r({ id: "e", data: "2026-10-06", valorCentavos: 600000 })], { cartoes: [] });
  const s = simularGasto(e, { valorCentavos: 300000 });
  assert.equal(s.veredito, "adiar");
  assert.equal(s.adiarAte, "2026-10-06");
});

test("não cabe nem adiando: devolve nao_cabe e o dia em que quebra", () => {
  const e = estado([d({ id: "a", data: "2026-10-04", valorCentavos: 450000 })], { cartoes: [] });
  const s = simularGasto(e, { valorCentavos: 300000 });
  assert.equal(s.veredito, "nao_cabe");
  assert.equal(s.quebraEm, "2026-10-04");
});

test("no cartão, passar do limite livre não cabe, mesmo com caixa sobrando", () => {
  const e = estado([]);
  assert.equal(simularGasto(e, { valorCentavos: 450000, forma: "cartao", cartaoId: "c1" }).veredito, "nao_cabe");
  const ok = simularGasto(e, { valorCentavos: 100000, forma: "cartao", cartaoId: "c1" });
  assert.equal(ok.veredito, "cabe");
  assert.equal(ok.limiteDepoisCentavos, 300000);
});
