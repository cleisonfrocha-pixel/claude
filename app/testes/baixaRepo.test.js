// Camada de dados com o armazenamento local (o mesmo que o painel usa fora do
// claude.ai): prova que Paguei com "de onde saiu" mexe no saldo da conta certa.
import { test } from "node:test";
import assert from "node:assert/strict";

const memoria = new Map();
globalThis.window = { localStorage: { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) } };

const db = await import("../src/dados/db.js");
const { darBaixaTransacao, desfazerBaixa, ajustarEvento } = await import("../src/dados/baixaRepo.js");
const { eventosFuturos } = await import("../src/domain/previstos.js");
const { opcoesDePagamento, conferirSaldo } = await import("../src/dados/pagamentoRepo.js");
const { calcularSaldoConta } = await import("../src/domain/caixa.js");

const HOJE = "2026-10-02";
async function semear() {
  memoria.clear();
  await db.criar("pessoas", { nome: "Cleison", papel: "titular" });
  const next = await db.criar("contas", { nome: "Next", status: "ativa", pessoaId: "p", saldoInicialCentavos: 582907, dataSaldoInicial: "2026-10-01", tipo: "corrente" });
  const nubank = await db.criar("contas", { nome: "Nubank", status: "ativa", pessoaId: "p", saldoInicialCentavos: 300228, dataSaldoInicial: "2026-10-01", tipo: "corrente" });
  const cartao = await db.criar("cartoes", { apelido: "Nubank PJ", status: "ativo", pessoaId: "p", diaFechamento: 11, diaVencimento: 18, limiteTotalCentavos: 350000, contaPagamentoId: nubank });
  await db.criar("categorias", { nome: "Moradia", natureza: "despesa", ativa: true, grupo: "moradia", essencial: true });
  const luz = await db.criar("transacoes", { tipo: "despesa", status: "atrasado", certeza: "confirmado", data: "2026-09-23", competencia: "2026-09", valorCentavos: 15679, contaId: next, cartaoId: null, categoriaId: "cat", pessoaId: "p", descricao: "Conta de Luz 2", origem: "chat", revisado: true });
  return { next, nubank, cartao, luz };
}
const saldo = async (id) => {
  const contas = await db.listar("contas"); const trans = await db.listar("transacoes");
  return calcularSaldoConta({ id, ...contas.find((c) => c.id === id).dados }, trans.map((t) => ({ id: t.id, ...t.dados })));
};

test("Paguei escolhendo o Nubank derruba o Nubank (e não o Next), com a data do dia", async () => {
  const { next, nubank, luz } = await semear();
  const d = await darBaixaTransacao(luz, { hoje: HOJE, contaId: nubank });
  assert.equal(await saldo(nubank), 300228 - 15679);
  assert.equal(await saldo(next), 582907);
  await desfazerBaixa(d);
  assert.equal(await saldo(nubank), 300228);
});

test("pagar só uma parte deixa o resto como conta a pagar; desfazer apaga o resto", async () => {
  const { next, luz } = await semear();
  const d = await darBaixaTransacao(luz, { hoje: HOJE, valorCentavos: 10000, contaId: next });
  const todas = (await db.listar("transacoes")).map((t) => t.dados);
  const resto = todas.find((t) => t.status === "atrasado");
  assert.equal(resto.valorCentavos, 5679);
  assert.equal(await saldo(next), 582907 - 10000);
  await desfazerBaixa(d);
  assert.equal((await db.listar("transacoes")).length, 1);
});

test("pagar no cartão vira compra da fatura certa e não mexe em conta nenhuma", async () => {
  const { next, nubank, cartao, luz } = await semear();
  await darBaixaTransacao(luz, { hoje: HOJE, cartaoId: cartao });
  assert.equal(await saldo(next), 582907);
  assert.equal(await saldo(nubank), 300228);
  const t = (await db.listar("transacoes"))[0].dados;
  assert.equal(t.cartaoId, cartao);
  assert.ok(t.faturaId);
  const faturas = (await db.listar("faturas")).map((f) => f.dados);
  assert.equal(faturas[0].competencia, "2026-10");
});

