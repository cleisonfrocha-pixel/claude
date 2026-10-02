// Domínio puro: as contas do mês, cada uma com seu estado. O que importa pra
// quem paga conta é saber, de relance, o que já foi (paga), o que vence hoje,
// o que ainda vem (a pagar) e o que passou do dia (atrasada). Nada é gravado:
// o estado e o progresso saem da leitura, como todo total do produto.
//
// Conta = despesa que é compromisso: lançamento previsto/agendado/atrasado,
// parcela de dívida, recorrência ainda sem lançamento e fatura de cartão.
// Compra no cartão não é conta (entra pela fatura: contar as duas é contar o
// dinheiro duas vezes). Gasto avulso já pago não é conta, a menos que tenha
// nascido de uma conta (recorrência, dívida, essencial ou baixado de previsto).

import { eventosFuturos } from "./previstos.js";
import { dataVencimentoFatura, statusEfetivo } from "./transacoes.js";
import { competenciaDeData, diasNoMes, dataDeCompetencia } from "./tempo.js";

const ABERTO = new Set(["previsto", "agendado", "atrasado"]);
export const ORDEM_ESTADOS = ["atrasada", "hoje", "a_pagar", "paga"];

function diasEntre(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}

function estadoDe(vencimento, hoje, paga) {
  if (paga) return "paga";
  if (!vencimento) return "a_pagar";
  if (vencimento < hoje) return "atrasada";
  if (vencimento === hoje) return "hoje";
  return "a_pagar";
}

export function contasDoMes({ transacoes, faturas, cartoes, dividas, recorrencias, categorias, competencia, hoje }) {
  const itens = [];
  const competenciaHoje = competenciaDeData(hoje);
  const mesAtual = competencia === competenciaHoje;
  const mesPassado = competencia < competenciaHoje;
  const catPorId = new Map((categorias || []).map((c) => [c.id, c]));
  const catEssencial = (id) => !!catPorId.get(id)?.essencial || catPorId.get(id)?.grupo === "dividas";

  const novo = (base) => {
    const estado = estadoDe(base.vencimento, hoje, base.paga);
    itens.push({
      ...base, estado,
      diasAtraso: estado === "atrasada" && base.vencimento ? diasEntre(base.vencimento, hoje) : 0,
    });
  };

  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status === "cancelado") continue;
    if (t.faturaId || t.cartaoId) continue;
    const efetivo = statusEfetivo(t, hoje);
    const aberta = ABERTO.has(efetivo);
    const paga = t.status === "pago";
    // Conta paga pertence ao mês do vencimento e também ao mês em que foi
    // paga: pagar hoje uma conta atrasada de setembro marca ponto em outubro.
    const doMes = t.competencia === competencia || (paga && t.pagoEm && competenciaDeData(t.pagoEm) === competencia);
    const atrasadaDeAntes = mesAtual && aberta && t.competencia < competencia;
    if (!doMes && !atrasadaDeAntes) continue;
    if (paga && !(t.recorrenciaId || t.dividaId || t.foiPrevisto || catEssencial(t.categoriaId))) continue;
    novo({
      chave: `t:${t.id}`, tipo: "transacao", transacaoId: t.id, descricao: t.descricao || "Conta",
      valorCentavos: Number(t.valorCentavos) || 0, vencimento: t.semDia ? null : t.data, semDia: !!t.semDia,
      paga, pagoEm: paga ? (t.pagoEm || t.data) : null, categoriaId: t.categoriaId || null,
      origem: t.recorrenciaId ? { tipo: "recorrencia", id: t.recorrenciaId } : t.dividaId ? { tipo: "divida", id: t.dividaId } : { tipo: "transacao", id: t.id },
    });
  }

  const fim = dataDeCompetencia(competencia, diasNoMes(competencia));
  if (!mesPassado) {
    for (const e of eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda: [], cartoes, de: hoje, ate: fim, hoje })) {
      if (e.tipo !== "despesa" || !e.origem || !["divida", "recorrencia"].includes(e.origem.tipo)) continue;
      const venc = e.vencimento || e.data;
      if (competenciaDeData(venc) !== competencia && !(mesAtual && e.atrasado)) continue;
      novo({
        chave: `e:${e.origem.tipo}:${e.origem.id}:${venc}`, tipo: "evento", evento: { ...e, data: venc }, descricao: e.descricao,
        valorCentavos: e.valorCentavos, vencimento: venc, paga: false, origem: e.origem,
      });
    }
  }

  const totalPorFatura = new Map();
  for (const t of transacoes || []) {
    if (!t.faturaId || t.tipo !== "despesa" || t.status === "cancelado") continue;
    totalPorFatura.set(t.faturaId, (totalPorFatura.get(t.faturaId) || 0) + (Number(t.valorCentavos) || 0));
  }
  const cartaoPorId = new Map((cartoes || []).map((c) => [c.id, c]));
  for (const f of faturas || []) {
    const cartao = cartaoPorId.get(f.cartaoId);
    const total = totalPorFatura.get(f.id) || 0;
    if (!cartao || total <= 0) continue;
    const venc = dataVencimentoFatura(cartao, f.competencia);
    const paga = f.status === "paga";
    const doMes = competenciaDeData(venc) === competencia;
    const atrasadaDeAntes = mesAtual && !paga && venc < `${competencia}-01`;
    if (!doMes && !atrasadaDeAntes) continue;
    novo({
      chave: `f:${f.id}`, tipo: "fatura", faturaId: f.id, cartaoId: cartao.id, contaPagamentoId: cartao.contaPagamentoId || null,
      descricao: `Fatura ${cartao.apelido || "do cartão"}`, valorCentavos: total, vencimento: venc, paga, pagoEm: paga ? venc : null,
      origem: { tipo: "fatura", id: f.id },
    });
  }

  itens.sort((a, b) => ORDEM_ESTADOS.indexOf(a.estado) - ORDEM_ESTADOS.indexOf(b.estado)
    || (a.vencimento || "9999").localeCompare(b.vencimento || "9999") || a.descricao.localeCompare(b.descricao));

  const soma = (l) => l.reduce((s, i) => s + i.valorCentavos, 0);
  const porEstado = (e) => itens.filter((i) => i.estado === e);
  const pagas = porEstado("paga");
  const faltam = itens.filter((i) => i.estado !== "paga");
  const totalCentavos = soma(itens);
  return {
    competencia, itens,
    grupos: Object.fromEntries(ORDEM_ESTADOS.map((e) => [e, porEstado(e)])),
    resumo: {
      quantidade: itens.length, quantidadePagas: pagas.length,
      totalCentavos, pagoCentavos: soma(pagas), faltaCentavos: soma(faltam),
      atrasadasCentavos: soma(porEstado("atrasada")), quantidadeAtrasadas: porEstado("atrasada").length,
      percentualPago: totalCentavos > 0 ? Math.round((soma(pagas) / totalCentavos) * 100) : 0,
      proxima: faltam.filter((i) => i.vencimento && i.vencimento >= hoje)[0] || null,
    },
  };
}

