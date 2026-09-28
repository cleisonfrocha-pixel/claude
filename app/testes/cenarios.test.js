import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarBaseCenarios, cenariosPadrao, simularCenario, compararCenarios, ordemDeQuitacao, ordemDePagamento, premissas,
} from "../src/domain/cenarios.js";

// Base mínima escrita à mão: renda 5.000, essencial 3.000, 1.000 não
// essencial, uma dívida com acordo (parcela 500) e uma negativada parada.
function base(extra = {}) {
  return {
    competencia: "2026-09",
    mesesHistorico: 3,
    rendaMediaCentavos: 500000,
    rendaGarantidaCentavos: 450000,
    fonteRendaGarantida: "fontes",
    custoEssencialCentavos: 300000,
    custoAtualCentavos: 400000,
    discricionarioCentavos: 100000,
    dividas: [
      { id: "carro", nome: "Carro", saldoCentavos: 300000, parcelaCentavos: 50000, taxaMensalPct: 1.5, negativada: false },
      { id: "loja", nome: "Loja", saldoCentavos: 100000, parcelaCentavos: 0, taxaMensalPct: 5, negativada: true },
    ],
    reservaCentavos: 0,
    caixaCentavos: 0,
    ativosCentavos: 0,
    suficiente: true,
    ...extra,
  };
}

const cenario = (id, b = base(), opcoes) => cenariosPadrao(b, opcoes).find((c) => c.id === id);

test("ordem de quitação: negativadas primeiro (menor saldo), depois juros mais alto", () => {
  const ordem = ordemDeQuitacao([
    { id: "a", saldoCentavos: 5000, taxaMensalPct: 2, negativada: false },
    { id: "b", saldoCentavos: 9000, taxaMensalPct: 1, negativada: true },
    { id: "c", saldoCentavos: 1000, taxaMensalPct: 9, negativada: false },
    { id: "d", saldoCentavos: 3000, taxaMensalPct: 1, negativada: true },
  ]).map((d) => d.id);
  assert.deepEqual(ordem, ["d", "b", "c", "a"]);
});

test("ordem de pagamento (quem paga quando falta dinheiro pro mês): prioridade do usuário manda, mesmo contra o juro", () => {
  const ordem = ordemDePagamento([
    { id: "a", saldoCentavos: 1000, taxaMensalPct: 9, prioridadePagamento: 2 },
    { id: "b", saldoCentavos: 1000, taxaMensalPct: 1, prioridadePagamento: 1 },
    { id: "c", saldoCentavos: 1000, taxaMensalPct: 5, prioridadePagamento: null },
  ]).map((d) => d.id);
  // b (prioridade 1) primeiro mesmo com juro baixo; a (prioridade 2) depois;
  // c sem prioridade definida vai pro fim, mesmo com juro maior que o de a.
  assert.deepEqual(ordem, ["b", "a", "c"]);
});

test("ordem de pagamento sem NENHUMA prioridade definida: protege primeiro quem tem juro mais alto", () => {
  const ordem = ordemDePagamento([
    { id: "baixo", saldoCentavos: 1000, taxaMensalPct: 1, prioridadePagamento: null },
    { id: "alto", saldoCentavos: 1000, taxaMensalPct: 9, prioridadePagamento: null },
    { id: "empate-maior-saldo", saldoCentavos: 2000, taxaMensalPct: 5, prioridadePagamento: null },
    { id: "empate-menor-saldo", saldoCentavos: 500, taxaMensalPct: 5, prioridadePagamento: null },
  ]).map((d) => d.id);
  assert.deepEqual(ordem, ["alto", "empate-menor-saldo", "empate-maior-saldo", "baixo"]);
});

