import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularReserva, HORIZONTES_RESERVA_MESES } from "../src/domain/reserva.js";

test("calcularReserva: cobertura em meses e dias de custo essencial", () => {
  const r = calcularReserva({ saldoReservaCentavos: 600000, custoEssencialCentavos: 300000 });
  assert.equal(r.coberturaMeses, 2);
  assert.equal(r.coberturaDias, 60);
});

test("calcularReserva: sem custo essencial registrado, cobertura é null (não inventa número)", () => {
  const r = calcularReserva({ saldoReservaCentavos: 600000, custoEssencialCentavos: 0 });
  assert.equal(r.coberturaMeses, null);
  assert.equal(r.coberturaDias, null);
  assert.ok(r.metas.every((m) => m.metaCentavos === null));
});

test("PORTÃO §15: meta por horizonte, progresso e o que falta, para os três horizontes do blueprint", () => {
  const r = calcularReserva({ saldoReservaCentavos: 450000, custoEssencialCentavos: 300000 });
  assert.deepEqual(r.metas.map((m) => m.meses), HORIZONTES_RESERVA_MESES);

  const meta3 = r.metas.find((m) => m.meses === 3);
  assert.equal(meta3.metaCentavos, 900000);
  assert.equal(meta3.progressoPercentual, 50);
  assert.equal(meta3.faltaCentavos, 450000);

  const meta6 = r.metas.find((m) => m.meses === 6);
  assert.equal(meta6.metaCentavos, 1800000);
  assert.equal(meta6.progressoPercentual, 25);
});

test("calcularReserva: progresso nunca passa de 100%, mesmo com reserva além da meta", () => {
  const r = calcularReserva({ saldoReservaCentavos: 5000000, custoEssencialCentavos: 300000 });
  const meta3 = r.metas.find((m) => m.meses === 3);
  assert.equal(meta3.progressoPercentual, 100);
  assert.equal(meta3.faltaCentavos, 0);
});

test("calcularReserva: reserva zerada não quebra, progresso zero", () => {
  const r = calcularReserva({ saldoReservaCentavos: 0, custoEssencialCentavos: 300000 });
  assert.equal(r.coberturaMeses, 0);
  assert.equal(r.metas[0].progressoPercentual, 0);
});
