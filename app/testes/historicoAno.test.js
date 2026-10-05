import test from "node:test";
import assert from "node:assert/strict";
import { montarHistoricoAno, seloDaFonte, GRUPO_CARTAO_SEM_DETALHE } from "../src/domain/historicoAno.js";

const categorias = [
  { id: "c-sal", nome: "Salário", grupo: "renda", natureza: "receita" },
  { id: "c-mer", nome: "Mercado", grupo: "alimentacao", natureza: "despesa", essencial: true },
  { id: "c-out", nome: "Outros", grupo: "outros", natureza: "despesa" },
  { id: "c-div", nome: "Dívidas e parcelas", grupo: "dividas", natureza: "despesa" },
];
const fontesRenda = [{ id: "f-soc", nome: "Sociable" }, { id: "f-gab", nome: "Gábia" }, { id: "f-car", nome: "Salário da Carolina" }];
const contas = [{ id: "ct-cle", pessoaId: "p-cle" }, { id: "ct-car", pessoaId: "p-car" }];

let n = 0;
const tx = (campos) => ({ id: `t${++n}`, status: "pago", pessoaId: "p-cle", contaId: "ct-cle", competencia: (campos.data || "").slice(0, 7), ...campos });

function cenario() {
  const t = [];
  for (const m of ["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]) {
    t.push(tx({ tipo: "receita", valorCentavos: 450000, data: `${m}-01`, fonteRendaId: "f-soc", categoriaId: "c-sal" }));
    t.push(tx({ tipo: "despesa", valorCentavos: 100000, data: `${m}-10`, categoriaId: "c-mer" }));
    t.push(tx({ tipo: "despesa", valorCentavos: 20000, data: `${m}-12`, categoriaId: "c-out", descricao: "Fulano (a classificar)" }));
    t.push(tx({ tipo: "receita", valorCentavos: 490000, data: `${m}-07`, fonteRendaId: "f-car", categoriaId: "c-sal", pessoaId: "p-car", contaId: "ct-car" }));
  }
  // Gábia irregular: só em alguns meses
  t.push(tx({ tipo: "receita", valorCentavos: 170000, data: "2026-03-07", fonteRendaId: "f-gab", categoriaId: "c-sal" }));
  t.push(tx({ tipo: "receita", valorCentavos: 100000, data: "2026-05-07", fonteRendaId: "f-gab", categoriaId: "c-sal" }));
  t.push(tx({ tipo: "receita", valorCentavos: 170000, data: "2026-07-07", fonteRendaId: "f-gab", categoriaId: "c-sal" }));
  // Repasse não é renda nem gasto
  t.push(tx({ tipo: "repasse", direcao: "entrada", valorCentavos: 140000, data: "2026-08-20", descricao: "Gringo Pay" }));
  // Fatura sem compra: entra como cartão sem detalhe. Fatura com compra: não duplica.
  t.push(tx({ tipo: "pagamento_fatura", valorCentavos: 80000, data: "2026-08-15", faturaId: "fa1" }));
  t.push(tx({ tipo: "pagamento_fatura", valorCentavos: 50000, data: "2026-08-16", faturaId: "fa2" }));
  t.push(tx({ tipo: "despesa", valorCentavos: 50000, data: "2026-08-02", faturaId: "fa2", categoriaId: "c-mer", cartaoId: "cartao1", contaId: null }));
  // Previsto não conta; mês de hoje é parcial
  t.push(tx({ tipo: "despesa", valorCentavos: 999900, data: "2026-08-25", categoriaId: "c-mer", status: "previsto" }));
  t.push(tx({ tipo: "receita", valorCentavos: 450000, data: "2026-09-01", fonteRendaId: "f-soc", categoriaId: "c-sal" }));
  // Apoio: Carolina manda para o Cleison
  t.push(tx({ tipo: "transferencia", direcao: "saida", valorCentavos: 300000, data: "2026-08-08", transferenciaId: "tr1", contaId: "ct-car", pessoaId: "p-car" }));
  t.push(tx({ tipo: "transferencia", direcao: "entrada", valorCentavos: 300000, data: "2026-08-08", transferenciaId: "tr1", contaId: "ct-cle", pessoaId: "p-cle" }));
  return t;
}
const h = (extra = {}) => montarHistoricoAno({ transacoes: cenario(), categorias, fontesRenda, contas, hoje: "2026-09-10", ...extra });

test("renda por fonte e mês: só o pago, sem repasse nem transferência, cada número com seus ids", () => {
  const r = h();
  const ago = r.linhas.find((l) => l.competencia === "2026-08");
  assert.equal(ago.rendaCentavos, 450000 + 490000); // repasse de 1.400 e transferência de 3.000 ficam fora
  assert.equal(ago.fontes.find((f) => f.nome === "Sociable").totalCentavos, 450000);
  assert.ok(ago.fontes.every((f) => f.ids.length > 0));
  assert.equal(ago.repasses.entradaCentavos, 140000);
});

test("saídas por grupo: fatura sem detalhe entra à parte, fatura com compra não conta duas vezes, previsto fora", () => {
  const ago = h().linhas.find((l) => l.competencia === "2026-08");
  assert.equal(ago.grupos.find((g) => g.grupo === GRUPO_CARTAO_SEM_DETALHE).totalCentavos, 80000);
  assert.equal(ago.grupos.find((g) => g.grupo === "alimentacao").totalCentavos, 100000 + 50000);
  assert.equal(ago.saidaCentavos, 80000 + 150000 + 20000);
  assert.equal(ago.resultadoCentavos, ago.rendaCentavos - ago.saidaCentavos);
});

test("mês de hoje é parcial e fica fora da tendência e do piso", () => {
  const r = h();
  const set = r.linhas.find((l) => l.competencia === "2026-09");
  assert.equal(set.parcial, true);
  assert.equal(r.mesesFechados, 6);
  assert.ok(!r.janela.includes("2026-09"));
});

test("selo e piso de cada fonte vêm dos meses fechados", () => {
  const r = h();
  const soc = r.fontes.find((f) => f.nome === "Sociable");
  assert.equal(soc.selo, "fixa");
  assert.equal(soc.pisoCentavos, 450000);
  const gab = r.fontes.find((f) => f.nome === "Gábia");
  assert.equal(gab.selo, "irregular");
  assert.equal(gab.pisoCentavos, 0); // em 2026-04, 06 e 08 não veio nada
  assert.equal(gab.baseadoEmMeses, 6);
});

test("renda sem fonte cadastrada vira \"avulsa\", sem selo de fixa ou caiu", () => {
  const r = montarHistoricoAno({ transacoes: [tx({ tipo: "receita", valorCentavos: 10000, data: "2026-05-02", categoriaId: "c-sal" }), tx({ tipo: "receita", valorCentavos: 20000, data: "2026-06-02", categoriaId: "c-sal" })], categorias, fontesRenda, contas, hoje: "2026-09-10" });
  assert.equal(r.fontes[0].selo, "avulsa");
});

test("seloDaFonte: eventual, caiu, fixa e irregular", () => {
  assert.equal(seloDaFonte([0, 0, 500000, 0]), "eventual");
  assert.equal(seloDaFonte([450000, 450000, 460000, 450000]), "fixa");
  assert.equal(seloDaFonte([450000, 450000, 450000, 100000, 0, 0]), "caiu");
  assert.equal(seloDaFonte([170000, 0, 100000, 0, 170000]), "irregular");
});

test("tendência compara os 3 últimos meses fechados com os 3 anteriores", () => {
  const t = h().tendencia;
  assert.deepEqual(t.base.ultimos, ["2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(t.base.anteriores, ["2026-03", "2026-04", "2026-05"]);
  assert.ok(t.saidaMediaCentavos > 0);
});

test("pior e melhor mês pelo resultado", () => {
  const r = h();
  assert.equal(r.piorMes.competencia, "2026-08"); // fatura sem detalhe pesa mais em agosto
  assert.ok(r.melhorMes.resultadoCentavos >= r.piorMes.resultadoCentavos);
});

test("por pessoa: filtra os lançamentos e separa o apoio recebido do enviado", () => {
  const cle = h({ pessoaId: "p-cle" });
  const car = h({ pessoaId: "p-car" });
  assert.ok(!cle.fontes.some((f) => f.nome === "Salário da Carolina"));
  assert.ok(car.fontes.some((f) => f.nome === "Salário da Carolina"));
  assert.equal(cle.linhas.find((l) => l.competencia === "2026-08").apoio.recebidoCentavos, 300000);
  assert.equal(car.linhas.find((l) => l.competencia === "2026-08").apoio.enviadoCentavos, 300000);
  // A casa inteira só mostra o quanto circulou entre os dois
  assert.equal(h().linhas.find((l) => l.competencia === "2026-08").apoio.movimentadoCentavos, 300000);
});

test("quanto do gasto ainda está sem classificar, com os ids", () => {
  const r = h();
  assert.equal(r.semClassificar.quantidade, 6);
  assert.equal(r.semClassificar.valorCentavos, 6 * 20000);
  assert.equal(r.semClassificar.ids.length, 6);
  assert.ok(r.semClassificar.percentual > 0 && r.semClassificar.percentual < 1);
});

test("sem lançamentos: devolve vazio sem quebrar", () => {
  const r = montarHistoricoAno({ transacoes: [], categorias, fontesRenda, contas, hoje: "2026-09-10" });
  assert.equal(r.linhas.length, 0);
  assert.equal(r.tendencia, null);
  assert.equal(r.piorMes, null);
  assert.equal(r.semClassificar.percentual, 0);
});
