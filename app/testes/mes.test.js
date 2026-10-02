// A verdade do mês: o cenário que quebrou a confiança — renda cadastrada,
// nada recebido ainda. Nenhuma tela pode dizer "sem renda".

import { test } from "node:test";
import assert from "node:assert/strict";
import { visaoDoMes, numerosDoMes } from "../src/domain/mes.js";
import { statusEfetivo } from "../src/domain/transacoes.js";
import { calcularVisaoPorPessoa } from "../src/domain/pessoas.js";
import { calcularCustos } from "../src/domain/orcamento.js";
import { calcularRendaAtual } from "../src/domain/renda.js";
import { montarBaseCenarios, compararCenarios } from "../src/domain/cenarios.js";

const HOJE = "2026-10-03";
const COMP = "2026-10";
const categorias = [
  { id: "mor", nome: "Moradia", essencial: true, grupo: "moradia" },
  { id: "out", nome: "Outros", essencial: false, grupo: "outros" },
  { id: "div", nome: "Dívidas", essencial: true, grupo: "dividas" },
];
const fontesRenda = [
  { id: "f1", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 520000, diaRecebimento: 1, ativa: true, pessoaId: "c" },
  { id: "f2", nome: "Gedi", tipo: "recorrente", valorEsperadoCentavos: 350000, diaRecebimento: 24, ativa: true, pessoaId: "c" },
  { id: "f3", nome: "Cliente novo", tipo: "variavel", valorEsperadoCentavos: 400000, diaRecebimento: 20, ativa: true, pessoaId: "c" },
];
const recorrencias = [{ id: "r1", descricao: "Internet", tipo: "despesa", valorEstimadoCentavos: 15000, diaBase: 10, inicio: COMP, ativa: true, categoriaId: "mor", pessoaId: "c", contaId: "k" }];
const base = { transacoes: [], categorias, fontesRenda, recorrencias, dividas: [], cartoes: [], competencia: COMP, hoje: HOJE };

test("renda cadastrada e nada recebido: o mês tem renda provável, nunca zero", () => {
  const v = visaoDoMes(base);
  assert.equal(v.rendaConfirmadaCentavos, 0);
  assert.equal(v.rendaProvavelCentavos, 520000 + 350000); // Sociable atrasada (dia 1 passou) + Gedi dia 24
  assert.equal(v.rendaIncertaCentavos, 400000); // variável sem histórico: aparece, não conta
  assert.equal(v.rendaContavelCentavos, 870000);
});

test("renda recebida sai de 'provável' e entra em 'confirmada', sem contar duas vezes", () => {
  const t = [{ tipo: "receita", status: "pago", certeza: "confirmado", fonteRendaId: "f1", competencia: COMP, data: "2026-10-01", valorCentavos: 520000, pessoaId: "c" }];
  const v = visaoDoMes({ ...base, transacoes: t });
  assert.equal(v.rendaConfirmadaCentavos, 520000);
  assert.equal(v.rendaProvavelCentavos, 350000);
});

test("gasto previsto conta no essencial do mês; parcela de dívida fica de fora (já vai no comprometimento)", () => {
  const t = [
    { tipo: "despesa", status: "previsto", categoriaId: "mor", competencia: COMP, data: "2026-10-30", valorCentavos: 31961, pessoaId: "c" },
    { tipo: "despesa", status: "previsto", categoriaId: "div", competencia: COMP, data: "2026-10-04", valorCentavos: 331637, pessoaId: "c" },
    { tipo: "despesa", status: "pago", categoriaId: "out", competencia: COMP, data: "2026-10-02", valorCentavos: 10000, pessoaId: "c" },
  ];
  const v = visaoDoMes({ ...base, transacoes: t });
  assert.equal(v.essencialPrevistoCentavos, 31961 + 15000); // água + internet (recorrência sem lançamento)
  assert.equal(v.gastoPagoCentavos, 10000);
  assert.equal(v.gastoPrevistoCentavos, 31961 + 15000);
});

test("verba do mês (sem dia fixo) nunca vira atrasada dentro do mês", () => {
  const t = { status: "previsto", data: "2026-10-01", semDia: true };
  assert.equal(statusEfetivo(t, HOJE), "previsto");
  assert.equal(statusEfetivo(t, "2026-11-02"), "atrasado");
  assert.equal(statusEfetivo({ status: "previsto", data: "2026-10-01" }, HOJE), "atrasado");
});

test("numerosDoMes: renda e essencial saem do mesmo critério; sem visão, nada muda", () => {
  const custos = calcularCustos([], categorias, COMP);
  const v = visaoDoMes(base);
  const n = numerosDoMes({ rendaPagaCentavos: calcularRendaAtual([], COMP), custos, visao: v });
  assert.equal(n.rendaCentavos, 870000);
  assert.equal(n.custos.essencialCentavos, 15000);
  assert.equal(numerosDoMes({ rendaPagaCentavos: 7, custos, visao: null }).rendaCentavos, 7);
});

test("Por pessoa: com renda cadastrada e nada recebido, ninguém fica 'sem renda' e não há falta falsa", () => {
  const r = calcularVisaoPorPessoa({
    pessoas: [{ id: "c", nome: "Cleison" }], contas: [{ id: "k", pessoaId: "c", status: "ativa", saldoInicialCentavos: 800000, dataSaldoInicial: "2026-10-01" }],
    cartoes: [], categorias, transacoes: [], dividas: [{ id: "d", pessoaId: "c", nome: "Carro", saldoOriginalCentavos: 19000000, valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 19, dataInicio: "2025-03-04" }],
    ativos: [], competencia: COMP, hoje: HOJE, fontesRenda, recorrencias,
  });
  const c = r.pessoas[0].numeros;
  assert.equal(c.rendaCentavos, 870000);
  assert.ok(c.coberturaCentavos > 0, "renda 8.700 cobre essencial 150 + parcela 3.316");
  assert.equal(r.desequilibrio.faltaTotalCentavos, 0);
});

test("Caminhos sem histórico: usa o mês cadastrado e avisa", () => {
  const b = montarBaseCenarios({ transacoes: [], categorias, dividas: [], fontesRenda, recorrencias, cartoes: [], ativos: [], clareza: { saldoAtualCentavos: 800000, saldoReservaCentavos: 0 }, competencia: COMP, hoje: HOJE });
  assert.equal(b.semHistorico, true);
  assert.equal(b.suficiente, true);
  assert.ok(b.rendaMediaCentavos > 0);
  assert.ok(compararCenarios(b, {}).cenarios.length >= 5);
});
