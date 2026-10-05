import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirExtrato } from "../ferramentas/extrato/reconciliar.js";

test("conferirExtrato: fecha quando anterior + movimentos == final", () => {
  const r = conferirExtrato({ saldoAnteriorCentavos: 140635, movimentosCentavos: [450000, -331637, -9800], saldoFinalCentavos: 249198 });
  assert.equal(r.ok, true);
  assert.equal(r.diferencaCentavos, 0);
});

test("conferirExtrato: aponta a diferença em centavos (positiva = faltou entrada)", () => {
  const r = conferirExtrato({ saldoAnteriorCentavos: 100, movimentosCentavos: [-50], saldoFinalCentavos: 60 });
  assert.equal(r.ok, false);
  assert.equal(r.diferencaCentavos, 10);
});

test("conferirExtrato: recusa valor quebrado (dinheiro é centavo inteiro)", () => {
  assert.throws(() => conferirExtrato({ saldoAnteriorCentavos: 1.5, movimentosCentavos: [], saldoFinalCentavos: 1 }), /centavos inteiros/);
});
