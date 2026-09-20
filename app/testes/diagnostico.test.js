import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPressaoFixas, calcularReceita, calcularEvolucaoCustoDeVida, calcularEvolucaoReceita,
  calcularDespesasForaDoPadrao, calcularCompletude, calcularDiagnostico,
} from "../src/domain/diagnostico.js";

function despesa(overrides) {
  return { tipo: "despesa", status: "pago", valorCentavos: 0, ...overrides };
}
function receita(overrides) {
  return { tipo: "receita", status: "pago", certeza: "confirmado", valorCentavos: 0, ...overrides };
}

// ---------- calcularPressaoFixas ----------

test("calcularPressaoFixas: soma só despesas pagas do mês, e a fatia essencial", () => {
  const categorias = [{ id: "moradia", essencial: true }, { id: "lazer", essencial: false }];
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 150000 }),
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 50000 }),
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 999999, status: "previsto" }), // não conta
    despesa({ competencia: "2026-02", categoriaId: "moradia", valorCentavos: 999999 }), // fora do mês
  ];
  const r = calcularPressaoFixas(transacoes, categorias, "2026-03");
  assert.equal(r.totalCentavos, 200000);
  assert.equal(r.fixasCentavos, 150000);
  assert.equal(r.percentual, 75);
});

// ---------- calcularReceita ----------

test("calcularReceita: previsibilidade é a fatia confirmada, concentração é a maior fonte", () => {
  const transacoes = [
    receita({ competencia: "2026-03", categoriaId: "salario", valorCentavos: 400000, certeza: "confirmado" }),
    receita({ competencia: "2026-03", categoriaId: "freela", valorCentavos: 100000, certeza: "provavel" }),
  ];
  const r = calcularReceita(transacoes, "2026-03");
  assert.equal(r.totalCentavos, 500000);
  assert.equal(r.previsibilidadePercentual, 80);
  assert.equal(r.concentracaoPercentual, 80, "salário é 80% do total — é a maior fonte");
  assert.equal(r.quantidadeFontes, 2);
});

// ---------- evoluções ----------

test("calcularEvolucaoCustoDeVida: compara despesa paga do mês com a do mês anterior", () => {
  const transacoes = [
    despesa({ competencia: "2026-03", valorCentavos: 120000 }),
    despesa({ competencia: "2026-02", valorCentavos: 100000 }),
  ];
  const r = calcularEvolucaoCustoDeVida(transacoes, "2026-03");
  assert.equal(r.atualCentavos, 120000);
  assert.equal(r.anteriorCentavos, 100000);
  assert.equal(r.variacaoCentavos, 20000);
  assert.equal(r.variacaoPercentual, 20);
});

test("calcularEvolucaoReceita: mesma lógica, para receita", () => {
  const transacoes = [
    receita({ competencia: "2026-03", valorCentavos: 500000 }),
    receita({ competencia: "2026-02", valorCentavos: 500000 }),
  ];
  const r = calcularEvolucaoReceita(transacoes, "2026-03");
  assert.equal(r.variacaoCentavos, 0);
  assert.equal(r.variacaoPercentual, 0);
});

// ---------- calcularDespesasForaDoPadrao ----------

test("calcularDespesasForaDoPadrao: aponta categoria bem acima da média dos meses anteriores", () => {
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "saude", valorCentavos: 90000 }), // atual: R$900
    despesa({ competencia: "2026-02", categoriaId: "saude", valorCentavos: 30000 }),
    despesa({ competencia: "2026-01", categoriaId: "saude", valorCentavos: 30000 }),
    despesa({ competencia: "2025-12", categoriaId: "saude", valorCentavos: 30000 }), // média: R$300
    despesa({ competencia: "2026-03", categoriaId: "lazer", valorCentavos: 20000 }), // sem histórico — não entra
  ];
  const achados = calcularDespesasForaDoPadrao(transacoes, "2026-03");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].categoriaId, "saude");
  assert.equal(achados[0].mediaCentavos, 30000);
  assert.equal(achados[0].percentualAcima, 200);
});

