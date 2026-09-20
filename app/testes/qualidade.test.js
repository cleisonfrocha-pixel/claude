import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularCompletudeGeral, identificarItensAConfirmar, identificarSaldosNaoConciliados,
  calcularUltimaAtualizacao, calcularConfiabilidade,
} from "../src/domain/qualidade.js";

function dadosCompletos(overrides = {}) {
  return {
    pessoas: [{ id: "p1" }],
    contas: [{ id: "c1", ehReserva: true }],
    categorias: [{ id: "cat1", essencial: true }],
    fontesRenda: [{ id: "f1" }],
    ativos: [{ id: "a1" }],
    transacoes: [{ data: "2026-03-15" }],
    limiteTrintaDias: "2026-02-19",
    ...overrides,
  };
}

// ---------- calcularCompletudeGeral ----------

test("calcularCompletudeGeral: checklist inteiro ok dá 100% e nenhuma pendência", () => {
  const r = calcularCompletudeGeral(dadosCompletos());
  assert.equal(r.percentual, 100);
  assert.deepEqual(r.pendencias, []);
  assert.equal(r.completo, true);
});

test("calcularCompletudeGeral: sem pessoa nenhuma, percentual cai e a pendência aponta o que fazer", () => {
  const r = calcularCompletudeGeral(dadosCompletos({ pessoas: [] }));
  assert.ok(r.percentual < 100);
  assert.ok(r.pendencias.some((p) => p.includes("pessoa")));
});

test("calcularCompletudeGeral: sem transação recente, entra na lista de pendências", () => {
  const r = calcularCompletudeGeral(dadosCompletos({ transacoes: [{ data: "2025-01-01" }] }));
  assert.ok(r.pendencias.some((p) => p.includes("30 dias")));
});

// ---------- identificarItensAConfirmar ----------

test("identificarItensAConfirmar: transação incerta gera item a confirmar", () => {
  const r = identificarItensAConfirmar({ transacoes: [{ certeza: "incerto", status: "previsto" }], dividas: [] });
  assert.equal(r.length, 1);
  assert.equal(r[0].chave, "transacoes_incertas");
});

test("identificarItensAConfirmar: transação incerta mas cancelada não conta", () => {
  const r = identificarItensAConfirmar({ transacoes: [{ certeza: "incerto", status: "cancelado" }], dividas: [] });
  assert.deepEqual(r, []);
});

test("identificarItensAConfirmar: dívida sem taxa de juros gera item a confirmar", () => {
  const r = identificarItensAConfirmar({ transacoes: [], dividas: [{ taxaJurosMensalPct: null }] });
  assert.equal(r.some((i) => i.chave === "dividas_sem_taxa"), true);
});

test("identificarItensAConfirmar: nada incerto, lista vazia", () => {
  const r = identificarItensAConfirmar({ transacoes: [{ certeza: "confirmado", status: "pago" }], dividas: [{ taxaJurosMensalPct: 1.5 }] });
  assert.deepEqual(r, []);
});

// ---------- identificarSaldosNaoConciliados ----------

test("identificarSaldosNaoConciliados: conta com saldo inicial antigo aparece", () => {
  const r = identificarSaldosNaoConciliados(
    { contas: [{ id: "c1", nome: "Conta", status: "ativa", dataSaldoInicial: "2025-01-01" }], ativos: [] },
    { limiteData: "2026-01-01" },
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].tipo, "conta");
});

test("identificarSaldosNaoConciliados: ativo com avaliação recente não aparece", () => {
  const r = identificarSaldosNaoConciliados(
    { contas: [], ativos: [{ id: "a1", nome: "Poupança", dataAvaliacao: "2026-03-01" }] },
    { limiteData: "2026-01-01" },
  );
  assert.deepEqual(r, []);
});

// ---------- calcularUltimaAtualizacao ----------

test("calcularUltimaAtualizacao: pega a data mais recente entre todas as coleções", () => {
  const r = calcularUltimaAtualizacao([
    [{ atualizadoEm: "2026-03-01T10:00:00.000Z" }],
    [{ atualizadoEm: "2026-03-05T10:00:00.000Z" }, { atualizadoEm: "2026-02-01T10:00:00.000Z" }],
  ]);
  assert.equal(r, "2026-03-05T10:00:00.000Z");
});

test("calcularUltimaAtualizacao: nenhuma coleção com dado, retorna null", () => {
  assert.equal(calcularUltimaAtualizacao([[], []]), null);
});

// ---------- calcularConfiabilidade ----------

test("calcularConfiabilidade: tudo ok dá nível alta e confiavel=true", () => {
  const r = calcularConfiabilidade({
    completude: { percentual: 100, pendencias: [] }, itensAConfirmar: [], saldosNaoConciliados: [],
  });
  assert.equal(r.nivel, "alta");
  assert.equal(r.confiavel, true);
  assert.deepEqual(r.motivos, []);
});

test("PORTÃO §23: dados incompletos geram aviso com os motivos concretos", () => {
  const r = calcularConfiabilidade({
    completude: { percentual: 50, pendencias: ["Nenhuma pessoa cadastrada."] },
    itensAConfirmar: [{ rotulo: "2 lançamentos marcados como incerto." }],
    saldosNaoConciliados: [{ tipo: "conta" }],
  });
  assert.equal(r.confiavel, false);
  assert.equal(r.nivel, "baixa");
  assert.ok(r.motivos.includes("Nenhuma pessoa cadastrada."));
  assert.ok(r.motivos.includes("2 lançamentos marcados como incerto."));
  assert.ok(r.motivos.some((m) => m.includes("conferência recente")));
});

test("calcularConfiabilidade: poucos motivos mas completude alta dá nível média, não baixa", () => {
  const r = calcularConfiabilidade({
    completude: { percentual: 85, pendencias: [] },
    itensAConfirmar: [{ rotulo: "1 dívida sem taxa de juros informada." }],
    saldosNaoConciliados: [],
  });
  assert.equal(r.nivel, "media");
});
