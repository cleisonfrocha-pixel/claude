import { test } from "node:test";
import assert from "node:assert/strict";
import { gastosDoMes, vazamentos, composicaoDeDividas } from "../src/domain/relatorios.js";

const categorias = [
  { id: "m", nome: "Mercado", grupo: "alimentacao", natureza: "despesa", essencial: true },
  { id: "l", nome: "Lazer", grupo: "lazer", natureza: "despesa" },
  { id: "d", nome: "Dívidas e parcelas", grupo: "dividas", natureza: "despesa", essencial: true },
  { id: "a", nome: "Assinaturas", grupo: "outros", natureza: "despesa" },
];
const hoje = "2026-10-03";
const t = (o) => ({ tipo: "despesa", status: "previsto", competencia: "2026-10", valorCentavos: 10000, ...o });

test("gastos do mês: por categoria e grupo, pago x a pagar; fatura e transferência nunca entram", () => {
  const r = gastosDoMes({ categorias, dividas: [], recorrencias: [], cartoes: [], competencia: "2026-10", hoje, transacoes: [
    t({ id: "1", categoriaId: "m", valorCentavos: 30000, status: "pago" }),
    t({ id: "2", categoriaId: "m", valorCentavos: 70000 }),
    t({ id: "3", categoriaId: "l", valorCentavos: 50000 }),
    t({ id: "4", tipo: "pagamento_fatura", valorCentavos: 999999 }),
    t({ id: "5", tipo: "transferencia", valorCentavos: 999999 }),
    t({ id: "6", categoriaId: "l", valorCentavos: 777, status: "cancelado" }),
    t({ id: "7", categoriaId: "l", valorCentavos: 888, competencia: "2026-09" }),
  ] });
  assert.equal(r.totalCentavos, 150000);
  assert.equal(r.pagoCentavos, 30000);
  assert.equal(r.categorias[0].nome, "Mercado");
  assert.equal(r.categorias[0].totalCentavos, 100000);
  assert.equal(r.grupos[0].grupo, "alimentacao");
  assert.ok(Math.abs(r.categorias.reduce((s, c) => s + c.pct, 0) - 1) < 1e-9);
});

test("parcela de dívida sem lançamento entra pelo calendário, na categoria de dívidas", () => {
  const dividas = [{ id: "j", nome: "Jeep", valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 19, dataInicio: "2025-03-04" }];
  const r = gastosDoMes({ categorias, dividas, recorrencias: [], cartoes: [], transacoes: [], competencia: "2026-10", hoje });
  assert.equal(r.totalCentavos, 331637);
  assert.equal(r.categorias[0].grupo, "dividas");
});

test("vazamentos: assinaturas e pequenos fixos, ignorando verbas e despesas grandes", () => {
  const v = vazamentos({ categorias, recorrencias: [
    { id: "1", descricao: "Claude IA", tipo: "despesa", valorEstimadoCentavos: 11000, categoriaId: "a" },
    { id: "2", descricao: "iCloud", tipo: "despesa", valorEstimadoCentavos: 6690, categoriaId: "a" },
    { id: "3", descricao: "Aluguel", tipo: "despesa", valorEstimadoCentavos: 290000, categoriaId: "m" },
    { id: "4", descricao: "Mercado", tipo: "despesa", valorEstimadoCentavos: 100000, semDia: true },
    { id: "5", descricao: "Parou", tipo: "despesa", valorEstimadoCentavos: 5000, ativa: false },
  ] });
  assert.deepEqual(v.itens.map((i) => i.descricao), ["Claude IA", "iCloud"]);
  assert.equal(v.mensalCentavos, 17690);
  assert.equal(v.anualCentavos, 17690 * 12);
});

test("composição das dívidas usa o valor real (com desconto) e soma a economia", () => {
  const c = composicaoDeDividas([
    { id: "b", nome: "Bradesco", saldoOriginalCentavos: 554604, valorComJurosCentavos: 1006416, ofertaValorCentavos: 352246, quantidadeParcelas: 1, parcelasPagas: 0, valorParcelaCentavos: 0, negativada: true, dataInicio: "2025-08-10" },
    { id: "j", nome: "Jeep", saldoOriginalCentavos: 19898220, valorParcelaCentavos: 331637, quantidadeParcelas: 60, parcelasPagas: 19, dataInicio: "2025-03-04" },
  ], hoje);
  assert.equal(c.itens.find((i) => i.id === "b").valorCentavos, 352246);
  assert.equal(c.economiaCentavos, 654170);
  assert.equal(c.problemasCentavos, 352246);
  assert.ok(c.financiamentosCentavos > 0);
});
