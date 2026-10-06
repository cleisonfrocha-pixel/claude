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
import { compromissosPorDia } from "./calendario.js";
import { lerVerbas } from "./verbas.js";
import { dataVencimentoFatura, statusEfetivo, totaisPorFatura } from "./transacoes.js";
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

/** Itens ABERTOS do mês, tirados da MESMA linha do tempo do Início e do Plano
 * (`compromissosPorDia`): se uma conta está aberta, ela aparece aqui uma vez só e
 * pesa no "pode gastar" uma vez só. Verba do mês (repartida em semanas na linha
 * do tempo) volta a ser um item só, sem dia fixo. */
const SEM_CONTA = "__sem_conta__";

function itensAbertosDaLinhaDoTempo({ transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda, competencia, hoje, receitas }) {
  const competenciaHoje = competenciaDeData(hoje);
  if (competencia < competenciaHoje) return [];
  const fim = dataDeCompetencia(competencia, diasNoMes(competencia));
  const extras = eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda, cartoes, faturas, de: hoje, ate: fim, hoje });
  // Conta aberta sem conta de saída definida continua sendo conta a pagar.
  const comConta = (transacoes || []).map((t) => (t.contaId || t.tipo === "receita" || t.cartaoId || t.faturaId ? t : { ...t, contaId: SEM_CONTA }));
  const dias = compromissosPorDia({ transacoes: comConta, faturas, cartoes, de: hoje, ate: fim, hoje, extras });
  const inicioMes = `${competencia}-01`;
  const porVerba = new Map();
  const saida = [];
  for (const dia of dias) {
    if (dia.data < inicioMes) continue;
    for (const i of dia.itens) {
      if ((i.tipo === "receita") !== receitas) continue;
      if (i.semDia && i.transacaoId) {
        if (!porVerba.has(i.transacaoId)) {
          const unico = { ...i, valorCentavos: i.valorTotalCentavos || i.valorCentavos, vencimento: null };
          porVerba.set(i.transacaoId, unico);
          saida.push(unico);
        }
        continue;
      }
      saida.push({ ...i, dataDoEfeito: dia.data });
    }
  }
  return saida;
}

export function contasDoMes({ transacoes, faturas, cartoes, dividas, recorrencias, categorias, competencia, hoje }) {
  const itens = [];
  const competenciaHoje = competenciaDeData(hoje);
  const catPorId = new Map((categorias || []).map((c) => [c.id, c]));
  const catEssencial = (id) => !!catPorId.get(id)?.essencial || catPorId.get(id)?.grupo === "dividas";

  const novo = (base) => {
    const estado = estadoDe(base.vencimento, hoje, base.paga);
    itens.push({
      ...base, estado,
      diasAtraso: estado === "atrasada" && base.vencimento ? diasEntre(base.vencimento, hoje) : 0,
    });
  };

  // Abertas: da linha do tempo.
  for (const i of itensAbertosDaLinhaDoTempo({ transacoes, faturas, cartoes, dividas, recorrencias, fontesRenda: [], competencia, hoje, receitas: false })) {
    const rec = i.origem?.tipo === "recorrencia" ? (recorrencias || []).find((r) => r.id === i.origem.id) : null;
    if (i.tipo === "fatura") {
      novo({ chave: `f:${i.faturaId}`, tipo: "fatura", faturaId: i.faturaId, cartaoId: i.cartaoId, contaPagamentoId: i.contaPagamentoId, contaSugeridaId: i.contaPagamentoId, descricao: i.descricao, valorCentavos: i.valorCentavos, vencimento: i.vencimento, paga: false, origem: i.origem });
    } else if (i.transacaoId) {
      novo({ chave: `t:${i.transacaoId}`, tipo: "transacao", transacaoId: i.transacaoId, descricao: i.descricao, contaSugeridaId: i.contaId && i.contaId !== SEM_CONTA ? i.contaId : null, valorCentavos: i.valorCentavos, vencimento: i.vencimento, semDia: !!i.semDia, paga: false, categoriaId: i.categoriaId || null, origem: i.origem });
    } else if (i.evento) {
      const e = { ...i.evento, data: i.evento.vencimento || i.vencimento || i.evento.data };
      novo({ chave: `e:${i.origem.tipo}:${i.origem.id}:${e.data}`, tipo: "evento", evento: e, estimativa: !!e.estimativa, descricao: i.descricao, contaSugeridaId: rec?.contaId || null, valorCentavos: i.valorCentavos, vencimento: e.data, paga: false, origem: i.origem });
    }
  }

  // Verba do mês: quanto já foi gasto dela (pago na mesma categoria e mês) e o total.
  const verbas = lerVerbas(transacoes, hoje);
  for (const i of itens) {
    if (!i.semDia || i.paga || !i.transacaoId) continue;
    const v = verbas.get(i.transacaoId);
    if (!v) continue;
    i.gastoDaVerbaCentavos = v.gastoCentavos;
    i.totalDaVerbaCentavos = v.totalCentavos;
    i.valorCentavos = v.restanteCentavos;
  }

  // Pagas: o que já saiu (conta que nasceu de uma conta, ou essencial).
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status !== "pago" || t.faturaId || t.cartaoId) continue;
    const doMes = t.competencia === competencia || (t.pagoEm && competenciaDeData(t.pagoEm) === competencia);
    if (!doMes) continue;
    if (!(t.recorrenciaId || t.dividaId || t.foiPrevisto || catEssencial(t.categoriaId))) continue;
    novo({
      chave: `t:${t.id}`, tipo: "transacao", transacaoId: t.id, descricao: t.descricao || "Conta", contaSugeridaId: t.contaId || null,
      valorCentavos: Number(t.valorCentavos) || 0, vencimento: t.semDia ? null : t.data, semDia: !!t.semDia,
      paga: true, pagoEm: t.pagoEm || t.data, categoriaId: t.categoriaId || null,
      origem: t.recorrenciaId ? { tipo: "recorrencia", id: t.recorrenciaId } : t.dividaId ? { tipo: "divida", id: t.dividaId } : { tipo: "transacao", id: t.id },
    });
  }
  const cartaoPorId = new Map((cartoes || []).map((c) => [c.id, c]));
  const totais = totaisPorFatura(transacoes);
  for (const f of faturas || []) {
    if (f.status !== "paga") continue;
    const cartao = cartaoPorId.get(f.cartaoId);
    const total = (totais.get(f.id) || {}).totalCentavos || 0;
    if (!cartao || total <= 0) continue;
    const venc = dataVencimentoFatura(cartao, f.competencia);
    if (competenciaDeData(venc) !== competencia) continue;
    novo({
      chave: `f:${f.id}`, tipo: "fatura", faturaId: f.id, cartaoId: cartao.id, contaPagamentoId: cartao.contaPagamentoId || null, contaSugeridaId: cartao.contaPagamentoId || null,
      descricao: `Fatura ${cartao.apelido || "do cartão"}`, valorCentavos: total, vencimento: venc, paga: true, pagoEm: venc, origem: { tipo: "fatura", id: f.id },
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
      chave: `t:${t.id}`, tipo: "transacao", transacaoId: t.id, descricao: t.descricao || "Entrada", contaSugeridaId: t.contaId || null,
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
      const fonte = e.origem.tipo === "fonteRenda" ? (fontesRenda || []).find((f) => f.id === e.origem.id) : null;
      novo({
        chave: `e:${e.origem.tipo}:${e.origem.id}:${venc}`, tipo: "evento", evento: { ...e, data: venc }, descricao: e.descricao, contaSugeridaId: fonte?.contaId || null,
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
