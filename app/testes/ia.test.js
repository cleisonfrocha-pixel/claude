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
