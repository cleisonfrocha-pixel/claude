import { test } from "node:test";
import assert from "node:assert/strict";
import { valorCobradoCentavos, ofertaDaDivida, placarNomeLimpo, acordoDaOferta, progressoDoFinanciamento, gastoPorCentro } from "../src/domain/esteira.js";

const bradesco = { id: "b", nome: "Bradesco", saldoOriginalCentavos: 554604, valorComJurosCentavos: 1006416, quantidadeParcelas: 1, parcelasPagas: 0, negativada: true, oferta: { valorCentavos: 352246, origem: "Serasa", validade: null } };

test("oferta do Bradesco: de R$ 10.064,16 por R$ 3.522,46, desconto de 64% e economia certa", () => {
  const o = ofertaDaDivida(bradesco, "2026-10-02");
  assert.equal(o.economiaCentavos, 654170);
  assert.equal(o.originalCentavos, 554604);
  assert.equal(o.descontoPct, 64);
  assert.equal(o.vencida, false);
  assert.equal(o.diasParaVencer, null);
});

test("oferta com validade vencida é marcada, sem validade nunca vence", () => {
  assert.equal(ofertaDaDivida({ ...bradesco, oferta: { valorCentavos: 100, validade: "2026-09-01" } }, "2026-10-02").vencida, true);
  assert.equal(ofertaDaDivida({ ...bradesco, oferta: null }, "2026-10-02"), null);
});

test("placar nome limpo: protesto que é a mesma dívida do Serasa não conta duas vezes", () => {
  const ds = [
    { id: "a", negativada: true, quantidadeParcelas: 1, parcelasPagas: 1, saldoOriginalCentavos: 24338 },
    { id: "b", negativada: true, quantidadeParcelas: 1, parcelasPagas: 0, saldoOriginalCentavos: 22713 },
    { id: "p", protestada: true, mesmaDividaDe: "a", quantidadeParcelas: 1, parcelasPagas: 0, saldoOriginalCentavos: 24338 },
    { id: "c", protestada: true, quantidadeParcelas: 1, parcelasPagas: 0, saldoOriginalCentavos: 100000 },
    { id: "jeep", quantidadeParcelas: 60, parcelasPagas: 19, valorParcelaCentavos: 331637 },
  ];
  const p = placarNomeLimpo(ds);
  assert.deepEqual([p.total, p.limpas, p.faltam], [3, 1, 2]);
  assert.equal(p.valorQueFaltaCentavos, 22713 + 100000);
});

test("acordo da oferta vira parcelas e guarda o que foi economizado", () => {
  const patch = acordoDaOferta(bradesco, { parcelas: 4, primeiraParcela: "2026-10-20" });
  assert.equal(patch.saldoOriginalCentavos, 352246);
  assert.equal(patch.valorParcelaCentavos, 88062);
  assert.equal(patch.quantidadeParcelas, 4);
  assert.equal(patch.acordoDe.economiaCentavos, 654170);
  assert.throws(() => acordoDaOferta({ ...bradesco, oferta: null }, { primeiraParcela: "2026-10-20" }));
});

test("Jeep: 19 de 60 pagas, já pago e falta pagar, FIPE velha avisa", () => {
  const jeep = { quantidadeParcelas: 60, parcelasPagas: 19, valorParcelaCentavos: 331637 };
  const p = progressoDoFinanciamento(jeep, { valorAtualCentavos: 11654000, dataAvaliacao: "2026-10-02" }, "2026-10-02");
  assert.equal(p.jaPagoCentavos, 6301103);
  assert.equal(p.faltaPagarCentavos, 13597117);
  assert.equal(p.percentual, 31);
  assert.equal(p.marcoAtingido, 25);
  assert.equal(p.proximoMarco, 50);
  assert.equal(p.parcelasAteOProximoMarco, 11);
  assert.equal(p.avaliacaoVelha, false);
  assert.equal(progressoDoFinanciamento(jeep, { valorAtualCentavos: 11654000, dataAvaliacao: "2026-08-01" }, "2026-10-02").avaliacaoVelha, true);
});

test("gasto por centro: sem centro é da casa; cancelado e outro mês ficam fora", () => {
  const g = gastoPorCentro([
    { tipo: "despesa", competencia: "2026-10", valorCentavos: 100 },
    { tipo: "despesa", competencia: "2026-10", valorCentavos: 600, centro: "galpao" },
    { tipo: "despesa", competencia: "2026-10", valorCentavos: 50, centro: "negocio", status: "cancelado" },
    { tipo: "despesa", competencia: "2026-09", valorCentavos: 70, centro: "negocio" },
  ], "2026-10");
  assert.deepEqual(g, { casa: 100, negocio: 0, galpao: 600 });
});

import { calcularSaldoAtual } from "../src/domain/dividas.js";
test("dívida com oferta vigente vale a oferta (R$ 3.522,46), não os R$ 10.064,16 cobrados", () => {
  assert.equal(calcularSaldoAtual(bradesco, "2026-10-03"), 352246);
  assert.equal(valorCobradoCentavos(bradesco), 1006416);
  assert.equal(calcularSaldoAtual({ ...bradesco, oferta: { valorCentavos: 352246, validade: "2026-09-01" } }, "2026-10-03"), 1006416); // venceu: volta ao cobrado
  assert.equal(calcularSaldoAtual({ ...bradesco, oferta: null }, "2026-10-03"), 1006416);
  assert.equal(calcularSaldoAtual({ ...bradesco, oferta: null, valorComJurosCentavos: 0 }, "2026-10-03"), 554604);
  const flat = { ...bradesco, oferta: null, ofertaValorCentavos: 352246 };
  assert.equal(calcularSaldoAtual(flat, "2026-10-03"), 352246);
});

test("fechar o acordo zera os campos da oferta e vira parcela", () => {
  const patch = acordoDaOferta(bradesco, { parcelas: 1, primeiraParcela: "2026-10-20" });
  const depois = { ...bradesco, ...patch };
  assert.equal(depois.ofertaValorCentavos, 0);
  assert.equal(depois.valorParcelaCentavos, 352246);
  assert.equal(calcularSaldoAtual(depois, "2026-10-03"), 352246);
});
