import { test } from "node:test";
import assert from "node:assert/strict";
import { montarRetratoParaIA, montarTurnos, INSTRUCOES_IA } from "../src/domain/ia.js";

const inicio = {
  horizonteDias: 30,
  caixa: { saldoAtualCentavos: 892335, entradasPrevistasCentavos: 2360000, comprometidoCentavos: 1751247, seguroParaGastarCentavos: 643253, horizonteAte: "2026-11-02", diaMaisApertado: "2026-10-06" },
  confianca: { nivel: "baixa", frase: "A maior parte do que vai entrar ainda é esperada, não recebida.", esperadoCentavos: 2360000, totalCentavos: 2360000 },
  proximos: [{ data: "2026-10-05", descricao: "Del Poente", tipo: "entrada", valorCentavos: 500000, certeza: "provavel" }],
  retrato: [{ texto: "Nenhum bem cadastrado" }],
};

test("retrato da IA: cada linha traz a fonte e números formatados do painel", () => {
  const r = montarRetratoParaIA({ hoje: "2026-10-03", inicio, dividas: [], fontesRenda: [{ nome: "Gedi / Tony", tipo: "recorrente", valorEsperadoCentavos: 350000, fim: "2026-12" }], achados: [], ativos: [] });
  assert.ok(r.every((l) => l.fonte && l.texto));
  const txt = r.map((l) => l.texto).join("\n");
  assert.match(txt, /Pode gastar até 2026-11-02: R\$\s?6\.432,53/);
  assert.match(txt, /Del Poente.*\+R\$\s?5\.000,00 \(provavel\)/);
  assert.match(txt, /só até 2026-12/);
  assert.match(txt, /Nenhum bem cadastrado/);
});

test("turnos: instruções primeiro, dados dentro, pergunta por último; histórico limitado", () => {
  const retrato = [{ fonte: "Início", texto: "x" }];
  const hist = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));
  const t = montarTurnos({ retrato, historico: hist, pergunta: "e agora?" });
  assert.equal(t[0].role, "user");
  assert.ok(t[0].content.startsWith(INSTRUCOES_IA.slice(0, 40)) && t[0].content.includes("[Início] x"));
  assert.deepEqual(t.at(-1), { role: "user", content: "e agora?" });
  assert.ok(t.length <= 9);
  assert.equal(t[1].role, "assistant");
});

test("instruções: só lê, não inventa, incerto não é garantido, cita fontes", () => {
  for (const trecho of ["SOMENTE", "Você só lê", "nunca é dinheiro garantido", "Baseado em:"]) assert.ok(INSTRUCOES_IA.includes(trecho), trecho);
});

import { limitarRetrato } from "../src/domain/ia.js";

test("retrato grande é cortado com aviso, nunca passa do teto do prompt", () => {
  const linhas = Array.from({ length: 400 }, (_, i) => ({ fonte: "Fonte", texto: `linha ${i} ${"x".repeat(80)}` }));
  const r = limitarRetrato(linhas, 5000);
  const total = r.reduce((s, l) => s + l.fonte.length + l.texto.length + 4, 0);
  assert.ok(total < 5500);
  assert.equal(r.at(-1).fonte, "Aviso");
  assert.equal(limitarRetrato(linhas.slice(0, 5)).length, 5);
});

test("retrato traz o mapa dos próximos meses e as contas do mês", () => {
  const geral = { agora: { rendaConfirmadaCentavos: 0, rendaProvavelCentavos: 0, rendaIncertaCentavos: 0, gastoCentavos: 0, parcelasCentavos: 0, sobraCentavos: 0 }, futuro: [], alavancas: [],
    mapa: { linhas: [{ competencia: "2026-12", atual: false, sobraCentavos: 416736, saldoFimCentavos: 1585570, marcos: [{ texto: "Aluguel da casa começa", valorCentavos: 290000 }] }], semDiaADia: true, buraco: null } };
  const inicio2 = { ...inicio, contasMes: { resumo: { quantidade: 37, quantidadePagas: 0, pagoCentavos: 0, totalCentavos: 2049067, faltaCentavos: 2049067, quantidadeAtrasadas: 3, atrasadasCentavos: 24961 }, atrasadas: [{ descricao: "Conta de Luz" }] } };
  const txt = montarRetratoParaIA({ hoje: "2026-10-03", inicio: inicio2, geral, dividas: [], fontesRenda: [], achados: [], ativos: [] }).map((l) => `[${l.fonte}] ${l.texto}`).join("\n");
  assert.match(txt, /\[Plano · Próximos meses\] 2026-12: sobra R\$\s?4\.167,36.*Aluguel da casa começa/);
  assert.match(txt, /\[Contas do mês\] 0 de 37 contas pagas.*3 atrasada\(s\).*Conta de Luz/);
  assert.match(txt, /sem histórico|ainda não há histórico/);
});