test("falta dinheiro pro mês: a dívida com prioridade pior é a que fica sem pagar, a outra é paga em dia", () => {
  // Renda 4.500, custo 4.000: sobram 500 pra dívida, mas as duas parcelas
  // somam 800 (500 + 300). Sem prioridade, o juro mais alto (carro, 1,5%)
  // seria pago e a "loja" ficaria de fora — só que ela é negativada e sem
  // acordo (parcela 0), não entra nessa disputa. Uso duas COM acordo pra
  // testar a prioridade de verdade.
  const b = base({
    rendaMediaCentavos: 450000,
    dividas: [
      { id: "carro", nome: "Carro", saldoCentavos: 300000, parcelaCentavos: 50000, taxaMensalPct: 1.5, negativada: false, prioridadePagamento: 2 },
      { id: "cartao", nome: "Cartão", saldoCentavos: 100000, parcelaCentavos: 30000, taxaMensalPct: 8, negativada: false, prioridadePagamento: 1 },
    ],
  });
  const r = simularCenario(b, cenario("atual", b), { meses: 1 });
  // Prioridade 1 (cartão) paga; prioridade 2 (carro) não coube (500 - 300 = 200 < 500).
  assert.deepEqual(r.dividasComAtraso.map((d) => d.id), ["carro"]);
});

test("investimento mínimo é protegido: sai antes de qualquer dívida, mesmo que isso derrube uma parcela", () => {
  // Renda 4.500, custo 4.000: sem investimento, sobram 500 — dá pra pagar
  // a parcela de 500 do carro inteira. Com 500 de investimento mínimo
  // protegido, não sobra nada pra dívida: a parcela fica de fora.
  const b = base({ rendaMediaCentavos: 450000, dividas: [{ id: "carro", nome: "Carro", saldoCentavos: 300000, parcelaCentavos: 50000, taxaMensalPct: 1.5, negativada: false }] });
  const semInvestimento = simularCenario(b, cenario("atual", b), { meses: 1 });
  assert.deepEqual(semInvestimento.dividasComAtraso, []);
  const comInvestimento = simularCenario(b, cenario("atual", b), { meses: 1, investimentoMinimoMensalCentavos: 50000 });
  assert.deepEqual(comInvestimento.dividasComAtraso.map((d) => d.id), ["carro"]);
});

test("seguir como está: dívida com acordo rende a taxa e a parcela abate, negativada sem acordo só cresce, sobra fica no caixa", () => {
  const r = simularCenario(base(), cenario("atual"), { meses: 2 });
  // mês 1: loja 100.000 + 5% = 105.000; carro 300.000 + 1,5% − 50.000 = 254.500
  assert.equal(r.serie[0].dividaCentavos, 105000 + 254500);
  assert.equal(r.serie[0].caixaCentavos, 500000 - 400000 - 50000);
  // mês 2: loja 110.250; carro 254.500 + 3.818 − 50.000 = 208.318
  assert.equal(r.serie[1].dividaCentavos, 110250 + 208318);
  assert.equal(r.jurosAcumuladosCentavos, 5000 + 4500 + 5250 + 3818);
  assert.equal(r.mesNomeLimpo, null);
  assert.equal(r.viavel, true);
});

test("quitação acelerada: sobra limpa a negativada primeiro, depois o resto", () => {
  const r = simularCenario(base(), cenario("quitacao"));
  // sobra do mês = 5.000 - 4.000 - 500 = 500 → loja (105.000) some em 3 meses
  assert.equal(r.mesNomeLimpo, 3);
  assert.ok(r.mesDividaZerada != null && r.mesDividaZerada < 24);
  assert.equal(r.viavel, true);
});

test("corte no não essencial acelera: nome limpa antes da quitação simples", () => {
  const quitacao = simularCenario(base(), cenario("quitacao"));
  const corte = simularCenario(base(), cenario("corte", base(), { cortePct: 50 }));
  assert.equal(corte.custoCentavos, 300000 + 50000);
  assert.ok(corte.mesNomeLimpo < quitacao.mesNomeLimpo);
  assert.ok(corte.mesDividaZerada < quitacao.mesDividaZerada);
});

