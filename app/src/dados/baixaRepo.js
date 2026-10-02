// "Recebi" e "Paguei" em um toque. Dar baixa nunca digita nada: usa o que o
// painel já sabe do compromisso (valor, conta, categoria, pessoa) e vira um
// lançamento real, pago e confirmado. O compromisso previsto deixa de
// aparecer como futuro porque agora existe um lançamento da competência.

import * as db from "./db.js";
import { criarSimples, transacoes, registrarPagamentoFatura } from "./transacoesRepo.js";
import { dividas } from "./repositorios.js";
import { reabrirFatura, obterOuCriarFatura } from "./faturasRepo.js";
import { hojeISO, competenciaDeData } from "../domain/tempo.js";
import { competenciaFatura } from "../domain/transacoes.js";

async function lerTudo(caminho) {
  return (await db.listar(caminho)).map((x) => ({ id: x.id, ...x.dados }));
}

function contaPadrao(contas, pessoaId) {
  const ativas = contas.filter((c) => c.status === "ativa" && !c.ehReserva);
  return ativas.find((c) => c.pessoaId === pessoaId) || ativas[0] || null;
}

/** Lançamento previsto/agendado/atrasado vira pago.
 *
 * `contaId` ou `cartaoId` dizem DE ONDE o dinheiro saiu (ou em que conta caiu);
 * `dataPagamento` é o dia em que saiu (o vencimento continua em `data`);
 * `valorCentavos` menor que o da conta paga só uma parte: o que falta fica como
 * uma conta nova, a pagar. Nada disso exige o usuário atualizar saldo depois:
 * o saldo da conta escolhida passa a refletir o pagamento na hora. */
export async function darBaixaTransacao(id, { hoje = hojeISO(), valorCentavos, contaId, cartaoId, dataPagamento } = {}) {
  const t = (await lerTudo("transacoes")).find((x) => x.id === id);
  if (!t) throw new Error("Lançamento não encontrado.");
  const quando = dataPagamento || hoje;
  const pago = Number(valorCentavos) > 0 ? Number(valorCentavos) : t.valorCentavos;
  const resto = t.valorCentavos - pago;
  const campos = { status: "pago", certeza: "confirmado", competencia: t.competencia || competenciaDeData(t.data), foiPrevisto: true, pagoEm: quando };
  const antes = { status: t.status, certeza: t.certeza, data: t.data, competencia: t.competencia, foiPrevisto: !!t.foiPrevisto, pagoEm: t.pagoEm || null, valorCentavos: t.valorCentavos, contaId: t.contaId || null, cartaoId: t.cartaoId || null, faturaId: t.faturaId || null };
  if (pago !== t.valorCentavos) campos.valorCentavos = pago;
  if (cartaoId && t.tipo === "despesa") {
    const cartao = (await lerTudo("cartoes")).find((c) => c.id === cartaoId);
    if (!cartao) throw new Error("Cartão não encontrado.");
    // Pago no cartão: vira compra daquela fatura, na data da compra. O caixa
    // só sente quando a fatura for paga.
    Object.assign(campos, { contaId: null, cartaoId, faturaId: await obterOuCriarFatura(cartaoId, competenciaFatura(cartao, quando)), data: quando });
  } else if (contaId) {
    Object.assign(campos, { contaId, cartaoId: null, faturaId: null });
  }
  await transacoes.atualizar(id, campos);
  let restoId = null;
  if (resto > 0 && !t.dividaId) {
    const { id: _id, criadoEm, atualizadoEm, ...clone } = t;
    restoId = await criarSimples({ ...clone, valorCentavos: resto, status: t.status === "atrasado" ? "atrasado" : "previsto", foiPrevisto: false, pagoEm: null });
  }
  const somou = !!t.dividaId && t.status !== "pago";
  if (somou) await somarParcelaPaga(t.dividaId);
  return { restaurar: { id, campos: antes }, dividaId: somou ? t.dividaId : null, restoId };
}

async function tirarParcelaPaga(dividaId) {
  const d = (await lerTudo("dividas")).find((x) => x.id === dividaId);
  if (!d) return;
  await dividas.atualizar(dividaId, { parcelasPagas: Math.max(0, (Number(d.parcelasPagas) || 0) - 1) });
}

/** Desfaz uma baixa feita agora: o que `darBaixa*` devolveu diz como voltar.
 * Lançamento criado na baixa é apagado; lançamento que já existia volta ao
 * estado anterior; a parcela da dívida e a fatura voltam junto. */
export async function desfazerBaixa(desfazer) {
  if (!desfazer) return;
  if (desfazer.criadaId) await transacoes.apagar(desfazer.criadaId);
  if (desfazer.restoId) await transacoes.apagar(desfazer.restoId);
  if (desfazer.restaurar) await transacoes.atualizar(desfazer.restaurar.id, desfazer.restaurar.campos);
  if (desfazer.dividaId) await tirarParcelaPaga(desfazer.dividaId);
  if (desfazer.faturaId) await reabrirFatura(desfazer.faturaId);
}

/** Paga a fatura inteira, saindo da conta escolhida (ou da conta de pagamento
 * do cartão, ou da padrão). Não vira despesa nova: as compras já contaram. */
