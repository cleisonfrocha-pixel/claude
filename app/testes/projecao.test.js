import { test } from "node:test";
import assert from "node:assert/strict";
import { HORIZONTES, calcularHorizonte, calcularProjecao } from "../src/domain/projecao.js";

function despesa(overrides) {
  return { tipo: "despesa", valorCentavos: 0, status: "previsto", certeza: "provavel", ...overrides };
}
function receita(overrides) {
  return { tipo: "receita", valorCentavos: 0, status: "previsto", certeza: "provavel", ...overrides };
}

// ---------- HORIZONTES ----------

test("HORIZONTES: os quatro horizontes do §7, cada um com sua pergunta", () => {
  assert.equal(HORIZONTES.length, 4);
  assert.deepEqual(HORIZONTES.map((h) => h.dias), [7, 30, 90, 365]);
  assert.ok(HORIZONTES.every((h) => h.rotulo && h.funcao && h.pergunta));
});

// ---------- calcularHorizonte ----------

test("calcularHorizonte: sem eventos, o saldo final é igual ao inicial e não há saída crítica", () => {
  const r = calcularHorizonte({ transacoes: [], faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.equal(r.saldoFinalSeguroCentavos, 100000);
  assert.equal(r.saidaCritica, null);
});

test("calcularHorizonte: confirmado e provável caminham o saldo seguro", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 20000, certeza: "confirmado" }),
    receita({ data: "2026-03-10", valorCentavos: 50000, certeza: "provavel" }),
  ];
  const r = calcularHorizonte({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.equal(r.entradasSeguroCentavos, 50000);
  assert.equal(r.saidasSeguroCentavos, 20000);
  assert.equal(r.saldoFinalSeguroCentavos, 100000 - 20000 + 50000);
});

test("calcularHorizonte: incerto NUNCA soma no saldo seguro — só aparece no saldo com incerto", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 20000, certeza: "confirmado" }),
    receita({ data: "2026-03-08", valorCentavos: 900000, certeza: "incerto", descricao: "Bônus talvez" }),
  ];
  const r = calcularHorizonte({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.equal(r.entradasSeguroCentavos, 0, "a receita incerta não deveria contar como entrada segura");
  assert.equal(r.saldoFinalSeguroCentavos, 100000 - 20000, "o saldo seguro não pode incluir o incerto");
  assert.equal(r.entradasIncertoCentavos, 900000);
  assert.equal(r.saldoFinalComIncertoCentavos, 100000 - 20000 + 900000, "o saldo COM incerto é só informativo");
});

test("calcularHorizonte: uma receita incerta não evita a saída crítica do saldo seguro", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 150000, certeza: "confirmado", descricao: "Aluguel atrasado" }),
    receita({ data: "2026-03-05", valorCentavos: 200000, certeza: "incerto", descricao: "Possível reembolso" }),
  ];
  const r = calcularHorizonte({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.ok(r.saidaCritica, "mesmo com a receita incerta cobrindo no papel, o saldo SEGURO deveria ficar negativo");
  assert.equal(r.saidaCritica.data, "2026-03-05");
  assert.equal(r.saidaCritica.gapCentavos, 50000);
});

test("calcularHorizonte: saída crítica aponta a data, o evento causador e o tamanho do gap", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 40000, certeza: "confirmado", descricao: "Aluguel" }),
    despesa({ data: "2026-03-12", contaId: "c1", valorCentavos: 90000, certeza: "provavel", descricao: "IPTU anual" }),
  ];
  const r = calcularHorizonte({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.equal(r.saidaCritica.data, "2026-03-12", "quando");
  assert.equal(r.saidaCritica.itens[0].descricao, "IPTU anual", "qual evento provoca");
  assert.equal(r.saidaCritica.gapCentavos, 30000, "tamanho do gap: 100000 - 40000 - 90000 = -30000 -> gap 30000");
});

test("calcularHorizonte: aponta a PRIMEIRA data em que o saldo fica negativo, não a pior", () => {
  const transacoes = [
    despesa({ data: "2026-03-05", contaId: "c1", valorCentavos: 150000, certeza: "confirmado", descricao: "Primeiro aperto" }),
    despesa({ data: "2026-03-20", contaId: "c1", valorCentavos: 500000, certeza: "confirmado", descricao: "Aperto maior" }),
  ];
  const r = calcularHorizonte({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01", dias: 30 });
  assert.equal(r.saidaCritica.data, "2026-03-05");
});

// ---------- calcularProjecao ----------

test("calcularProjecao: um evento a 45 dias afeta 90d e 12m, mas não 7d nem 30d", () => {
  const transacoes = [
    despesa({ data: "2026-04-15", contaId: "c1", valorCentavos: 200000, certeza: "confirmado", descricao: "Viagem" }),
  ];
  const r = calcularProjecao({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01" });
  const porChave = Object.fromEntries(r.horizontes.map((h) => [h.chave, h]));
  assert.equal(porChave["7d"].saidaCritica, null);
  assert.equal(porChave["30d"].saidaCritica, null);
  assert.ok(porChave["90d"].saidaCritica, "90 dias alcança o evento de 45 dias");
  assert.ok(porChave["12m"].saidaCritica, "12 meses também alcança");
});

// ---------- PORTÃO DA FASE 5 ----------

test("PORTÃO DA FASE 5: quando o saldo projetado fica negativo, o sistema diz quando, qual evento e o gap", () => {
  const transacoes = [
    despesa({ data: "2026-03-10", contaId: "c1", valorCentavos: 350000, certeza: "confirmado", descricao: "Fatura do cartão" }),
  ];
  const r = calcularProjecao({ transacoes, faturas: [], cartoes: [], saldoInicialCentavos: 100000, hoje: "2026-03-01" });
  const h30 = r.horizontes.find((h) => h.chave === "30d");
  assert.ok(h30.saidaCritica, "deveria haver saída crítica dentro de 30 dias");
  assert.equal(h30.saidaCritica.data, "2026-03-10", "QUANDO: a data exata do aperto");
  assert.equal(h30.saidaCritica.itens[0].descricao, "Fatura do cartão", "QUAL EVENTO: a obrigação causadora, nomeada");
  assert.equal(h30.saidaCritica.gapCentavos, 250000, "TAMANHO DO GAP: 100000 - 350000 = -250000 -> gap 250000");
});
