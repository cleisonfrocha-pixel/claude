// Relatórios: pra onde o dinheiro está indo. Puro (CLAUDE.md): só lê, agrega e
// devolve números com os itens que os formam. Nada é gravado.

import { eventosFuturos } from "./previstos.js";
import { calcularSaldoAtual, classificarDivida, statusDivida } from "./dividas.js";
import { ofertaDaDivida } from "./esteira.js";
import { competenciaDeData, diasNoMes, dataDeCompetencia, somarDias } from "./tempo.js";

export const NOME_GRUPO = {
  moradia: "Moradia", transporte: "Transporte", alimentacao: "Alimentação", saude: "Saúde", educacao: "Educação",
  filho: "Filho", lazer: "Lazer", dividas: "Dívidas e parcelas", negocio: "Negócio", renda: "Renda", outros: "Outros",
};

/**
 * Tudo que sai no mês, por categoria e por grupo, separando o que já foi pago do que ainda vai sair.
 * Conta a despesa pela data da compra (cartão incluso); pagamento de fatura e transferência nunca entram
 * (já contaram nas compras). Parcela de dívida e recorrência ainda sem lançamento entram pelo calendário.
 */
export function gastosDoMes({ transacoes, categorias, dividas, recorrencias, cartoes, faturas, competencia, hoje }) {
  const cat = new Map((categorias || []).map((c) => [c.id, c]));
  const itens = [];
  for (const t of transacoes || []) {
    if (t.tipo !== "despesa" || t.status === "cancelado" || t.competencia !== competencia) continue;
    itens.push({ categoriaId: t.categoriaId || null, valorCentavos: Number(t.valorCentavos) || 0, pago: t.status === "pago", descricao: t.descricao || "Despesa", id: t.id });
  }
  if (competencia >= competenciaDeData(hoje)) {
    const inicio = `${competencia}-01`;
    const de = inicio > hoje ? inicio : hoje;
    const ate = dataDeCompetencia(competencia, diasNoMes(competencia));
    const catDividas = (categorias || []).find((c) => c.grupo === "dividas" && c.natureza === "despesa")?.id || null;
    for (const e of eventosFuturos({ transacoes, dividas, recorrencias, fontesRenda: [], cartoes, faturas, de, ate, hoje })) {
      if (e.tipo !== "despesa" || !e.virtual) continue;
      if (competenciaDeData(e.vencimento || e.data) !== competencia) continue;
      const rec = e.origem?.tipo === "recorrencia" ? (recorrencias || []).find((r) => r.id === e.origem.id) : null;
      itens.push({ semCategoriaNome: e.origem?.tipo === "cartaoUso" ? "Cartões (uso habitual)" : null, categoriaId: rec ? rec.categoriaId || null : e.origem?.tipo === "divida" ? catDividas : null, valorCentavos: Number(e.valorCentavos) || 0, pago: false, descricao: e.descricao || "Despesa", id: null });
    }
  }
  const porCat = new Map();
  for (const i of itens) {
    const k = i.categoriaId || i.semCategoriaNome || "sem";
    const c = cat.get(i.categoriaId);
    if (!porCat.has(k)) porCat.set(k, { categoriaId: i.categoriaId, nome: c?.nome || i.semCategoriaNome || "Sem categoria", grupo: c?.grupo || "outros", essencial: !!c?.essencial, totalCentavos: 0, pagoCentavos: 0, previstoCentavos: 0, itens: [] });
    const r = porCat.get(k);
    r.totalCentavos += i.valorCentavos;
    if (i.pago) r.pagoCentavos += i.valorCentavos; else r.previstoCentavos += i.valorCentavos;
    r.itens.push(i);
  }
  const total = [...porCat.values()].reduce((s, r) => s + r.totalCentavos, 0);
  const categoriasOrdenadas = [...porCat.values()].map((r) => ({ ...r, pct: total > 0 ? r.totalCentavos / total : 0, itens: r.itens.sort((a, b) => b.valorCentavos - a.valorCentavos) })).sort((a, b) => b.totalCentavos - a.totalCentavos);
  const porGrupo = new Map();
  for (const r of categoriasOrdenadas) {
    if (!porGrupo.has(r.grupo)) porGrupo.set(r.grupo, { grupo: r.grupo, nome: NOME_GRUPO[r.grupo] || r.grupo, totalCentavos: 0, pagoCentavos: 0, previstoCentavos: 0, categorias: [] });
    const g = porGrupo.get(r.grupo);
    g.categorias.push(r);
    g.totalCentavos += r.totalCentavos; g.pagoCentavos += r.pagoCentavos; g.previstoCentavos += r.previstoCentavos;
  }
  const grupos = [...porGrupo.values()].map((g) => ({ ...g, pct: total > 0 ? g.totalCentavos / total : 0 })).sort((a, b) => b.totalCentavos - a.totalCentavos);
  const pagoCentavos = categoriasOrdenadas.reduce((s, r) => s + r.pagoCentavos, 0);
  return { competencia, totalCentavos: total, pagoCentavos, previstoCentavos: total - pagoCentavos, categorias: categoriasOrdenadas, grupos, maioresItens: itens.slice().sort((a, b) => b.valorCentavos - a.valorCentavos).slice(0, 5) };
}

