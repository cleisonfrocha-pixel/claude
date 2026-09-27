import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularVisaoPorPessoa, donoDaTransacao, SEM_DONO } from "../src/domain/pessoas.js";
import { validarDivida, padraoDivida } from "../src/domain/esquema.js";
import { calcularVisaoConsolidada, dataEstimadaQuitacao } from "../src/domain/dividas.js";
import { detectarAchados } from "../src/domain/decisoes.js";

const COMP = "2026-09";
const HOJE = "2026-09-26";

function base() {
  return {
    pessoas: [{ id: "eu", nome: "Cleison" }, { id: "ela", nome: "Esposa" }],
    contas: [
      { id: "c-eu", pessoaId: "eu", nome: "Nubank", status: "ativa", saldoInicialCentavos: 100000, dataSaldoInicial: "2026-08-31" },
      { id: "c-ela", pessoaId: "ela", nome: "Inter", status: "ativa", saldoInicialCentavos: 50000, dataSaldoInicial: "2026-08-31" },
      { id: "c-res", pessoaId: "ela", nome: "Reserva", status: "ativa", ehReserva: true, saldoInicialCentavos: 200000, dataSaldoInicial: "2026-08-31" },
    ],
    cartoes: [{ id: "k-eu", pessoaId: "eu", apelido: "Roxinho" }],
    categorias: [
      { id: "mor", essencial: true }, { id: "laz", essencial: false }, { id: "sal" },
    ],
    transacoes: [
      { tipo: "receita", status: "pago", competencia: COMP, data: "2026-09-05", valorCentavos: 300000, contaId: "c-eu", pessoaId: "eu", categoriaId: "sal" },
      { tipo: "receita", status: "pago", competencia: COMP, data: "2026-09-05", valorCentavos: 400000, contaId: "c-ela", pessoaId: "ela", categoriaId: "sal" },
      { tipo: "despesa", status: "pago", competencia: COMP, data: "2026-09-06", valorCentavos: 350000, contaId: "c-eu", pessoaId: "eu", categoriaId: "mor" },
      { tipo: "despesa", status: "pago", competencia: COMP, data: "2026-09-07", valorCentavos: 50000, cartaoId: "k-eu", pessoaId: "", categoriaId: "laz" },
      { tipo: "despesa", status: "pago", competencia: COMP, data: "2026-09-08", valorCentavos: 100000, contaId: "c-ela", pessoaId: "ela", categoriaId: "mor" },
      // Ela passa 1.000 pra conta dele.
      { tipo: "transferencia", status: "pago", competencia: COMP, data: "2026-09-10", valorCentavos: 100000, contaId: "c-ela", direcao: "saida", transferenciaId: "tr1" },
      { tipo: "transferencia", status: "pago", competencia: COMP, data: "2026-09-10", valorCentavos: 100000, contaId: "c-eu", direcao: "entrada", transferenciaId: "tr1" },
      // Lançamento sem dono nenhum (conta de ninguém).
      { tipo: "despesa", status: "pago", competencia: COMP, data: "2026-09-11", valorCentavos: 7000, categoriaId: "laz" },
    ],
    dividas: [
      { id: "d1", pessoaId: "eu", nome: "Carro", saldoOriginalCentavos: 1000000, valorParcelaCentavos: 60000, quantidadeParcelas: 20, parcelasPagas: 5, dataInicio: "2026-05-10" },
      { id: "d2", pessoaId: "ela", nome: "Loja", negativada: true, saldoOriginalCentavos: 80000, valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2025-03-01" },
    ],
    ativos: [{ pessoaId: "ela", valorAtualCentavos: 150000 }],
    competencia: COMP,
    hoje: HOJE,
  };
}

test("dono da transação: responsável, senão dono da conta, senão dono do cartão", () => {
  const ctx = { contasPorId: new Map([["c", { pessoaId: "a" }]]), cartoesPorId: new Map([["k", { pessoaId: "b" }]]) };
  assert.equal(donoDaTransacao({ pessoaId: "x", contaId: "c" }, ctx), "x");
  assert.equal(donoDaTransacao({ contaId: "c" }, ctx), "a");
  assert.equal(donoDaTransacao({ cartaoId: "k" }, ctx), "b");
  assert.equal(donoDaTransacao({}, ctx), SEM_DONO);
});

test("cada pessoa tem sua renda, gasto, parcelas e cobertura", () => {
  const v = calcularVisaoPorPessoa(base());
  const [eu, ela] = v.pessoas;
  assert.equal(eu.numeros.rendaCentavos, 300000);
  assert.equal(eu.numeros.despesasCentavos, 400000); // conta + cartão dele
  assert.equal(eu.numeros.essencialCentavos, 350000);
  assert.equal(eu.numeros.parcelasCentavos, 60000);
  assert.equal(eu.numeros.coberturaCentavos, 300000 - 350000 - 60000);
  assert.equal(ela.numeros.rendaCentavos, 400000);
  assert.equal(ela.numeros.coberturaCentavos, 400000 - 100000);
  assert.equal(ela.numeros.dividasNegativadas, 1);
  assert.equal(ela.numeros.saldoNegativadoCentavos, 80000);
  assert.equal(eu.participacaoRendaPct, 43);
  assert.equal(ela.participacaoRendaPct, 57);
});

test("saldo é da conta: transferência entre os dois move saldo, não vira renda", () => {
  const v = calcularVisaoPorPessoa(base());
  const [eu, ela] = v.pessoas;
  assert.equal(eu.numeros.saldoOperacaoCentavos, 100000 + 300000 - 350000 + 100000);
  assert.equal(ela.numeros.saldoOperacaoCentavos, 50000 + 400000 - 100000 - 100000);
  assert.equal(ela.numeros.saldoReservaCentavos, 200000);
  assert.equal(eu.numeros.rendaCentavos, 300000);
});

test("repasses: quem passou dinheiro pra quem no mês", () => {
  const v = calcularVisaoPorPessoa(base());
  assert.deepEqual(v.repasses, [{ dePessoaId: "ela", paraPessoaId: "eu", totalCentavos: 100000, quantidade: 1 }]);
});

test("desequilíbrio: a folga de um cobre a falta do outro", () => {
  const v = calcularVisaoPorPessoa(base());
  assert.deepEqual(v.desequilibrio.comFalta, [{ pessoaId: "eu", faltaCentavos: 110000 }]);
  assert.equal(v.desequilibrio.folgaCentavos, 300000);
  assert.equal(v.desequilibrio.cobertoCentavos, 110000);
  assert.equal(v.desequilibrio.descobertoCentavos, 0);
});

test("invariante: pessoas + sem dono somam exatamente a casa", () => {
  const v = calcularVisaoPorPessoa(base());
  assert.ok(v.semDono, "o lançamento sem conta nem responsável aparece como sem dono");
  const blocos = [...v.pessoas, v.semDono];
  for (const campo of ["rendaCentavos", "despesasCentavos", "essencialCentavos", "parcelasCentavos", "saldoOperacaoCentavos",
    "saldoReservaCentavos", "dividasSaldoCentavos", "ativosCentavos", "patrimonioLiquidoCentavos", "coberturaCentavos"]) {
    const soma = blocos.reduce((s, b) => s + b.numeros[campo], 0);
    assert.equal(soma, v.casa[campo], campo);
  }
});

test("registro de pessoa apagada cai em sem dono e a soma continua fechando", () => {
  const b = base();
  b.dividas.push({ id: "d3", pessoaId: "fantasma", nome: "X", saldoOriginalCentavos: 5000, valorParcelaCentavos: 1000, quantidadeParcelas: 5, parcelasPagas: 0, dataInicio: "2026-10-01" });
  const v = calcularVisaoPorPessoa(b);
  const soma = [...v.pessoas, v.semDono].reduce((s, x) => s + x.numeros.dividasSaldoCentavos, 0);
  assert.equal(soma, v.casa.dividasSaldoCentavos);
});

test("sem nada sem dono, o bloco sem dono não aparece", () => {
  const b = base();
  b.transacoes = b.transacoes.filter((t) => t.valorCentavos !== 7000);
  assert.equal(calcularVisaoPorPessoa(b).semDono, null);
});

test("negativada sem acordo: parcela zero é válida só se negativada", () => {
  const semAcordo = padraoDivida({ nome: "Loja", pessoaId: "p", saldoOriginalCentavos: 80000, valorParcelaCentavos: 0, quantidadeParcelas: 1, negativada: true });
  assert.deepEqual(validarDivida(semAcordo), []);
  assert.ok(validarDivida({ ...semAcordo, negativada: false }).length > 0);
});

test("dívida sem acordo não tem data de quitação e zera a previsão do conjunto", () => {
  const b = base();
  assert.equal(dataEstimadaQuitacao(b.dividas[1]), null);
  const v = calcularVisaoConsolidada(b.dividas, HOJE);
  assert.equal(v.quantidadeNegativadas, 1);
  assert.equal(v.quantidadeSemAcordo, 1);
  assert.equal(v.dataQuitacaoTotal, null);
  assert.equal(v.comprometimentoMensalCentavos, 60000);
});

test("achado de negativada substitui o de atrasada pra mesma dívida", () => {
  const b = base();
  const achados = detectarAchados({ dividas: b.dividas, hoje: HOJE });
  const daLoja = achados.filter((a) => a.origem?.id === "d2");
  assert.equal(daLoja.length, 1);
  assert.equal(daLoja[0].chave, "divida_negativada");
  assert.equal(daLoja[0].urgencia, "alta");
  assert.equal(daLoja[0].impactoCentavos, 80000);
});
