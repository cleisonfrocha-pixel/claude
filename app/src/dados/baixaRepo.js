// "Recebi" e "Paguei" em um toque. Dar baixa nunca digita nada: usa o que o
// painel já sabe do compromisso (valor, conta, categoria, pessoa) e vira um
// lançamento real, pago e confirmado. O compromisso previsto deixa de
// aparecer como futuro porque agora existe um lançamento da competência.

import * as db from "./db.js";
import { criarSimples, transacoes, registrarPagamentoFatura } from "./transacoesRepo.js";
import { dividas } from "./repositorios.js";
import { reabrirFatura } from "./faturasRepo.js";
import { hojeISO, competenciaDeData } from "../domain/tempo.js";

async function lerTudo(caminho) {
  return (await db.listar(caminho)).map((x) => ({ id: x.id, ...x.dados }));
}

function contaPadrao(contas, pessoaId) {
  const ativas = contas.filter((c) => c.status === "ativa" && !c.ehReserva);
  return ativas.find((c) => c.pessoaId === pessoaId) || ativas[0] || null;
}

/** Lançamento previsto/agendado/atrasado vira pago. A data real do
 * pagamento é hoje, a menos que a data do lançamento já tenha passado. */
export async function darBaixaTransacao(id, { hoje = hojeISO(), valorCentavos } = {}) {
  const t = (await lerTudo("transacoes")).find((x) => x.id === id);
  if (!t) throw new Error("Lançamento não encontrado.");
  const data = t.data <= hoje ? t.data : hoje;
  const outroValor = Number(valorCentavos) > 0 && Number(valorCentavos) !== t.valorCentavos;
  await transacoes.atualizar(id, { status: "pago", certeza: "confirmado", data, competencia: t.competencia || competenciaDeData(data), foiPrevisto: true, pagoEm: hoje, ...(outroValor ? { valorCentavos: Number(valorCentavos) } : {}) });
  const somou = !!t.dividaId && t.status !== "pago";
  if (somou) await somarParcelaPaga(t.dividaId);
  return { restaurar: { id, campos: { status: t.status, certeza: t.certeza, data: t.data, competencia: t.competencia, foiPrevisto: !!t.foiPrevisto, pagoEm: t.pagoEm || null, valorCentavos: t.valorCentavos } }, dividaId: somou ? t.dividaId : null };
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
  if (desfazer.restaurar) await transacoes.atualizar(desfazer.restaurar.id, desfazer.restaurar.campos);
  if (desfazer.dividaId) await tirarParcelaPaga(desfazer.dividaId);
  if (desfazer.faturaId) await reabrirFatura(desfazer.faturaId);
}

/** Paga a fatura inteira, saindo da conta de pagamento do cartão (ou da
 * conta padrão). Não vira despesa nova: as compras já contaram. */
export async function darBaixaFatura({ faturaId, cartaoId, valorCentavos, descricao, hoje = hojeISO() }) {
  const [contas, cartoesLista] = await Promise.all([lerTudo("contas"), lerTudo("cartoes")]);
  const cartao = cartoesLista.find((c) => c.id === cartaoId);
  const conta = contas.find((c) => c.id === cartao?.contaPagamentoId && c.status === "ativa") || contaPadrao(contas, cartao?.pessoaId);
  if (!conta) throw new Error("Falta uma conta ativa pra pagar a fatura.");
  const criadaId = await registrarPagamentoFatura({ faturaId, contaId: conta.id, valorCentavos, data: hoje, descricao });
  return { criadaId, faturaId };
}

async function somarParcelaPaga(dividaId) {
  const d = (await lerTudo("dividas")).find((x) => x.id === dividaId);
  if (!d) return;
  await dividas.atualizar(dividaId, { parcelasPagas: Math.min(Number(d.quantidadeParcelas) || 0, (Number(d.parcelasPagas) || 0) + 1) });
}

/** Evento virtual do calendário (renda esperada, parcela de dívida,
 * recorrência ainda sem lançamento) vira um lançamento real pago. */
export async function darBaixaEvento(evento, { valorCentavos, hoje = hojeISO() } = {}) {
  const valor = Number(valorCentavos) > 0 ? Number(valorCentavos) : evento.valorCentavos;
  const [contas, categorias, fontes, listaDividas, recs] = await Promise.all([
    lerTudo("contas"), lerTudo("categorias"), lerTudo("fontesRenda"), lerTudo("dividas"), lerTudo("recorrencias"),
  ]);
  const data = evento.data <= hoje && !evento.atrasado ? evento.data : hoje;
  const base = { valorCentavos: valor, data, status: "pago", certeza: "confirmado", foiPrevisto: true, pagoEm: hoje };
  const { tipo, id } = evento.origem || {};
  if (tipo === "fonteRenda") {
    const f = fontes.find((x) => x.id === id);
    if (!f) throw new Error("Fonte de renda não encontrada.");
    const conta = contas.find((c) => c.id === f.contaId && c.status === "ativa") || contaPadrao(contas, f.pessoaId);
    const cat = categorias.find((c) => c.natureza === "receita" && c.ativa !== false && c.id === f.categoriaId)
      || categorias.find((c) => c.natureza === "receita" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou uma categoria de receita.");
    return { criadaId: await criarSimples({ ...base, tipo: "receita", contaId: conta.id, categoriaId: cat.id, pessoaId: f.pessoaId, descricao: f.nome, fonteRendaId: f.id }) };
  }
  if (tipo === "divida") {
    const d = listaDividas.find((x) => x.id === id);
    if (!d) throw new Error("Dívida não encontrada.");
    const conta = contaPadrao(contas, d.pessoaId);
    const cat = categorias.find((c) => c.grupo === "dividas" && c.natureza === "despesa" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou a categoria de dívidas.");
    const novo = await criarSimples({ ...base, tipo: "despesa", contaId: conta.id, categoriaId: cat.id, pessoaId: d.pessoaId, descricao: evento.descricao, dividaId: d.id });
    await somarParcelaPaga(d.id);
    return { criadaId: novo, dividaId: d.id };
  }
  if (tipo === "recorrencia") {
    const r = recs.find((x) => x.id === id);
    if (!r) throw new Error("Recorrência não encontrada.");
    return {
      criadaId: await criarSimples({
        ...base, tipo: r.tipo === "receita" ? "receita" : "despesa", contaId: r.contaId || null, cartaoId: r.cartaoId || null,
        categoriaId: r.categoriaId, pessoaId: r.pessoaId, descricao: r.descricao, recorrenciaId: r.id,
        competencia: competenciaDeData(evento.data),
      }),
    };
  }
  throw new Error("Esse item é uma estimativa, não um compromisso que dá pra baixar.");
}
