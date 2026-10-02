// "Recebi" e "Paguei" em um toque. Dar baixa nunca digita nada: usa o que o
// painel já sabe do compromisso (valor, conta, categoria, pessoa) e vira um
// lançamento real, pago e confirmado. O compromisso previsto deixa de
// aparecer como futuro porque agora existe um lançamento da competência.

import * as db from "./db.js";
import { criarSimples, transacoes } from "./transacoesRepo.js";
import { dividas } from "./repositorios.js";
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
export async function darBaixaTransacao(id, { hoje = hojeISO() } = {}) {
  const t = (await lerTudo("transacoes")).find((x) => x.id === id);
  if (!t) throw new Error("Lançamento não encontrado.");
  const data = t.data <= hoje ? t.data : hoje;
  await transacoes.atualizar(id, { status: "pago", certeza: "confirmado", data, competencia: t.competencia || competenciaDeData(data) });
  if (t.dividaId && t.status !== "pago") await somarParcelaPaga(t.dividaId);
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
  const base = { valorCentavos: valor, data, status: "pago", certeza: "confirmado" };
  const { tipo, id } = evento.origem || {};
  if (tipo === "fonteRenda") {
    const f = fontes.find((x) => x.id === id);
    if (!f) throw new Error("Fonte de renda não encontrada.");
    const conta = contaPadrao(contas, f.pessoaId);
    const cat = categorias.find((c) => c.natureza === "receita" && c.ativa !== false && c.id === f.categoriaId)
      || categorias.find((c) => c.natureza === "receita" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou uma categoria de receita.");
    return criarSimples({ ...base, tipo: "receita", contaId: conta.id, categoriaId: cat.id, pessoaId: f.pessoaId, descricao: f.nome, fonteRendaId: f.id });
  }
  if (tipo === "divida") {
    const d = listaDividas.find((x) => x.id === id);
    if (!d) throw new Error("Dívida não encontrada.");
    const conta = contaPadrao(contas, d.pessoaId);
    const cat = categorias.find((c) => c.grupo === "dividas" && c.natureza === "despesa" && c.ativa !== false);
    if (!conta || !cat) throw new Error("Falta uma conta ativa ou a categoria de dívidas.");
    const novo = await criarSimples({ ...base, tipo: "despesa", contaId: conta.id, categoriaId: cat.id, pessoaId: d.pessoaId, descricao: evento.descricao, dividaId: d.id });
    await somarParcelaPaga(d.id);
    return novo;
  }
  if (tipo === "recorrencia") {
    const r = recs.find((x) => x.id === id);
    if (!r) throw new Error("Recorrência não encontrada.");
    return criarSimples({
      ...base, tipo: r.tipo === "receita" ? "receita" : "despesa", contaId: r.contaId || null, cartaoId: r.cartaoId || null,
      categoriaId: r.categoriaId, pessoaId: r.pessoaId, descricao: r.descricao, recorrenciaId: r.id,
      competencia: competenciaDeData(evento.data),
    });
  }
  throw new Error("Esse item é uma estimativa, não um compromisso que dá pra baixar.");
}
