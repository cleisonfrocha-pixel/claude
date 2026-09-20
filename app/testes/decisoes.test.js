import { test } from "node:test";
import assert from "node:assert/strict";
import { detectarAchados, priorizarAchados, montarPlanoVivo } from "../src/domain/decisoes.js";

function divida(overrides) {
  return {
    id: "d1", nome: "Cartão", saldoOriginalCentavos: 500000, valorParcelaCentavos: 100000,
    quantidadeParcelas: 5, parcelasPagas: 0, dataInicio: "2026-01-10", emRisco: false,
    ...overrides,
  };
}

// ---------- detectarAchados ----------

test("detectarAchados: seguro negativo vira problema de urgência alta, apontando a origem", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: -30000, livreCentavos: -30000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "caixa_seguro_negativo");
  assert.ok(a);
  assert.equal(a.tipo, "problema");
  assert.equal(a.urgencia, "alta");
  assert.equal(a.impactoCentavos, 30000);
  assert.equal(a.origem.rotulo, "Início — Dinheiro seguro para gastar");
});

test("detectarAchados: sem seguro negativo, nenhum problema de caixa aparece", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 5000, livreCentavos: 5000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.some((a) => a.chave === "caixa_seguro_negativo"), false);
});

test("detectarAchados: sobra livre relevante vira oportunidade", () => {
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 300000, livreCentavos: 300000 }, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "caixa_sobra_livre");
  assert.ok(a);
  assert.equal(a.tipo, "oportunidade");
  assert.equal(a.urgencia, "baixa");
});

test("detectarAchados: dívida atrasada vira problema, apontando a dívida de origem", () => {
  const d = divida({ id: "d1", nome: "Financiamento", dataInicio: "2026-01-10", parcelasPagas: 0 }); // vence 2026-01-10
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "divida_atrasada");
  assert.ok(a);
  assert.equal(a.id, "divida_atrasada:d1");
  assert.equal(a.origem.id, "d1");
  assert.equal(a.impactoCentavos, 100000);
});

test("detectarAchados: dívida quitada não gera nenhum achado", () => {
  const d = divida({ id: "d1", quantidadeParcelas: 5, parcelasPagas: 5 });
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.some((a) => a.origem?.id === "d1"), false);
});

test("detectarAchados: dívida em risco (mas não atrasada) vira risco, sem duplicar com o achado de atraso", () => {
  const d = divida({ id: "d1", dataInicio: "2026-03-01", parcelasPagas: 0, emRisco: true });
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [d], cartoesVisao: [], hoje: "2026-03-01" });
  assert.equal(achados.filter((a) => a.origem?.id === "d1").length, 1);
  assert.equal(achados[0].chave, "divida_em_risco");
});

test("detectarAchados: cartão no limite vira risco de urgência alta; perto do limite, média", () => {
  const cartoesVisao = [
    { cartaoId: "c1", apelido: "Roxinho", visao: { nivelAlerta: "critico", disponivelCentavos: 1000, percentualUtilizado: 95 } },
    { cartaoId: "c2", apelido: "Azul", visao: { nivelAlerta: "atencao", disponivelCentavos: 20000, percentualUtilizado: 75 } },
    { cartaoId: "c3", apelido: "Verde", visao: { nivelAlerta: "normal", disponivelCentavos: 400000, percentualUtilizado: 10 } },
  ];
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, dividas: [], cartoesVisao, hoje: "2026-03-01" });
  const critico = achados.find((a) => a.origem.id === "c1");
  const atencao = achados.find((a) => a.origem.id === "c2");
  assert.equal(critico.urgencia, "alta");
  assert.equal(atencao.urgencia, "media");
  assert.equal(achados.some((a) => a.origem.id === "c3"), false, "cartão normal não gera achado");
});

test("detectarAchados: saída crítica de 30 dias vira risco, urgência alta se for em até 7 dias", () => {
  const horizonte30d = { saidaCritica: { data: "2026-03-05", gapCentavos: 20000, itens: [{ descricao: "IPTU" }] } };
  const achados = detectarAchados({ clareza: { seguroParaGastarCentavos: 0, livreCentavos: 0 }, horizonte30d, dividas: [], cartoesVisao: [], hoje: "2026-03-01" });
  const a = achados.find((x) => x.chave === "projecao_saida_critica");
  assert.equal(a.urgencia, "alta", "5 dias de distância é dentro da janela de 7 dias");
  assert.equal(a.prazo, "2026-03-05");
});

// ---------- priorizarAchados ----------

test("priorizarAchados: urgência alta vem antes de média e baixa", () => {
  const achados = [
    { urgencia: "baixa", impactoCentavos: 999999 },
    { urgencia: "alta", impactoCentavos: 1 },
    { urgencia: "media", impactoCentavos: 500 },
  ];
  const r = priorizarAchados(achados);
  assert.deepEqual(r.map((a) => a.urgencia), ["alta", "media", "baixa"]);
});

test("priorizarAchados: empate de urgência desempata por impacto financeiro", () => {
  const achados = [
    { urgencia: "alta", impactoCentavos: 100 },
    { urgencia: "alta", impactoCentavos: 900 },
  ];
  const r = priorizarAchados(achados);
  assert.equal(r[0].impactoCentavos, 900);
});

// ---------- montarPlanoVivo ----------

test("PORTÃO DA FASE 7 (§9/§10): achados vão para os horizontes certos, e o plano se recalcula do zero cada vez", () => {
  const achados = [
    { id: "a", urgencia: "alta", impactoCentavos: 100, prazo: null },
    { id: "b", urgencia: "media", impactoCentavos: 50, prazo: "2026-03-04" }, // dentro de 7 dias -> esta semana
    { id: "c", urgencia: "media", impactoCentavos: 50, prazo: null }, // sem prazo -> este mês
    { id: "d", urgencia: "baixa", impactoCentavos: 10, prazo: null }, // -> 90 dias
  ];
  const plano = montarPlanoVivo(achados, "2026-03-01");
  assert.deepEqual(plano.agora.map((a) => a.id), ["a"]);
  assert.deepEqual(plano.estaSemana.map((a) => a.id), ["b"]);
  assert.deepEqual(plano.esteMes.map((a) => a.id), ["c"]);
  assert.deepEqual(plano.em90.map((a) => a.id), ["d"]);
  assert.deepEqual(plano.em12meses, []);

  // O mesmo achado resolvido (removido da lista de pendentes) simplesmente
  // não aparece mais em nenhum horizonte — não é preciso "desfazer" nada.
  const planoDepois = montarPlanoVivo(achados.filter((a) => a.id !== "a"), "2026-03-01");
  assert.deepEqual(planoDepois.agora, []);
});