test("essencial cobre exatamente a renda: a parcela do carro fica sem pagar, mas a reserva não é tocada e o caminho continua viável", () => {
  // Renda 4.000 = custo (essencial 3.000 + não essencial 1.000): sobra
  // zero pra dívida. A parcela do carro (500) não cabe — fica parada, os
  // juros continuam contando —, mas sobreviver não depende da reserva.
  const apertado = base({ rendaMediaCentavos: 400000, reservaCentavos: 60000 });
  const r = simularCenario(apertado, cenario("atual", apertado), { meses: 3 });
  assert.equal(r.serie[0].reservaCentavos, 60000, "reserva intocada: dívida não paga não é motivo pra sacar reserva");
  assert.equal(r.serie[2].reservaCentavos, 60000);
  assert.equal(r.primeiroMesNegativo, null);
  assert.equal(r.viavel, true, "sobrevivência sempre coberta, mesmo sem pagar a dívida");
  assert.deepEqual(r.dividasComAtraso, [{ id: "carro", nome: "Carro", quantidadeMeses: 3, primeiroMes: 1 }]);
  assert.equal(r.parcelasPuladas.length, 3);
});

test("quando falta pra cobrir o ESSENCIAL (não só a dívida), aí sim a reserva é usada e o caminho pode apertar", () => {
  // Renda 3.500 < custo 4.000: falta 500/mês pra viver, não pra pagar dívida.
  const apertado = base({ rendaMediaCentavos: 350000, reservaCentavos: 60000 });
  const r = simularCenario(apertado, cenario("atual", apertado), { meses: 3 });
  assert.equal(r.serie[0].reservaCentavos, 10000, "reserva cobre a falta de essencial no mês 1");
  assert.equal(r.primeiroMesNegativo, 2, "reserva não alcança o mês 2");
  assert.equal(r.viavel, false);
  // A dívida também não é paga (não sobra nada pra ela), mas o marco que
  // importa aqui é o essencial não fechar, não a dívida.
  assert.equal(r.dividasComAtraso.length, 1);
});

test("conservador usa a renda garantida e monta a reserva antes da dívida", () => {
  assert.equal(simularCenario(base(), cenario("conservador")).rendaCentavos, 450000);
  // Com 500/mês de sobra: 6 meses depois a reserva tem 3.000 e a
  // negativada ainda não recebeu nada (continua crescendo com juros).
  const b = base({ rendaGarantidaCentavos: 500000 });
  const r = simularCenario(b, cenario("conservador", b), { meses: 24, metaReservaMeses: 3 });
  assert.equal(r.serie[5].reservaCentavos, 300000);
  assert.equal(r.pagoExtraCentavos > 0 && r.mesReservaMeta == null, false);
  assert.ok(r.mesNomeLimpo == null || r.mesNomeLimpo > r.mesReservaMeta);
});

test("dívida zerada: a sobra passa a encher a reserva até a meta", () => {
  const semDivida = base({ dividas: [] });
  const r = simularCenario(semDivida, cenario("quitacao", semDivida), { meses: 12, metaReservaMeses: 3 });
  assert.equal(r.mesDividaZerada, 0);
  assert.equal(r.mesReservaMeta, 9); // 9.000 de meta, 1.000/mês
});

test("comparação: com negativada, o objetivo é limpar o nome e vem com motivo", () => {
  const c = compararCenarios(base());
  assert.equal(c.objetivo.campo, "mesNomeLimpo");
  assert.equal(c.cenarios.length, 6);
  const rec = c.cenarios.find((x) => x.id === c.recomendado.id);
  assert.ok(rec.resultado.viavel);
  assert.ok(rec.resultado.mesNomeLimpo != null);
  assert.match(c.recomendado.motivo, /limpar o nome/);
  assert.ok(c.destaques.maisRapidoNomeLimpo);
});

test("recomendação prefere menos esforço quando a diferença é pequena", () => {
  const c = compararCenarios(base());
  const rec = c.cenarios.find((x) => x.id === c.recomendado.id);
  const melhor = Math.min(...c.cenarios.filter((x) => x.resultado.viavel).map((x) => x.resultado.mesNomeLimpo ?? Infinity));
  assert.ok(rec.resultado.mesNomeLimpo <= melhor + 3);
  const maisBaratos = c.cenarios.filter((x) => x.resultado.viavel && (x.resultado.mesNomeLimpo ?? Infinity) <= melhor + 3);
  assert.equal(rec.esforco, Math.min(...maisBaratos.map((x) => x.esforco)));
});