export async function darBaixaFatura({ faturaId, cartaoId, valorCentavos, descricao, contaId, dataPagamento, hoje = hojeISO() }) {
  const [contas, cartoesLista] = await Promise.all([lerTudo("contas"), lerTudo("cartoes")]);
  const cartao = cartoesLista.find((c) => c.id === cartaoId);
  const conta = contas.find((c) => c.id === contaId && c.status === "ativa")
    || contas.find((c) => c.id === cartao?.contaPagamentoId && c.status === "ativa") || contaPadrao(contas, cartao?.pessoaId);
  if (!conta) throw new Error("Falta uma conta ativa pra pagar a fatura.");
  const criadaId = await registrarPagamentoFatura({ faturaId, contaId: conta.id, valorCentavos, data: dataPagamento || hoje, descricao });
  return { criadaId, faturaId };
}

async function somarParcelaPaga(dividaId) {
  const d = (await lerTudo("dividas")).find((x) => x.id === dividaId);
  if (!d) return;
  await dividas.atualizar(dividaId, { parcelasPagas: Math.min(Number(d.quantidadeParcelas) || 0, (Number(d.parcelasPagas) || 0) + 1) });
}

/** Evento virtual do calendário (renda esperada, parcela de dívida,
 * recorrência ainda sem lançamento) vira um lançamento real pago. */
export async function darBaixaEvento(evento, { valorCentavos, contaId, cartaoId, dataPagamento, hoje = hojeISO() } = {}) {
  const valor = Number(valorCentavos) > 0 ? Number(valorCentavos) : evento.valorCentavos;
  const quando = dataPagamento || hoje;
  const resto = evento.valorCentavos - valor;
  const [contas, categorias, fontes, listaDividas, recs] = await Promise.all([
    lerTudo("contas"), lerTudo("categorias"), lerTudo("fontesRenda"), lerTudo("dividas"), lerTudo("recorrencias"),
  ]);
  const data = evento.data <= hoje && !evento.atrasado ? evento.data : hoje;
  const base = { valorCentavos: valor, data, status: "pago", certeza: "confirmado", foiPrevisto: true, pagoEm: quando };
  const escolhida = contaId ? contas.find((c) => c.id === contaId && c.status === "ativa") : null;
  // Quando sobrou um pedaço (pagou menos que o combinado), o pedaço fica a pagar/receber.
  const criarResto = async (extra) => (resto > 0 ? criarSimples({ ...base, ...extra, valorCentavos: resto, status: "previsto", certeza: evento.certeza === "incerto" ? "incerto" : "provavel", foiPrevisto: false, pagoEm: null, data: evento.data > quando ? evento.data : quando }) : null);
  const { tipo, id } = evento.origem || {};
  if (tipo === "fonteRenda") {
    const f = fontes.find((x) => x.id === id);
    if (!f) throw new Error("Fonte de renda não encontrada.");
    const conta = escolhida || contas.find((c) => c.id === f.contaId && c.status === "ativa") || contaPadrao(contas, f.pessoaId);
    const cat = categorias.find((c) => c.natureza === "receita" && c.ativa !== false && c.id === f.categoriaId)
      || categorias.find((c) => c.natureza === "receita" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou uma categoria de receita.");
    const dados = { tipo: "receita", contaId: conta.id, categoriaId: cat.id, pessoaId: f.pessoaId, descricao: f.nome, fonteRendaId: f.id };
    const criadaId = await criarSimples({ ...base, ...dados });
    return { criadaId, restoId: await criarResto(dados) };
  }
  if (tipo === "divida") {
    const d = listaDividas.find((x) => x.id === id);
    if (!d) throw new Error("Dívida não encontrada.");
    const conta = escolhida || contaPadrao(contas, d.pessoaId);
    const cat = categorias.find((c) => c.grupo === "dividas" && c.natureza === "despesa" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou a categoria de dívidas.");
    const novo = await criarSimples({ ...base, tipo: "despesa", contaId: conta.id, categoriaId: cat.id, pessoaId: d.pessoaId, descricao: evento.descricao, dividaId: d.id });
    await somarParcelaPaga(d.id);
    return { criadaId: novo, dividaId: d.id };
  }
  if (tipo === "recorrencia") {
    const r = recs.find((x) => x.id === id);
    if (!r) throw new Error("Recorrência não encontrada.");
    const ehReceita = r.tipo === "receita";
    const dados = {
      tipo: ehReceita ? "receita" : "despesa",
      contaId: cartaoId && !ehReceita ? null : (escolhida?.id || r.contaId || contaPadrao(contas, r.pessoaId)?.id || null),
      cartaoId: !ehReceita ? (cartaoId || r.cartaoId || null) : null,
      categoriaId: r.categoriaId, pessoaId: r.pessoaId, descricao: r.descricao, recorrenciaId: r.id,
      competencia: competenciaDeData(evento.data), ...(r.semDia ? { semDia: true } : {}),
    };
    if (dados.cartaoId) dados.data = quando; // compra no cartão: na data em que foi feita
    const criadaId = await criarSimples({ ...base, ...dados, ...(dados.cartaoId ? { data: quando } : {}) });
    return { criadaId, restoId: await criarResto({ ...dados, ...(dados.cartaoId ? {} : {}) }) };
  }
  throw new Error("Esse item é uma estimativa, não um compromisso que dá pra baixar.");
}
