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

test("renda com 'fim': não projeta depois do último mês (Gedi/Tony até dezembro)", () => {
  const fonte = { id: "f1", nome: "Gedi / Tony", tipo: "recorrente", valorEsperadoCentavos: 350000, diaRecebimento: 24, ativa: true, fim: "2026-12" };
  const ev = eventosFuturos({ transacoes: [], dividas: [], recorrencias: [], fontesRenda: [fonte], cartoes: [], de: "2026-10-03", ate: "2027-03-31", hoje: "2026-10-03" });
  const meses = ev.filter((e) => e.origem?.tipo === "fonteRenda").map((e) => e.data.slice(0, 7));
  assert.deepEqual(meses, ["2026-10", "2026-11", "2026-12"]);
});

test("13.2 item 16: compra no cartão com uso habitual não entra também no gasto do dia a dia", async () => {
  const { gastoDiaADiaMensal } = await import("../src/domain/previstos.js");
  const cartoes = [{ id: "c", apelido: "Nubank", status: "ativo", diaFechamento: 5, diaVencimento: 12, usoMensalCentavos: 0 }];
  const faturas = [{ id: "f7", cartaoId: "c", competencia: "2026-07" }, { id: "f8", cartaoId: "c", competencia: "2026-08" }, { id: "f9", cartaoId: "c", competencia: "2026-09" }];
  const transacoes = [];
  for (const [i, c] of [["f7", "2026-07"], ["f8", "2026-08"], ["f9", "2026-09"]]) {
    transacoes.push({ tipo: "despesa", status: "pago", competencia: c, categoriaId: "mer", cartaoId: "c", faturaId: i, valorCentavos: 50000 });
    transacoes.push({ tipo: "despesa", status: "pago", competencia: c, categoriaId: "mer", contaId: "k", valorCentavos: 20000 });
  }
  const semCartoes = gastoDiaADiaMensal({ transacoes, categorias: [], recorrencias: [], competencia: "2026-10" });
  const comCartoes = gastoDiaADiaMensal({ transacoes, categorias: [], recorrencias: [], cartoes, faturas, competencia: "2026-10" });
  assert.equal(semCartoes, 70000);
  assert.equal(comCartoes, 20000);
});

test("13.3 item 9: salário lançado do extrato sem vínculo não faz a fonte aparecer de novo no mês", () => {
  const fontesRenda = [{ id: "f", nome: "Salário Carolina", tipo: "fixa", valorEsperadoCentavos: 500000, diaRecebimento: 5, contaId: "bb", ativa: true }];
  const base = { dividas: [], recorrencias: [], cartoes: [], faturas: [], fontesRenda, de: "2026-10-01", ate: "2026-10-31", hoje: "2026-10-01" };
  const sem = eventosFuturos({ ...base, transacoes: [] }).filter((e) => e.tipo === "receita");
  assert.equal(sem.length, 1);
  const extrato = [{ tipo: "receita", status: "pago", contaId: "bb", competencia: "2026-10", data: "2026-10-05", valorCentavos: 497500, descricao: "PIX RECEBIDO PREFEITURA SALARIO" }];
  assert.equal(eventosFuturos({ ...base, transacoes: extrato }).filter((e) => e.tipo === "receita").length, 0);
  const outra = [{ tipo: "receita", status: "pago", contaId: "next", competencia: "2026-10", data: "2026-10-05", valorCentavos: 30000, descricao: "Dona Ana" }];
  assert.equal(eventosFuturos({ ...base, transacoes: outra }).filter((e) => e.tipo === "receita").length, 1, "outra entrada qualquer não cobre o salário");
});

test("13.3 item 9: conta mensal NÃO casa sozinha com um pagamento parecido (Vivo de setembro pago em outubro)", () => {
  const recorrencias = [{ id: "r", descricao: "Vivo internet móvel", tipo: "despesa", valorEstimadoCentavos: 9462, diaBase: 10, ativa: true, categoriaId: "tel" }];
  const base = { dividas: [], fontesRenda: [], cartoes: [], faturas: [], recorrencias, de: "2026-10-02", ate: "2026-10-31", hoje: "2026-10-02" };
  const pagoSetembro = [{ tipo: "despesa", status: "pago", contaId: "k", competencia: "2026-10", data: "2026-10-02", valorCentavos: 9200, descricao: "Vivo internet móvel SET" }];
  assert.equal(eventosFuturos({ ...base, transacoes: pagoSetembro }).length, 1);
});

test("13.3 item 14: parcela atrasada de setembro paga em outubro não esconde a parcela de outubro", () => {
  const divida = { id: "d", nome: "Jeep", valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 21, dataInicio: "2025-01-03", diaVencimento: 3 };
  const pagaHoje = [{ tipo: "despesa", status: "pago", dividaId: "d", competencia: "2026-09", data: "2026-10-02", pagoEm: "2026-10-02", valorCentavos: 331637, contaId: "k" }];
  const ev = eventosFuturos({ transacoes: pagaHoje, dividas: [divida], recorrencias: [], fontesRenda: [], cartoes: [], faturas: [], de: "2026-10-02", ate: "2026-10-31", hoje: "2026-10-02" });
  assert.equal(ev.filter((e) => e.origem.tipo === "divida").length, 1);
});

test("13.3 item 28: uso mensal informado igual ao limite, sem fatura que mostre isso, não projeta o limite inteiro", async () => {
  const { usoMensalDoCartao } = await import("../src/domain/previstos.js");
  const cartao = { id: "pf", limiteTotalCentavos: 40000, usoMensalCentavos: 40000 };
  assert.equal(usoMensalDoCartao(cartao, { transacoes: [], faturas: [], competenciaHoje: "2026-10" }).valorCentavos, 0);
  assert.equal(usoMensalDoCartao({ ...cartao, usoMensalCentavos: 25000 }, { transacoes: [], faturas: [], competenciaHoje: "2026-10" }).valorCentavos, 25000);
});