test("opções de pagamento mostram o saldo de cada conta e o limite livre de cada cartão", async () => {
  await semear();
  const o = await opcoesDePagamento(HOJE);
  assert.deepEqual(o.contas.map((c) => [c.nome, c.saldoCentavos]), [["Next", 582907], ["Nubank", 300228]]);
  assert.equal(o.cartoes[0].disponivelCentavos, 350000);
});

test("conferir saldo guarda a diferença e passa a contar dali pra frente", async () => {
  const { next } = await semear();
  const r = await conferirSaldo(next, 582933, { hoje: HOJE, agora: "2026-10-02T16:00:00.000Z" });
  assert.equal(r.diferencaCentavos, 26);
  const conta = (await db.listar("contas")).find((c) => c.id === next).dados;
  assert.equal(conta.dataSaldoInicial, HOJE);
  assert.equal(conta.conferencias[0].diferencaCentavos, 26);
  assert.equal(await saldo(next), 582933);
});

test("verba do mês: gastar R$ 80 em 'Mercado' deixa a verba com o resto, ainda sem dia, e desfazer restaura", async () => {
  const { next } = await semear();
  const verba = await db.criar("transacoes", { tipo: "despesa", status: "previsto", certeza: "confirmado", data: "2026-10-01", competencia: "2026-10", semDia: true, valorCentavos: 100000, contaId: next, categoriaId: "mercado", pessoaId: "p", descricao: "Mercado do mês", origem: "chat", revisado: true });
  const { candidatosDePagamento } = await import("../src/domain/conciliacao.js");
  const abertas = (await db.listar("transacoes")).map((t) => ({ id: t.id, ...t.dados }));
  const cand = candidatosDePagamento({ tipo: "despesa", valorCentavos: 8000, descricao: "Mercado Assaí", data: "2026-10-03" }, abertas, { hoje: "2026-10-03" });
  assert.equal(cand[0].transacao.id, verba);
  assert.equal(cand[0].verba, true);
  const d = await darBaixaTransacao(verba, { hoje: "2026-10-03", valorCentavos: 8000, contaId: next });
  const todas = (await db.listar("transacoes")).map((t) => t.dados);
  const resto = todas.find((t) => t.status === "previsto" && t.descricao === "Mercado do mês");
  assert.equal(resto.valorCentavos, 92000);
  assert.equal(resto.semDia, true);
  await desfazerBaixa(d);
  assert.equal((await db.listar("transacoes")).filter((t) => t.dados.descricao === "Mercado do mês").length, 1);
});

test("editar só este mês: a recorrência ganha um previsto no mês, o automático some e o cadastro não muda", async () => {
  const { next } = await semear();
  const rec = await db.criar("recorrencias", { descricao: "Internet", tipo: "despesa", valorEstimadoCentavos: 15790, diaBase: 10, inicio: "2026-10", ativa: true, contaId: next, categoriaId: "cat", pessoaId: "p", periodicidade: "mensal", semDia: false });
  const lerTudo = async () => ({ transacoes: (await db.listar("transacoes")).map((t) => ({ id: t.id, ...t.dados })), recorrencias: (await db.listar("recorrencias")).map((r) => ({ id: r.id, ...r.dados })) });
  let est = await lerTudo();
  const antes = eventosFuturos({ ...est, dividas: [], fontesRenda: [], cartoes: [], de: HOJE, ate: "2026-10-31", hoje: HOJE }).find((e) => e.descricao === "Internet");
  assert.equal(antes.valorCentavos, 15790);
  await ajustarEvento(antes, { valorCentavos: 19900, data: "2026-10-15" });
  est = await lerTudo();
  const depois = eventosFuturos({ ...est, dividas: [], fontesRenda: [], cartoes: [], de: HOJE, ate: "2026-10-31", hoje: HOJE }).filter((e) => e.descricao === "Internet");
  assert.equal(depois.length, 0);                                  // o automático deste mês saiu
  const nova = est.transacoes.find((t) => t.recorrenciaId === rec);
  assert.equal(nova.valorCentavos, 19900);
  assert.equal(nova.data, "2026-10-15");
  assert.equal(nova.status, "previsto");
  assert.equal(est.recorrencias[0].valorEstimadoCentavos, 15790);  // cadastro intacto
  const nov = eventosFuturos({ ...est, dividas: [], fontesRenda: [], cartoes: [], de: HOJE, ate: "2026-11-30", hoje: HOJE }).find((e) => e.descricao === "Internet" && e.data.startsWith("2026-11"));
  assert.equal(nov.valorCentavos, 15790);                          // outros meses seguem o cadastro
});