test("calcularDespesasForaDoPadrao: gasto normal (perto da média) não aparece", () => {
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "mercado", valorCentavos: 32000 }),
    despesa({ competencia: "2026-02", categoriaId: "mercado", valorCentavos: 30000 }),
    despesa({ competencia: "2026-01", categoriaId: "mercado", valorCentavos: 30000 }),
    despesa({ competencia: "2025-12", categoriaId: "mercado", valorCentavos: 30000 }),
  ];
  assert.deepEqual(calcularDespesasForaDoPadrao(transacoes, "2026-03"), []);
});

// ---------- calcularCompletude ----------

test("calcularCompletude: aponta o que falta, uma pendência por vez", () => {
  const r = calcularCompletude({ pessoas: [], contas: [], categorias: [], transacoes: [] });
  assert.ok(r.pendencias.some((p) => p.includes("pessoa")));
  assert.equal(r.completo, false);
});

test("calcularCompletude: completo quando não falta nada relevante", () => {
  const r = calcularCompletude({
    pessoas: [{ id: "p1" }],
    contas: [{ id: "c1", ehReserva: true }],
    categorias: [{ id: "cat1", essencial: true }],
    transacoes: [{ tipo: "despesa", categoriaId: "cat1" }],
  });
  assert.equal(r.completo, true);
  assert.deepEqual(r.pendencias, []);
});

// ---------- calcularDiagnostico (portão do §8) ----------

test("PORTÃO DA FASE 7 (§8): o diagnóstico junta fatos observáveis, sem inventar patrimônio líquido", () => {
  const clareza = { seguroParaGastarCentavos: -50000, livreCentavos: -50000, saldoReservaCentavos: 100000 };
  const dividas = [
    { nome: "Cartão", saldoOriginalCentavos: 500000, valorParcelaCentavos: 100000, quantidadeParcelas: 5, parcelasPagas: 0, dataInicio: "2026-01-01" },
  ];
  const transacoes = [
    despesa({ competencia: "2026-03", categoriaId: "moradia", valorCentavos: 150000 }),
    receita({ competencia: "2026-03", categoriaId: "salario", valorCentavos: 400000 }),
  ];
  const d = calcularDiagnostico({
    contas: [{ id: "c1", ehReserva: true, status: "ativa" }],
    transacoes,
    categorias: [{ id: "moradia", essencial: true }],
    dividas,
    pessoas: [{ id: "p1" }],
    clareza,
    competenciaAtual: "2026-03",
    hoje: "2026-03-15",
  });

  assert.equal(d.estadoCaixa.seguroParaGastarCentavos, -50000, "estado do caixa vem direto da clareza de caixa já calculada");
  assert.equal(d.pesoDividas.comprometimentoMensalCentavos, 100000, "peso das dívidas reaproveita a visão consolidada da Fase 6");
  assert.equal(d.receita.totalCentavos, 400000);
  assert.equal(d.reserva.temReserva, true);
  assert.equal(d.patrimonioLiquido.disponivel, true, "patrimônio líquido reaproveita o motor da Fase 9, não é mais um texto fixo");
  assert.equal(d.patrimonioLiquido.ativosCentavos, 0, "sem ativos informados, ativos ficam em zero — não inventa valor");
  assert.equal(d.patrimonioLiquido.liquidoCentavos, -500000, "líquido é ativos menos a mesma dívida já consolidada em pesoDividas");
});

test("calcularDiagnostico: patrimônio líquido soma os ativos informados", () => {
  const d = calcularDiagnostico({
    contas: [], transacoes: [], categorias: [], dividas: [], pessoas: [],
    ativos: [{ classe: "liquido", valorAtualCentavos: 300000 }],
    clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0, saldoReservaCentavos: 0 },
    competenciaAtual: "2026-03", hoje: "2026-03-15",
  });
  assert.equal(d.patrimonioLiquido.ativosCentavos, 300000);
  assert.equal(d.patrimonioLiquido.liquidoCentavos, 300000);
});
