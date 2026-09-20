import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectarNovaRecorrencia, detectarRecorrenciaValorDiferente, detectarAumentoCartao,
  detectarReceitaEsperadaNaoRecebida, compararComPeriodoAnterior,
} from "../src/domain/anomalias.js";

// ---------- detectarNovaRecorrencia ----------

test("detectarNovaRecorrencia: recorrência cujo início é o mês atual aparece", () => {
  const recorrencias = [
    { id: "r1", descricao: "Streaming", inicio: "2026-03", ativa: true, valorEstimadoCentavos: 4000 },
    { id: "r2", descricao: "Aluguel", inicio: "2025-01", ativa: true, valorEstimadoCentavos: 150000 },
  ];
  const r = detectarNovaRecorrencia(recorrencias, "2026-03");
  assert.deepEqual(r.map((x) => x.recorrenciaId), ["r1"]);
});

test("detectarNovaRecorrencia: recorrência inativa não conta como nova", () => {
  const recorrencias = [{ id: "r1", descricao: "X", inicio: "2026-03", ativa: false, valorEstimadoCentavos: 100 }];
  assert.deepEqual(detectarNovaRecorrencia(recorrencias, "2026-03"), []);
});

// ---------- detectarRecorrenciaValorDiferente ----------

test("detectarRecorrenciaValorDiferente: diferença acima do limiar aparece", () => {
  const recorrencias = [{ id: "r1", descricao: "Streaming", ativa: true, valorEstimadoCentavos: 4000 }];
  const transacoes = [{ recorrenciaId: "r1", competencia: "2026-03", status: "pago", valorCentavos: 6000, data: "2026-03-05" }];
  const r = detectarRecorrenciaValorDiferente(recorrencias, transacoes, "2026-03");
  assert.equal(r.length, 1);
  assert.equal(r[0].percentual, 50);
});

test("detectarRecorrenciaValorDiferente: diferença pequena não aparece", () => {
  const recorrencias = [{ id: "r1", descricao: "Streaming", ativa: true, valorEstimadoCentavos: 4000 }];
  const transacoes = [{ recorrenciaId: "r1", competencia: "2026-03", status: "pago", valorCentavos: 4100, data: "2026-03-05" }];
  assert.deepEqual(detectarRecorrenciaValorDiferente(recorrencias, transacoes, "2026-03"), []);
});

test("detectarRecorrenciaValorDiferente: sem lançamento nesta competência, não aparece", () => {
  const recorrencias = [{ id: "r1", descricao: "Streaming", ativa: true, valorEstimadoCentavos: 4000 }];
  assert.deepEqual(detectarRecorrenciaValorDiferente(recorrencias, [], "2026-03"), []);
});

// ---------- detectarAumentoCartao ----------

function fatura(id, cartaoId, competencia) {
  return { id, cartaoId, competencia };
}

test("detectarAumentoCartao: fatura muito acima da média das anteriores aparece", () => {
  const cartoes = [{ id: "c1", apelido: "Roxinho" }];
  const faturas = [fatura("f1", "c1", "2026-01"), fatura("f2", "c1", "2026-02"), fatura("f3", "c1", "2026-03")];
  const transacoes = [
    { faturaId: "f1", valorCentavos: 100000 },
    { faturaId: "f2", valorCentavos: 100000 },
    { faturaId: "f3", valorCentavos: 300000 }, // mês atual, bem acima da média (100000)
  ];
  const r = detectarAumentoCartao(cartoes, faturas, transacoes, "2026-03");
  assert.equal(r.length, 1);
  assert.equal(r[0].cartaoId, "c1");
  assert.equal(r[0].percentualAcima, 200);
});

test("detectarAumentoCartao: sem histórico de faturas anteriores, não aparece", () => {
  const cartoes = [{ id: "c1", apelido: "Roxinho" }];
  const faturas = [fatura("f1", "c1", "2026-03")];
  const transacoes = [{ faturaId: "f1", valorCentavos: 300000 }];
  assert.deepEqual(detectarAumentoCartao(cartoes, faturas, transacoes, "2026-03"), []);
});

test("detectarAumentoCartao: gasto normal (dentro da média), não aparece", () => {
  const cartoes = [{ id: "c1", apelido: "Roxinho" }];
  const faturas = [fatura("f1", "c1", "2026-02"), fatura("f2", "c1", "2026-03")];
  const transacoes = [
    { faturaId: "f1", valorCentavos: 100000 },
    { faturaId: "f2", valorCentavos: 105000 },
  ];
  assert.deepEqual(detectarAumentoCartao(cartoes, faturas, transacoes, "2026-03"), []);
});

// ---------- detectarReceitaEsperadaNaoRecebida ----------

test("detectarReceitaEsperadaNaoRecebida: fonte fixa sem receita paga, já no fim do mês, aparece", () => {
  const fontes = [{ id: "f1", nome: "Salário", tipo: "fixa", ativa: true, valorEsperadoCentavos: 500000 }];
  const r = detectarReceitaEsperadaNaoRecebida(fontes, [], "2026-03", "2026-03-25");
  assert.equal(r.length, 1);
  assert.equal(r[0].fonteId, "f1");
});

test("detectarReceitaEsperadaNaoRecebida: ainda cedo no mês, não aparece mesmo sem receita", () => {
  const fontes = [{ id: "f1", nome: "Salário", tipo: "fixa", ativa: true, valorEsperadoCentavos: 500000 }];
  assert.deepEqual(detectarReceitaEsperadaNaoRecebida(fontes, [], "2026-03", "2026-03-05"), []);
});

test("detectarReceitaEsperadaNaoRecebida: receita já paga nesta competência, não aparece", () => {
  const fontes = [{ id: "f1", nome: "Salário", tipo: "fixa", ativa: true, valorEsperadoCentavos: 500000 }];
  const transacoes = [{ fonteRendaId: "f1", competencia: "2026-03", status: "pago", valorCentavos: 500000 }];
  assert.deepEqual(detectarReceitaEsperadaNaoRecebida(fontes, transacoes, "2026-03", "2026-03-25"), []);
});

test("detectarReceitaEsperadaNaoRecebida: fonte variável/eventual nunca gera este achado", () => {
  const fontes = [{ id: "f1", nome: "Freela", tipo: "variavel", ativa: true, valorEsperadoCentavos: 100000 }];
  assert.deepEqual(detectarReceitaEsperadaNaoRecebida(fontes, [], "2026-03", "2026-03-25"), []);
});

// ---------- compararComPeriodoAnterior ----------

test("compararComPeriodoAnterior: queda acima do limiar retorna subiu=false", () => {
  const r = compararComPeriodoAnterior(70000, 100000, { limiarPercentual: 20 });
  assert.ok(r);
  assert.equal(r.subiu, false);
  assert.equal(r.variacaoPercentual, -30);
});

test("compararComPeriodoAnterior: alta acima do limiar retorna subiu=true", () => {
  const r = compararComPeriodoAnterior(150000, 100000, { limiarPercentual: 20 });
  assert.ok(r);
  assert.equal(r.subiu, true);
});

test("compararComPeriodoAnterior: variação pequena (dentro do limiar) retorna null", () => {
  assert.equal(compararComPeriodoAnterior(105000, 100000, { limiarPercentual: 20 }), null);
});

test("compararComPeriodoAnterior: sem período anterior, retorna null", () => {
  assert.equal(compararComPeriodoAnterior(50000, 0), null);
});
