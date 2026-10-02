import { test } from "node:test";
import assert from "node:assert/strict";
import { eventosFuturos, gastoDiaADiaMensal } from "../src/domain/previstos.js";
import { faturaParaPagamento } from "../src/domain/cartoes.js";

const janela = { de: "2026-09-28", ate: "2026-10-28", hoje: "2026-09-28" };

test("renda fixa entra no dia do último recebimento, e não duplica mês já recebido", () => {
  const fontes = [{ id: "f", nome: "Salário", tipo: "fixa", valorEsperadoCentavos: 300000, ativa: true }];
  const transacoes = [{ tipo: "receita", status: "pago", fonteRendaId: "f", competencia: "2026-09", data: "2026-09-05", valorCentavos: 300000 }];
  const e = eventosFuturos({ transacoes, fontesRenda: fontes, ...janela });
  assert.deepEqual(e.map((x) => [x.data, x.valorCentavos, x.certeza]), [["2026-10-05", 300000, "provavel"]]);
});

test("renda variável entra pelo pior mês fechado; sem histórico, é incerta (não garante nada)", () => {
  const fontes = [{ id: "v", nome: "Freela", tipo: "variavel", valorEsperadoCentavos: 700000, ativa: true, diaRecebimento: 12 }];
  const transacoes = [
    { tipo: "receita", status: "pago", fonteRendaId: "v", competencia: "2026-07", data: "2026-07-12", valorCentavos: 820000 },
    { tipo: "receita", status: "pago", fonteRendaId: "v", competencia: "2026-08", data: "2026-08-12", valorCentavos: 560000 },
  ];
  // Janela começa 2026-09-28: o dia 12 de setembro já passou sem receita
  // lançada, então também aparece — atrasado, pesando hoje — além da
  // projeção normal de outubro.
  assert.deepEqual(eventosFuturos({ transacoes, fontesRenda: fontes, ...janela }).map((x) => [x.data, x.valorCentavos, x.certeza, !!x.atrasado]), [
    ["2026-09-28", 560000, "provavel", true], ["2026-10-12", 560000, "provavel", false],
  ]);
  assert.deepEqual(eventosFuturos({ transacoes: [], fontesRenda: fontes, ...janela }).map((x) => [x.data, x.valorCentavos, x.certeza, !!x.atrasado]), [
    ["2026-09-28", 700000, "incerto", true], ["2026-10-12", 700000, "incerto", false],
  ]);
});

test("fonte de renda com dia já passado no mês e sem receita lançada pesa hoje, como atrasada", () => {
  const fontes = [{ id: "s", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 520000, ativa: true, diaRecebimento: 1 }];
  const e = eventosFuturos({ transacoes: [], fontesRenda: fontes, de: "2026-10-15", ate: "2026-11-15", hoje: "2026-10-15" });
  assert.deepEqual(e.map((x) => [x.data, x.valorCentavos, !!x.atrasado]), [
    ["2026-10-15", 520000, true], ["2026-11-01", 520000, false],
  ]);
});

test("fonte de renda: dia do mês ainda não chegou não é atrasado; mês já recebido não repete", () => {
  const fontes = [{ id: "s", nome: "Sociable", tipo: "recorrente", valorEsperadoCentavos: 520000, ativa: true, diaRecebimento: 20 }];
  const semReceita = eventosFuturos({ transacoes: [], fontesRenda: fontes, de: "2026-10-15", ate: "2026-11-25", hoje: "2026-10-15" });
  assert.deepEqual(semReceita.map((x) => [x.data, !!x.atrasado]), [["2026-10-20", false], ["2026-11-20", false]]);
  const jaRecebido = [{ tipo: "receita", status: "pago", fonteRendaId: "s", competencia: "2026-10", data: "2026-10-20", valorCentavos: 520000 }];
  const comReceita = eventosFuturos({ transacoes: jaRecebido, fontesRenda: fontes, de: "2026-10-15", ate: "2026-11-25", hoje: "2026-10-15" });
  assert.deepEqual(comReceita.map((x) => x.data), ["2026-11-20"]);
});

test("parcela de dívida entra no vencimento; parcela vencida e não paga pesa hoje", () => {
  const dividas = [
    { id: "a", nome: "Carro", valorParcelaCentavos: 115000, quantidadeParcelas: 48, parcelasPagas: 20, dataInicio: "2025-02-15" },
    { id: "b", nome: "Atrasada", valorParcelaCentavos: 50000, quantidadeParcelas: 10, parcelasPagas: 0, dataInicio: "2026-09-01" },
    { id: "c", nome: "Serasa", valorParcelaCentavos: 0, quantidadeParcelas: 1, parcelasPagas: 0, dataInicio: "2024-01-01" },
  ];
  const e = eventosFuturos({ dividas, ...janela });
  assert.deepEqual(e.map((x) => [x.data, x.valorCentavos, !!x.atrasado]), [
    ["2026-09-28", 50000, true], ["2026-10-01", 50000, false], ["2026-10-15", 115000, false],
  ]);
});

test("recorrência sem o lançamento do mês gerado entra; com o lançamento gerado, não duplica", () => {
  const recorrencias = [{ id: "r", descricao: "Aluguel", tipo: "despesa", valorEstimadoCentavos: 180000, diaBase: 10, inicio: "2026-01", ativa: true, contaId: "k" }];
  assert.deepEqual(eventosFuturos({ recorrencias, transacoes: [], ...janela }).map((x) => x.data), ["2026-10-10"]);
  const gerado = [{ tipo: "despesa", status: "previsto", recorrenciaId: "r", competencia: "2026-10", data: "2026-10-10", valorCentavos: 180000 }];
  assert.deepEqual(eventosFuturos({ recorrencias, transacoes: gerado, ...janela }), []);
});

test("gasto do dia a dia: média dos meses fechados com dados, sem parcela e sem o que a recorrência já projeta", () => {
  const categorias = [{ id: "d", grupo: "dividas" }];
  const transacoes = [
    { tipo: "despesa", status: "pago", competencia: "2026-08", valorCentavos: 300000 },
    { tipo: "despesa", status: "pago", competencia: "2026-08", categoriaId: "d", valorCentavos: 100000 },
    { tipo: "despesa", status: "pago", competencia: "2026-07", valorCentavos: 200000 },
    // junho sem nada: antes do histórico, não entra como zero
  ];
  const recorrencias = [{ tipo: "despesa", valorEstimadoCentavos: 50000, ativa: true }];
  assert.equal(gastoDiaADiaMensal({ transacoes, categorias, recorrencias, competencia: "2026-09" }), 200000);
});

test("faturaParaPagamento: a que já fechou até a data; adiantado, a mais antiga em aberto", () => {
  const cartao = { diaFechamento: 25, diaVencimento: 5 };
  const abertas = [{ id: "jul", competencia: "2026-07" }, { id: "ago", competencia: "2026-08" }];
  assert.equal(faturaParaPagamento(cartao, abertas, "2026-08-05").id, "jul");
  assert.equal(faturaParaPagamento(cartao, abertas, "2026-08-26").id, "ago");
  assert.equal(faturaParaPagamento(cartao, abertas, "2026-07-10").id, "jul");
});