/**
 * O lado de quem recebe: as entradas do mês com o mesmo vocabulário de estado
 * (`paga` = recebida, `atrasada` = o dia esperado passou e não caiu, `hoje`,
 * `a_pagar` = ainda a receber). Entrada incerta aparece com `incerta: true` e
 * fica FORA dos totais (CLAUDE.md: incerto não é dinheiro garantido).
 */
export function entradasDoMes({ transacoes, fontesRenda, recorrencias, cartoes, competencia, hoje }) {
  const itens = [];
  const competenciaHoje = competenciaDeData(hoje);
  const mesAtual = competencia === competenciaHoje;
  const mesPassado = competencia < competenciaHoje;
  const novo = (base) => {
    const estado = estadoDe(base.vencimento, hoje, base.paga);
    itens.push({ ...base, estado, diasAtraso: estado === "atrasada" && base.vencimento ? diasEntre(base.vencimento, hoje) : 0 });
  };

  for (const t of transacoes || []) {
    if (t.tipo !== "receita" || t.status === "cancelado") continue;
    const paga = t.status === "pago";
    const aberta = ABERTO.has(statusEfetivo(t, hoje));
    const doMes = t.competencia === competencia || (paga && t.pagoEm && competenciaDeData(t.pagoEm) === competencia);
    const atrasadaDeAntes = mesAtual && aberta && t.competencia < competencia;
    if (!doMes && !atrasadaDeAntes) continue;
    novo({
      chave: `t:${t.id}`, tipo: "transacao", transacaoId: t.id, descricao: t.descricao || "Entrada",
      valorCentavos: Number(t.valorCentavos) || 0, vencimento: t.data, paga, pagoEm: paga ? (t.pagoEm || t.data) : null,
      incerta: !paga && t.certeza === "incerto",
      origem: t.fonteRendaId ? { tipo: "fonteRenda", id: t.fonteRendaId } : { tipo: "transacao", id: t.id },
    });
  }

  if (!mesPassado) {
    const fim = dataDeCompetencia(competencia, diasNoMes(competencia));
    for (const e of eventosFuturos({ transacoes, dividas: [], recorrencias, fontesRenda, cartoes, de: hoje, ate: fim, hoje })) {
      if (e.tipo !== "receita" || !e.origem || !["fonteRenda", "recorrencia"].includes(e.origem.tipo)) continue;
      const venc = e.vencimento || e.data;
      if (competenciaDeData(venc) !== competencia) continue;
      novo({
        chave: `e:${e.origem.tipo}:${e.origem.id}:${venc}`, tipo: "evento", evento: { ...e, data: venc }, descricao: e.descricao,
        valorCentavos: e.valorCentavos, vencimento: venc, paga: false, incerta: e.certeza === "incerto", origem: e.origem,
      });
    }
  }

  itens.sort((a, b) => ORDEM_ESTADOS.indexOf(a.estado) - ORDEM_ESTADOS.indexOf(b.estado)
    || (a.vencimento || "9999").localeCompare(b.vencimento || "9999") || a.descricao.localeCompare(b.descricao));

  const contaveis = itens.filter((i) => !i.incerta);
  const soma = (l) => l.reduce((s, i) => s + i.valorCentavos, 0);
  const pagas = contaveis.filter((i) => i.estado === "paga");
  const faltam = contaveis.filter((i) => i.estado !== "paga");
  const totalCentavos = soma(contaveis);
  const atrasadas = contaveis.filter((i) => i.estado === "atrasada");
  return {
    competencia, itens,
    grupos: Object.fromEntries(ORDEM_ESTADOS.map((e) => [e, itens.filter((i) => i.estado === e)])),
    resumo: {
      quantidade: contaveis.length, quantidadePagas: pagas.length,
      totalCentavos, pagoCentavos: soma(pagas), faltaCentavos: soma(faltam),
      atrasadasCentavos: soma(atrasadas), quantidadeAtrasadas: atrasadas.length,
      incertasCentavos: soma(itens.filter((i) => i.incerta)),
      percentualPago: totalCentavos > 0 ? Math.round((soma(pagas) / totalCentavos) * 100) : 0,
      proxima: faltam.filter((i) => i.vencimento && i.vencimento >= hoje)[0] || null,
    },
  };
}