test("nenhum caminho fecha: recomenda o que segura mais tempo e diz isso", () => {
  const quebrado = base({ rendaMediaCentavos: 200000, rendaGarantidaCentavos: 200000 });
  const c = compararCenarios(quebrado, { aumentoRendaCentavos: 10000, cortePct: 10 });
  assert.ok(c.cenarios.every((x) => !x.resultado.viavel));
  assert.match(c.recomendado.motivo, /Nenhum caminho fecha/);
});

test("simular nunca mexe na base (nada de escrever no dado real)", () => {
  const b = base();
  const copia = JSON.parse(JSON.stringify(b));
  compararCenarios(b);
  assert.deepEqual(b, copia);
});

test("premissas avisam quando dívida sem acordo não tem juros informado", () => {
  const b = base({ dividas: [{ id: "x", nome: "X", saldoCentavos: 1000, parcelaCentavos: 0, taxaMensalPct: null, negativada: true }] });
  assert.ok(premissas(b).some((p) => p.includes("sem juros informado")));
});

test("base a partir dos dados: média só dos meses FECHADOS com movimento e dívidas ativas", () => {
  const transacoes = [
    // Mês corrente (em andamento) — nunca entra na média, por maior que
    // pareça: um mês incompleto não é comparável a um mês fechado.
    { tipo: "receita", status: "pago", competencia: "2026-09", valorCentavos: 999999 },
    { tipo: "despesa", status: "pago", competencia: "2026-09", valorCentavos: 999999, categoriaId: "e" },
    { tipo: "receita", status: "previsto", competencia: "2026-09", valorCentavos: 999900 },
    // Dois meses fechados de verdade.
    { tipo: "receita", status: "pago", competencia: "2026-08", valorCentavos: 500000 },
    { tipo: "despesa", status: "pago", competencia: "2026-08", valorCentavos: 200000, categoriaId: "e" },
    { tipo: "receita", status: "pago", competencia: "2026-07", valorCentavos: 300000 },
    { tipo: "despesa", status: "pago", competencia: "2026-07", valorCentavos: 100000, categoriaId: "n" },
  ];
  const b = montarBaseCenarios({
    transacoes, categorias: [{ id: "e", essencial: true }, { id: "n" }],
    dividas: [
      { id: "q", nome: "Quitada", saldoOriginalCentavos: 1000, valorParcelaCentavos: 500, quantidadeParcelas: 2, parcelasPagas: 2, dataInicio: "2026-01-01" },
      { id: "s", nome: "Serasa", saldoOriginalCentavos: 80000, valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2025-01-01", negativada: true },
    ],
    fontesRenda: [], ativos: [], clareza: { saldoAtualCentavos: 1000, saldoReservaCentavos: 2000 },
    competencia: "2026-09", hoje: "2026-09-26",
  });
  assert.equal(b.mesesHistorico, 2, "só os dois meses fechados, o corrente fica de fora");
  assert.equal(b.rendaMediaCentavos, 400000, "média de 500000 e 300000 — o 999999 do mês corrente não entra");
  assert.equal(b.rendaGarantidaCentavos, 300000);
  assert.equal(b.custoEssencialCentavos, 100000, "média de 200000 (essencial em 08) e 0 (nada essencial em 07)");
  assert.equal(b.custoAtualCentavos, 150000);
  assert.deepEqual(b.dividas.map((d) => d.id), ["s"]);
  assert.equal(b.dividas[0].parcelaCentavos, 0);
});

test("caixaCentavos parte do saldo em conta, não do livre (senão o mês 1 desconta o próximo compromisso duas vezes)", () => {
  // Saldo em conta 6000; livreCentavos já desconta 2000 de um boleto que
  // vence nos próximos 30 dias (clareza de caixa, §4). Se a base usasse
  // livreCentavos (4000), o mês 1 da simulação subtrairia o custo médio do
  // mês (que já inclui esse mesmo boleto) de novo, descontando duas vezes.
  const b = montarBaseCenarios({
    transacoes: [{ tipo: "receita", status: "pago", competencia: "2026-09", valorCentavos: 100000 }],
    categorias: [], dividas: [], fontesRenda: [], ativos: [],
    clareza: { saldoAtualCentavos: 6000, livreCentavos: 4000, saldoReservaCentavos: 0 },
    competencia: "2026-09", hoje: "2026-09-26",
  });
  assert.equal(b.caixaCentavos, 6000);
});