/** Os gastos que passam batido: assinaturas e pequenos fixos que se repetem todo mês. */
export function vazamentos({ recorrencias, categorias, limiteCentavos = 20000 }) {
  const cat = new Map((categorias || []).map((c) => [c.id, c]));
  const lista = (recorrencias || [])
    .filter((r) => r.ativa !== false && r.tipo === "despesa" && !r.semDia)
    .map((r) => ({ id: r.id, descricao: r.descricao, valorCentavos: Number(r.valorEstimadoCentavos) || 0, categoria: cat.get(r.categoriaId)?.nome || "", assinatura: /assinatura/i.test(cat.get(r.categoriaId)?.nome || "") }))
    .filter((r) => r.valorCentavos > 0 && (r.valorCentavos <= limiteCentavos || r.assinatura))
    .sort((a, b) => b.valorCentavos - a.valorCentavos);
  const mensalCentavos = lista.reduce((s, r) => s + r.valorCentavos, 0);
  return { itens: lista, mensalCentavos, anualCentavos: mensalCentavos * 12 };
}

/** De quê é feita a dívida: o que vale hoje (já com o desconto das ofertas), por dívida. */
export function composicaoDeDividas(dividas, hoje) {
  const ativas = (dividas || []).filter((d) => statusDivida(d, hoje) !== "quitada" && !d.mesmaDividaDe);
  const itens = ativas.map((d) => {
    const oferta = ofertaDaDivida(d, hoje);
    return { id: d.id, nome: d.nome, valorCentavos: calcularSaldoAtual(d, hoje), classe: classificarDivida(d, hoje), economiaCentavos: oferta && !oferta.vencida ? oferta.economiaCentavos : 0 };
  }).filter((i) => i.valorCentavos > 0).sort((a, b) => b.valorCentavos - a.valorCentavos);
  const soma = (cl) => itens.filter((i) => i.classe === cl).reduce((s, i) => s + i.valorCentavos, 0);
  return { itens, financiamentosCentavos: soma("financiamento"), problemasCentavos: soma("divida"), totalCentavos: itens.reduce((s, i) => s + i.valorCentavos, 0), economiaCentavos: itens.reduce((s, i) => s + i.economiaCentavos, 0) };
}

/** Os meses do mapa dos 12 meses, prontos para o gráfico de colunas: entra, sai e o saldo ao fim. */
export function serieMensal(linhasDoMapa) {
  return (linhasDoMapa || []).map((l) => ({ competencia: l.competencia, atual: !!l.atual, entradasCentavos: l.entradasCentavos, saidasCentavos: l.saidasCentavos, saldoFimCentavos: l.saldoFimCentavos }));
}
