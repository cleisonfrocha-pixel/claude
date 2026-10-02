// Camada de dados com o armazenamento local (o mesmo que o painel usa fora do
// claude.ai): prova que Paguei com "de onde saiu" mexe no saldo da conta certa.
import { test } from "node:test";
import assert from "node:assert/strict";

const memoria = new Map();
globalThis.window = { localStorage: { getItem: (k) => (memoria.has(k) ? memoria.get(k) : null), setItem: (k, v) => memoria.set(k, v), removeItem: (k) => memoria.delete(k) } };

const db = await import("../src/dados/db.js");
const { darBaixaTransacao, desfazerBaixa } = await import("../src/dados/baixaRepo.js");
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
