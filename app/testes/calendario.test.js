import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compromissosPorDia, calcularCoberturaDiaria, diaDeMaiorPressao, diasSemCobertura,
} from "../src/domain/calendario.js";

function despesa(overrides) {
  return { tipo: "despesa", valorCentavos: 0, status: "previsto", certeza: "provavel", ...overrides };
}
function receita(overrides) {
  return { tipo: "receita", valorCentavos: 0, status: "previsto", certeza: "provavel", ...overrides };
}

// ---------- compromissosPorDia ----------

test("compromissosPorDia: agrupa despesas diretas por data, dentro do intervalo", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 15000, descricao: "Aluguel" }),
    despesa({ data: "2026-03-10", contaId: "c1", valorCentavos: 5000, descricao: "Internet" }),
    despesa({ data: "2026-04-05", contaId: "c1", valorCentavos: 15000, descricao: "Fora do intervalo" }),
  ];
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 2);
  assert.equal(dias[0].data, "2026-03-05");
  assert.equal(dias[0].saidasCentavos, 15000);
  assert.equal(dias[1].saidasCentavos, 5000);
});

test("compromissosPorDia: despesa paga ou cancelada não entra", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 15000, status: "pago" }),
    despesa({ data: "2026-03-06", contaId: "c1", valorCentavos: 15000, status: "cancelado" }),
  ];
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 0);
});

test("compromissosPorDia: receita entra como entrada, no mesmo dia de uma despesa se coincidir", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 10000 }),
    receita({ data: "2026-03-05", valorCentavos: 30000 }),
  ];
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 1);
  assert.equal(dias[0].entradasCentavos, 30000);
  assert.equal(dias[0].saidasCentavos, 10000);
});

test("compromissosPorDia: despesa em cartão não entra sozinha — só via o vencimento da fatura", () => {
  const transacoes = [despesa({ data: "2026-03-05", cartaoId: "cartao1", contaId: null, faturaId: "fat1", valorCentavos: 20000 })];
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 0, "sem a fatura, a compra isolada não deveria aparecer no calendário");
});

test("compromissosPorDia: fatura em aberto aparece no dia do vencimento, com o total", () => {
  const cartao = { id: "cartao1", apelido: "Roxinho", diaFechamento: 10, diaVencimento: 20 };
  const fatura = { id: "fat1", cartaoId: "cartao1", competencia: "2026-03", status: "fechada" };
  const transacoes = [
    despesa({ cartaoId: "cartao1", contaId: null, faturaId: "fat1", valorCentavos: 12000 }),
    despesa({ cartaoId: "cartao1", contaId: null, faturaId: "fat1", valorCentavos: 8000 }),
  ];
  const dias = compromissosPorDia({ transacoes, faturas: [fatura], cartoes: [cartao], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 1);
  assert.equal(dias[0].data, "2026-03-20");
  assert.equal(dias[0].saidasCentavos, 20000);
  assert.equal(dias[0].itens[0].descricao, "Fatura Roxinho");
});

test("compromissosPorDia: fatura já paga não aparece mais", () => {
  const cartao = { id: "cartao1", diaFechamento: 10, diaVencimento: 20 };
  const fatura = { id: "fat1", cartaoId: "cartao1", competencia: "2026-03", status: "paga" };
  const transacoes = [despesa({ cartaoId: "cartao1", contaId: null, faturaId: "fat1", valorCentavos: 12000 })];
  const dias = compromissosPorDia({ transacoes, faturas: [fatura], cartoes: [cartao], de: "2026-03-01", ate: "2026-03-31" });
  assert.equal(dias.length, 0);
});

// ---------- calcularCoberturaDiaria ----------

test("calcularCoberturaDiaria: caminha o saldo aplicando cada dia em ordem", () => {
  const dias = [
    { data: "2026-03-05", entradasCentavos: 0, saidasCentavos: 30000, itens: [] },
    { data: "2026-03-10", entradasCentavos: 50000, saidasCentavos: 0, itens: [] },
  ];
  const r = calcularCoberturaDiaria(100000, dias);
  assert.equal(r[0].saldoAntesCentavos, 100000);
  assert.equal(r[0].saldoDepoisCentavos, 70000);
  assert.equal(r[1].saldoAntesCentavos, 70000);
  assert.equal(r[1].saldoDepoisCentavos, 120000);
  assert.ok(r.every((d) => d.coberto));
});

test("calcularCoberturaDiaria: sinaliza o dia em que o saldo fica negativo", () => {
  const dias = [
    { data: "2026-03-05", entradasCentavos: 0, saidasCentavos: 80000, itens: [] },
    { data: "2026-03-10", entradasCentavos: 0, saidasCentavos: 30000, itens: [] },
  ];
  const r = calcularCoberturaDiaria(100000, dias);
  assert.equal(r[0].coberto, true);
  assert.equal(r[1].coberto, false);
  assert.equal(r[1].saldoDepoisCentavos, -10000);
});

// ---------- diaDeMaiorPressao ----------

test("diaDeMaiorPressao: acha o dia de maior saída líquida", () => {
  const dias = [
    { data: "2026-03-05", entradasCentavos: 0, saidasCentavos: 20000 },
    { data: "2026-03-10", entradasCentavos: 10000, saidasCentavos: 90000 },
    { data: "2026-03-15", entradasCentavos: 0, saidasCentavos: 15000 },
  ];
  const pior = diaDeMaiorPressao(dias);
  assert.equal(pior.data, "2026-03-10");
});

test("diaDeMaiorPressao: null quando não há dias", () => {
  assert.equal(diaDeMaiorPressao([]), null);
});

// ---------- diasSemCobertura ----------

test("diasSemCobertura: só devolve os dias negativos", () => {
  const dias = [
    { data: "2026-03-05", coberto: true },
    { data: "2026-03-10", coberto: false },
    { data: "2026-03-15", coberto: false },
  ];
  const r = diasSemCobertura(dias);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((d) => d.data), ["2026-03-10", "2026-03-15"]);
});

// ---------- PORTÃO DA FASE 4 ----------

test("PORTÃO DA FASE 4: o calendário aponta o dia que aperta e a obrigação sem cobertura", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 40000, descricao: "Aluguel" }),
    despesa({ data: "2026-03-12", contaId: "c1", valorCentavos: 90000, descricao: "IPTU anual" }),
    receita({ data: "2026-03-20", valorCentavos: 300000, descricao: "Salário" }),
  ];
  const dias = compromissosPorDia({ transacoes, faturas: [], cartoes: [], de: "2026-03-01", ate: "2026-03-31" });
  const saldoAtual = 100000; // R$ 1.000,00
  const cobertura = calcularCoberturaDiaria(saldoAtual, dias);

  const pior = diaDeMaiorPressao(dias);
  assert.equal(pior.data, "2026-03-12", "o IPTU é o dia de maior pressão");

  const descobertos = diasSemCobertura(cobertura);
  assert.equal(descobertos.length, 1);
  assert.equal(descobertos[0].data, "2026-03-12", "o dia do IPTU é onde o saldo aperta");
  assert.equal(descobertos[0].itens[0].descricao, "IPTU anual", "a obrigação sem cobertura é identificável");
  assert.equal(descobertos[0].saldoDepoisCentavos, 100000 - 40000 - 90000);

  // E depois do salário, o saldo se recupera — o aperto é específico daquele dia.
  const diaSalario = cobertura.find((d) => d.data === "2026-03-20");
  assert.equal(diaSalario.coberto, true);
});