test("13.1: conferi o saldo hoje e depois paguei e recebi hoje: o saldo mexe na hora", async () => {
  const { next, luz } = await semear();
  await conferirSaldo(next, 225298, { hoje: HOJE, agora: "2026-10-02T12:00:00.000Z" });
  assert.equal(await saldo(next), 225298);
  await darBaixaTransacao(luz, { hoje: HOJE, contaId: next });
  assert.equal(await saldo(next), 225298 - 15679);
  const { criarSimples } = await import("../src/dados/transacoesRepo.js");
  await criarSimples({ tipo: "receita", status: "pago", certeza: "confirmado", data: HOJE, pagoEm: HOJE, valorCentavos: 25000, contaId: next, descricao: "Dona Ana", categoriaId: "c", pessoaId: "p" });
  assert.equal(await saldo(next), 225298 - 15679 + 25000);
});

test("13.1: editar um lançamento pago que já estava no saldo conferido não conta de novo", async () => {
  const { next } = await semear();
  const { criarSimples, transacoes } = await import("../src/dados/transacoesRepo.js");
  const id = await criarSimples({ tipo: "despesa", status: "pago", certeza: "confirmado", data: HOJE, pagoEm: HOJE, valorCentavos: 19000, contaId: next, descricao: "Barbeiro", categoriaId: "c", pessoaId: "p" });
  const futuro = new Date(Date.now() + 60000).toISOString();
  await conferirSaldo(next, 100000, { hoje: HOJE, agora: futuro });
  assert.equal(await saldo(next), 100000);
  await transacoes.atualizar(id, { descricao: "Gabriel (barbeiro)" });
  assert.equal(await saldo(next), 100000, "editar não pode mexer no saldo");
});

test("13.1: desfazer a baixa tira a hora do movimento e o saldo volta", async () => {
  const { next, luz } = await semear();
  await conferirSaldo(next, 225298, { hoje: HOJE, agora: "2026-10-02T12:00:00.000Z" });
  const d = await darBaixaTransacao(luz, { hoje: HOJE, contaId: next });
  const t = (await db.listar("transacoes")).find((x) => x.id === luz).dados;
  assert.ok(t.movimentadoEm, "baixa grava a hora do movimento");
  await desfazerBaixa(d);
  assert.equal(await saldo(next), 225298);
});

test("13.3 item 12: editar a data de uma compra no cartão leva a compra para a fatura certa", async () => {
  const { cartao } = await semear();
  const { criarSimples, transacoes } = await import("../src/dados/transacoesRepo.js");
  const id = await criarSimples({ tipo: "despesa", status: "pago", certeza: "confirmado", data: "2026-10-05", valorCentavos: 5000, cartaoId: cartao, contaId: null, descricao: "Farmácia", categoriaId: "c", pessoaId: "p" });
  const fat = async () => { const t = (await db.listar("transacoes")).find((x) => x.id === id).dados; const f = (await db.listar("faturas")).find((x) => x.id === t.faturaId); return f.dados.competencia; };
  assert.equal(await fat(), "2026-10"); // fecha dia 11
  await transacoes.atualizar(id, { data: "2026-10-15" });
  assert.equal(await fat(), "2026-11");
});
